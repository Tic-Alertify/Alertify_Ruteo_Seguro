# Alertify — Módulo de Ruteo Seguro

Sistema de ruteo inteligente para la ciudad de Quito que calcula rutas óptimas ponderadas por nivel de riesgo. Utiliza datos cartográficos de OpenStreetMap, un algoritmo A* modificado y una base de datos espacial en Azure SQL para ofrecer navegación segura en tiempo real.

## Arquitectura

```
┌─────────────────────┐       HTTP/JSON        ┌─────────────────────┐
│   Frontend Android   │ ◄────────────────────► │   Backend NestJS    │
│   (Kotlin + MVVM)    │   POST /api/ruteo/     │   (TypeScript)      │
│   Google Maps SDK    │   calcular             │   Algoritmo A*      │
└─────────────────────┘                         └────────┬────────────┘
                                                         │ TypeORM
                                                         ▼
                                                ┌─────────────────────┐
                                                │     Azure SQL       │
                                                │  Índices Espaciales │
                                                │  ~1.8M nodos        │
                                                │  ~3.8M aristas      │
                                                └─────────────────────┘
```

## Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | Android (Kotlin), Google Maps SDK, Retrofit, Google Places API |
| Backend | NestJS 11, TypeScript, TypeORM |
| Base de datos | Azure SQL Server (geography, índices espaciales) |
| Datos cartográficos | OpenStreetMap (Quito, Ecuador) |
| Documentación API | Swagger UI (`/api`) |

## Estructura del proyecto

```
├── backend/             # API REST (NestJS)
│   └── src/
│       ├── config/      # Variables de entorno
│       └── modules/
│           ├── common/  # Filtros, utilidades (Haversine, MinHeap, Polyline)
│           └── ruteo/   # Módulo principal
│               ├── application/       # Servicios (A*, orquestador)
│               ├── domain/            # Entidades y contratos de dominio
│               ├── infrastructure/    # Entities TypeORM, repositorios, ETL
│               └── presentation/      # Controlador REST, DTOs
├── frontend/            # App Android (Kotlin)
│   └── app/src/main/java/com/erickballas/ruteoseguro/
│       ├── ui/          # Fragments y Activities
│       ├── viewmodel/   # ViewModels (MVVM)
│       ├── data/        # API, modelos, repositorios
│       └── utils/       # GeoUtils, Constants
├── docs/                # Documentación de sprints
└── infra/               # Infraestructura (pendiente)
```

## Inicio rápido

### Backend

```bash
cd backend
npm install
```

Crear archivo `.env` basándose en `.env.example`:

```
DB_HOST=server-ruteo-seguro.database.windows.net
DB_PORT=1433
DB_USER=tu_usuario
DB_PASSWORD=tu_password
DB_NAME=tu_base_de_datos
DB_SYNCHRONIZE=false
```

Ejecutar:

```bash
npm run start:dev    # Servidor en http://localhost:3001
```

### Pipeline ETL (carga de datos cartográficos)

```bash
npm run etl:clean         # Parsea quito.osm → JSON limpios
npm run etl:validate      # Genera GeoJSON para validación visual
npm run etl:seed          # Carga nodos + aristas en Azure SQL
npm run etl:seed:edges    # Solo aristas (si nodos ya están cargados)
```

### Frontend

Abrir la carpeta `frontend/` en Android Studio. Configurar en `local.properties`:

```properties
MAPS_API_KEY=tu_api_key_de_google_maps
BASE_URL=http://10.0.2.2:3001/
```

Nota: el backend expone la API en `http://localhost:3001/api` (ver `backend/src/main.ts`).

Compilar y ejecutar en emulador o dispositivo físico.

## API

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/ruteo/calcular` | Calcula ruta segura entre dos coordenadas GPS |
| `GET` | `/api/ruteo/incidentes` | Devuelve incidentes activos |
| `POST` | `/api/webhook/incidente` | Recibe incidentes externos y penaliza riesgo en calles cercanas |

Documentación interactiva disponible en `http://localhost:3001/api` (Swagger UI).

## Sprints

- [docs/Sprint_1.md](docs/Sprint_1.md)
- [docs/Sprint_2.md](docs/Sprint_2.md)
- [docs/Sprint_3.md](docs/Sprint_3.md)
- [docs/Sprint_4.md](docs/Sprint_4.md) — Webhook + Stored Procedures + limpieza automática de incidentes

## Algoritmo

El motor utiliza **A\*** con función de costo ponderada por riesgo:

- **Costo:** g(n) = Σ (distancia × peso_riesgo)
- **Heurística:** h(n) = Haversine(nodo, destino)
- **Peso de riesgo:** 1.0 (seguro) → N (peligroso)

La ruta se devuelve como [Google Encoded Polyline](https://developers.google.com/maps/documentation/utilities/polylinealgorithm) para renderizado directo en Google Maps.

## Autor

Erick Ballas — Universidad
