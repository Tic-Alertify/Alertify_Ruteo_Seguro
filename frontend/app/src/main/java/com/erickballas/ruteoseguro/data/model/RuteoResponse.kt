package com.erickballas.ruteoseguro.data.model

import com.google.gson.annotations.SerializedName

data class RuteoResponse(
    @SerializedName("rutaGeometria") val rutaGeometria: String,
    @SerializedName("distanciaMetros") val distanciaMetros: Double,
    @SerializedName("tiempoEstimado") val tiempoEstimado: String,
    @SerializedName("nivelRiesgo") val nivelRiesgo: String
)