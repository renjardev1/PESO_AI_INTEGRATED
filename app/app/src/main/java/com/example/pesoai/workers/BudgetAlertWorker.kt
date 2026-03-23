package com.example.pesoai.workers

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.example.pesoai.api.ApiClient
import com.example.pesoai.utils.BudgetNotificationHelper

class BudgetAlertWorker(
    private val context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val prefs  = context.getSharedPreferences("PesoAI_Prefs", Context.MODE_PRIVATE)
        val token  = "Bearer ${prefs.getString("jwt_token", "") ?: ""}"
        val userId = prefs.getString("user_id", "") ?: ""

        if (userId.isBlank() || token == "Bearer ") return Result.success()

        return try {
            val response = ApiClient.authApi.getDashboard(token, userId)
            if (response.isSuccessful && response.body()?.success == true) {
                val data   = response.body()!!
                val budget = data.monthlyIncome
                val spent  = data.totalSpent
                if (budget > 0) {
                    BudgetNotificationHelper.checkAndNotifyTiers(context, spent, budget)
                }
            }
            Result.success()
        } catch (e: Exception) {
            android.util.Log.e("BudgetAlertWorker", "Error: ${e.message}", e)
            Result.retry()
        }
    }
}