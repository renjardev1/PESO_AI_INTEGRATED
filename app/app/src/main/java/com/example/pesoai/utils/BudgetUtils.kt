package com.example.pesoai.utils

import androidx.annotation.ColorRes
import com.example.pesoai.R
import java.text.SimpleDateFormat
import java.util.*

object BudgetUtils {

    fun calculatePeriodBudget(monthlyBudget: Double, period: String): Double {
        return when (period) {
            "Daily"      -> monthlyBudget / 30
            "Weekly"     -> monthlyBudget / 4
            "Bi-monthly" -> monthlyBudget / 2
            "Monthly"    -> monthlyBudget
            else         -> monthlyBudget
        }
    }

    fun getPeriodLabel(period: String): String {
        return when (period) {
            "Daily"      -> "today"
            "Weekly"     -> "this week"
            "Bi-monthly" -> "this fortnight"
            "Monthly"    -> "this month"
            else         -> "this month"
        }
    }

    fun getShortPeriodLabel(period: String): String {
        return when (period) {
            "Daily"      -> "day"
            "Weekly"     -> "week"
            "Bi-monthly" -> "2 weeks"
            "Monthly"    -> "month"
            else         -> "month"
        }
    }

    fun getCurrentPeriodDates(period: String): Pair<Date, Date> {
        val calendar = Calendar.getInstance()
        val endDate  = calendar.time

        when (period) {
            "Daily" -> {
                calendar.set(Calendar.HOUR_OF_DAY, 0)
                calendar.set(Calendar.MINUTE, 0)
                calendar.set(Calendar.SECOND, 0)
                calendar.set(Calendar.MILLISECOND, 0)
            }
            "Weekly" -> {
                calendar.set(Calendar.DAY_OF_WEEK, Calendar.MONDAY)
                calendar.set(Calendar.HOUR_OF_DAY, 0)
                calendar.set(Calendar.MINUTE, 0)
                calendar.set(Calendar.SECOND, 0)
                calendar.set(Calendar.MILLISECOND, 0)
            }
            "Bi-monthly" -> {
                val dayOfMonth = calendar.get(Calendar.DAY_OF_MONTH)
                calendar.set(Calendar.DAY_OF_MONTH, if (dayOfMonth <= 15) 1 else 16)
                calendar.set(Calendar.HOUR_OF_DAY, 0)
                calendar.set(Calendar.MINUTE, 0)
                calendar.set(Calendar.SECOND, 0)
                calendar.set(Calendar.MILLISECOND, 0)
            }
            "Monthly" -> {
                calendar.set(Calendar.DAY_OF_MONTH, 1)
                calendar.set(Calendar.HOUR_OF_DAY, 0)
                calendar.set(Calendar.MINUTE, 0)
                calendar.set(Calendar.SECOND, 0)
                calendar.set(Calendar.MILLISECOND, 0)
            }
        }

        return Pair(calendar.time, endDate)
    }

    fun formatPeriodRange(period: String): String {
        val (startDate, endDate) = getCurrentPeriodDates(period)
        val dateFormat = SimpleDateFormat("MMM dd", Locale.getDefault())
        return when (period) {
            "Daily"                -> SimpleDateFormat("MMMM dd, yyyy", Locale.getDefault()).format(startDate)
            "Weekly", "Bi-monthly" -> "${dateFormat.format(startDate)} - ${dateFormat.format(endDate)}"
            "Monthly"              -> SimpleDateFormat("MMMM yyyy", Locale.getDefault()).format(startDate)
            else                   -> SimpleDateFormat("MMMM yyyy", Locale.getDefault()).format(startDate)
        }
    }

    fun calculateBudgetPercentage(spent: Double, budget: Double): Int {
        if (budget <= 0) return 0
        return ((spent / budget) * 100).toInt().coerceIn(0, 100)
    }

    /**
     * Returns a color resource ID based on the current budget usage percentage.
     * Use with ContextCompat.getColor(context, getBudgetStatusColorRes(pct)).
     */
    @ColorRes
    fun getBudgetStatusColorRes(percentage: Int): Int {
        return when {
            percentage >= 90 -> R.color.error_red
            percentage >= 75 -> R.color.warning_orange
            percentage >= 50 -> R.color.warning_orange
            else             -> R.color.success_green
        }
    }

    fun getDaysRemainingInPeriod(period: String): Int {
        val calendar = Calendar.getInstance()
        return when (period) {
            "Daily"      -> 1
            "Weekly"     -> {
                val daysUntilSunday = (Calendar.SUNDAY - calendar.get(Calendar.DAY_OF_WEEK) + 7) % 7
                if (daysUntilSunday == 0) 7 else daysUntilSunday
            }
            "Bi-monthly" -> {
                val dayOfMonth = calendar.get(Calendar.DAY_OF_MONTH)
                if (dayOfMonth <= 15) 15 - dayOfMonth + 1
                else calendar.getActualMaximum(Calendar.DAY_OF_MONTH) - dayOfMonth + 1
            }
            "Monthly"    -> {
                calendar.getActualMaximum(Calendar.DAY_OF_MONTH) - calendar.get(Calendar.DAY_OF_MONTH) + 1
            }
            else         -> 30
        }
    }

    /**
     * Returns ISO-8601 date string pair (startDate, endDate) for the current period.
     * Used for API calls: viewModel.loadTransactions(token, userId, startDate, endDate)
     */
    fun getPeriodDates(period: String): Pair<String, String> {
        val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
        val (startDate, endDate) = getCurrentPeriodDates(period)
        return Pair(sdf.format(startDate), sdf.format(endDate))
    }
}