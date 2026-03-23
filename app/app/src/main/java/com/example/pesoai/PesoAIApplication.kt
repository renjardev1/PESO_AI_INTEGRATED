package com.example.pesoai

import android.app.Application
import androidx.work.*
import com.example.pesoai.utils.BudgetNotificationHelper
import com.example.pesoai.workers.BudgetAlertWorker
import com.example.pesoai.workers.NotificationPollingWorker
import com.example.pesoai.workers.RecurringReminderWorker
import java.util.concurrent.TimeUnit

class PesoAIApplication : Application() {

    override fun onCreate() {
        super.onCreate()
        BudgetNotificationHelper.createNotificationChannels(this)
        scheduleWorkers()
    }

    private fun scheduleWorkers() {
        val networkConstraint = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        // GROUP G TEST MODE: all workers run every 15 minutes for demo control
        // TODO: restore to 6h / 24h / 6h before production release
        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            "BudgetAlertWorker",
            ExistingPeriodicWorkPolicy.KEEP,
            PeriodicWorkRequestBuilder<BudgetAlertWorker>(15, TimeUnit.MINUTES)
                .setConstraints(networkConstraint)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 15, TimeUnit.MINUTES)
                .build()
        )

        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            "RecurringReminderWorker",
            ExistingPeriodicWorkPolicy.KEEP,
            PeriodicWorkRequestBuilder<RecurringReminderWorker>(15, TimeUnit.MINUTES)
                .setConstraints(networkConstraint)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 15, TimeUnit.MINUTES)
                .build()
        )

        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            "NotificationPollingWorker",
            ExistingPeriodicWorkPolicy.KEEP,
            PeriodicWorkRequestBuilder<NotificationPollingWorker>(15, TimeUnit.MINUTES)
                .setConstraints(networkConstraint)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 15, TimeUnit.MINUTES)
                .build()
        )
    }
}