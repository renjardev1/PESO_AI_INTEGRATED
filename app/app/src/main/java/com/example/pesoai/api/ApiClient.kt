package com.example.pesoai.api

import com.google.gson.GsonBuilder
import com.google.gson.FieldNamingPolicy
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object ApiClient {

    // ── CONFIGURE YOUR SERVER HOST HERE ──────────────────────────────────────
    //
    //  Android Emulator → use 10.0.2.2  (maps to your PC's localhost)
    //  Physical Device  → use your PC's local IP e.g. 192.168.1.x
    //
    //  ⚠️  CRITICAL:
    //      - Port must match .env PORT (default 3000)
    //      - NO /v1/ anywhere — base path is /api/ only
    //      - Change only the host part (10.0.2.2 or 192.168.x.x)
    //
    private const val BASE_URL = "http://192.168.68.51:3000/api/"
    // ─────────────────────────────────────────────────────────────────────────

    private val logging = HttpLoggingInterceptor().apply {
        level = HttpLoggingInterceptor.Level.BODY
    }

    private val gson = GsonBuilder()
        .setFieldNamingPolicy(FieldNamingPolicy.IDENTITY)
        .create()

    private val okHttpClient = OkHttpClient.Builder()
        .addInterceptor(logging)
        .connectTimeout(30,  TimeUnit.SECONDS)
        .readTimeout(120,    TimeUnit.SECONDS)   // AI endpoints need up to 90 s
        .writeTimeout(30,    TimeUnit.SECONDS)
        .build()

    val retrofit: Retrofit by lazy {
        Retrofit.Builder()
            .baseUrl(BASE_URL)
            .addConverterFactory(GsonConverterFactory.create(gson))
            .client(okHttpClient)
            .build()
    }

    val authApi: AuthApi by lazy {
        retrofit.create(AuthApi::class.java)
    }
}