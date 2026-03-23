package com.erickballas.ruteoseguro.data.api

import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import com.erickballas.ruteoseguro.BuildConfig
import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit

object RetrofitClient {
    // ─── Cambia según el entorno de prueba ───────────────────────────────────
    // Emulador Android Studio  → "http://10.0.2.2:3000/"
    // Dispositivo físico (WiFi) → "http://192.168.X.X:3000/"  (tu IP local)
    // Producción (Azure)        → "https://tu-app-alertify.azurewebsites.net/"

    private val baseUrl: String by lazy {
        val configuredUrl = BuildConfig.BASE_URL.trim()
        require(configuredUrl.isNotEmpty()) {
            "BASE_URL no está configurada. Declara BASE_URL en frontend/local.properties"
        }
        if (configuredUrl.endsWith('/')) configuredUrl else "$configuredUrl/"
    }

    private val okHttpClient: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(120, TimeUnit.SECONDS)
            .readTimeout(120, TimeUnit.SECONDS)
            .callTimeout(120, TimeUnit.SECONDS)
            .build()
    }

    private val retrofit by lazy {
        Retrofit.Builder()
            .baseUrl(baseUrl)
                .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }

    val apiService: RuteoApiService by lazy {
        retrofit.create(RuteoApiService::class.java)
    }
}