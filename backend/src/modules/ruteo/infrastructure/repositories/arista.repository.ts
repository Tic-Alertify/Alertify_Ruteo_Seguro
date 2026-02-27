import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Arista } from '../entities/arista.entity';
import { AristaDomain } from '../../domain/entities/grafo.domain';

@Injectable()
export class AristaRepository {
  constructor(
    @InjectRepository(Arista)
    private readonly aristaRepo: Repository<Arista>,
  ) {}

  /**
   * Devuelve todas las aristas que parten de un nodo dado.
   * Usa el índice FK_Aristas_NodoOrigen para la búsqueda eficiente.
   * Necesario para construir el grafo de adyacencia en memoria (T-07).
   */
  async findByNodoOrigen(idNodo: string): Promise<AristaDomain[]> {
    const aristas = await this.aristaRepo.find({
      where: { id_nodo_origen: idNodo },
    });

    return aristas.map((a) => {
      const d = new AristaDomain();
      d.idArista = a.id_arista;
      d.idNodoOrigen = a.id_nodo_origen;
      d.idNodoDestino = a.id_nodo_destino;
      d.distanciaMetros = a.distancia_metros;
      d.pesoRiesgo = a.peso_riesgo;
      d.velocidadBase = a.velocidad_base ?? 50;
      return d;
    });
  }
}
