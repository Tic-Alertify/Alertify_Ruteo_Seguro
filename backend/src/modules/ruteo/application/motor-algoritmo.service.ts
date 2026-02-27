import { Injectable } from '@nestjs/common';
import { GrafoDomain } from '../domain/entities/grafo.domain';

export interface ResultadoRuta {
  /** Polilínea codificada en formato Google Encoded Polyline */
  rutaGeometria: string;
  distanciaMetros: number;
  tiempoEstimadoMinutos: number;
  nivelRiesgo: number; // promedio ponderado de peso_riesgo de las aristas recorridas
  idsNodosRuta: string[];
}

@Injectable()
export class MotorAlgoritmoService {
  /**
   * Algoritmo A-star / Dijkstra ponderado por peso_riesgo.
   * @param idOrigen  ID del nodo de partida (nodo más cercano al GPS de origen)
   * @param idDestino ID del nodo de destino (nodo más cercano al GPS de destino)
   * @param grafo     Grafo de adyacencia precargado en memoria
   */
  async calcularRutaSegura(
    idOrigen: string,
    idDestino: string,
    grafo: GrafoDomain,
  ): Promise<ResultadoRuta> {
    // TODO (T-06): implementar A* / Dijkstra sobre GrafoDomain
    throw new Error('T-06 pendiente: Algoritmo A* aún no implementado');
  }
}