import * as mssql from 'mssql';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../../../../.env') });

const NODES_FILE = path.join(__dirname, 'data', 'nodos_limpios.json');
const EDGES_FILE = path.join(__dirname, 'data', 'aristas_limpios.json');

// SQL Server limita 2100 parámetros por query.
// Nodos: 2 params/fila  → lote de 500 = 1000 params ✓
// Aristas: 4 params/fila → lote de 250 = 1000 params ✓
const NODE_BATCH  = 500;
const EDGE_BATCH  = 250;

function progress(label: string, done: number, total: number) {
  const pct = Math.round((done / total) * 100);
  const bar = '█'.repeat(Math.floor(pct / 5)).padEnd(20, '░');
  process.stdout.write(`\r  ${label}: [${bar}] ${pct}% (${done.toLocaleString()}/${total.toLocaleString()})`);
}

async function insertNodeBatch(pool: mssql.ConnectionPool, batch: any[]) {
  const request = pool.request();
  const values: string[] = [];

  batch.forEach((n, i) => {
    request.input(`id${i}`,  mssql.BigInt,   BigInt(n.id));
    request.input(`wkt${i}`, mssql.VarChar,  `POINT(${n.lon} ${n.lat})`);
    values.push(`(@id${i}, geography::STGeomFromText(@wkt${i}, 4326), 1)`);
  });

  await request.query(
    `INSERT INTO NODOS (id_nodo, ubicacion, es_interseccion) VALUES ${values.join(',')}`
  );
}

async function insertEdgeBatch(pool: mssql.ConnectionPool, batch: any[]) {
  const request = pool.request();
  const values: string[] = [];

  batch.forEach((e, i) => {
    request.input(`eid${i}`, mssql.BigInt,  BigInt(e.id));
    request.input(`src${i}`, mssql.BigInt,  BigInt(e.source));
    request.input(`tgt${i}`, mssql.BigInt,  BigInt(e.target));
    request.input(`geo${i}`, mssql.VarChar, e._wkt);
    values.push(
      `(@eid${i}, @src${i}, @tgt${i}, geography::STGeomFromText(@geo${i}, 4326), ` +
      `geography::STGeomFromText(@geo${i}, 4326).STLength(), 1.0, 50.0)`
    );
  });

  await request.query(
    `INSERT INTO ARISTAS (id_arista, id_nodo_origen, id_nodo_destino, trayectoria, distancia_metros, peso_riesgo, velocidad_base) ` +
    `VALUES ${values.join(',')}`
  );
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
    requestTimeout:    120_000,
    connectionTimeout:  30_000,
  });

  console.log('Conectado. Leyendo archivos JSON...');

  const nodesData: any[] = JSON.parse(fs.readFileSync(NODES_FILE, 'utf-8'));
  const edgesData: any[] = JSON.parse(fs.readFileSync(EDGES_FILE, 'utf-8'));

  // Mapa O(1): id_nodo → { lat, lon }
  const nodeMap = new Map<string, { lat: number; lon: number }>();
  for (const n of nodesData) nodeMap.set(String(n.id), { lat: n.lat, lon: n.lon });

  console.log(`  Nodos leídos : ${nodesData.length.toLocaleString()}`);
  console.log(`  Aristas leídas: ${edgesData.length.toLocaleString()}`);

  try {
    // ──────────────────────────────────────────────
    // 1. NODOS
    // ──────────────────────────────────────────────
    if (ONLY_EDGES) {
      console.log('\nSaltando carga de nodos (--only-edges).');
    } else {
      console.log(`\nInsertando nodos en lotes de ${NODE_BATCH}...`);
      let nodesDone = 0;
      let nodeErrors = 0;

      for (let i = 0; i < nodesData.length; i += NODE_BATCH) {
        const batch = nodesData.slice(i, i + NODE_BATCH);
        try {
          await insertNodeBatch(pool, batch);
        } catch (err: any) {
          if (err?.number !== 2627) throw err;
          nodeErrors += batch.length;
        }
        nodesDone += batch.length;
        progress('Nodos', nodesDone, nodesData.length);
      }
      console.log(`\n  Nodos cargados. Omitidos (duplicados): ${nodeErrors}`);
    }

    // ──────────────────────────────────────────────
    // 2. ARISTAS
    // ──────────────────────────────────────────────
    console.log(`\nPreprocesando aristas...`);
    let skipped = 0;

    const validEdges = edgesData.reduce((acc: any[], e: any) => {
      if (!e.nodes || e.nodes.length < 2) { skipped++; return acc; }

      // Verificar que source y target existan en NODOS (evita FK violation)
      if (!nodeMap.has(String(e.source)) || !nodeMap.has(String(e.target))) {
        skipped++;
        return acc;
      }

      const coords = (e.nodes as string[])
        .map(nid => nodeMap.get(String(nid)))
        .filter(Boolean)
        .map((n: any) => `${n.lon} ${n.lat}`);

      if (coords.length < 2) { skipped++; return acc; }

      acc.push({ ...e, _wkt: `LINESTRING(${coords.join(', ')})` });
      return acc;
    }, []);

    console.log(`  Válidas: ${validEdges.length.toLocaleString()}  |  Omitidas: ${skipped}`);
    console.log(`\nInsertando aristas en lotes de ${EDGE_BATCH}...`);

    let edgesDone = 0;
    let edgeErrors = 0;

    for (let i = 0; i < validEdges.length; i += EDGE_BATCH) {
      const batch = validEdges.slice(i, i + EDGE_BATCH);
      try {
        await insertEdgeBatch(pool, batch);
      } catch (err: any) {
        // 2627 = PK duplicada, 547 = FK violation (nodo no existe)
        if (err?.number !== 2627 && err?.number !== 547) throw err;
        edgeErrors += batch.length;
      }
      edgesDone += batch.length;
      progress('Aristas', edgesDone, validEdges.length);
    }
    console.log(`\n  Aristas cargadas. Omitidas (duplicados): ${edgeErrors}`);

    console.log('\n✔ ETL completado exitosamente.');

  } catch (error) {
    console.error('\n✘ Error crítico en ETL:', error);
  } finally {
    await pool.close();
  }
}

seedDatabase();