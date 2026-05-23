package com.erickballas.ruteoseguro.viewmodel
import com.erickballas.ruteoseguro.location.LocationTracker

import android.location.Location
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.erickballas.ruteoseguro.data.repository.RuteoRepository
import com.erickballas.ruteoseguro.utils.Constants
import com.erickballas.ruteoseguro.utils.GeoUtils
import com.google.android.gms.maps.model.LatLng
import com.google.maps.android.PolyUtil
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class MapViewModel : ViewModel() {

    private val repository = RuteoRepository()

    // 1. Configuración inicial del mapa (Quito centro)
    val quitoLocation = LatLng(-0.210313, -78.488884)
    val defaultZoom = 14f

    // 2. Coordenadas de origen y destino
    private val _coordenadaOrigen = MutableStateFlow<LatLng?>(null)
    val coordenadaOrigen: StateFlow<LatLng?> = _coordenadaOrigen.asStateFlow()

    private val _origenHeading = MutableStateFlow<Float?>(null)
    val origenHeading: StateFlow<Float?> = _origenHeading.asStateFlow()

    private val _coordenadaDestino = MutableStateFlow<LatLng?>(null)
    val coordenadaDestino: StateFlow<LatLng?> = _coordenadaDestino.asStateFlow()

    // 3. Estado de carga
    private val _isLoadingRoute = MutableStateFlow(false)
    val isLoadingRoute: StateFlow<Boolean> = _isLoadingRoute.asStateFlow()

    // 4. Geometría de la ruta calculada
    private val _rutaPolyline = MutableStateFlow<String?>(null)
    val rutaPolyline: StateFlow<String?> = _rutaPolyline.asStateFlow()

    // 5. Mensaje de error para mostrar en la UI (null = sin error)
    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    // Bandera para evitar que dispare 100 peticiones de recálculo en 1 segundo
    private var isRecalculating = false
    private var isDeviationArmed = false
    private var routeStartTimeMs = 0L
    private var lastLocationAccuracyMeters: Float? = null

    private val deviationToleranceMeters = 100.0
    private val deviationGracePeriodMs = 8000L
    private val deviationAccuracyThresholdMeters = 70f

    private var lastLocation: Location? = null

    init {
        // T-16: Empezamos a escuchar el GPS en segundo plano apenas nace el ViewModel
        viewModelScope.launch {
            LocationTracker.currentLocation.collect { location ->
                location?.let {
                    val currentLatLng = LatLng(it.latitude, it.longitude)
                    lastLocationAccuracyMeters = if (it.hasAccuracy()) it.accuracy else null

                    // Actualizamos el origen para que el marcador verde se mueva en el mapa
                    _coordenadaOrigen.value = currentLatLng

                    _origenHeading.value = resolveHeading(it, lastLocation)
                    lastLocation = it

                    // Verificamos si se desvió (T-17 y T-18)
                    verificarDesvio(currentLatLng)
                }
            }
        }
    }

    private fun resolveHeading(current: Location, previous: Location?): Float? {
        if (current.hasBearing()) {
            return current.bearing
        }
        if (previous == null) {
            return null
        }
        if (current.distanceTo(previous) < 2f) {
            return null
        }
        return previous.bearingTo(current)
    }

    // T-17: Lógica Matemática de Detección
    private fun verificarDesvio(currentLatLng: LatLng) {
        val currentPolylineStr = _rutaPolyline.value ?: return // Si no hay ruta, no hay desvío
        if (isRecalculating) return // Si ya estamos recalculando, ignoramos

        if (routeStartTimeMs != 0L) {
            val elapsedMs = System.currentTimeMillis() - routeStartTimeMs
            if (elapsedMs < deviationGracePeriodMs) return
        }

        val accuracy = lastLocationAccuracyMeters
        if (accuracy != null && accuracy > deviationAccuracyThresholdMeters) return

        try {
            val path = PolyUtil.decode(currentPolylineStr)

            // Tolerancia: 100.0 metros. Si el GPS se aleja más de 100m de la línea azul, es desvío.
            // false = la ruta no es un polígono cerrado
            val estaEnRuta = PolyUtil.isLocationOnPath(
                currentLatLng,
                path,
                false,
                deviationToleranceMeters
            )

            if (!isDeviationArmed) {
                if (estaEnRuta) {
                    isDeviationArmed = true
                }
                return
            }

            if (!estaEnRuta) {
                Log.w("MapViewModel", "🚨 ¡Desvío detectado! A más de 100m de la ruta.")
                isRecalculating = true
                _errorMessage.value = "Desvío detectado. Recalculando ruta segura..."

                // T-18: Disparar nueva petición automáticamente
                solicitarRutaSegura(mostrarLoading = false)
            }
        } catch (e: Exception) {
            Log.e("MapViewModel", "Error al decodificar ruta para desvío: ${e.message}")
        }
    }

    /** Limpia el último error una vez que la UI lo consumió */
    fun clearError() {
        _errorMessage.value = null
    }

    /** Resetea el destino para volver al flujo de búsqueda */
    fun clearDestino() {
        _coordenadaDestino.value = null
        _rutaPolyline.value = null
        isDeviationArmed = false
        routeStartTimeMs = 0L
    }

    // ─── T-04: Validación de coordenadas dentro del área de Pichincha ───────

    fun setOrigen(latLng: LatLng) {
        if (!GeoUtils.estaDentroDelPoligono(latLng, Constants.PICHINCHA_POLYGON)) {
            _errorMessage.value = "El punto de origen está fuera del área de cobertura (Pichincha)"
            Log.w("MapViewModel", "Origen fuera de Pichincha: $latLng")
            return
        }
        _coordenadaOrigen.value = latLng
    }

    fun setDestino(latLng: LatLng) {
        if (!GeoUtils.estaDentroDelPoligono(latLng, Constants.PICHINCHA_POLYGON)) {
            _errorMessage.value = "El destino está fuera del área de cobertura (Pichincha)"
            Log.w("MapViewModel", "Destino fuera de Pichincha: $latLng")
            return
        }
        _coordenadaDestino.value = latLng
    }

    // ─── Solicitud de ruta al backend ───────────────────────────────────────

    fun solicitarRutaSegura(mostrarLoading: Boolean = true) {
        val origen = _coordenadaOrigen.value
        val destino = _coordenadaDestino.value

        Log.d("MapViewModel", "solicitarRutaSegura() — origen=$origen | destino=$destino")

        if (origen == null || destino == null) {
            _errorMessage.value = "Debes definir un origen y un destino válidos"
            Log.w("MapViewModel", "Solicitud cancelada: origen o destino nulos")
            return
        }

        Log.d("MapViewModel", "Enviando petición → (${origen.latitude}, ${origen.longitude}) → (${destino.latitude}, ${destino.longitude})")
        if (mostrarLoading) {
            _isLoadingRoute.value = true
        }

        viewModelScope.launch {
            try {
                val resultado = repository.obtenerRutaSegura(
                    origenLat  = origen.latitude,
                    origenLng  = origen.longitude,
                    destinoLat = destino.latitude,
                    destinoLng = destino.longitude
                )

                if (resultado.isSuccess) {
                    val ruteoData = resultado.getOrNull()!!
                    Log.d("MapViewModel", "Ruta OK — Tiempo: ${ruteoData.tiempoEstimado}, Riesgo: ${ruteoData.nivelRiesgo}")

                    // Al actualizar este valor, el MapFragment automáticamente borrará la ruta vieja
                    // y dibujará la nueva, cumpliendo con la transición suave (T-19)
                    isDeviationArmed = false
                    routeStartTimeMs = System.currentTimeMillis()
                    _rutaPolyline.value = ruteoData.rutaGeometria
                } else {
                    val excepcion = resultado.exceptionOrNull()
                    _errorMessage.value = "Error al calcular la ruta. Intenta de nuevo."
                    Log.e("MapViewModel", "Fallo en el repositorio: ${excepcion?.message}")
                }
            } catch (e: Exception) {
                _errorMessage.value = "Error inesperado en la aplicación."
                Log.e("MapViewModel", "Excepción de corrutina: ${e.message}")
            } finally {
                if (mostrarLoading) {
                    _isLoadingRoute.value = false
                }

                // 🛑 T-18 y T-19: Liberamos el escudo.
                // Si el usuario vuelve a desviarse más adelante, el sistema podrá volver a recalcular.
                isRecalculating = false
            }
        }
    }
}
