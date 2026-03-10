import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Arista } from '../entities/arista.entity';
import { AristaDomain } from '../../domain/entities/grafo.domain';

@Injectable()
export class AristaRepository {
  private readonly logger = new Logger(AristaRepository.name);

  constructor(
    @InjectRepository(Arista)
    private readonly aristaRepo: Repository<Arista>,
  ) {}

  /**
   * NUEVO: Extrae SOLO las calles que están dentro de un cuadrante geográfico (Bounding Box).
   * Aprovecha al 100% el índice espacial SPATIAL_IX_Aristas_Geometria.
   * En lugar de descargar 3.8 millones de calles, solo descarga las necesarias para la ruta.
   */
  async findAristasEnBoundingBox(minLat: number, minLng: number, maxLat: number, maxLng: number): Promise<AristaDomain[]> {
    this.logger.debug(`Extrayendo aristas en Bounding Box: [${minLat}, ${minLng}] a [${maxLat}, ${maxLng}]`);

    // Polígono cerrado (WKT) que dibuja el rectángulo en el mapa. 
    // Orden de puntos: Abajo-Izquierda, Abajo-Derecha, Arriba-Derecha, Arriba-Izquierda, Abajo-Izquierda (cierre)
    const bboxWkt = `POLYGON((${minLng} ${minLat}, ${maxLng} ${minLat}, ${maxLng} ${maxLat}, ${minLng} ${maxLat}, ${minLng} ${minLat}))`;

  const query = `
      SELECT 
        id_arista, 
        id_nodo_origen, 
        id_nodo_destino, 
        distancia_metros, 
        peso_riesgo, 
        velocidad_base 
      FROM dbo.ARISTAS WITH(INDEX(SPATIAL_IX_Aristas_Geometria)) -- Forzamos el uso del índice
      WHERE trayectoria.Filter(geography::STGeomFromText(@0, 4326)) = 1
    `;
    
    // Ejecutamos pasando el polígono como parámetro seguro
    const resultados: Array<any> = await this.aristaRepo.manager.query(query, [bboxWkt]);

    this.logger.debug(`Se encontraron ${resultados.length} aristas en el cuadrante.`);

    return resultados.map((row) => {
      const arista = new AristaDomain();
      arista.idArista = String(row.id_arista);
      arista.idNodoOrigen = String(row.id_nodo_origen);
      arista.idNodoDestino = String(row.id_nodo_destino);
      arista.distanciaMetros = Number(row.distancia_metros);
      arista.pesoRiesgo = Number(row.peso_riesgo);
      arista.velocidadBase = Number(row.velocidad_base ?? 50);
      return arista;
    });
  }

  /**
   * Extrae todas las aristas (calles) de la red vial de una sola vez.
   * ADVERTENCIA: Con 3.8 millones de registros, usar esta función puede causar un Timeout o agotar la RAM.
   */
  async findAll(): Promise<AristaDomain[]> {
    this.logger.warn('Ejecutando findAll() - PELIGRO: Extrayendo millones de aristas...');

    const query = `
      SELECT 
        id_arista, 
        id_nodo_origen, 
        id_nodo_destino, 
        distancia_metros, 
        peso_riesgo, 
        velocidad_base 
      FROM dbo.ARISTAS
    `;
    
    const resultados: Array<any> = await this.aristaRepo.manager.query(query);

    return resultados.map((row) => {
      const arista = new AristaDomain();
      arista.idArista = String(row.id_arista);
      arista.idNodoOrigen = String(row.id_nodo_origen);
      arista.idNodoDestino = String(row.id_nodo_destino);
      arista.distanciaMetros = Number(row.distancia_metros);
      arista.pesoRiesgo = Number(row.peso_riesgo);
      arista.velocidadBase = Number(row.velocidad_base ?? 50); 
      return arista;
    });
  }

  /**
   * Devuelve todas las aristas que parten de un nodo dado.
   * Usa el índice FK_Aristas_NodoOrigen para la búsqueda eficiente.
   */
  async findByNodoOrigen(idNodo: string): Promise<AristaDomain[]> {
    const aristas = await this.aristaRepo.find({
      where: { id_nodo_origen: idNodo },
    });

    return aristas.map((a) => {
      const d = new AristaDomain();
      d.idArista = String(a.id_arista);
      d.idNodoOrigen = String(a.id_nodo_origen);
      d.idNodoDestino = String(a.id_nodo_destino);
      d.distanciaMetros = Number(a.distancia_metros);
      d.pesoRiesgo = Number(a.peso_riesgo);
      d.velocidadBase = Number(a.velocidad_base ?? 50);
      return d;
    });
  }
}