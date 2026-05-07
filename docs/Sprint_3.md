# Sprint 3 · Módulo de Ruteo Seguro

## 1. Alcance del Sprint
- **Objetivo**: habilitar un flujo extremo a extremo que calcule rutas seguras ponderadas por riesgo y las visualice en Android con trazado preciso.
- **Entregables clave**: API `POST /ruteo/calcular`, utilitarios de grafo/A*, integración Retrofit + ViewModel + Fragmento de mapa, validaciones geoespaciales y mejoras de UX (autocompletado, marcadores, autoencuadre).
- **Historias atendidas**: T-09 Consumo API de ruteo, T-10 Dibujo de polilínea, T-11 Marcadores personalizados, T-12 Autoencuadre de ruta (Epic E-03 Visualización y Navegación segura).

## 2. Backend (NestJS)
### 2.1 API de ruteo
- Controlador documentado con Swagger en [backend/src/modules/ruteo/presentation/ruteo.controller.ts](backend/src/modules/ruteo/presentation/ruteo.controller.ts).
- Endpoints expuestos:
  - `POST /api/ruteo/calcular`: recibe `CalcularRutaDto` y responde `RutaResponseDto`.
  - `GET /api/ruteo/incidentes`: preparado para superponer incidentes activos.

```ts
// backend/src/modules/ruteo/presentation/ruteo.controller.ts
@Post('calcular')
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: 'Calcular ruta segura' })
@ApiBody({ type: CalcularRutaDto })
@ApiResponse({ status: 200, type: RutaResponseDto })
async calcularRuta(@Body() dto: CalcularRutaDto): Promise<RutaResponseDto> {
  return this.ruteoService.calcularRuta(dto);
}
```

### 2.2 Servicio de dominio y heurísticas
- [backend/src/modules/ruteo/application/ruteo.service.ts](backend/src/modules/ruteo/application/ruteo.service.ts) construye un **grafo acotado por Bounding Box**, carga nodos/aristas desde Azure SQL y realiza un **snap in-memory** usando la fórmula de Haversine.
- Clasifica el riesgo percibido (`Bajo/Medio/Alto`) según el puntaje promedio de la ruta.

```ts
const grafo = await this.obtenerGrafoParaRuta(latO, lngO, latD, lngD);
const nodoOrigen = this.encontrarNodoMasCercanoEnMemoria(latO, lngO, grafo);
const nodoDestino = this.encontrarNodoMasCercanoEnMemoria(latD, lngD, grafo);
const resultado = await this.motorAlgoritmo.calcularRutaSegura(
  nodoOrigen.id,
  nodoDestino.id,
  grafo,
);
return {
  rutaGeometria: resultado.rutaGeometria,
  distanciaMetros: resultado.distanciaMetros,
  tiempoEstimado: `${Math.ceil(resultado.tiempoEstimadoMinutos)} min`,
  nivelRiesgo: clasificarNivelRiesgo(resultado.nivelRiesgo),
};
```

### 2.3 Motor A* ponderado por riesgo
- Implementado en [backend/src/modules/ruteo/application/motor-algoritmo.service.ts](backend/src/modules/ruteo/application/motor-algoritmo.service.ts).
- Costos: $g(n) = \sum (\text{distancia} \times peso\_riesgo)$ y heurística admisible `h(n)` basada en Haversine.
- Usa `MinHeap` personalizado y codifica el camino en formato Google Encoded Polyline.

```ts
const gNuevo = gActual + arista.pesoTotal;
if (gNuevo < gAnterior) {
  gCosto.set(idVecino, gNuevo);
  padre.set(idVecino, idActual);
  aristaUsada.set(idVecino, arista);
  const f = gNuevo + this.heuristica(nodoVecino, nodoDestino);
  cola.push({ id: idVecino, f });
}
...
const coordenadas: [number, number][] = idsNodosRuta
  .map((id) => grafo.nodos.get(id))
  .filter((n): n is NodoDomain => n !== undefined)
  .map((n) => [n.lat, n.lng]);
const rutaGeometria = encodePolyline(coordenadas);
```

### 2.4 Utilitarios y DTOs
- Validadores en [backend/src/modules/ruteo/presentation/dtos](backend/src/modules/ruteo/presentation/dtos) sincronizan contrato con el cliente Android.
- Utilitarios:
  - [haversine.ts](backend/src/modules/common/utils/haversine.ts) — distancia en metros y heurística.
  - [min-heap.ts](backend/src/modules/common/utils/min-heap.ts) — cola de prioridad.
  - [polyline.encoder.ts](backend/src/modules/common/utils/polyline.encoder.ts) — codificación geométrica lista para Google Maps.

### 2.5 Contrato de ejemplo
**Request**
```json
POST /api/ruteo/calcular
{
  "origenLat": -0.2099,
  "origenLng": -78.4849,
  "destinoLat": -0.1807,
  "destinoLng": -78.4678
}
```
**Response**
```json
{
  "rutaGeometria": "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
  "distanciaMetros": 3400.5,
  "tiempoEstimado": "12 min",
  "nivelRiesgo": "Bajo"
}
```

## 3. Frontend (Android · Kotlin)
### 3.1 Consumo de API (T-09)
- Retrofit centralizado en [frontend/app/src/main/java/com/erickballas/ruteoseguro/data/api/RetrofitClient.kt](frontend/app/src/main/java/com/erickballas/ruteoseguro/data/api/RetrofitClient.kt) lee `BASE_URL` desde `local.properties` (misma convención que BuildConfig) y configura timeouts para la espera del motor A*.
- `RuteoRepository` encapsula la llamada y devuelve `Result` con manejo de excepciones de red.

```kotlin
val response = RetrofitClient.apiService.calcularRutaSegura(request)
if (response.isSuccessful && response.body() != null) {
    Result.success(response.body()!!)
} else {
    Result.failure(Exception("Error HTTP: ${response.code()} - ${response.message()}"))
}
```

### 3.2 ViewModel + validaciones geográficas
- [MapViewModel](frontend/app/src/main/java/com/erickballas/ruteoseguro/viewmodel/MapViewModel.kt) mantiene `StateFlow` para origen, destino, polilínea y errores.
- Valida que ambas coordenadas estén dentro del polígono de Pichincha definido en [Constants.kt](frontend/app/src/main/java/com/erickballas/ruteoseguro/utils/Constants.kt) mediante `GeoUtils.estaDentroDelPoligono`.
- Expone `solicitarRutaSegura()` que activa el loader y propaga la polilínea recibida.

### 3.3 UI de mapa (T-10, T-11, T-12)
- [MapFragment](frontend/app/src/main/java/com/erickballas/ruteoseguro/ui/map/MapFragment.kt):
  - Integra Google Places para sugerencias y fija el destino.
  - Solicita permisos, obtiene la ubicación actual y crea marcadores personalizados (punto verde de origen y bandera roja de destino).
  - Dibuja la polilínea decodificada con `PolyUtil.decode`, la segmenta para evitar el límite de 10k puntos y la muestra con `RoundCap`, `JointType.ROUND`, `zIndex` y color corporativo.
  - Calcula `LatLngBounds` para animar la cámara y encuadrar toda la ruta con un padding de 150 px (T-12).

```kotlin
val puntos = PolyUtil.decode(encodedPolyline)
val boundsBuilder = LatLngBounds.Builder()
...
val polyline = googleMap.addPolyline(
    PolylineOptions()
        .addAll(segment)
        .width(16f)
        .color("#1E88E5".toColorInt())
        .startCap(RoundCap())
        .endCap(RoundCap())
        .jointType(JointType.ROUND)
)
rutaPolylines.add(polyline)
segment.forEach { boundsBuilder.include(it) }
val bounds = boundsBuilder.build()
googleMap.animateCamera(CameraUpdateFactory.newLatLngBounds(bounds, 150))
```

### 3.4 UX Complementaria
- `PlacesAdapter` muestra sugerencias de Google Places.
- Loader full-screen controlado por `isLoadingRoute` y se oculta automáticamente.
- Botones "Confirmar ubicación" / "Cambiar destino" limpian marcadores, polilínea y devuelven el foco al buscador.

## 4. Cómo ejecutar
### Backend
1. Copiar `.env.example` → `.env` y ajustar credenciales de Azure SQL / storage.
2. Instalar dependencias: `cd backend && npm install`.
3. Ejecutar en modo desarrollo: `npm run start:dev` (NestJS expone Swagger en `http://localhost:3000/api`).

### Frontend
1. Abrir `frontend/` en Android Studio Iguana o superior.
2. Crear/editar `frontend/local.properties` e incluir `BASE_URL=http://10.0.2.2:3000/` (emulador) o la URL productiva.
3. Sincronizar Gradle y ejecutar la app en un emulador Android 12+ con Servicios de Google Play.

## 5. Pruebas manuales sugeridas
1. **Validación de cobertura**: intentar fijar un destino fuera del polígono; la app debe mostrar `"El destino está fuera del área de cobertura"`.
2. **Consumo API (T-09)**: seleccionar origen/destino válidos y verificar en Logcat que la petición Retrofit responde 200 con la polilínea.
3. **Polyline y marcadores (T-10 & T-11)**: tras recibir la ruta, confirmar que el trazo usa los estilos configurados y que los marcadores personalizados aparecen en el inicio/fin.
4. **Autoencuadre (T-12)**: realizar rutas largas y observar que la cámara ajusta el zoom sin recortar la polilínea.
5. **Reinicio de flujo**: usar "Cambiar destino" para limpiar polilínea, marcador y volver a buscar.

## 6. Próximos pasos sugeridos
- Implementar la persistencia de incidentes y respuesta real en `obtenerIncidentesActivos()`.
- Añadir métricas de telemetría para medir tiempos reales de cómputo del motor A* en producción.
- Publicar el SDK/contrato en Postman dentro de `postman/collections/Alertify — Módulo de Ruteo Seguro` para pruebas de QA.
