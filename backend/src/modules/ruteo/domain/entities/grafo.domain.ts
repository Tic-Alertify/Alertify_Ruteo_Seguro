import { NodoDomain } from './nodo.domain';

/**
 * Representa una arista del grafo con su peso compuesto.
 */
export class AristaDomain {

  idArista: string;
  idNodoOrigen: string;
  idNodoDestino: string;
  distanciaMetros: number;
  pesoRiesgo: number = 1.0;   // escala 1.0 (sin riesgo) → N (muy peligroso)
  velocidadBase: number; // km/h

  /** Peso final que usa el algoritmo: distancia ponderada por riesgo */
  get pesoTotal(): number {
    return this.distanciaMetros * this.pesoRiesgo;
  }
}

/**
 * Lista de adyacencia para el algoritmo de ruteo (A* / Dijkstra).
 */
export class GrafoDomain {
  /** Nodos indexados por id para acceso O(1) */
  nodos: Map<string, NodoDomain> = new Map();

  /** Aristas agrupadas por nodo origen para recorrido eficiente */
  aristas: Map<string, AristaDomain[]> = new Map();

  agregarNodo(nodo: NodoDomain): void {
    this.nodos.set(nodo.id, nodo);
  }

    agregarArista(arista: AristaDomain): void {
      const lista = this.aristas.get(arista.idNodoOrigen) ?? [];
      lista.push(arista);
      this.aristas.set(arista.idNodoOrigen, lista);
    }

  getVecinos(idNodo: string): AristaDomain[] {
    return this.aristas.get(idNodo) ?? [];
  }
}