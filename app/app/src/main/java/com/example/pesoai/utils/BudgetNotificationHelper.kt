package com.example.pesoai.utils

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import com.example.pesoai.MainActivity
import com.example.pesoai.R
import com.example.pesoai.api.models.AppNotification
import com.example.pesoai.api.models.RecurringTransaction
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.*

object BudgetNotificationHelper {

    // ── Channel IDs ───────────────────────────────────────────────────────────
    private const val CHANNEL_BUDGET_50    = "budget_alert_50"
    private const val CHANNEL_BUDGET_80    = "budget_alert_80"
    private const val CHANNEL_BUDGET_100   = "budget_alert_100"
    private const val CHANNEL_RECURRING    = "recurring_reminders"
    private const val CHANNEL_SAVINGS      = "savings_contributions"
    private const val CHANNEL_GOAL         = "goal_completed"

    private const val CHANNEL_DAILY        = "daily_reminders"

    // ── Notification IDs ──────────────────────────────────────────────────────
    private const val NOTIF_ID_BUDGET_50  = 2001
    private const val NOTIF_ID_BUDGET_80  = 2002
    private const val NOTIF_ID_BUDGET_100 = 2003

    // ── Pref keys for duplicate prevention ───────────────────────────────────
    private const val PREF_ALERT_50_MONTH  = "budget_alert_50_month"
    private const val PREF_ALERT_80_MONTH  = "budget_alert_80_month"
    private const val PREF_ALERT_100_MONTH = "budget_alert_100_month"

    // ── Channel registration ──────────────────────────────────────────────────

    fun createNotificationChannels(context: Context) {
        if (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.O) return
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        nm.createNotificationChannel(NotificationChannel(
            CHANNEL_BUDGET_50, "Budget Awareness",
            NotificationManager.IMPORTANCE_HIGH
        ).apply { description = "Notifies at 50% of monthly budget" })

        nm.createNotificationChannel(NotificationChannel(
            CHANNEL_BUDGET_80, "Budget Warning",
            NotificationManager.IMPORTANCE_HIGH
        ).apply { description = "Notifies at 80% of monthly budget" })

        nm.createNotificationChannel(NotificationChannel(
            CHANNEL_BUDGET_100, "Budget Critical",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Notifies at 100% of monthly budget"
            enableVibration(true)
        })

        nm.createNotificationChannel(NotificationChannel(
            CHANNEL_RECURRING, "Recurring Reminders",
            NotificationManager.IMPORTANCE_HIGH
        ).apply { description = "Reminders for upcoming recurring transactions" })

        nm.createNotificationChannel(NotificationChannel(
            CHANNEL_SAVINGS, "Savings Contributions",
            NotificationManager.IMPORTANCE_DEFAULT
        ).apply { description = "Notifies when a savings contribution is added" })

        nm.createNotificationChannel(NotificationChannel(
            CHANNEL_GOAL, "Goal Completed",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Notifies when a savings goal is completed"
            enableVibration(true)
        })

        nm.createNotificationChannel(NotificationChannel(
            CHANNEL_DAILY, "Daily Reminders",
            NotificationManager.IMPORTANCE_DEFAULT
        ).apply { description = "Daily budget check-ins and spending summaries" })
    }

    // ── Legacy single-channel registration (kept for backwards compat) ────────
    fun createNotificationChannel(context: Context) = createNotificationChannels(context)

    // ── Legacy single-threshold check (called from TransactionFragment) ───────
    fun checkAndNotify(context: Context, totalSpent: Double) {
        val prefs  = context.getSharedPreferences("PesoAI_Prefs", Context.MODE_PRIVATE)
        val budget = prefs.getFloat("user_monthly_budget", 0f).toDouble()
        if (budget > 0) checkAndNotifyTiers(context, totalSpent, budget)
    }

    // ── Phase 3: Tiered budget alert checks ───────────────────────────────────

    fun checkAndNotifyTiers(context: Context, spent: Double, budget: Double) {
        val prefs = context.getSharedPreferences("PesoAI_Prefs", Context.MODE_PRIVATE)
        if (!prefs.getBoolean("push_notifications", true)) return
        if (!prefs.getBoolean("budget_alerts", true)) return

        val pct          = (spent / budget) * 100
        val currentMonth = SimpleDateFormat("yyyy-MM", Locale.US).format(Date())
        val fmt          = NumberFormat.getNumberInstance(Locale.US)

        data class Tier(
            val threshold: Double,
            val prefKey:   String,
            val channelId: String,
            val notifId:   Int,
            val title:     String,
            val body:      String
        )

        val tiers = listOf(
            Tier(100.0, PREF_ALERT_100_MONTH, CHANNEL_BUDGET_100, NOTIF_ID_BUDGET_100,
                "🚨 Budget Critical",
                "You've reached 100% of your ₱${fmt.format(budget.toInt())} budget."),
            Tier(80.0,  PREF_ALERT_80_MONTH,  CHANNEL_BUDGET_80,  NOTIF_ID_BUDGET_80,
                "⚠️ Budget Warning",
                "You've spent ₱${fmt.format(spent.toInt())} — 80% of your ₱${fmt.format(budget.toInt())} budget."),
            Tier(50.0,  PREF_ALERT_50_MONTH,  CHANNEL_BUDGET_50,  NOTIF_ID_BUDGET_50,
                "💡 Budget Awareness",
                "You've spent ₱${fmt.format(spent.toInt())} — 50% of your ₱${fmt.format(budget.toInt())} budget."),
        )

        for (tier in tiers) {
            if (pct < tier.threshold) continue
            val lastMonth = prefs.getString(tier.prefKey, "")
            if (lastMonth == currentMonth) continue   // already fired this month

            prefs.edit().putString(tier.prefKey, currentMonth).apply()
            fireNotification(context, tier.channelId, tier.notifId, tier.title, tier.body)
            break
        }
    }

    // ── Recurring reminders ───────────────────────────────────────────────────

    fun notifyRecurringDueToday(context: Context, rec: RecurringTransaction) {
        val prefs   = context.getSharedPreferences("PesoAI_Prefs", Context.MODE_PRIVATE)
        if (!prefs.getBoolean("push_notifications", true)) return
        val fmt     = NumberFormat.getNumberInstance(Locale.US)
        val notifId = CHANNEL_RECURRING.hashCode() + rec.id
        fireNotification(
            context, CHANNEL_RECURRING, notifId,
            "🔁 Recurring Due Today",
            "₱${fmt.format(rec.amount.toInt())} for ${rec.category} is due today."
        )
    }

    fun notifyRecurringDueTomorrow(context: Context, rec: RecurringTransaction) {
        val prefs   = context.getSharedPreferences("PesoAI_Prefs", Context.MODE_PRIVATE)
        if (!prefs.getBoolean("push_notifications", true)) return
        val fmt     = NumberFormat.getNumberInstance(Locale.US)
        val notifId = CHANNEL_RECURRING.hashCode() + rec.id + 10_000
        fireNotification(
            context, CHANNEL_RECURRING, notifId,
            "🔁 Upcoming Recurring Transaction",
            "₱${fmt.format(rec.amount.toInt())} for ${rec.category} is due tomorrow."
        )
    }

    // ── Server notification delivery ──────────────────────────────────────────

    fun notifyFromServer(context: Context, notif: AppNotification) {
        val prefs = context.getSharedPreferences("PesoAI_Prefs", Context.MODE_PRIVATE)
        if (!prefs.getBoolean("push_notifications", true)) return

        val channelId = when {
            notif.type.startsWith("budget_alert_50")  -> CHANNEL_BUDGET_50
            notif.type.startsWith("budget_alert_80")  -> CHANNEL_BUDGET_80
            notif.type.startsWith("budget_alert_100") -> CHANNEL_BUDGET_100
            notif.type == "recurring"                 -> CHANNEL_RECURRING
            notif.type == "savings_contribution"      -> CHANNEL_SAVINGS
            notif.type == "goal_completed"            -> CHANNEL_GOAL
            notif.type == "daily_reminder"            -> CHANNEL_DAILY  // ← ADD THIS
            else                                      -> CHANNEL_BUDGET_80
        }

        // Use time-based ID — prevents silent replacement if same DB row ID
        // was already posted to the tray by NotificationPollingWorker
        val androidNotifId = (System.currentTimeMillis() % Int.MAX_VALUE).toInt()

        fireNotification(context, channelId, androidNotifId, notif.title, notif.body)
    }

    // ── Core fire function ────────────────────────────────────────────────────

    private fun fireNotification(
        context:   Context,
        channelId: String,
        notifId:   Int,
        title:     String,
        body:      String
    ) {
        val tapIntent = PendingIntent.getActivity(
            context, notifId,
            Intent(context, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val notification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(
                if (channelId == CHANNEL_BUDGET_100) NotificationCompat.PRIORITY_HIGH
                else NotificationCompat.PRIORITY_DEFAULT
            )
            .setContentIntent(tapIntent)
            .setAutoCancel(true)
            .build()

        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(notifId, notification)
    }
}