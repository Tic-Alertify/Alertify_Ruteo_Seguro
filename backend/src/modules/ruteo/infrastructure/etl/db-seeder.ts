import * as mssql from 'mssql';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../../../../.env') });

const NODES_FILE = path.join(__dirname, 'data', 'nodos_limpios.json');
const EDGES_FILE = path.join(__dirname, 'data', 'aristas_limpios.json');

const NODE_BATCH  = 1000;
const EDGE_BATCH  = 50000;

function progress(label: string, done: number, total: number) {
  const pct = Math.round((done / total) * 100);
  const bar = '█'.repeat(Math.floor(pct / 5)).padEnd(20, '░');
  process.stdout.write(`\r  ${label}: [${bar}] ${pct}% (${done.toLocaleString()}/${total.toLocaleString()})`);
}

async function executeWithRetry(operation: () => Promise<void>, maxRetries = 5, baseDelay = 2000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await operation();
      return; 
    } catch (error: any) {
      const isTransient = 
        error.code === 'ECONNRESET' || error.code === 'ETIMEOUT' || error.code === 'ESOCKETTIMEDOUT' ||
        error.number === 'ECONNRESET' || error.name === 'TimeoutError' ||
        error.message?.includes('socket') || error.message?.includes('timeout');

      if (!isTransient || attempt === maxRetries) throw error;
      console.log(`\n  [Azure ocupado] Conexión inestable (Intento ${attempt}/${maxRetries}). Pausando ${baseDelay * attempt}ms...`);
      await new Promise(resolve => setTimeout(resolve, baseDelay * attempt));
    }
  }
}

function calcularDistancia(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

async function insertNodeBatch(pool: mssql.ConnectionPool, batch: any[]) {
  const request = pool.request();
  const values: string[] = [];
  batch.forEach((n, i) => {
    request.input(`id${i}`,  mssql.BigInt,   BigInt(n.id));
    request.input(`wkt${i}`, mssql.VarChar,  `POINT(${n.lon} ${n.lat})`);
    values.push(`(@id${i}, geography::STGeomFromText(@wkt${i}, 4326), 1)`);
  });
  await request.query(`INSERT INTO NODOS (id_nodo, ubicacion, es_interseccion) VALUES ${values.join(',')}`);
}

const ONLY_EDGES = process.argv.includes('--only-edges');

async function seedDatabase() {
  console.log('Conectando a Azure SQL...');

  const pool = await mssql.connect({
    server:   process.env.DB_HOST!,
    port:     1433,
    user:     process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    database: process.env.DB_NAME!,
    options:  { encrypt: true, trustServerCertificate: false },
    requestTimeout:    1200_000, 
    connectionTimeout: 60_000,
    pool: { max: 10, min: 1, idleTimeoutMillis: 60000, acquireTimeoutMillis: 120000 }
  });

  console.log('Conectado. Leyendo archivos JSON...');

  const nodesData: any[] = JSON.parse(fs.readFileSync(NODES_FILE, 'utf-8'));
  const edgesData: any[] = JSON.parse(fs.readFileSync(EDGES_FILE, 'utf-8'));

  const nodeMap = new Map<string, { lat: number; lon: number }>();
  for (const n of nodesData) nodeMap.set(String(n.id), { lat: n.lat, lon: n.lon });

  try {
    // 1. CARGA DE NODOS (Se saltará si usas --only-edges)
    if (ONLY_EDGES) {
      console.log('\n[INFO] Saltando carga de nodos (--only-edges). Procesando SOLO ARISTAS...');
      await executeWithRetry(async () => {
        await pool.request().query('TRUNCATE TABLE dbo.ARISTAS;');
      });
      console.log('Tabla ARISTAS limpiada.');
    } else {
      console.log('\nLimpiando base de datos completa (Nodos y Aristas)...');
      await executeWithRetry(async () => {
        await pool.request().query(`
          TRUNCATE TABLE dbo.ARISTAS;
          DELETE FROM dbo.NODOS;
        `);
      });
      console.log('Base de datos vaciada correctamente.');

      console.log(`\nInsertando nodos en lotes seguros de ${NODE_BATCH}...`);
      let nodesDone = 0;
      let nodeErrors = 0;

      for (let i = 0; i < nodesData.length; i += NODE_BATCH) {
        const batch = nodesData.slice(i, i + NODE_BATCH);
        try {
          await executeWithRetry(() => insertNodeBatch(pool, batch));
        } catch (err: any) {
          if (err?.number !== 2627) throw err;
          nodeErrors += batch.length;
        }
        nodesDone += batch.length;
        progress('Nodos', nodesDone, nodesData.length);
        
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      console.log(`\n  Nodos cargados. Omitidos (duplicados): ${nodeErrors}`);
    }

    // 2. PREPROCESAMIENTO
    console.log(`\nPreprocesando aristas (Segmentación, Reglas de Tránsito y Distancia)...`);
    const validEdges: any[] = [];
    edgesData.forEach((e: any) => {
      const nodes = e.nodes as string[];
      if (!nodes || nodes.length < 2) return;

      const isOneWay = e.oneway === 'yes' || e.oneway === 'true' || e.oneway === '1';
      const isReverseOneWay = e.oneway === '-1';

      for (let i = 0; i < nodes.length - 1; i++) {
        const sourceId = String(nodes[i]);
        const targetId = String(nodes[i + 1]);
        const sourceCoord = nodeMap.get(sourceId);
        const targetCoord = nodeMap.get(targetId);

        if (!sourceCoord || !targetCoord) continue; 

        const distMetros = calcularDistancia(sourceCoord.lat, sourceCoord.lon, targetCoord.lat, targetCoord.lon);
        const wktNormal = `LINESTRING(${sourceCoord.lon} ${sourceCoord.lat}, ${targetCoord.lon} ${targetCoord.lat})`;
        const wktInverso = `LINESTRING(${targetCoord.lon} ${targetCoord.lat}, ${sourceCoord.lon} ${sourceCoord.lat})`;

        if (!isReverseOneWay) {
          validEdges.push({ id: `${e.id}_${i}`, source: sourceId, target: targetId, _wkt: wktNormal, dist: distMetros });
        }
        if (!isOneWay) {
          validEdges.push({ id: `${e.id}_${i}_inv`, source: targetId, target: sourceId, _wkt: wktInverso, dist: distMetros });
        }
      }
    });

    console.log(`  Segmentos Válidos a subir: ${validEdges.length.toLocaleString()}`);

    // 3. TABLA STAGING (Ahora con un id_temp numérico para iterar)
    console.log(`\nPreparando base de datos para Carga Masiva (Bulk Insert)...`);
    await executeWithRetry(async () => {
      await pool.request().query(`
        IF OBJECT_ID('dbo.ARISTAS_STAGING', 'U') IS NOT NULL DROP TABLE dbo.ARISTAS_STAGING;
      `);
    });

    // 4. BULK INSERT EN LOTES
    console.log(`\nSubiendo datos hacia la tabla temporal en lotes de ${EDGE_BATCH.toLocaleString()}...`);
    let edgesDone = 0;
    let globalCounter = 1; // Contador maestro para Azure

    for (let i = 0; i < validEdges.length; i += EDGE_BATCH) {
      const batch = validEdges.slice(i, i + EDGE_BATCH);
      const table = new mssql.Table('ARISTAS_STAGING');
      table.create = (i === 0); 

      // Agregamos nuestra propia llave primaria secuencial
      table.columns.add('id_temp', mssql.Int, { nullable: false });
      table.columns.add('id_arista', mssql.VarChar(255), { nullable: false });
      table.columns.add('id_nodo_origen', mssql.VarChar(255), { nullable: false });
      table.columns.add('id_nodo_destino', mssql.VarChar(255), { nullable: false });
      table.columns.add('wkt', mssql.VarChar(8000), { nullable: false });
      table.columns.add('distancia_metros', mssql.Float, { nullable: false });
      table.columns.add('peso_riesgo', mssql.Float, { nullable: false });
      table.columns.add('velocidad_base', mssql.Float, { nullable: false });

      batch.forEach(e => {
        table.rows.add(
          globalCounter++, // Generamos el ID aquí mismo
          String(e.id), String(e.source), String(e.target), String(e._wkt), Number(e.dist), 1.0, 50.0
        );
      });

      await executeWithRetry(() => pool.request().bulk(table));
      edgesDone += batch.length;
      progress('Aristas (Bulk)', edgesDone, validEdges.length);
    }

    // 5. TRANSFORMACIÓN ESPACIAL EN LOTES PROTEGIDOS
    console.log(`\n\n¡Subida completada! Transformando datos a Geografía Espacial en lotes para proteger la memoria de Azure...`);
    
    let transformed = 0;
    const TRANSFORM_BATCH = 50000; 
    const totalRows = validEdges.length;

    for (let j = 0; j < totalRows; j += TRANSFORM_BATCH) {
      const startId = j;
      const endId = j + TRANSFORM_BATCH;

      await executeWithRetry(async () => {
        await pool.request().query(`
          INSERT INTO dbo.ARISTAS (id_arista, id_nodo_origen, id_nodo_destino, trayectoria, distancia_metros, peso_riesgo, velocidad_base)
          SELECT
            id_arista, 
            CAST(id_nodo_origen AS BIGINT), 
            CAST(id_nodo_destino AS BIGINT),
            geography::STGeomFromText(wkt, 4326),
            distancia_metros, peso_riesgo, velocidad_base
          FROM dbo.ARISTAS_STAGING
          WHERE id_temp > ${startId} AND id_temp <= ${endId};
        `);
      });

      transformed += TRANSFORM_BATCH;
      if (transformed > totalRows) transformed = totalRows;
      progress('Transformación Espacial', transformed, totalRows);
      
      await new Promise(r => setTimeout(r, 500)); // Micro-descanso para Azure
    }

    console.log(`\n\nLimpiando datos temporales...`);
    await pool.request().query('DROP TABLE dbo.ARISTAS_STAGING;');

    console.log('\nETL COMPLETADO EXISTOSAMENTE. ¡Tu red vial está 100% lista!');

  } catch (error) {
    console.error('\nError crítico en ETL:', error);
  } finally {
    await pool.close();
  }
}

seedDatabase();