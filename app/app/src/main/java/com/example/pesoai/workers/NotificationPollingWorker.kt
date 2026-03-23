package com.example.pesoai.workers

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.example.pesoai.api.ApiClient
import com.example.pesoai.utils.BudgetNotificationHelper

/**
 * Polls the server notifications table and fires Android push notifications
 * for any unread server-created notifications not yet delivered locally.
 * Uses SharedPreferences to track which notification IDs have already been shown.
 */
class NotificationPollingWorker(
    private val context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    companion object {
        private const val PREF_SHOWN_IDS = "notif_shown_ids"
    }

    override suspend fun doWork(): Result {
        val prefs  = context.getSharedPreferences("PesoAI_Prefs", Context.MODE_PRIVATE)
        val token  = "Bearer ${prefs.getString("jwt_token", "") ?: ""}"
        val userId = prefs.getString("user_id", "") ?: ""

        if (userId.isBlank() || token == "Bearer ") return Result.success()

        return try {
            val response = ApiClient.authApi.getNotifications(token, userId)
            if (response.isSuccessful && response.body()?.success == true) {
                val shownIds = prefs.getStringSet(PREF_SHOWN_IDS, emptySet())!!
                    .toMutableSet()

                val undelivered = response.body()!!.notifications
                    .filter { !it.isRead && !it.isPushed && !shownIds.contains(it.id.toString()) }

                undelivered.forEach { notif ->
                    BudgetNotificationHelper.notifyFromServer(context, notif)
                    shownIds.add(notif.id.toString())
                }

                // Persist updated shown set — trim to last 200 to prevent unbounded growth
                val trimmed = if (shownIds.size > 200)
                    shownIds.toList().takeLast(200).toSet()
                else shownIds

                prefs.edit().putStringSet(PREF_SHOWN_IDS, trimmed).apply()
            }
            Result.success()
        } catch (e: Exception) {
            android.util.Log.e("NotificationPollingWorker", "Error: ${e.message}", e)
            Result.retry()
        }
    }
}