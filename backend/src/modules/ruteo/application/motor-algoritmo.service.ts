import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { GrafoDomain, AristaDomain } from '../domain/entities/grafo.domain';
import { NodoDomain } from '../domain/entities/nodo.domain';
import { MinHeap } from '../../common/utils/min-heap';
import { haversineMetros } from '../../common/utils/haversine';
import { encodePolyline } from '../../common/utils/polyline.encoder';

export interface ResultadoRuta {
  /** Polilínea codificada en formato Google Encoded Polyline */
  rutaGeometria: string;
  distanciaMetros: number;
  tiempoEstimadoMinutos: number;
  nivelRiesgo: number; // promedio ponderado de peso_riesgo de las aristas recorridas
  idsNodosRuta: string[];
}

interface NodoEnCola {
  id: string;
  f: number; // g + h
}

@Injectable()
export class MotorAlgoritmoService {
  private readonly logger = new Logger(MotorAlgoritmoService.name);

  /**
   * Algoritmo A* ponderado por peso_riesgo.
   *
   * Función de costo:  g(n) = Σ (distancia_metros × peso_riesgo) acumulado
   * Heurística:        h(n) = haversine(nodo_actual, destino)  — admisible, nunca sobreestima
   * Función total:     f(n) = g(n) + h(n)
   *
   * @param idOrigen  ID del nodo de partida (nodo más cercano al GPS de origen)
   * @param idDestino ID del nodo de destino (nodo más cercano al GPS de destino)
   * @param grafo     Grafo de adyacencia precargado en memoria
   */
  async calcularRutaSegura(
    idOrigen: string,
    idDestino: string,
    grafo: GrafoDomain,
  ): Promise<ResultadoRuta> {
    const nodoOrigen = grafo.nodos.get(idOrigen);
    if (!nodoOrigen) throw new NotFoundException(`Nodo origen ${idOrigen} no encontrado en el grafo`);

    const nodoDestino = grafo.nodos.get(idDestino);
    if (!nodoDestino) throw new NotFoundException(`Nodo destino ${idDestino} no encontrado en el grafo`);

    this.logger.debug(`A* iniciado: ${idOrigen} → ${idDestino}`);

    // ── Diagnóstico de tipos (temporal) ───────────────────────────────────────
    const vecinosOrigen = grafo.getVecinos(idOrigen);
    const primerasClaves = [...grafo.aristas.keys()].slice(0, 3);
    this.logger.debug(
      `Diagnóstico grafo — nodos: ${grafo.nodos.size}, aristas-keys: ${grafo.aristas.size} | ` +
        `tipo clave nodo: ${typeof idOrigen} | ` +
        `tipo clave arista: ${typeof primerasClaves[0]} | ` +
        `muestra claves aristas: [${primerasClaves.join(', ')}] | ` +
        `vecinos nodo origen: ${vecinosOrigen.length}`,
    );
    // ─────────────────────────────────────────────────────────────────────────

    // ── Estructuras del algoritmo ──────────────────────────────────────────────
    /** Costo real acumulado g(n) */
    const gCosto = new Map<string, number>();
    /** Nodo padre para reconstruir el camino */
    const padre = new Map<string, string>();
    /** Arista usada para llegar al nodo (para métricas) */
    const aristaUsada = new Map<string, AristaDomain>();
    /** Nodos ya procesados definitivamente */
    const cerrado = new Set<string>();

    const cola = new MinHeap<NodoEnCola>((a, b) => a.f - b.f);

    gCosto.set(idOrigen, 0);
    cola.push({ id: idOrigen, f: this.heuristica(nodoOrigen, nodoDestino) });

    while (cola.size > 0) {
      const { id: idActual } = cola.pop()!;

      if (cerrado.has(idActual)) continue;
      cerrado.add(idActual);

      // ── Destino alcanzado ─────────────────────────────────────────────────
      if (idActual === idDestino) {
        return this.construirResultado(
          idOrigen,
          idDestino,
          grafo,
          padre,
          aristaUsada,
        );
      }

      const gActual = gCosto.get(idActual) ?? Infinity;
      const vecinos = grafo.getVecinos(idActual);

        for (const arista of vecinos) {
        const idVecino = arista.idNodoDestino;
        if (cerrado.has(idVecino)) continue;

        const nodoVecino = grafo.nodos.get(idVecino);
        if (!nodoVecino) continue;

        const gNuevo = gActual + arista.pesoTotal;
        const gAnterior = gCosto.get(idVecino) ?? Infinity;

        if (gNuevo < gAnterior) {
          gCosto.set(idVecino, gNuevo);
          padre.set(idVecino, idActual);
          aristaUsada.set(idVecino, arista);

          const f = gNuevo + this.heuristica(nodoVecino, nodoDestino);
          cola.push({ id: idVecino, f });
        }
      }
    }

    throw new NotFoundException(
      `No existe ruta entre el origen (${idOrigen}) y el destino (${idDestino})`,
    );
  }

  // ── Heurística admisible ───────────────────────────────────────────────────

  private heuristica(desde: NodoDomain, hasta: NodoDomain): number {
    // Distancia en línea recta en metros (pesoRiesgo mínimo = 1.0 → nunca sobreestima)
    return haversineMetros(desde.lat, desde.lng, hasta.lat, hasta.lng);
  }

  // ── Reconstrucción del resultado ───────────────────────────────────────────

  private construirResultado(
    idOrigen: string,
    idDestino: string,
    grafo: GrafoDomain,
    padre: Map<string, string>,
    aristaUsada: Map<string, AristaDomain>,
  ): ResultadoRuta {
    // Reconstruir secuencia de IDs desde destino hacia atrás
    const idsNodosRuta: string[] = [];
    let actual = idDestino;
    while (actual !== idOrigen) {
      idsNodosRuta.unshift(actual);
      actual = padre.get(actual)!;
    }
    idsNodosRuta.unshift(idOrigen);

    // Calcular métricas acumuladas sobre las aristas del camino
    let distanciaTotal = 0;
    let tiempoSegundos = 0;
    let sumaRiesgoPonderado = 0;

    for (let i = 1; i < idsNodosRuta.length; i++) {
      const arista = aristaUsada.get(idsNodosRuta[i]);
      if (!arista) continue;

      distanciaTotal += arista.distanciaMetros;
      // t = d / v  (v en km/h → m/s = km/h * 1000/3600)
      tiempoSegundos += arista.distanciaMetros / ((arista.velocidadBase * 1_000) / 3_600);
      sumaRiesgoPonderado += arista.pesoRiesgo * arista.distanciaMetros;
    }

    const nivelRiesgo = distanciaTotal > 0 ? sumaRiesgoPonderado / distanciaTotal : 1.0;
    const tiempoEstimadoMinutos = tiempoSegundos / 60;

    // Construir polilínea con las coordenadas de cada nodo
    const coordenadas: [number, number][] = idsNodosRuta
      .map((id) => grafo.nodos.get(id))
      .filter((n): n is NodoDomain => n !== undefined)
      .map((n) => [n.lat, n.lng]);

    const rutaGeometria = encodePolyline(coordenadas);

    this.logger.log(
      `A* completado: ${idsNodosRuta.length} nodos | ` +
        `${distanciaTotal.toFixed(0)} m | ` +
        `riesgo ${nivelRiesgo.toFixed(2)} | ` +
        `${tiempoEstimadoMinutos.toFixed(1)} min`,
    );

    return {
      rutaGeometria,
      distanciaMetros: distanciaTotal,
      tiempoEstimadoMinutos,
      nivelRiesgo,
      idsNodosRuta,
    };
  }
}