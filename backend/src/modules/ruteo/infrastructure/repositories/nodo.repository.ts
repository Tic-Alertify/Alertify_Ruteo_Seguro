import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Nodo } from '../entities/nodo.entity';
import { NodoDomain } from '../../domain/entities/nodo.domain';
import { INodoRepository } from '../../domain/interfaces/nodo-repository.interfaces';

/** Extrae lat y lng desde el texto WKT 'POINT(lng lat)' devuelto por Azure SQL */
function parsearUbicacionWkt(wkt: string): { lat: number; lng: number } {
  const contenido = wkt.replace(/^POINT\s*\(/i, '').replace(')', '').trim();
  const partes = contenido.split(/\s+/);
  return { lng: parseFloat(partes[0]), lat: parseFloat(partes[1]) };
}

@Injectable()
export class NodoRepository implements INodoRepository {
  private readonly logger = new Logger(NodoRepository.name);

  constructor(
    @InjectRepository(Nodo)
    private readonly nodoRepo: Repository<Nodo>,
  ) {}

  /**
   * NUEVO: Extrae SOLO los nodos que están dentro de un cuadrante geográfico (Bounding Box).
   * Aprovecha al 100% el índice espacial SPATIAL_IX_Nodos_Ubicacion.
   */
  async findNodosEnBoundingBox(minLat: number, minLng: number, maxLat: number, maxLng: number): Promise<NodoDomain[]> {
    this.logger.debug(`Extrayendo nodos en Bounding Box: [${minLat}, ${minLng}] a [${maxLat}, ${maxLng}]`);

    // Polígono WKT del Bounding Box
    const bboxWkt = `POLYGON((${minLng} ${minLat}, ${maxLng} ${minLat}, ${maxLng} ${maxLat}, ${minLng} ${maxLat}, ${minLng} ${minLat}))`;

    const query = `
      SELECT 
        id_nodo, 
        ubicacion.STAsText() AS ubicacion_wkt, 
        es_interseccion 
      FROM dbo.NODOS
      WHERE ubicacion.Filter(geography::STGeomFromText(@0, 4326)) = 1
    `;

    const filas: Array<any> = await this.nodoRepo.manager.query(query, [bboxWkt]);
    this.logger.debug(`Se encontraron ${filas.length} nodos en el cuadrante.`);

    return filas.map((f) => {
      const { lat, lng } = parsearUbicacionWkt(f.ubicacion_wkt);
      return new NodoDomain({ 
        id: String(f.id_nodo), 
        esInterseccion: Boolean(f.es_interseccion), 
        lat, 
        lng 
      });
    });
  }

  /**
   * Encuentra el nodo de intersección más cercano usando SQL nativo e Índice Espacial.
   */
/**
   * Encuentra el nodo de intersección más cercano usando SQL nativo e Índice Espacial.
   * Optimizado con EXISTS para hacer el chequeo de conectividad en 1 solo viaje a la BD.
   */
  async findNodoMasCercano(latitud: number, longitud: number): Promise<NodoDomain> {
    const wkt = `POINT(${longitud} ${latitud})`;
    
    // 1. Un solo viaje a la BD: Busca el nodo más cercano que SÍ tenga calles conectadas
    const query = `
      SELECT TOP 1
        id_nodo,
        ubicacion.STAsText() AS ubicacion_wkt,
        es_interseccion
      FROM dbo.NODOS N WITH(INDEX(SPATIAL_IX_Nodos_Ubicacion))
      WHERE es_interseccion = 1
        AND ubicacion.STDistance(geography::STGeomFromText(@0, 4326)) <= 3000
        AND (
          EXISTS (SELECT 1 FROM dbo.ARISTAS A WHERE A.id_nodo_origen = N.id_nodo) OR
          EXISTS (SELECT 1 FROM dbo.ARISTAS A WHERE A.id_nodo_destino = N.id_nodo)
        )
      ORDER BY ubicacion.STDistance(geography::STGeomFromText(@0, 4326)) ASC
    `;

    let filas: Array<any> = await this.nodoRepo.manager.query(query, [wkt]);

    // Fallback si estás en medio de la nada a más de 3km de una calle
    if (filas.length === 0) {
      this.logger.warn(`No se encontraron nodos a 3km de (${latitud}, ${longitud}). Ampliando búsqueda...`);
      const sqlFallback = `
        SELECT TOP 1
          id_nodo,
          ubicacion.STAsText() AS ubicacion_wkt,
          es_interseccion
        FROM dbo.NODOS N
        WHERE es_interseccion = 1
          AND (
            EXISTS (SELECT 1 FROM dbo.ARISTAS A WHERE A.id_nodo_origen = N.id_nodo) OR
            EXISTS (SELECT 1 FROM dbo.ARISTAS A WHERE A.id_nodo_destino = N.id_nodo)
          )
        ORDER BY ubicacion.STDistance(geography::STGeomFromText(@0, 4326)) ASC
      `;
      filas = await this.nodoRepo.manager.query(sqlFallback, [wkt]);
    }

    if (filas.length === 0) {
      throw new Error('No se encontraron nodos cercanos conectados a la red vial.');
    }

    // 2. Mapeamos directamente el único resultado ganador
    const { lat, lng } = parsearUbicacionWkt(filas[0].ubicacion_wkt);
    return new NodoDomain({
      id: String(filas[0].id_nodo),
      esInterseccion: Boolean(filas[0].es_interseccion),
      lat,
      lng,
    });
  }

  /**
   * Devuelve un nodo por su ID. Null si no existe.
   */
  async findById(id: string): Promise<NodoDomain | null> {
    const nodo = await this.nodoRepo.findOne({ where: { id_nodo: id } });
    if (!nodo) return null;
    const { lat, lng } = parsearUbicacionWkt(nodo.ubicacion.toString());
    return new NodoDomain({ id: String(nodo.id_nodo), esInterseccion: Boolean(nodo.es_interseccion), lat, lng });
  }

  /**
   * Extrae TODOS los nodos del grafo.
   * ADVERTENCIA: Usar con cuidado con 1.8 millones de registros.
   */
  async findAll(): Promise<NodoDomain[]> {
    this.logger.warn('Ejecutando findAll() - PELIGRO: Extrayendo millones de nodos...');
    const filas: Array<{ id_nodo: string; ubicacion_wkt: string; es_interseccion: boolean }> =
      await this.nodoRepo.manager.query(
        `SELECT id_nodo, ubicacion.STAsText() AS ubicacion_wkt, es_interseccion FROM dbo.NODOS`,
      );

    return filas.map((f) => {
      const { lat, lng } = parsearUbicacionWkt(f.ubicacion_wkt);
      return new NodoDomain({ id: String(f.id_nodo), esInterseccion: Boolean(f.es_interseccion), lat, lng });
    });
  }
}