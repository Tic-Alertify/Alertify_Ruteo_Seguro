package com.erickballas.ruteoseguro.data.repository

import com.erickballas.ruteoseguro.data.api.RetrofitClient
import com.erickballas.ruteoseguro.data.model.RuteoRequest
import com.erickballas.ruteoseguro.data.model.RuteoResponse

class RuteoRepository {
    suspend fun obtenerRutaSegura(
        origenLat: Double,
        origenLng: Double,
        destinoLat: Double,
        destinoLng: Double
    ): Result<RuteoResponse> {
        return try {
            val request = RuteoRequest(origenLat, origenLng, destinoLat, destinoLng)
            // Llamamos a Retrofit
            val response = RetrofitClient.apiService.calcularRutaSegura(request)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception("Error HTTP: ${response.code()} - ${response.message()}"))
            }
        } catch (e: Exception) {
            Result.failure(Exception("Error de red: ${e.message}"))
        }
    }
}