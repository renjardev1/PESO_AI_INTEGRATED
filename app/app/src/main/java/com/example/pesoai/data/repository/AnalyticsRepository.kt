package com.example.pesoai.data.repository

import com.example.pesoai.api.ApiClient
import com.example.pesoai.api.models.AnalyticsResponse

class AnalyticsRepository {

    // ✅ token always passed as "Bearer <jwt>" — ApiClient.authApi requires @Header("Authorization")
    suspend fun getAnalytics(
        token: String,
        userId: String,
        startDate: String,
        endDate: String
    ): AnalyticsResponse {
        val response = ApiClient.authApi.getAnalytics(token, userId, startDate, endDate)
        if (response.isSuccessful) return response.body()!!
        throw Exception(
            "Analytics load failed (${response.code()}): ${response.errorBody()?.string() ?: "no body"}"
        )
    }
}