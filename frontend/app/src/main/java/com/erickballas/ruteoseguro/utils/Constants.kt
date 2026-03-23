package com.erickballas.ruteoseguro.utils

import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.LatLngBounds

object Constants {

    // ─── API ────────────────────────────────────────────────────────────────
    // Emulador Android Studio  → "http://10.0.2.2:3000/"
    // Dispositivo físico (WiFi) → "http://192.168.X.X:3000/"
    // Producción (Azure)        → "https://tu-app-alertify.azurewebsites.net/"
    //const val BASE_URL = "http://10.0.2.2:3000/"

    // ─── Área de cobertura: Provincia de Pichincha ──────────────────────────
    // Polígono descargado de OSM — coordenadas en LatLng(lat, lon)
    // Área original: 12.461 km²
    val PICHINCHA_POLYGON: List<LatLng> = listOf(
        LatLng(-0.666, -78.601),
        LatLng(-0.672, -78.527),
        LatLng(-0.664, -78.474),
        LatLng(-0.510, -77.616),
        LatLng( 0.193, -77.682),
        LatLng( 0.254, -78.066),
        LatLng( 0.288, -78.395),
        LatLng( 0.049, -78.857),
        LatLng(-0.568, -78.875),
        LatLng(-0.664, -78.697)
    )

    // Bounding box del polígono — restringe el autocompletado de Places a Pichincha
    val PICHINCHA_BOUNDS: LatLngBounds = LatLngBounds(
        LatLng(-0.672, -78.875), // SW — esquina inferior izquierda
        LatLng( 0.288, -77.616)  // NE — esquina superior derecha
    )
}
