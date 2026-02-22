import { Entity, PrimaryColumn, Column, Index } from 'typeorm';

@Entity('NODOS')
export class Nodo {
  @PrimaryColumn({ type: 'bigint' })
  id_nodo: string; // TypeORM maneja BigInt como string para precisión

  @Index('SPATIAL_IX_Nodos_Ubicacion') 
  @Column({ type: 'geography', spatialFeatureType: 'Point', srid: 4326 })
  ubicacion: string;

  @Column({ type: 'bit', default: 1 })
  es_interseccion: boolean;
}