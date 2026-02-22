import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Nodo } from '../entities/nodo.entity';

@Injectable()
export class NodoRepository {
  constructor(
    @InjectRepository(Nodo)
    private readonly nodoRepo: Repository<Nodo>,
  ) {}

  /**
   * Encuentra el nodo (intersección) más cercano a las coordenadas enviadas por el celular.
   * ¡Esta consulta está ultra-optimizada gracias al SPATIAL INDEX!
   */
  async findNodoMasCercano(latitud: number, longitud: number): Promise<Nodo> {
    // Convertimos la coordenada de Kotlin a un punto WKT que SQL Server entienda
    const puntoOrigenWKT = `POINT(${longitud} ${latitud})`;

    const nodoCercano = await this.nodoRepo
      .createQueryBuilder('nodo')
      // Utilizamos STDistance() de SQL Server para calcular la distancia en metros
      .addSelect(`nodo.ubicacion.STDistance(geography::STGeomFromText('${puntoOrigenWKT}', 4326))`, 'distancia')
      // Filtramos para asegurar que no nos devuelva nodos basura
      .where('nodo.es_interseccion = 1')
      // Ordenamos por el que tenga menor distancia
      .orderBy('distancia', 'ASC')
      .getOne();

    return nodoCercano;
  }
}