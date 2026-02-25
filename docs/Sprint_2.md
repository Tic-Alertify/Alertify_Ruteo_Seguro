# Sprint 2 — Modulo Ruteo Seguro
**Fecha:** 22 de febrero de 2026  
**Épica:** E-03 — Visualización y Navegación

---

## T-02 — Interfaz para búsqueda de direcciones con autocompletado ✅

**RS-32**

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

## T-03 — Captura de coordenadas de inicio y fin ✅

**RS-33**

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

## T-04 — Validar que las coordenadas estén dentro de Quito ✅

**RS-34**

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

## Archivos nuevos en este Sprint

| Archivo | Tipo | Descripción |
|---|---|---|
| `utils/GeoUtils.kt` | Kotlin | Algoritmo Ray-Casting para validación geoespacial |
| `utils/Constants.kt` | Kotlin | Polígono Pichincha, bounding box, URL base API |

## Archivos modificados en este Sprint

| Archivo | Cambios |
|---|---|
| `MapFragment.kt` | `buscarSugerencias` con `LocationRestriction`, marcadores en mapa, `observarCoordenadas()`, `observarErrores()`, fix cámara T-04, `addOnFailureListener` en Places |
| `MapViewModel.kt` | Validación en `setOrigen/setDestino`, `_errorMessage` StateFlow, `clearError()`, mensajes de error en todos los casos |

---

## Pendiente para completar Sprint 2

**Frontend:**
- [ ] T-05 / siguiente tarea — observar `rutaPolyline` en `MapFragment` y dibujar `Polyline` en el mapa con la ruta devuelta por el backend

**Backend:**
- [ ] Completar `CalcularRutaDto` con validaciones (`class-validator`)
- [ ] Implementar algoritmo de ruteo (A* / Dijkstra ponderado por `peso_riesgo`)
- [ ] Endpoint `POST /ruteo/calcular`
- [ ] Endpoint `GET /incidentes`
- [ ] Lógica de actualización de `peso_riesgo` según incidentes activos
