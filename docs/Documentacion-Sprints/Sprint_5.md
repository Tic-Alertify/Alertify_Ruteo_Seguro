# Sprint 5 — Módulo de Ruteo Seguro 🗺️🚗
**Fecha:** 4–16 de mayo de 2026  
**Épica:** E-03 — Visualización y Navegación segura  

---

## 🎯 Objetivo del Sprint
Implementar el motor de navegación de la aplicación móvil. Desarrollar capacidades avanzadas de rastreo en segundo plano, visualización dinámica del progreso del viaje y un sistema autónomo para detectar desvíos del usuario y solicitar nuevas rutas de forma reactiva y sin parpadeos visuales.

---

## 🚀 Alcance (Historias de Usuario)

### T-16 — Seguimiento GPS en segundo plano
**Entregables:**
- Implementación de un `Foreground Service` (Servicio en primer plano) en Android.
- Generación de una notificación persistente (in-matable) requerida por el OS para rastreo continuo.
- Flujo reactivo (`StateFlow`) para emitir la ubicación precisa hacia la capa de UI independientemente de si la app está minimizada.

### T-17 — Detección de desvío en tiempo real
**Entregables:**
- Integración de matemática geoespacial (`PolyUtil.isLocationOnPath`) con tolerancia de desvío (ej. 50m - 100m).
- Implementación de un **periodo de gracia inicial** para estabilizar la señal del GPS al iniciar el viaje.
- Filtro por precisión de señal (Accuracy) para descartar "falsos positivos" o saltos de antena.
- Lógica de "Arming": la detección de desvío solo se activa una vez que el usuario ingresa físicamente al corredor de la ruta principal.

### T-18 — Recálculo automático de ruta
**Entregables:**
- Petición automática de un nuevo trazado al backend (NestJS) cuando se confirma un desvío válido.
- Implementación de bloqueos temporales (`Debouncing` / Flags de estado) para evitar un colapso de peticiones (múltiples recálculos simultáneos).

### T-19 — Transición y actualización de ruta en UI
**Entregables:**
- Modificación del motor de renderizado (`MapFragment`) para soportar **transiciones suaves (Smooth Transitions)** al actualizar marcadores, evitando la destrucción y recreación de objetos gráficos.
- Lógica de **recorte de polilínea**: el trazo azul se borra por detrás del usuario conforme avanza, simulando un GPS de grado comercial.

---

## 🛠️ Arquitectura Frontend (Android · Kotlin)

### 1) Tracking en Segundo Plano
- El componente `TrackingService` actúa como el motor de GPS, configurado con `Priority.PRIORITY_HIGH_ACCURACY`.
- Se utiliza el patrón de diseño Singleton a través de `LocationTracker` para servir como puente de comunicación reactiva entre el Servicio (Background) y la Vista (Foreground).

**Archivos clave:**
- `frontend/app/src/main/java/com/erickballas/ruteoseguro/location/TrackingService.kt`
- `frontend/app/src/main/java/com/erickballas/ruteoseguro/location/LocationTracker.kt`

---

### 2) Detección de Desvío y Recálculo (Core Logic)
- El `MapViewModel` consume el flujo de `LocationTracker`.
- Se aplican las reglas de negocio de T-17 y T-18: validación geométrica de la posición frente a la Polyline codificada devuelta por Azure SQL.
- Si la tolerancia se supera (y el GPS es preciso), se levanta la bandera de recálculo y se invoca al `RuteoRepository` de forma asíncrona mediante Corrutinas.

**Archivo clave:**
- `frontend/app/src/main/java/com/erickballas/ruteoseguro/viewmodel/MapViewModel.kt`

---

### 3) UI y Navegación (Presentación)
- El `MapFragment` orquesta la experiencia del usuario.
- **Modo Conducción:** Al confirmar destino, el marcador estático se reemplaza por un ícono de flecha que rota dinámicamente según el `bearing` (rumbo) del dispositivo.
- **Renderizado Reactivo:** La nueva polilínea se dibuja reemplazando la anterior sin limpiar el mapa entero, garantizando una experiencia visual impecable.

**Archivo clave:**
- `frontend/app/src/main/java/com/erickballas/ruteoseguro/ui/map/MapFragment.kt`

---

## 🎨 Ajustes Visuales
- Implementación de `ic_nav_user.xml` (Flecha de navegación vectorial plana en 3D).
- Ajustes de márgenes y `padding` en los recuadros de búsqueda sobre el mapa para no obstruir la visibilidad del trazado geográfico.

---

## 🧪 Pruebas Manuales y de Integración Sugeridas
1. **Prueba de Transición:** Iniciar una ruta y confirmar que la bandera de origen cambia correctamente a la flecha azul de navegación.
2. **Prueba de Consumo:** Avanzar sobre la ruta trazada mediante simulador/físico y verificar que la polilínea se recorta de forma proporcional por detrás del usuario.
3. **Prueba de Desvío (T-17/T-18):** Esperar a que pase el periodo de gracia inicial. Utilizar el *Location Simulator* para desviar la posición >100m de la ruta original. Validar que la UI muestra "Recalculando..." y dibuja la nueva ruta.
4. **Prueba de Precisión:** Inyectar una coordenada falsa con una dispersión de error muy alta (baja precisión). Confirmar que el sistema ignora el salto y no dispara el recálculo.
5. **Prueba de Limpieza de Recursos:** Presionar el botón "Cambiar destino". Validar que la polilínea se destruye, la flecha vuelve a ser bandera, y el `TrackingService` se detiene correctamente en el Logcat.

---

## 🏆 Resultado Final
El Sprint 5 deja el sistema consolidado con **seguimiento en tiempo real**, **detección de desvíos algorítmicamente estable** y una **visualización fluida y dinámica** del avance, cerrando el flujo principal de la épica E-03 para el usuario final.