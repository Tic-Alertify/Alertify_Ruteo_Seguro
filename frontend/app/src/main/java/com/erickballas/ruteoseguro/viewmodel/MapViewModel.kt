package com.erickballas.ruteoseguro.viewmodel

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.erickballas.ruteoseguro.data.repository.RuteoRepository
import com.erickballas.ruteoseguro.utils.Constants
import com.erickballas.ruteoseguro.utils.GeoUtils
import com.google.android.gms.maps.model.LatLng
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

    /** Limpia el último error una vez que la UI lo consumió */
    fun clearError() {
        _errorMessage.value = null
    }

    /** Resetea el destino para volver al flujo de búsqueda */
    fun clearDestino() {
        _coordenadaDestino.value = null
        _rutaPolyline.value = null
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

    fun solicitarRutaSegura() {
        val origen = _coordenadaOrigen.value
        val destino = _coordenadaDestino.value

        if (origen == null || destino == null) {
            _errorMessage.value = "Debes definir un origen y un destino válidos"
            return
        }

        _isLoadingRoute.value = true

        viewModelScope.launch {
            try {
                val response = repository.obtenerRutaSegura(
                    origenLat  = origen.latitude,
                    origenLng  = origen.longitude,
                    destinoLat = destino.latitude,
                    destinoLng = destino.longitude
                )

                if (response.isSuccessful && response.body() != null) {
                    val ruteoData = response.body()!!
                    Log.d("MapViewModel", "Ruta OK — Tiempo: ${ruteoData.tiempoEstimado}, Riesgo: ${ruteoData.nivelRiesgo}")
                    _rutaPolyline.value = ruteoData.rutaGeometria
                } else {
                    _errorMessage.value = "Error del servidor (${response.code()}). Intenta de nuevo."
                    Log.e("MapViewModel", "Error servidor: ${response.code()}")
                }
            } catch (e: Exception) {
                _errorMessage.value = "Sin conexión. Verifica tu internet e intenta de nuevo."
                Log.e("MapViewModel", "Excepción de red: ${e.message}")
            } finally {
                _isLoadingRoute.value = false
            }
        }
    }
}
