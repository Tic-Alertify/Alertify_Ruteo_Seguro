import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Nodo } from './nodo.entity';

@Entity('ARISTAS')
export class Arista {
 @PrimaryColumn({ type: 'varchar', length: 100 })
  id_arista: string; // NO es autogenerado, usaremos el ID de OSM

  @Column({ type: 'bigint' })
  id_nodo_origen: string;

  @Column({ type: 'bigint' })
  id_nodo_destino: string;

  @Index('SPATIAL_IX_Aristas_Geometria') 
  @Column({ type: 'geography', spatialFeatureType: 'LineString', srid: 4326 })
  trayectoria: string; 

  @Column({ type: 'float' })
  distancia_metros: number;

  @Column({ type: 'float', default: 1.0 })
  peso_riesgo: number;

  @Column({ type: 'float', nullable: true })
  velocidad_base: number; 

  // Relaciones (opcional para el ETL, vital para el ruteo)
  @ManyToOne(() => Nodo)
  @JoinColumn({ name: 'id_nodo_origen' })
  nodoOrigen: Nodo;

  @ManyToOne(() => Nodo)
  @JoinColumn({ name: 'id_nodo_destino' })
  nodoDestino: Nodo;
}