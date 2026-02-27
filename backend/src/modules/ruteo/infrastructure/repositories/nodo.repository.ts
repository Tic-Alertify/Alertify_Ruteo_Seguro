import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Nodo } from '../entities/nodo.entity';
import { NodoDomain } from '../../domain/entities/nodo.domain';
import { INodoRepository } from '../../domain/interfaces/nodo-repository.interfaces';

@Injectable()
export class NodoRepository implements INodoRepository {
  constructor(
    @InjectRepository(Nodo)
    private readonly nodoRepo: Repository<Nodo>,
  ) {}

  /**
   * Encuentra el nodo (intersección) más cercano a las coordenadas enviadas por el celular.
   * Aprovecha el SPATIAL_IX_Nodos_Ubicacion definido en el script SQL.
   */
  async findNodoMasCercano(latitud: number, longitud: number): Promise<NodoDomain> {
    const puntoOrigenWKT = `POINT(${longitud} ${latitud})`;

    const nodo = await this.nodoRepo
      .createQueryBuilder('nodo')
      .addSelect(
        `nodo.ubicacion.STDistance(geography::STGeomFromText('${puntoOrigenWKT}', 4326))`,
        'distancia',
      )
      .where('nodo.es_interseccion = 1')
      .orderBy('distancia', 'ASC')
      .getOne();

    return new NodoDomain({
      id: nodo.id_nodo,
      esInterseccion: Boolean(nodo.es_interseccion),
      // La ubicación está en WKT: extraemos lat/lng del texto 'POINT(lng lat)'
      lng: parseFloat(nodo.ubicacion.toString().replace('POINT (', '').split(' ')[0]),
      lat: parseFloat(nodo.ubicacion.toString().replace('POINT (', '').split(' ')[1]),
    });
  }

  /**
   * Devuelve un nodo por su ID. Null si no existe.
   */
  async findById(id: string): Promise<NodoDomain | null> {
    const nodo = await this.nodoRepo.findOne({ where: { id_nodo: id } });
    if (!nodo) return null;

    return new NodoDomain({
      id: nodo.id_nodo,
      esInterseccion: Boolean(nodo.es_interseccion),
      lng: parseFloat(nodo.ubicacion.toString().replace('POINT (', '').split(' ')[0]),
      lat: parseFloat(nodo.ubicacion.toString().replace('POINT (', '').split(' ')[1]),
    });
  }
}