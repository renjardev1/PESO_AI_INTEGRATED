package com.example.pesoai.data.repository

import com.example.pesoai.api.ApiClient
import com.example.pesoai.api.models.DashboardResponse

class DashboardRepository {

    suspend fun getDashboardData(token: String, userId: String): DashboardResponse {
        val response = ApiClient.authApi.getDashboardData(token, userId)
        if (response.isSuccessful) return response.body()!!
        throw Exception("Failed to get dashboard data: ${response.errorBody()?.string()}")
    }
}