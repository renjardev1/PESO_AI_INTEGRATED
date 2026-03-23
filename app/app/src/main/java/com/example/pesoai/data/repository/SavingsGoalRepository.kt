package com.example.pesoai.data.repository

import com.example.pesoai.api.ApiClient
import com.example.pesoai.api.models.ContributionRequest
import com.example.pesoai.api.models.GoalRequest
import com.example.pesoai.api.models.GoalProgressResponse
import com.example.pesoai.api.models.ContributionsResponse
import com.example.pesoai.api.models.SavingsGoal

class SavingsGoalRepository {

    // ✅ All methods take token as first param — AuthApi requires @Header("Authorization")

    suspend fun getGoals(
        token: String,
        userId: String,
        status: String? = null
    ): List<SavingsGoal> {
        val response = ApiClient.authApi.getGoalsFiltered(token, userId, status)
        if (response.isSuccessful) return response.body()?.goals ?: emptyList()
        throw Exception("Failed to get goals (${response.code()}): ${response.errorBody()?.string() ?: "Unknown error"}")
    }

    suspend fun addGoal(
        token: String,
        userId: String,
        goalName: String,
        targetAmount: Double,
        currentAmount: Double = 0.0,
        deadline: String?,
        category: String?,
        icon: String? = "🎯",
        color: String? = "#2196F3"
    ): SavingsGoal {
        val request = GoalRequest(
            userId        = userId,
            goalName      = goalName,
            targetAmount  = targetAmount,
            currentAmount = currentAmount,
            deadline      = deadline,
            category      = category,
            icon          = icon,
            color         = color
        )
        val response = ApiClient.authApi.addGoal(token, request)
        if (response.isSuccessful) return response.body()!!.goal
        throw Exception("Failed to add goal (${response.code()}): ${response.errorBody()?.string() ?: "Unknown error"}")
    }

    suspend fun updateGoal(
        token: String,
        userId: String,
        goalId: Int,
        goalName: String,
        targetAmount: Double,
        currentAmount: Double,
        deadline: String?,
        category: String?,
        icon: String? = "🎯",
        color: String? = "#2196F3"
    ): SavingsGoal {
        val request = GoalRequest(
            userId        = userId,
            goalName      = goalName,
            targetAmount  = targetAmount,
            currentAmount = currentAmount,
            deadline      = deadline,
            category      = category,
            icon          = icon,
            color         = color
        )
        val response = ApiClient.authApi.updateGoal(token, userId, goalId, request)
        if (response.isSuccessful) return response.body()!!.goal
        throw Exception("Failed to update goal (${response.code()}): ${response.errorBody()?.string() ?: "Unknown error"}")
    }

    // ✅ contributeToGoal — inserts savings transaction + updates current_amount on backend
    suspend fun contributeToGoal(
        token: String,
        userId: String,
        goalId: Int,
        amount: Double
    ): SavingsGoal {
        val response = ApiClient.authApi.contributeToGoal(
            token, userId, goalId, ContributionRequest(amount)
        )
        if (response.isSuccessful) return response.body()!!.goal
        throw Exception("Failed to contribute (${response.code()}): ${response.errorBody()?.string() ?: "Unknown error"}")
    }

    suspend fun deleteGoal(token: String, userId: String, goalId: Int): Boolean {
        val response = ApiClient.authApi.deleteGoal(token, userId, goalId)
        return response.isSuccessful
    }

    suspend fun getGoalContributions(
        token: String,
        userId: String,
        goalId: Int,
        page: Int = 1,
        limit: Int = 50
    ): ContributionsResponse {
        val response = ApiClient.authApi.getGoalContributions(token, userId, goalId, page, limit)
        if (response.isSuccessful) return response.body()!!
        throw Exception("Failed to get contributions (${response.code()}): ${response.errorBody()?.string() ?: "Unknown error"}")
    }
}