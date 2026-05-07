# Sprint 4 — Módulo de Ruteo Seguro
**Fecha:** 24 de marzo — 7 de abril de 2026  
**Épica:** E-01 — Gestión del riesgo (incidentes)

---

## Objetivo del Sprint
Habilitar un flujo automático para **registrar incidentes** (desde un sistema externo vía webhook), **penalizar el riesgo** de las calles cercanas en la base espacial y **revertir/limpiar** incidentes expirados mediante una tarea programada.

---

## Alcance (Historias)

### T-13 — Creación de Stored Procedure para interceptar nuevos reportes (RS-43)
**Entregables:**
- Stored Procedure `dbo.SP_Registrar_Y_Penalizar_Incidente`
- Endpoint de webhook que ejecuta el SP con parámetros validados

### T-14 — Vinculación de incidente con arista más cercana (RS-44)
**Entregables:**
- Asociación geoespacial del incidente a calles cercanas usando un radio de búsqueda de **300 m** (buffer) e intersección espacial

### T-15 — Automatización de la actualización del campo riesgo (RS-45)
**Entregables:**
- Stored Procedure `dbo.SP_Limpiar_Incidentes_Expirados`
- Job programado con `@nestjs/schedule` para limpieza y reversión de penalizaciones

---

## Backend (NestJS)

### 1) Webhook para ingreso de incidentes
- **Ruta:** `POST /api/webhook/incidente`
- **Módulo:** `WebhookModule`
- **Validación:** `class-validator`

**DTO de entrada:**
- `id_incidente` (int)
- `latitud` (number)
- `longitud` (number)
- `nivel_gravedad` (int, 1–5)
- `tipo` (string)

**Comportamiento:**
- Registra el incidente y penaliza el riesgo de calles cercanas ejecutando el SP `dbo.SP_Registrar_Y_Penalizar_Incidente`.

Archivos clave:
- `backend/src/modules/webhook/webhook.controller.ts`
- `backend/src/modules/webhook/webhook.service.ts`
- `backend/src/modules/webhook/dto/create-incident-webhook.dto.ts`

---

### 2) Limpieza automática de incidentes expirados
- Servicio `IncidenteCleanupService` con `@Cron(CronExpression.EVERY_HOUR)`.
- Ejecuta el SP `dbo.SP_Limpiar_Incidentes_Expirados` con `@horas_caducidad=2`.

Archivos clave:
- `backend/src/modules/ruteo/application/incidente-cleanup.service.ts`
- `backend/src/app.module.ts` (habilita `ScheduleModule.forRoot()`)

---

## Base de datos (Azure SQL)

### 1) `dbo.SP_Registrar_Y_Penalizar_Incidente`
**Propósito:**
- Insertar un nuevo incidente en `dbo.INCIDENTES`.
- Penalizar el riesgo (`ARISTAS.peso_riesgo`) de las calles cuyo `LINESTRING` esté dentro del área de influencia del incidente.

**Estrategia geoespacial:**
- Construye un `GEOGRAPHY::Point(lat, lon, 4326)`.
- Genera un buffer circular: `@area_busqueda = punto.STBuffer(300)`.
- Actualiza aristas donde `trayectoria.STIntersects(@area_busqueda) = 1`.
- Fuerza uso de índice espacial: `WITH(INDEX(SPATIAL_IX_Aristas_Geometria))`.

Script: `docs/SP_Registrar_Y_Penalizar_Incidente.txt`

---

### 2) `dbo.SP_Limpiar_Incidentes_Expirados`
**Propósito:**
- Revertir la penalización de riesgo aplicada por incidentes que ya caducaron.
- Eliminar incidentes expirados.

**Reglas:**
- Reduce `peso_riesgo` en `nivel_gravedad * 1000`, con mínimo `1.0`.
- Usa índice espacial y `ROWLOCK` para minimizar bloqueos.

Script: `docs/SP_Limpiar_Incidentes_Expirados.txt`

---

## Endpoints involucrados
- `POST /api/webhook/incidente` — Ingesta de incidente externo y penalización de riesgo.
- `GET /api/ruteo/incidentes` — Consulta de incidentes activos (para superponer en mapa).
- `POST /api/ruteo/calcular` — Cálculo de ruta usando los pesos `peso_riesgo` actualizados.

---

## Pruebas manuales sugeridas
1. Enviar un incidente de prueba al webhook:

```http
POST /api/webhook/incidente
Content-Type: application/json

{
  "id_incidente": 1001,
  "latitud": -0.2099,
  "longitud": -78.4849,
  "nivel_gravedad": 3,
  "tipo": "Robo"
}
```

2. Verificar en BD (o mediante cálculo de ruta) que el riesgo cambió para calles cercanas.
3. Esperar la ejecución del cron (o ejecutarlo manualmente en desarrollo) y confirmar que:
- incidentes expirados se eliminan
- `peso_riesgo` se reduce sin bajar de `1.0`

---

## Resultado
Sprint 4 deja el sistema listo para **actualizar dinámicamente el riesgo** de las rutas en función de incidentes reportados, manteniendo la base de datos optimizada con **limpieza automática** de reportes expirados.
