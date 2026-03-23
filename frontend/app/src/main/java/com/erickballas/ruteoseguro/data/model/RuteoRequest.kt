package com.erickballas.ruteoseguro.data.model

import com.google.gson.annotations.SerializedName

// Este es el JSON que enviaremos
data class RuteoRequest(
    @SerializedName("origenLat") val origenLat: Double,
    @SerializedName("origenLng") val origenLng: Double,
    @SerializedName("destinoLat") val destinoLat: Double,
    @SerializedName("destinoLng") val destinoLng: Double
)