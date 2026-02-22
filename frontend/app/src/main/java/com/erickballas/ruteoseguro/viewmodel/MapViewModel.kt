package com.erickballas.ruteoseguro.viewmodel

import androidx.lifecycle.ViewModel
import com.google.android.gms.maps.model.LatLng

class MapViewModel : ViewModel() {

    // Coordenadas centrales de Quito, Ecuador
    val quitoLocation = LatLng(-0.229850, -78.524950)

    // Nivel de zoom predeterminado para ver la ciudad
    val defaultZoom = 13f
}