import * as fs from 'fs';
import * as path from 'path';

const NODES_FILE = path.join(__dirname, 'data', 'nodos_limpios.json');
const EDGES_FILE = path.join(__dirname, 'data', 'aristas_limpios.json');
const GEOJSON_OUTPUT = path.join(__dirname, 'data', 'mapa_completo_quito.geojson'); // Nombre nuevo

async function generateVisualValidation() {
  console.log('Generando validación visual COMPLETA (Esto puede tardar)...');

  if (!fs.existsSync(NODES_FILE) || !fs.existsSync(EDGES_FILE)) {
    console.error('Error: Ejecuta primero npm run etl:clean');
    return;
  }

  const nodes = JSON.parse(fs.readFileSync(NODES_FILE, 'utf-8'));
  const edges = JSON.parse(fs.readFileSync(EDGES_FILE, 'utf-8'));

  // Mapa rápido de nodos
  const nodeMap = new Map();
  nodes.forEach((n: any) => nodeMap.set(n.id, [n.lon, n.lat]));

  const geojson = {
    type: 'FeatureCollection',
    features: [] as any[]
  };

  let count = 0;
  
  for (const edge of edges) { 
    const coordinates = edge.nodes
      .map((nodeId: string) => nodeMap.get(nodeId))
      .filter((coord: any) => coord !== undefined);

    if (coordinates.length > 1) {
      geojson.features.push({
        type: 'Feature',
        properties: {
          id: edge.id,
          tipo: edge.type 
        },
        geometry: {
          type: 'LineString',
          coordinates: coordinates
        }
      });
      count++;
    }
  }

  fs.writeFileSync(GEOJSON_OUTPUT, JSON.stringify(geojson));
  console.log(`Archivo COMPLETO generado: ${GEOJSON_OUTPUT}`);
  console.log(`Se incluyeron ${count} calles (100% de tu data).`);
  console.log('Úsalo en https://kepler.gl/demo para visualizar grandes volúmenes.');
}

generateVisualValidation();