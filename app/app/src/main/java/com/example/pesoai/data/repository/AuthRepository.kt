package com.example.pesoai.data.repository

import com.example.pesoai.api.ApiClient
import com.example.pesoai.api.models.AuthResponse
import com.example.pesoai.api.models.LoginRequest
import com.example.pesoai.api.models.SignupRequest

class AuthRepository {

    suspend fun login(
        username: String,
        email: String,
        password: String
    ): AuthResponse {
        val response = ApiClient.authApi.login(
            LoginRequest(username, email, password)
        )
        if (response.isSuccessful) {
            return response.body()!!
        } else {
            val error = response.errorBody()?.string()
            throw Exception("Login failed: ${error ?: "Unknown error"}")
        }
    }

    suspend fun signup(
        firstName: String,
        lastName: String,
        username: String,
        email: String,
        password: String
    ): AuthResponse {
        val response = ApiClient.authApi.signup(
            SignupRequest(firstName, lastName, username, email, password)
        )
        if (response.isSuccessful) {
            return response.body()!!
        } else {
            val error = response.errorBody()?.string()
            throw Exception("Signup failed: ${error ?: "Unknown error"}")
        }
    }
}