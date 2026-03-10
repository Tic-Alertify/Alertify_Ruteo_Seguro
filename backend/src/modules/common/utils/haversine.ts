/**
 * Calcula la distancia en metros entre dos puntos geográficos
 * usando la fórmula de Haversine.
 *
 * Se usa como heurística admisible en el algoritmo A*:
 * la distancia en línea recta es siempre ≤ la distancia real por carretera.
 */

const RADIO_TIERRA_METROS = 6_371_000;

export function haversineMetros(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = aRad(lat2 - lat1);
  const dLng = aRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aRad(lat1)) * Math.cos(aRad(lat2)) * Math.sin(dLng / 2) ** 2;

  return 2 * RADIO_TIERRA_METROS * Math.asin(Math.sqrt(a));
}

function aRad(grados: number): number {
  return (grados * Math.PI) / 180;
}
