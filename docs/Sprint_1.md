# Sprint 1 — Modulo Ruteo Seguro
**Fecha:** 21 de febrero de 2026  
**Nombre:** Erick Ballas

---

## Objetivo del Sprint

Establecer la infraestructura base del sistema: conexión a Azure SQL, carga masiva de datos de OpenStreetMap (OSM) de Quito, y bootstrapping de la aplicación Android con visualización de mapa.

---

## Backend — NestJS + TypeScript

### 1. Configuración del proyecto

| Elemento | Detalle |
|---|---|
| Framework | NestJS 11 |
| ORM | TypeORM + driver `mssql` |
| Base de datos | Azure SQL (server-ruteo-seguro.database.windows.net) |
| Puerto | 3000 |
| CORS | Habilitado globalmente |

Variables de entorno gestionadas con `@nestjs/config` desde `.env`:
```
DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, DB_SYNCHRONIZE
```

---

### 2. Entities (Infrastructure)

#### `NODOS`
- `id_nodo` — BIGINT, PK (sin IDENTITY, ID de OSM)
- `ubicacion` — geography POINT SRID 4326 (índice espacial)
- `es_interseccion` — BIT, default 1

#### `ARISTAS`
- `id_arista` — BIGINT, PK (ID de OSM)
- `id_nodo_origen / id_nodo_destino` — BIGINT, FK → NODOS
- `trayectoria` — geography LINESTRING SRID 4326 (índice espacial)
- `distancia_metros` — FLOAT (calculado con `STLength()`)
- `peso_riesgo` — FLOAT, default 1.0
- `velocidad_base` — FLOAT, default 50.0

#### `INCIDENTES`
- `id_incidente` — UNIQUEIDENTIFIER, PK
- `ubicacion` — geography POINT SRID 4326 (índice espacial)
- `fecha_reporte` — DATETIME
- `nivel_gravedad` — INT
- `tipo` — VARCHAR(100)

---

### 3. Repositorios (Infrastructure)

#### `NodoRepository`
Método implementado:
- **`findNodoMasCercano(lat, lon)`** — usa `STDistance()` de SQL Server para encontrar el nodo de intersección más cercano a una coordenada GPS. Aprovecha el índice espacial `SPATIAL_IX_Nodos_Ubicacion`.

#### `AristaRepository`
Scaffolding — métodos pendientes para Sprint 2.

---

### 4. Módulo Ruteo (scaffolding)

| Archivo | Estado |
|---|---|
| `RuteoModule` | Configurado, registra entities y providers |
| `RuteoController` | Scaffolding — endpoint `POST /ruteo` pendiente |
| `RuteoService` | Scaffolding — lógica de negocio pendiente |
| `MotorAlgoritmoService` | Scaffolding — algoritmo A* / Dijkstra pendiente |
| `CalcularRutaDto` | Scaffolding — campos pendiente |
| `INodoRepository` | Interfaz definida (domain) |
| `NodoDomain / GrafoDomain` | Archivos creados, implementación pendiente |

---

### 5. Pipeline ETL

Scripts npm disponibles:

```bash
npm run etl:clean        # Parsea quito.osm → nodos_limpios.json + aristas_limpios.json
npm run etl:validate     # Genera mapa_completo_quito.geojson para validación visual
npm run etl:seed         # Carga completa (nodos + aristas) en Azure SQL
npm run etl:seed:edges   # Solo aristas (cuando nodos ya están cargados)
```

#### `osm-cleaner.ts` — Extracción y Limpieza

Realiza **2 pasadas** sobre el archivo `quito.osm` (formato SAX streaming para eficiencia de memoria):

| Pasada | Acción |
|---|---|
| 1/2 | Indexa todos los `<node>` en un `Map<id, {lat, lon}>` |
| 2/2 | Filtra `<way>` por `highway` permitido, extrae `oneway`, descarta nodos huérfanos |

**Tipos de vías aceptados:**
- Motorizados: `motorway`, `trunk`, `primary`, `secondary`, `tertiary`, `residential`, `service`, `unclassified` (y sus `_link`)
- Peatones: `living_street`, `pedestrian`, `footway`, `path`, `steps`
- Ciclistas: `cycleway`

**Extracción de reglas de tránsito:** cada `way` exporta su atributo `oneway` (`yes`, `-1`, `no`) para que el seeder genere aristas en la dirección correcta.

#### `db-seeder.ts` — Carga en Azure SQL

| Etapa | Descripción |
|---|---|
| 1. Nodos | Batch INSERT de 1.000 nodos por lote con `geography::STGeomFromText` |
| 2. Preprocesamiento | Segmentación nodo-a-nodo + reglas oneway + cálculo Haversine |
| 3. Staging | Bulk Insert en tabla temporal `ARISTAS_STAGING` (lotes de 50.000) |
| 4. Transformación | INSERT-SELECT con `geography::STGeomFromText` en lotes de 50.000 |
| 5. Limpieza | `DROP TABLE ARISTAS_STAGING` |

**Segmentación de vías:** una vía OSM con nodos `[A, B, C, D]` genera 3 aristas individuales (`A→B`, `B→C`, `C→D`) en lugar de 1 sola (`A→D`), produciendo un grafo de mayor granularidad para el algoritmo A*.

**Reglas de dirección (oneway):**

| Valor `oneway` | Aristas generadas |
|---|---|
| `no` (default) | Forward (`A→B`) + Inversa (`B→A`) |
| `yes` / `true` / `1` | Solo forward (`A→B`) |
| `-1` | Solo inversa (`B→A`) |

**Distancia:** calculada segmento a segmento con Haversine local (en el seeder), no con `STLength()` en el servidor.

#### Datos cargados
| Dataset | Cantidad |
|---|---|
| Nodos (intersecciones de Quito) | ~1.884.803 |
| Aristas (segmentos nodo-a-nodo) | ~3.800.000 (tras segmentación + bidireccionalidad) |
| Fuente | OpenStreetMap — `quito.osm` |

#### Optimizaciones implementadas

| Problema | Solución |
|---|---|
| 1 INSERT por fila → ~1.8M queries | Nodos: Batch INSERT de 1.000. Aristas: Bulk Insert nativo de `mssql` |
| `Array.find()` O(n) en lookup de nodos | `Map<id, {lat,lon}>` con lookup O(1) |
| FK violation (aristas con nodos inexistentes) | Pre-filtro de `source`/`target` contra el `nodeMap` antes de insertar |
| Sin visibilidad del progreso | Barra de progreso en tiempo real con porcentaje |
| Re-insertar nodos ya cargados | Flag `--only-edges` para saltar la carga de nodos |
| Crash ante duplicados | Tolerancia silenciosa a errores 2627 (PK) |
| Conexión inestable a Azure | Retry con backoff exponencial (`executeWithRetry`, hasta 5 intentos) |
| `STGeomFromText` en lote grande agota RAM de Azure | Tabla staging + transformación espacial en lotes de 50.000 |
| Aristas solo en una dirección | Extracción de `oneway` desde OSM + generación de aristas inversas |
| 1 arista por vía completa (baja granularidad) | Segmentación nodo-a-nodo: cada segmento es una arista individual |

#### `validator.ts` — Validación Visual

Genera `mapa_completo_quito.geojson` a partir de los JSON limpios. Reconstruye la geometría `LineString` de cada arista usando las coordenadas de sus nodos. El archivo resultante se visualiza en [kepler.gl/demo](https://kepler.gl/demo) para verificar cobertura.

---

### 6. Incidencias resueltas

| Error | Causa | Solución |
|---|---|---|
| `Login failed for user 'admin-ruteo'` | `#` en contraseña interpretado como comentario por dotenv | Envolver `DB_PASSWORD` entre comillas en `.env` |
| ETL tardaba horas | INSERT uno por uno a través de internet | Bulk Insert nativo + tabla staging (redujo a minutos) |
| `FK_Aristas_NodoDestino` violation | Aristas referenciando nodos inexistentes en el dataset | Filtro previo `nodeMap.has(source) && nodeMap.has(target)` |
| `No driver (HTTP) has been selected` | Faltaba `@nestjs/platform-express` | `npm install @nestjs/platform-express` |
| Aristas sin granularidad | 1 arista por vía OSM completa (no por segmento) | Segmentación nodo-a-nodo en el seeder |
| Calles de un solo sentido navegables en ambos | No se extraía `oneway` del OSM | Extracción de `oneway` + generación condicional de aristas inversas |
| Azure desconecta mid-upload | Conexiones transitorias cerradas (`ECONNRESET`) | `executeWithRetry` con backoff exponencial (5 intentos) |

---

## Frontend — Android (Kotlin)

### 1. Configuración del proyecto

| Elemento | Detalle |
|---|---|
| Lenguaje | Kotlin |
| Build system | Gradle Kotlin DSL |
| Package | `com.erickballas.ruteoseguro` |
| minSdk | 24 (Android 7.0) |
| targetSdk | 36 |
| versionName | 1.0 |

---

### 2. Dependencias principales

| Librería | Versión | Uso |
|---|---|---|
| `play-services-maps` | 18.2.0 | Google Maps SDK |
| `android-maps-utils` | 3.8.0 | Utilidades para dibujar rutas en el mapa |
| `fragment-ktx` | 1.6.2 | Manejo de fragments con Kotlin extensions |
| `androidx.appcompat` | 1.6.1 | Compatibilidad |
| `material` | 1.10.0 | Componentes Material Design |

---

### 3. Estructura de clases implementadas

#### `MainActivity`
- Activity principal
- Carga el layout `activity_main` que contiene el `MapFragment`

#### `MapFragment` (Fragment + OnMapReadyCallback)
- Integra `SupportMapFragment` con Google Maps
- Habilita controles de zoom, brújula y botón de ubicación
- Centra la cámara en Quito, Ecuador al iniciar (`LatLng(-0.22985, -78.52495)`, zoom 13)
- Conectado a `MapViewModel` mediante `viewModels()`

#### `MapViewModel` (ViewModel)
- Almacena estado de la cámara: coordenadas centrales de Quito y zoom por defecto
- Diseñado para escalar con estados de ruta (pendiente próximo sprint)

#### `Constants.kt`
- Archivo creado, pendiente de llenar con URLs de API y claves de configuración

---

## Pendiente para Sprint 2

**Backend (E-02 Motor de Cálculo):**
- [ ] Estructuración de controladores — endpoint `POST /ruteo/calcular`, DTOs con validación
- [ ] Implementar algoritmo A* ponderado por `peso_riesgo`
- [ ] Obtención de grafos (nodos/aristas) con Bounding Box + índices espaciales
- [ ] Transformación geográfica (WKT → dominio, polilínea codificada, Haversine)

**Frontend (E-03 Visualización):**
- [ ] Interfaz de búsqueda de destinos con autocompletado (Google Places)
- [ ] Captura de coordenadas GPS origen + destino del buscador
- [ ] Validación de coordenadas dentro de Pichincha (Ray-Casting)
- [ ] Consumir API de ruteo desde Android (Retrofit)
- [ ] Dibujar `Polyline` en el mapa con la ruta devuelta por el backend
