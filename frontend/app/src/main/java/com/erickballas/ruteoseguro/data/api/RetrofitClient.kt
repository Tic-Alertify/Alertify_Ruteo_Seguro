package com.erickballas.ruteoseguro.data.api

import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import com.erickballas.ruteoseguro.BuildConfig

object RetrofitClient {

    // ─── Cambia según el entorno de prueba ───────────────────────────────────
    // Emulador Android Studio  → "http://10.0.2.2:3000/"
    // Dispositivo físico (WiFi) → "http://192.168.X.X:3000/"  (tu IP local)
    // Producción (Azure)        → "https://tu-app-alertify.azurewebsites.net/"
    private const val BASE_URL = BuildConfig.BASE_URL

    private val retrofit by lazy {
        Retrofit.Builder()
            .baseUrl(BASE_URL)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }

    val apiService: RuteoApiService by lazy {
        retrofit.create(RuteoApiService::class.java)
    }
}