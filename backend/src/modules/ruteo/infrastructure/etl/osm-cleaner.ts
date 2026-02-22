import * as fs from 'fs';
import * as path from 'path';
import * as sax from 'sax';

const INPUT_FILE = path.join(__dirname, 'data', 'quito.osm');
const NODES_OUTPUT = path.join(__dirname, 'data', 'nodos_limpios.json');
const EDGES_OUTPUT = path.join(__dirname, 'data', 'aristas_limpios.json');

const ALLOWED_HIGHWAYS = [
  // ── Vehículos motorizados ──────────────────────────────────────────────────
  'motorway',       // Autopistas de alta velocidad
  'motorway_link',  // Ramales de autopista
  'trunk',          // Vías troncales
  'trunk_link',     // Ramales de vías troncales
  'primary',        // Avenidas principales
  'primary_link',   // Ramales de avenidas principales
  'secondary',      // Vías secundarias
  'secondary_link', // Ramales de vías secundarias
  'tertiary',       // Vías terciarias
  'tertiary_link',  // Ramales de vías terciarias
  'unclassified',   // Sin clasificar (calles de barrio)
  'residential',    // Calles residenciales
  'service',        // Vías de servicio (accesos, parqueaderos)
  // ── Peatones ──────────────────────────────────────────────────────────────
  'living_street',  // Calles de convivencia (prioridad peatonal)
  'pedestrian',     // Zonas peatonales (parques, plazas)
  'footway',        // Aceras y caminos peatonales
  'path',           // Senderos genéricos (peatones/ciclistas)
  'steps',          // Escaleras
  // ── Ciclistas ─────────────────────────────────────────────────────────────
  'cycleway',       // Ciclovías
];

async function cleanMap() {
  console.log('Iniciando limpieza de cartografía de Quito...');

  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`Error: No se encuentra el archivo en: ${INPUT_FILE}`);
    return;
  }

  // ── PASO 1: Primera pasada — indexar nodos (id -> lat/lon) ──────────────────
  console.log('Pasada 1/2: Indexando nodos geográficos...');
  const nodeMap = new Map<string, { lat: number; lon: number }>();

  await new Promise<void>((resolve, reject) => {
    const parser = sax.createStream(true); // strict mode
    let nodeCount = 0;

    parser.on('opentag', (tag) => {
      if (tag.name === 'node' && tag.attributes.id) {
        nodeMap.set(tag.attributes.id as string, {
          lat: parseFloat(tag.attributes.lat as string),
          lon: parseFloat(tag.attributes.lon as string),
        });
        nodeCount++;
        if (nodeCount % 500_000 === 0) {
          console.log(`  -> ${nodeCount.toLocaleString()} nodos indexados...`);
        }
      }
    });

    parser.on('end', () => {
      console.log(`  Pasada 1 completada: ${nodeCount.toLocaleString()} nodos totales.`);
      resolve();
    });
    parser.on('error', reject);

    fs.createReadStream(INPUT_FILE).pipe(parser);
  });

  // ── PASO 2: Segunda pasada — filtrar ways (aristas) ────────────────────────
  console.log('Pasada 2/2: Filtrando vías y reconstruyendo topología...');

  const cleanEdges: any[] = [];
  const usedNodeIds = new Set<string>();

  await new Promise<void>((resolve, reject) => {
    const parser = sax.createStream(true);

    let currentWay: { id: string; refs: string[]; tags: Record<string, string> } | null = null;
    let wayCount = 0;

    parser.on('opentag', (tag) => {
      if (tag.name === 'way') {
        currentWay = { id: tag.attributes.id as string, refs: [], tags: {} };
      } else if (tag.name === 'nd' && currentWay) {
        currentWay.refs.push(tag.attributes.ref as string);
      } else if (tag.name === 'tag' && currentWay) {
        currentWay.tags[tag.attributes.k as string] = tag.attributes.v as string;
      }
    });

    parser.on('closetag', (tagName) => {
      if (tagName === 'way' && currentWay) {
        const highwayType = currentWay.tags['highway'] || '';

        if (ALLOWED_HIGHWAYS.includes(highwayType) && currentWay.refs.length >= 2) {
          const validRefs = currentWay.refs.filter((ref) => nodeMap.has(ref));

          if (validRefs.length === currentWay.refs.length) {
            cleanEdges.push({
              id: currentWay.id,
              source: validRefs[0],
              target: validRefs[validRefs.length - 1],
              nodes: validRefs,
              type: highwayType,
            });

            validRefs.forEach((ref) => usedNodeIds.add(ref));
            wayCount++;

            if (wayCount % 10_000 === 0) {
              console.log(`  -> ${wayCount.toLocaleString()} vías válidas encontradas...`);
            }
          }
        }

        currentWay = null;
      }
    });

    parser.on('end', () => {
      console.log(`  Pasada 2 completada: ${wayCount.toLocaleString()} aristas válidas.`);
      resolve();
    });
    parser.on('error', reject);

    fs.createReadStream(INPUT_FILE).pipe(parser);
  });

  // ── PASO 3: Filtrar nodos huérfanos ────────────────────────────────────────
  console.log('Limpiando nodos huérfanos...');
  const cleanNodes: any[] = [];

  usedNodeIds.forEach((id) => {
    const coords = nodeMap.get(id);
    if (coords) {
      cleanNodes.push({ id, lat: coords.lat, lon: coords.lon });
    }
  });

  // ── PASO 4: Escribir archivos de salida ────────────────────────────────────
  console.log('Escribiendo archivos JSON...');
  fs.writeFileSync(NODES_OUTPUT, JSON.stringify(cleanNodes));
  fs.writeFileSync(EDGES_OUTPUT, JSON.stringify(cleanEdges));

  console.log(`\n Proceso completado:`);
  console.log(`   Nodos  : ${cleanNodes.length.toLocaleString()} → nodos_limpios.json`);
  console.log(`   Aristas: ${cleanEdges.length.toLocaleString()} → aristas_limpios.json`);
}

cleanMap().catch((err) => console.error('Error fatal en osm-cleaner:', err));