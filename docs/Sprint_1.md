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
npm run etl:validate     # Valida integridad de los JSON generados
npm run etl:seed         # Carga completa (nodos + aristas) en Azure SQL
npm run etl:seed:edges   # Solo aristas (cuando nodos ya están cargados)
```

#### Datos cargados
| Dataset | Cantidad |
|---|---|
| Nodos (intersecciones de Quito) | ~1.884.803 |
| Aristas (calles) | a confirmar tras ETL final |
| Fuente | OpenStreetMap — `quito.osm` |

#### Optimizaciones implementadas en `db-seeder.ts`

| Problema | Solución |
|---|---|
| 1 INSERT por fila → ~1.8M queries | Batch INSERT de 500 nodos / 250 aristas (respeta límite de 2100 params de SQL Server) |
| `Array.find()` O(n) en lookup de nodos | `Map<id, {lat,lon}>` con lookup O(1) |
| FK violation (aristas con nodos inexistentes) | Pre-filtro de `source`/`target` contra el `nodeMap` antes de insertar |
| Sin visibilidad del progreso | Barra de progreso en tiempo real con porcentaje |
| Re-insertar nodos ya cargados | Flag `--only-edges` para saltar la carga de nodos |
| Crash ante duplicados | Tolerancia silenciosa a errores 2627 (PK) y 547 (FK) |

---

### 6. Incidencias resueltas

| Error | Causa | Solución |
|---|---|---|
| `Login failed for user 'admin-ruteo'` | `#` en contraseña interpretado como comentario por dotenv | Envolver `DB_PASSWORD` entre comillas en `.env` |
| ETL tardaba horas | INSERT uno por uno a través de internet | Batch insert (redujo queries de ~1.8M a ~3.800) |
| `FK_Aristas_NodoDestino` violation | Aristas referenciando nodos inexistentes en el dataset | Filtro previo `nodeMap.has(source) && nodeMap.has(target)` |
| `No driver (HTTP) has been selected` | Faltaba `@nestjs/platform-express` | `npm install @nestjs/platform-express` |

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

**Backend:**
- [ ] Implementar algoritmo de ruteo (A* o Dijkstra ponderado por `peso_riesgo`)
- [ ] Endpoint `POST /ruteo/calcular` — recibe origen/destino en coordenadas GPS
- [ ] Endpoint `GET /incidentes` — devuelve incidentes activos como GeoJSON
- [ ] Lógica de actualización de `peso_riesgo` según incidentes activos
- [ ] Completar `CalcularRutaDto` con validaciones (`class-validator`)

**Frontend:**
- [ ] Consumir API de ruteo desde Android (Retrofit o Ktor)
- [ ] Dibujar `Polyline` en el mapa con la ruta devuelta por el backend
- [ ] Solicitar permisos de ubicación y obtener posición real del dispositivo
- [ ] Completar `Constants.kt` con la URL base del API
- [ ] Pantalla de carga / manejo de errores de red
