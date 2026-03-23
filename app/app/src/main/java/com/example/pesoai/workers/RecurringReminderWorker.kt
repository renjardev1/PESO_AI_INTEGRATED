package com.example.pesoai.workers

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.example.pesoai.api.ApiClient
import com.example.pesoai.utils.BudgetNotificationHelper
import java.text.SimpleDateFormat
import java.util.*

class RecurringReminderWorker(
    private val context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val prefs  = context.getSharedPreferences("PesoAI_Prefs", Context.MODE_PRIVATE)
        val token  = "Bearer ${prefs.getString("jwt_token", "") ?: ""}"
        val userId = prefs.getString("user_id", "") ?: ""

        if (userId.isBlank() || token == "Bearer ") return Result.success()

        return try {
            val response = ApiClient.authApi.getRecurring(token, userId)
            if (response.isSuccessful && response.body()?.success == true) {
                val sdf      = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
                val today    = sdf.format(Date())
                val tomorrow = sdf.format(Date(System.currentTimeMillis() + 86_400_000L))

                response.body()!!.data
                    .filter { it.status == "active" }
                    .forEach { rec ->
                        val dueDate = rec.nextRunDate.take(10)
                        when (dueDate) {
                            today    -> BudgetNotificationHelper.notifyRecurringDueToday(context, rec)
                            tomorrow -> BudgetNotificationHelper.notifyRecurringDueTomorrow(context, rec)
                        }
                    }
            }
            Result.success()
        } catch (e: Exception) {
            android.util.Log.e("RecurringReminderWorker", "Error: ${e.message}", e)
            Result.retry()
        }
    }
}