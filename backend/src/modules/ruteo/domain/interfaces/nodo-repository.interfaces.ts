import { NodoDomain } from '../entities/nodo.domain';
import { AristaDomain } from '../entities/grafo.domain';

export interface INodoRepository {
  /**
   * Devuelve el nodo de intersección más cercano a las coordenadas GPS.
   * Aprovecha el índice espacial SPATIAL_IX_Nodos_Ubicacion.
   */
  findNodoMasCercano(lat: number, lng: number): Promise<NodoDomain>;

  /**
   * Devuelve un nodo por su ID. Null si no existe.
   */
  findById(id: string): Promise<NodoDomain | null>;
}

export interface IAristaRepository {
  /**
   * Devuelve todas las aristas que parten de un nodo dado.
   * Usa el índice FK_Aristas_NodoOrigen (tabla ARISTAS del script SQL).
   */
  findByNodoOrigen(idNodo: string): Promise<AristaDomain[]>;
}