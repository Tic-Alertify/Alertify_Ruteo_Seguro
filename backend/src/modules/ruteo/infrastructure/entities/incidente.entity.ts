import { Entity, PrimaryColumn, Column, Index } from 'typeorm';

@Entity('INCIDENTES')
export class Incidente {

  @PrimaryColumn({ type: 'uniqueidentifier' }) 
  id_incidente: string;

  // Coincide con tu script: SPATIAL_IX_Incidentes_Ubicacion
  @Index('SPATIAL_IX_Incidentes_Ubicacion') 
  @Column({ 
    type: 'geography', 
    spatialFeatureType: 'Point', 
    srid: 4326 
  })
  ubicacion: string; // TypeORM maneja la geometría como string WKT (Well-Known Text)

  @Column({ type: 'datetime' })
  fecha_reporte: Date;

  @Column({ type: 'int' })
  nivel_gravedad: number;

  @Column({ type: 'varchar', length: 100 })
  tipo: string;
}