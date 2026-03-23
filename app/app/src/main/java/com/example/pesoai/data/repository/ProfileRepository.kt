package com.example.pesoai.data.repository

import com.example.pesoai.api.ApiClient
import com.example.pesoai.api.models.ProfileResponse
import com.example.pesoai.api.models.UpdateProfileRequest
import com.example.pesoai.api.models.UpdateBudgetRequest
import com.example.pesoai.api.models.UpdateBudgetResponse
import com.example.pesoai.api.models.ChangePasswordRequest
import com.example.pesoai.api.models.ChangePasswordResponse
import com.example.pesoai.api.models.DeleteAccountRequest
import com.example.pesoai.api.models.DeleteAccountResponse

class ProfileRepository {

    suspend fun getUserProfile(token: String, userId: String): ProfileResponse {
        val response = ApiClient.authApi.getUserProfile(token, userId)
        if (response.isSuccessful) return response.body()!!
        throw Exception("Failed to get profile: ${response.errorBody()?.string()}")
    }

    suspend fun updateProfile(token: String, userId: String, request: UpdateProfileRequest): ProfileResponse {
        val response = ApiClient.authApi.updateProfile(token, userId, request)
        if (response.isSuccessful) return response.body()!!
        throw Exception("Failed to update profile: ${response.errorBody()?.string()}")
    }

    suspend fun updateBudget(token: String, userId: String, request: UpdateBudgetRequest): UpdateBudgetResponse {
        val response = ApiClient.authApi.updateBudget(token, userId, request)
        if (response.isSuccessful) return response.body()!!
        throw Exception("Failed to update budget: ${response.errorBody()?.string()}")
    }

    suspend fun changePassword(token: String, userId: String, request: ChangePasswordRequest): ChangePasswordResponse {
        val response = ApiClient.authApi.changePassword(token, userId, request)
        if (response.isSuccessful) return response.body()!!
        throw Exception("Failed to change password: ${response.errorBody()?.string()}")
    }

    suspend fun deleteAccount(token: String, userId: String, request: DeleteAccountRequest): DeleteAccountResponse {
        val response = ApiClient.authApi.deleteAccount(token, userId, request)
        if (response.isSuccessful) return response.body()!!
        throw Exception("Failed to delete account: ${response.errorBody()?.string()}")
    }
}
