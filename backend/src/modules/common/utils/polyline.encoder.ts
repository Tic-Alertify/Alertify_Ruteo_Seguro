/**
 * Implementación del algoritmo Google Encoded Polyline.
 * https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 *
 * Convierte un array de coordenadas [lat, lng] a la cadena codificada que
 * consume el SDK de Google Maps en Android/iOS.
 */

export function encodePolyline(coordenadas: [number, number][]): string {
  let resultado = '';
  let latPrev = 0;
  let lngPrev = 0;

  for (const [lat, lng] of coordenadas) {
    const latRedondeado = Math.round(lat * 1e5);
    const lngRedondeado = Math.round(lng * 1e5);
    resultado += codificarValor(latRedondeado - latPrev);
    resultado += codificarValor(lngRedondeado - lngPrev);
    latPrev = latRedondeado;
    lngPrev = lngRedondeado;
  }

  return resultado;
}

function codificarValor(valor: number): string {
  let v = valor < 0 ? ~(valor << 1) : valor << 1;
  let codificado = '';
  while (v >= 0x20) {
    codificado += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>= 5;
  }
  codificado += String.fromCharCode(v + 63);
  return codificado;
}
