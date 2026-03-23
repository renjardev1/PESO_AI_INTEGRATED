package com.example.pesoai.data.repository

import com.example.pesoai.api.ApiClient
import com.example.pesoai.api.models.ChangePasswordRequest
import com.example.pesoai.api.models.ChangePasswordResponse
import com.example.pesoai.api.models.DeleteAccountRequest
import com.example.pesoai.api.models.DeleteAccountResponse
import com.example.pesoai.api.models.OnboardingRequest
import com.example.pesoai.api.models.OnboardingResponse
import com.example.pesoai.api.models.ProfileResponse
import com.example.pesoai.api.models.UpdateBudgetRequest
import com.example.pesoai.api.models.UpdateBudgetResponse
import com.example.pesoai.api.models.UpdateProfileRequest
import com.example.pesoai.api.models.UploadProfilePictureRequest
import com.example.pesoai.api.models.UploadProfilePictureResponse

class UserProfileRepository {

    suspend fun completeOnboarding(
        token: String,
        userId: String,
        age: Int,
        gender: String,
        occupation: String,
        monthlyIncome: Double,
        monthlyExpenses: Double,
        financialGoals: List<String>,
        riskTolerance: String
    ): OnboardingResponse {
        val request = OnboardingRequest(
            userId          = userId,
            age             = age,
            gender          = gender,
            occupation      = occupation,
            monthlyIncome   = monthlyIncome,
            financialGoals  = financialGoals,
            riskTolerance   = riskTolerance
        )
        val response = ApiClient.authApi.completeOnboarding(token, request)
        if (response.isSuccessful) return response.body()!!
        throw Exception("Failed to complete onboarding: ${response.errorBody()?.string()}")
    }

    suspend fun getUserProfile(token: String, userId: String): ProfileResponse {
        val response = ApiClient.authApi.getUserProfile(token, userId)
        if (response.isSuccessful) return response.body()!!
        throw Exception("Failed to get profile: ${response.errorBody()?.string()}")
    }

    // Called with explicit request object
    suspend fun updateProfile(
        token: String,
        userId: String,
        request: UpdateProfileRequest
    ): ProfileResponse {
        val response = ApiClient.authApi.updateProfile(token, userId, request)
        if (response.isSuccessful) return response.body()!!
        throw Exception("Failed to update profile: ${response.errorBody()?.string()}")
    }

    // Overload: called by UserProfileViewModel and SettingsViewModel with individual fields
    suspend fun updateProfile(
        token: String,
        userId: String,
        firstName:     String? = null,
        lastName:      String? = null,
        email:         String? = null,
        username:      String? = null,
        phone:         String? = null,
        location:      String? = null,
        riskTolerance: String? = null   // Phase 2
    ): ProfileResponse {
        val request = UpdateProfileRequest(
            firstName     = firstName,
            lastName      = lastName,
            email         = email,
            username      = username,
            phone         = phone,
            location      = location,
            riskTolerance = riskTolerance
        )
        val response = ApiClient.authApi.updateProfile(token, userId, request)
        if (response.isSuccessful) return response.body()!!
        throw Exception("Failed to update profile: ${response.errorBody()?.string()}")
    }

    suspend fun updateBudget(
        token: String,
        userId: String,
        request: UpdateBudgetRequest
    ): UpdateBudgetResponse {
        val response = ApiClient.authApi.updateBudget(token, userId, request)
        if (response.isSuccessful) return response.body()!!
        throw Exception("Failed to update budget: ${response.errorBody()?.string()}")
    }

    suspend fun changePassword(
        token: String,
        userId: String,
        oldPassword: String,
        newPassword: String
    ): ChangePasswordResponse {
        val response = ApiClient.authApi.changePassword(
            token, userId,
            ChangePasswordRequest(oldPassword = oldPassword, newPassword = newPassword)
        )
        if (response.isSuccessful) return response.body()!!
        throw Exception("Failed to change password: ${response.errorBody()?.string()}")
    }

    suspend fun deleteAccount(
        token: String,
        userId: String,
        password: String
    ): DeleteAccountResponse {
        val response = ApiClient.authApi.deleteAccount(
            token, userId, DeleteAccountRequest(password = password)
        )
        if (response.isSuccessful) return response.body()!!
        throw Exception("Failed to delete account: ${response.errorBody()?.string()}")
    }

    suspend fun uploadProfilePicture(
        token: String,
        userId: String,
        base64Image: String   // ✅ must start with "data:image/"
    ): UploadProfilePictureResponse {
        val response = ApiClient.authApi.uploadProfilePicture(
            token, userId, UploadProfilePictureRequest(profilePicture = base64Image)
        )
        if (response.isSuccessful) return response.body()!!
        throw Exception("Failed to upload picture: ${response.errorBody()?.string()}")
    }
}