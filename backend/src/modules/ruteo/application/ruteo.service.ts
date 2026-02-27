import { Injectable } from '@nestjs/common';
import { CalcularRutaDto } from '../presentation/dtos/calcular-ruta.dto';
import { RutaResponseDto } from '../presentation/dtos/ruta-response.dto';
import { IncidenteResponseDto } from '../presentation/dtos/incidente-response.dto';
import { NodoRepository } from '../infrastructure/repositories/nodo.repository';
import { AristaRepository } from '../infrastructure/repositories/arista.repository';
import { MotorAlgoritmoService } from './motor-algoritmo.service';

@Injectable()
export class RuteoService {
  constructor(
    private readonly nodoRepository: NodoRepository,
    private readonly aristaRepository: AristaRepository,
    private readonly motorAlgoritmo: MotorAlgoritmoService,
  ) {}

  /**
   * Recibe coordenadas GPS de origen/destino y devuelve la ruta segura óptima.
   * 1. Snap de coordenadas al nodo más cercano en el grafo.
   * 2. Ejecuta A-star / Dijkstra ponderado por peso_riesgo.
   * 3. Devuelve la geometría codificada y métricas de riesgo.
   */
  async calcularRuta(dto: CalcularRutaDto): Promise<RutaResponseDto> {
    // implementar lógica completa
    // 1. nodoOrigen = await this.nodoRepository.findNodoMasCercano(dto.origenLat, dto.origenLng)
    // 2. nodoDestino = await this.nodoRepository.findNodoMasCercano(dto.destinoLat, dto.destinoLng)
    // 3. ruta = await this.motorAlgoritmo.calcularRutaSegura(nodoOrigen.id, nodoDestino.id)
    // 4. return mapear resultado a RutaResponseDto
    throw new Error('T-06 pendiente: Algoritmo de ruteo aún no implementado');
  }

  /**
   * Devuelve los incidentes activos de las últimas 24h para superponer en el mapa.
   */
  async obtenerIncidentesActivos(): Promise<IncidenteResponseDto[]> {
    // consultar INCIDENTES activos desde la base de datos
    return [];
  }
}