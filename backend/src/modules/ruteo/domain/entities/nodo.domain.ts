/**
 * Entidad de dominio puro — no depende de TypeORM ni de ninguna infraestructura.
 * Representa un nodo (intersección) dentro del grafo de ruteo.
 */
export class NodoDomain {
  id: string;
  lat: number;
  lng: number;
  esInterseccion: boolean;

  constructor(partial: Partial<NodoDomain>) {
    Object.assign(this, partial);
  }
}