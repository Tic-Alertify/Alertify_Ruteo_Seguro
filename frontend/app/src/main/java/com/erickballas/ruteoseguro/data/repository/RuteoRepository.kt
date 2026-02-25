package com.erickballas.ruteoseguro.data.repository

import com.erickballas.ruteoseguro.data.api.RetrofitClient
import com.erickballas.ruteoseguro.data.model.RuteoRequest
import com.erickballas.ruteoseguro.data.model.RuteoResponse
import retrofit2.Response

class RuteoRepository {

    // Recibe datos primitivos, arma el DTO y se comunica con la API.
    suspend fun obtenerRutaSegura(
        origenLat: Double,
        origenLng: Double,
        destinoLat: Double,
        destinoLng: Double
    ): Response<RuteoResponse> {

        // Empaqueta los datos en el modelo que creamos antes
        val request = RuteoRequest(origenLat, origenLng, destinoLat, destinoLng)

        // Realiza la llamada de red hacia tu servidor en Azure
        return RetrofitClient.apiService.calcularRutaSegura(request)
    }
}