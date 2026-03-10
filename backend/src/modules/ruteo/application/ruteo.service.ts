import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CalcularRutaDto } from '../presentation/dtos/calcular-ruta.dto';
import { RutaResponseDto } from '../presentation/dtos/ruta-response.dto';
import { IncidenteResponseDto } from '../presentation/dtos/incidente-response.dto';
import { NodoRepository } from '../infrastructure/repositories/nodo.repository';
import { AristaRepository } from '../infrastructure/repositories/arista.repository';
import { MotorAlgoritmoService } from './motor-algoritmo.service';
import { GrafoDomain } from '../domain/entities/grafo.domain';
import { NodoDomain } from '../domain/entities/nodo.domain';
import { haversineMetros } from '../../common/utils/haversine'; // Asegúrate de que esta ruta sea correcta

@Injectable()
export class RuteoService {
  private readonly logger = new Logger(RuteoService.name);

  constructor(
    private readonly nodoRepository: NodoRepository,
    private readonly aristaRepository: AristaRepository,
    private readonly motorAlgoritmo: MotorAlgoritmoService,
  ) {}

  async calcularRuta(dto: CalcularRutaDto): Promise<RutaResponseDto> {
    const startCalculo = Date.now();

    // 1. Construir el grafo PRIMERO (Bounding Box de 0.01 grados)
    // Esto ya trae todos los nodos de la zona a la memoria RAM.
    const grafo = await this.obtenerGrafoParaRuta(dto.origenLat, dto.origenLng, dto.destinoLat, dto.destinoLng);

    // 2. Snap "In-Memory" (Ultrarrápido: 0 milisegundos)
    // Buscamos los nodos más cercanos directamente en la RAM, sin tocar la base de datos.
    const nodoOrigen = this.encontrarNodoMasCercanoEnMemoria(dto.origenLat, dto.origenLng, grafo);
    const nodoDestino = this.encontrarNodoMasCercanoEnMemoria(dto.destinoLat, dto.destinoLng, grafo);

    this.logger.debug(
      `Snap In-Memory: origen → nodo ${nodoOrigen.id} | destino → nodo ${nodoDestino.id}`
    );

    // 3. Ejecutar A* en la memoria RAM
    const resultado = await this.motorAlgoritmo.calcularRutaSegura(
      nodoOrigen.id,
      nodoDestino.id,
      grafo,
    );

    this.logger.log(`Petición completa resuelta en ${Date.now() - startCalculo}ms`);

    // 4. Mapear a DTO de respuesta
    return {
      rutaGeometria: resultado.rutaGeometria,
      distanciaMetros: resultado.distanciaMetros,
      tiempoEstimado: `${Math.ceil(resultado.tiempoEstimadoMinutos)} min`,
      nivelRiesgo: clasificarNivelRiesgo(resultado.nivelRiesgo),
    };
  }

  async obtenerIncidentesActivos(): Promise<IncidenteResponseDto[]> {
    return [];
  }

  private async obtenerGrafoParaRuta(origenLat: number, origenLng: number, destinoLat: number, destinoLng: number): Promise<GrafoDomain> {
    this.logger.log('Construyendo grafo en Bounding Box desde Azure SQL…');
    const inicio = Date.now();

    const MARGEN_GRADOS = 0.01; 

    const minLat = Math.min(origenLat, destinoLat) - MARGEN_GRADOS;
    const maxLat = Math.max(origenLat, destinoLat) + MARGEN_GRADOS;
    const minLng = Math.min(origenLng, destinoLng) - MARGEN_GRADOS;
    const maxLng = Math.max(origenLng, destinoLng) + MARGEN_GRADOS;

    const [nodos, aristas] = await Promise.all([
      this.nodoRepository.findNodosEnBoundingBox(minLat, minLng, maxLat, maxLng),
      this.aristaRepository.findAristasEnBoundingBox(minLat, minLng, maxLat, maxLng),
    ]);

    const grafo = new GrafoDomain();
    for (const nodo of nodos) grafo.agregarNodo(nodo);
    for (const arista of aristas) grafo.agregarArista(arista);

    this.logger.log(`Grafo de sector listo: ${nodos.length} nodos, ${aristas.length} aristas — ${Date.now() - inicio} ms`);
    return grafo;
  }

  /**
   * NUEVO: Snap en Memoria RAM
   * Itera sobre los nodos descargados y calcula el Haversine. 
   * Ignora los nodos huérfanos comprobando si tienen vecinos en el Grafo.
   */
  private encontrarNodoMasCercanoEnMemoria(lat: number, lng: number, grafo: GrafoDomain): NodoDomain {
    let nodoMasCercano: NodoDomain | null = null;
    let distanciaMinima = Infinity;

    for (const nodo of grafo.nodos.values()) {
      // Magia: Solo consideramos nodos que ya sepamos que tienen calles conectadas en este vecindario
      const vecinos = grafo.getVecinos(nodo.id);
      if (vecinos.length === 0) continue; 

      const dist = haversineMetros(lat, lng, nodo.lat, nodo.lng);
      
      if (dist < distanciaMinima) {
        distanciaMinima = dist;
        nodoMasCercano = nodo;
      }
    }

    if (!nodoMasCercano) {
      throw new NotFoundException('No se encontraron calles conectadas cerca de esta ubicación.');
    }

    return nodoMasCercano;
  }
}

function clasificarNivelRiesgo(nivelNumerico: number): 'Bajo' | 'Medio' | 'Alto' {
  if (nivelNumerico < 1.3) return 'Bajo';
  if (nivelNumerico <= 2.0) return 'Medio';
  return 'Alto';
}