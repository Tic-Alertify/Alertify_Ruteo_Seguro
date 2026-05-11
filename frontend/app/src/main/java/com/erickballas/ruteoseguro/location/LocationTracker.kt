package com.erickballas.ruteoseguro.location

import android.location.Location
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Singleton que actúa como puente de comunicación.
 * El TrackingService escribirá aquí, y tu MapViewModel leerá de aquí.
 */
object LocationTracker {
    private val _currentLocation = MutableStateFlow<Location?>(null)
    val currentLocation: StateFlow<Location?> = _currentLocation.asStateFlow()

    fun updateLocation(location: Location) {
        _currentLocation.value = location
    }
}