package com.erickballas.ruteoseguro.data.api

import com.erickballas.ruteoseguro.data.model.RuteoRequest
import com.erickballas.ruteoseguro.data.model.RuteoResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.POST

interface RuteoApiService {

    // Endpoint POST /api/ruteo/calcular
    @POST("api/ruteo/calcular")
    suspend fun calcularRutaSegura(
        @Body request: RuteoRequest
    ): Response<RuteoResponse>

}