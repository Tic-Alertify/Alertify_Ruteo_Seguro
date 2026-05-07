# Sprint 2 — Modulo Ruteo Seguro
**Fecha:** 21 de febrero — 14 de marzo de 2026  
**Épicas:** E-03 — Visualización y Navegación | E-02 — Motor de Cálculo

---

## T-02 — Interfaz para búsqueda de direcciones con autocompletado

**RS-32 | E-03 Visualización y Navegación**

### Descripción
El usuario puede escribir un destino en un campo de texto y recibir sugerencias en tiempo real, restringidas al área de cobertura del sistema (Provincia de Pichincha).

### Implementación

**Archivos modificados:**
- `MapFragment.kt` — UI/lógica del buscador
- `Constants.kt` — Bounding box de Pichincha para restricción geográfica

**Flujo:**
1. El usuario escribe en `et_destino` (`EditText`)
2. El `TextWatcher` detecta cambios; a partir de 3 caracteres llama a `buscarSugerencias()`
3. `FindAutocompletePredictionsRequest` se construye con:
   - `setCountry("EC")` — filtra a Ecuador
   - `setLocationRestriction(RectangularBounds.newInstance(Constants.PICHINCHA_BOUNDS))` — restringe al bounding box de Pichincha (SW: `-0.672, -78.875` / NE: `0.288, -77.616`)
4. Los resultados se muestran en un `RecyclerView` mediante `PlacesAdapter`
5. El ícono "X" (`iv_clear_text`) limpia el campo y oculta la lista
6. Al seleccionar una sugerencia se muestra `btnConfirmarUbicacion`

---

## T-03 — Captura de coordenadas de inicio y fin 

**RS-33 | E-03 Visualización y Navegación**

### Descripción
El sistema obtiene automáticamente la ubicación GPS del usuario como origen y permite seleccionar un destino mediante el buscador. Ambas coordenadas quedan almacenadas en el `ViewModel` y se visualizan con marcadores en el mapa.

### Implementación

**Archivos modificados:**
- `MapFragment.kt`
- `MapViewModel.kt`

**Origen (GPS):**
1. Al estar listo el mapa (`onMapReady`), se solicitan permisos `ACCESS_FINE_LOCATION` y `ACCESS_COARSE_LOCATION` mediante `ActivityResultContracts.RequestMultiplePermissions`
2. Si se conceden, se llama a `FusedLocationProviderClient.lastLocation`
3. La ubicación se envía a `viewModel.setOrigen(latLng)`
4. `observarCoordenadas()` escucha el `StateFlow<coordenadaOrigen>` y coloca un **marcador azul** ("Mi ubicación") en el mapa

**Destino (Places):**
1. El usuario selecciona una sugerencia del autocompletado
2. `obtenerCoordenadasDelLugar(placeId)` llama a `FetchPlaceRequest` para obtener el `LatLng`
3. La coordenada se envía a `viewModel.setDestino(latLng)`
4. `observarCoordenadas()` escucha el `StateFlow<coordenadaDestino>` y coloca un **marcador rojo** ("Destino") en el mapa

**Feedback visual:**
| Evento | Resultado en mapa |
|---|---|
| GPS obtenido y válido | Marcador azul + cámara se mueve al origen |
| Destino seleccionado y válido | Marcador rojo + cámara se mueve al destino |
| Se cambia el destino | Marcador anterior se elimina, se crea uno nuevo |
| GPS no disponible | Toast: "No se detectó tu ubicación. Activa el GPS e intenta de nuevo." |
| Error al obtener lugar | Toast: "No se pudo obtener la ubicación del lugar" |

---

## T-04 — Validar que las coordenadas estén dentro de Quito

**RS-34 | E-03 Visualización y Navegación**

### Descripción
Toda coordenada capturada (tanto origen GPS como destino del buscador) es validada contra el polígono real de la Provincia de Pichincha antes de ser aceptada. Si la coordenada cae fuera del área, se notifica al usuario y se descarta sin modificar el estado.

### Área de cobertura

| Propiedad | Valor |
|---|---|
| Región | Provincia de Pichincha |
| Fuente | OpenStreetMap |
| Superficie | 12.461 km² |
| Vértices del polígono | 10 puntos |

**Polígono (lon, lat):**
```
[-78.601, -0.666] → [-78.527, -0.672] → [-78.474, -0.664] → [-77.616, -0.510]
→ [-77.682,  0.193] → [-78.066,  0.254] → [-78.395,  0.288] → [-78.857,  0.049]
→ [-78.875, -0.568] → [-78.697, -0.664]
```

### Implementación

**Archivos creados/modificados:**
- `GeoUtils.kt` *(nuevo)* — Algoritmo de validación geométrica
- `Constants.kt` — Polígono `PICHINCHA_POLYGON` y bounding box `PICHINCHA_BOUNDS`
- `MapViewModel.kt` — Validación en `setOrigen()` y `setDestino()`
- `MapFragment.kt` — Observer de errores + fix del movimiento de cámara

**Algoritmo Ray-Casting (`GeoUtils.estaDentroDelPoligono`):**

Lanza un rayo horizontal desde el punto hacia la derecha y cuenta cuántos lados del polígono cruza:
- Cruces **impares** → el punto está **dentro**
- Cruces **pares** → el punto está **fuera**

Complejidad: $O(n)$ donde $n$ = número de vértices del polígono.

```kotlin
// Pseudo-lógica del algoritmo
for cada segmento [j → i] del polígono:
    si el segmento cruza el nivel horizontal del punto:
        calcular X de intersección
        si el punto está a la izquierda del cruce:
            invertir bandera "dentro"
return bandera
```

**Integración en ViewModel:**
```kotlin
fun setOrigen(latLng: LatLng) {
    if (!GeoUtils.estaDentroDelPoligono(latLng, Constants.PICHINCHA_POLYGON)) {
        _errorMessage.value = "El punto de origen está fuera del área de cobertura (Pichincha)"
        return  // ← coordenada descartada, StateFlow no cambia
    }
    _coordenadaOrigen.value = latLng
}
```

**Fix crítico aplicado:**  
En la versión anterior, `obtenerCoordenadasDelLugar()` movía la cámara directamente con `googleMap.animateCamera()` **antes** de validar. Esto causaba que la cámara se moviera a puntos fuera de Pichincha aunque el Toast de error se mostrara.

Solución: la cámara y los marcadores ahora se controlan **únicamente** desde `observarCoordenadas()`, que solo reacciona cuando el `StateFlow` cambia — y el `StateFlow` solo cambia si `GeoUtils` valida que la coordenada es válida.

**Estado de error (`_errorMessage: MutableStateFlow<String?>`):**

| Situación | Mensaje mostrado |
|---|---|
| Origen fuera de Pichincha | "El punto de origen está fuera del área de cobertura (Pichincha)" |
| Destino fuera de Pichincha | "El destino está fuera del área de cobertura (Pichincha)" |
| Origen o destino no definidos al confirmar | "Debes definir un origen y un destino válidos" |
| Error de red | "Sin conexión. Verifica tu internet e intenta de nuevo." |
| Error del servidor | "Error del servidor (4xx/5xx). Intenta de nuevo." |

---

## T-05 — Estructuración de controladores para el ruteo

**RS-35 | E-02 Motor de Cálculo**

### Descripción
Se estructura la capa de presentación del backend siguiendo la arquitectura hexagonal: controlador REST, DTOs de entrada con validación, DTOs de respuesta, filtro global de excepciones y documentación Swagger.

### Implementación

**Archivos creados/modificados:**

| Archivo | Capa | Descripción |
|---|---|---|
| `ruteo.controller.ts` | Presentación | Controlador REST con 2 endpoints |
| `calcular-ruta.dto.ts` | Presentación | DTO de entrada con validaciones `class-validator` |
| `ruta-response.dto.ts` | Presentación | DTO de respuesta con polyline, tiempo, riesgo, distancia |
| `incidente-response.dto.ts` | Presentación | DTO de respuesta para incidentes activos |
| `http-exception.filter.ts` | Common | Filtro global de excepciones |
| `main.ts` | Raíz | Swagger UI + `ValidationPipe` global |

**Endpoints:**

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/ruteo/calcular` | Calcula la ruta segura entre dos coordenadas GPS |
| `GET` | `/api/ruteo/incidentes` | Devuelve incidentes activos (últimas 24h) |

**DTO de entrada (`CalcularRutaDto`):**
```typescript
origenLat:  @IsNumber @IsNotEmpty @Min(-90)  @Max(90)
origenLng:  @IsNumber @IsNotEmpty @Min(-180) @Max(180)
destinoLat: @IsNumber @IsNotEmpty @Min(-90)  @Max(90)
destinoLng: @IsNumber @IsNotEmpty @Min(-180) @Max(180)
```

**DTO de respuesta (`RutaResponseDto`):**
```typescript
{
  rutaGeometria: string,   // Google Encoded Polyline
  distanciaMetros: number, // Distancia total en metros
  tiempoEstimado: string,  // Ej: "12 min"
  nivelRiesgo: string      // 'Bajo' | 'Medio' | 'Alto'
}
```

**Validación global (`main.ts`):**
```typescript
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,           // Ignora propiedades no declaradas
  forbidNonWhitelisted: true, // Rechaza propiedades extra (400)
  transform: true,           // Transforma tipos automáticamente
}));
```

**Filtro global (`HttpExceptionFilter`):** captura toda excepción no manejada y devuelve un JSON consistente con `statusCode`, `error`, `mensaje`, `path` y `timestamp` que el frontend Android interpreta de forma uniforme.

**Swagger UI:** documentación automática disponible en `/api` con `@nestjs/swagger`.

---

## T-06 — Implementación del algoritmo asumiendo la variable de riesgo

**RS-36 | E-02 Motor de Cálculo**

### Descripción
Se implementa el algoritmo A* (A-Star) ponderado por la variable `peso_riesgo` como motor de cálculo de rutas seguras. El algoritmo combina distancia geográfica con el nivel de peligrosidad de cada calle para encontrar la ruta óptima.

### Implementación

**Archivo:** `motor-algoritmo.service.ts`

**Modelo matemático:**

| Función | Fórmula | Descripción |
|---|---|---|
| Costo real | $g(n) = \sum (distancia\_metros \times peso\_riesgo)$ | Costo acumulado desde el origen |
| Heurística | $h(n) = haversine(n, destino)$ | Distancia en línea recta al destino (admisible) |
| Total | $f(n) = g(n) + h(n)$ | Prioridad en la cola |

**Peso compuesto (`AristaDomain.pesoTotal`):**
```typescript
get pesoTotal(): number {
  return this.distanciaMetros * this.pesoRiesgo;
}
```
- `pesoRiesgo = 1.0` → calle segura (costo = distancia pura)
- `pesoRiesgo = 2.5` → calle peligrosa (costo = 2.5× la distancia real)

**Heurística admisible:** `haversineMetros()` calcula la distancia en línea recta entre dos puntos geográficos. Como `pesoRiesgo ≥ 1.0` siempre, la heurística nunca sobreestima el costo real → A* es óptimo.

**Estructuras de datos:**
- `MinHeap<NodoEnCola>` — Cola de prioridad con $O(\log n)$ push/pop
- `gCosto: Map<string, number>` — Costo acumulado por nodo
- `padre: Map<string, string>` — Reconstrucción del camino
- `aristaUsada: Map<string, AristaDomain>` — Arista usada para métricas
- `cerrado: Set<string>` — Nodos ya procesados

**Resultado (`ResultadoRuta`):**
```typescript
{
  rutaGeometria: string,        // Google Encoded Polyline
  distanciaMetros: number,      // Σ distancia_metros de aristas recorridas
  tiempoEstimadoMinutos: number, // Σ (distancia / velocidad_base)
  nivelRiesgo: number,          // Promedio ponderado por distancia
  idsNodosRuta: string[]        // Secuencia de IDs para debug
}
```

**Clasificación del riesgo (en `ruteo.service.ts`):**

| Rango numérico | Nivel |
|---|---|
| < 1.3 | Bajo |
| 1.3 – 2.0 | Medio |
| > 2.0 | Alto |

**Utilidades implementadas:**

| Archivo | Función | Descripción |
|---|---|---|
| `haversine.ts` | `haversineMetros(lat1, lng1, lat2, lng2)` | Fórmula de Haversine, radio terrestre = 6.371.000 m |
| `min-heap.ts` | `MinHeap<T>` | Heap binario genérico con comparador personalizable |
| `polyline.encoder.ts` | `encodePolyline(coordenadas)` | Codificador de Google Encoded Polyline Algorithm |

---

## T-07 — Obtención de grafos (nodos/aristas) y sus pesos 

**RS-37 | E-02 Motor de Cálculo**

### Descripción
Se implementan los repositorios y la lógica de dominio necesarios para extraer de Azure SQL únicamente los nodos y aristas relevantes para una ruta, usando consultas espaciales con Bounding Box. Se construye un grafo de adyacencia en memoria RAM para el algoritmo A*.

### Implementación

**Archivos creados/modificados:**

| Archivo | Capa | Descripción |
|---|---|---|
| `nodo.repository.ts` | Infrastructure | Repositorio con consultas espaciales para nodos |
| `arista.repository.ts` | Infrastructure | Repositorio con consultas espaciales para aristas |
| `grafo.domain.ts` | Domain | Lista de adyacencia `Map<string, AristaDomain[]>` |
| `nodo.domain.ts` | Domain | Entidad de dominio puro (id, lat, lng, esInterseccion) |
| `nodo-repository.interfaces.ts` | Domain | Contrato de repositorio (interfaz) |
| `ruteo.service.ts` | Application | Orquestador: construye grafo + snap + A* |

**Estrategia: Bounding Box Dinámico**

En lugar de descargar los ~3.8M de aristas, se calcula un rectángulo geográfico que encierra origen y destino con un margen de 0.01° (~1.1 km), y se consultan **solo** los datos dentro de ese cuadrante.

```typescript
const MARGEN_GRADOS = 0.01;
const minLat = Math.min(origenLat, destinoLat) - MARGEN_GRADOS;
const maxLat = Math.max(origenLat, destinoLat) + MARGEN_GRADOS;
const minLng = Math.min(origenLng, destinoLng) - MARGEN_GRADOS;
const maxLng = Math.max(origenLng, destinoLng) + MARGEN_GRADOS;
```

**Consultas espaciales:**

Nodos y aristas se extraen en paralelo con `Promise.all`, aprovechando los índices espaciales de Azure SQL:

```sql
-- Nodos en Bounding Box
SELECT id_nodo, ubicacion.STAsText() AS ubicacion_wkt, es_interseccion
FROM dbo.NODOS
WHERE ubicacion.Filter(geography::STGeomFromText(@bbox, 4326)) = 1

-- Aristas en Bounding Box (forzando índice espacial)
SELECT id_arista, id_nodo_origen, id_nodo_destino, distancia_metros, peso_riesgo, velocidad_base
FROM dbo.ARISTAS WITH(INDEX(SPATIAL_IX_Aristas_Geometria))
WHERE trayectoria.Filter(geography::STGeomFromText(@bbox, 4326)) = 1
```

**Parseo WKT → Dominio:**
```typescript
// 'POINT(-78.4849 -0.2099)' → { lat: -0.2099, lng: -78.4849 }
function parsearUbicacionWkt(wkt: string): { lat: number; lng: number }
```

**Snap In-Memory:** una vez descargado el grafo, la búsqueda del nodo más cercano al GPS se realiza en RAM iterando sobre los nodos del grafo y calculando Haversine, sin volver a consultar la base de datos. Solo se consideran nodos que tienen vecinos (no huérfanos).

**Dominio del grafo (`GrafoDomain`):**
```typescript
nodos: Map<string, NodoDomain>        // Acceso O(1) por ID
aristas: Map<string, AristaDomain[]>  // Lista de adyacencia por nodo origen
agregarNodo(nodo) / agregarArista(arista) / getVecinos(idNodo)
```

**`NodoRepository` — Métodos adicionales:**
- `findNodosEnBoundingBox(minLat, minLng, maxLat, maxLng)` — extracción espacial
- `findNodoMasCercano(lat, lng)` — con `EXISTS` para garantizar conectividad + fallback sin límite de distancia
- `findById(id)` / `findAll()` — acceso genérico

**`AristaRepository` — Métodos:**
- `findAristasEnBoundingBox(minLat, minLng, maxLat, maxLng)` — extracción espacial forzando índice
- `findByNodoOrigen(idNodo)` — por FK
- `findAll()` — extracción completa (uso con precaución)

---

## T-08 — Transformación de la información geográfica y exposición

**RS-38 | E-02 Motor de Cálculo**

### Descripción
Se implementa la cadena completa de transformación de datos geográficos: desde el formato espacial de Azure SQL (WKT/geography) hasta la respuesta JSON consumible por el frontend Android, incluyendo la codificación de la ruta como Google Encoded Polyline.

### Implementación

**Cadena de transformación:**

```
Azure SQL (geography)
    ↓ STAsText()
WKT 'POINT(lng lat)'
    ↓ parsearUbicacionWkt()
{ lat: number, lng: number }
    ↓ NodoDomain → GrafoDomain
Grafo en memoria RAM
    ↓ A* → idsNodosRuta
Secuencia de coordenadas [lat, lng][]
    ↓ encodePolyline()
Google Encoded Polyline (string)
    ↓ RutaResponseDto
JSON para Android
```

**Encoder de polilínea (`polyline.encoder.ts`):**

Implementación del [Google Encoded Polyline Algorithm](https://developers.google.com/maps/documentation/utilities/polylinealgorithm):
1. Para cada coordenada, calcula la diferencia respecto a la anterior
2. Multiplica por $10^5$ y redondea
3. Codifica con desplazamiento de bits y chunks de 5 bits + offset ASCII 63

```typescript
export function encodePolyline(coordenadas: [number, number][]): string
```

**Métricas calculadas por el motor:**

| Métrica | Fórmula | Unidad |
|---|---|---|
| Distancia | $\sum distancia\_metros$ de cada arista | metros |
| Tiempo estimado | $\sum \frac{distancia}{velocidad\_base \times \frac{1000}{3600}}$ | minutos |
| Nivel de riesgo | $\frac{\sum (peso\_riesgo \times distancia)}{\sum distancia}$ | promedio ponderado |

**Exposición (API REST):**

Frontend Android consume `POST /api/ruteo/calcular` via Retrofit y recibe:
```json
{
  "rutaGeometria": "_p~iF~ps|U_ulLnnqC...",
  "distanciaMetros": 3400.5,
  "tiempoEstimado": "12 min",
  "nivelRiesgo": "Bajo"
}
```

**Integración Android (capa de red):**

| Archivo | Responsabilidad |
|---|---|
| `RetrofitClient.kt` | Singleton Retrofit con `BuildConfig.BASE_URL` + `GsonConverterFactory` |
| `RuteoApiService.kt` | Interfaz `@POST("api/ruteo/calcular")` |
| `RuteoRequest.kt` | Data class con `origenLat`, `origenLng`, `destinoLat`, `destinoLng` |
| `RuteoResponse.kt` | Data class con `rutaGeometria`, `tiempoEstimado`, `nivelRiesgo` |
| `RuteoRepository.kt` | Empaqueta coordenadas → `RuteoRequest` → llama API |
| `MapViewModel.kt` | `solicitarRutaSegura()` → llama repositorio → expone `rutaPolyline: StateFlow<String?>` |

---

## Archivos nuevos en este Sprint

| Archivo | Tipo | Descripción |
|---|---|---|
| `utils/GeoUtils.kt` | Kotlin | Algoritmo Ray-Casting para validación geoespacial |
| `utils/Constants.kt` | Kotlin | Polígono Pichincha, bounding box, URL base API |
| `data/api/RuteoApiService.kt` | Kotlin | Interfaz Retrofit para el endpoint de ruteo |
| `data/api/RetrofitClient.kt` | Kotlin | Singleton Retrofit con configuración de red |
| `data/model/RuteoRequest.kt` | Kotlin | DTO de petición (coordenadas GPS) |
| `data/model/RuteoResponse.kt` | Kotlin | DTO de respuesta (polyline, tiempo, riesgo) |
| `data/repository/RuteoRepository.kt` | Kotlin | Repositorio que comunica ViewModel ↔ API |
| `presentation/dtos/calcular-ruta.dto.ts` | TypeScript | DTO de entrada con validaciones `class-validator` |
| `presentation/dtos/ruta-response.dto.ts` | TypeScript | DTO de respuesta del endpoint /ruteo/calcular |
| `presentation/dtos/incidente-response.dto.ts` | TypeScript | DTO de respuesta del endpoint /ruteo/incidentes |
| `presentation/ruteo.controller.ts` | TypeScript | Controlador REST con endpoints POST y GET |
| `application/motor-algoritmo.service.ts` | TypeScript | Algoritmo A* ponderado por riesgo |
| `application/ruteo.service.ts` | TypeScript | Orquestador: grafo + snap + A* + respuesta |
| `infrastructure/repositories/arista.repository.ts` | TypeScript | Consultas espaciales para aristas |
| `domain/entities/grafo.domain.ts` | TypeScript | `AristaDomain` + `GrafoDomain` (lista de adyacencia) |
| `domain/entities/nodo.domain.ts` | TypeScript | Entidad de dominio puro del nodo |
| `common/utils/haversine.ts` | TypeScript | Fórmula de Haversine (distancia entre puntos GPS) |
| `common/utils/min-heap.ts` | TypeScript | Cola de prioridad para A* |
| `common/utils/polyline.encoder.ts` | TypeScript | Google Encoded Polyline encoder |
| `common/filters/http-exception.filter.ts` | TypeScript | Filtro global de excepciones |

## Archivos modificados en este Sprint

| Archivo | Cambios |
|---|---|
| `MapFragment.kt` | `buscarSugerencias` con `LocationRestriction`, marcadores en mapa, `observarCoordenadas()`, `observarErrores()`, fix cámara T-04, `addOnFailureListener` en Places, botón "Confirmar" llama a `solicitarRutaSegura()` |
| `MapViewModel.kt` | Validación en `setOrigen/setDestino`, `_errorMessage` StateFlow, `clearError()`, `clearDestino()`, `solicitarRutaSegura()`, `_rutaPolyline`, `_isLoadingRoute` |
| `nodo.repository.ts` | Nuevos métodos: `findNodosEnBoundingBox()`, `findNodoMasCercano()` optimizado con `EXISTS` |
| `ruteo.module.ts` | Registra `MotorAlgoritmoService`, `AristaRepository` como providers |
| `app.module.ts` | Aumenta `requestTimeout` y `connectionTimeout` para consultas espaciales |
| `main.ts` | Swagger UI, `ValidationPipe` global, `HttpExceptionFilter` global, prefix `/api` |
