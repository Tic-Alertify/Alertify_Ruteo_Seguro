package com.erickballas.ruteoseguro.data.model

import com.google.gson.annotations.SerializedName

// Lo que esperamos que nos devuelva el motor-algoritmo.service.ts
data class RuteoResponse(
    @SerializedName("rutaGeometria") val rutaGeometria: String, // Polilínea codificada
    @SerializedName("tiempoEstimado") val tiempoEstimado: String,
    @SerializedName("nivelRiesgo") val nivelRiesgo: String
)