package com.example.pesoai.ui.recurring

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.example.pesoai.R
import com.example.pesoai.api.models.RecurringTransaction
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.*
import java.util.TimeZone

class RecurringAdapter(
    private val onEditClick:   (RecurringTransaction) -> Unit,
    private val onDeleteClick: (RecurringTransaction) -> Unit
) : ListAdapter<RecurringTransaction, RecurringAdapter.ViewHolder>(DiffCallback) {

    inner class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val tvCategoryIcon: TextView = view.findViewById(R.id.tvCategoryIcon)
        val tvCategory:     TextView = view.findViewById(R.id.tvCategory)
        val tvFrequency:    TextView = view.findViewById(R.id.tvFrequency)
        val tvNextDue:      TextView = view.findViewById(R.id.tvNextDue)
        val tvAmount:       TextView = view.findViewById(R.id.tvAmount)
        val tvReminder:     TextView = view.findViewById(R.id.tvReminder)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_recurring, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val fmt = NumberFormat.getNumberInstance(Locale.US)
        val rec = getItem(position)
        holder.tvCategoryIcon.text = getCategoryEmoji(rec.category)
        // Show description as primary label if available, otherwise fall back to category
        holder.tvCategory.text     = rec.description?.takeIf { it.isNotBlank() }
            ?: rec.category.capitalizeWords()
        holder.tvFrequency.text    = formatFrequency(rec.frequency, rec.repeatInterval)
        holder.tvAmount.text       = "-₱${fmt.format(rec.amount.toInt())}"
        holder.tvReminder.visibility = if (rec.reminderEnabled) View.VISIBLE else View.GONE

// ── ADD THIS SECTION ─────────────────────────────────────────────────
// Show "Cancelled" badge for completed recurring
        when (rec.status) {
            "completed" -> {
                val completedLabel = if (!rec.completedAt.isNullOrBlank())
                    "✓ Paid on ${formatDate(rec.completedAt)}"
                else
                    "✓ Completed"
                holder.tvNextDue.text = completedLabel
                holder.tvNextDue.setTextColor(
                    androidx.core.content.ContextCompat.getColor(holder.itemView.context, R.color.success_green)
                )
                holder.itemView.alpha = 0.8f
            }
            "cancelled" -> {
                holder.tvNextDue.text = "✗ Cancelled"
                holder.tvNextDue.setTextColor(
                    androidx.core.content.ContextCompat.getColor(holder.itemView.context, R.color.error_red)
                )
                holder.itemView.alpha = 0.6f
            }
            else -> {
                holder.tvNextDue.text = "Next: ${formatDate(rec.nextRunDate)}"
                holder.tvNextDue.setTextColor(
                    androidx.core.content.ContextCompat.getColor(holder.itemView.context, R.color.text_secondary)
                )
                holder.itemView.alpha = 1.0f
            }
        }
// ─────────────────────────────────────────────────────────────────────

        holder.itemView.setOnClickListener       { onEditClick(rec)   }

        holder.itemView.setOnClickListener       { onEditClick(rec)   }
        holder.itemView.setOnLongClickListener   { onDeleteClick(rec); true }
    }

    private fun getCategoryEmoji(category: String): String = when (category.lowercase()) {
        "food & dining"    -> "🍔"
        "transport",
        "transportation"   -> "🚗"
        "shopping"         -> "🛍️"
        "bills & utilities"-> "💡"
        "health"           -> "❤️"
        "entertainment"    -> "🎬"
        "savings"          -> "💰"
        else               -> "🔁"
    }

    private fun formatFrequency(frequency: String, interval: Int): String {
        val base = when (frequency) {
            "daily"    -> if (interval == 1) "Daily"           else "Every $interval days"
            "weekly"   -> if (interval == 1) "Weekly"          else "Every $interval weeks"
            "biweekly" -> "Every 2 weeks"
            "monthly"  -> if (interval == 1) "Monthly"         else "Every $interval months"
            "yearly"   -> if (interval == 1) "Yearly"          else "Every $interval years"
            else       -> frequency.replaceFirstChar { it.uppercase() }
        }
        return base
    }

    private fun formatDate(dateStr: String): String {
        return try {
            val deviceTz = TimeZone.getDefault()

            // Parse the date — handles both "yyyy-MM-dd" and "yyyy-MM-ddTHH:mm:ss.SSSZ" formats
            val parsedDate: java.util.Date? = when {
                dateStr.length > 10 -> {
                    // Full ISO timestamp — parse as UTC then convert to device timezone
                    val formats = listOf(
                        "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
                        "yyyy-MM-dd'T'HH:mm:ss'Z'",
                        "yyyy-MM-dd'T'HH:mm:ssXXX"
                    )
                    formats.firstNotNullOfOrNull { fmt ->
                        try {
                            SimpleDateFormat(fmt, Locale.US)
                                .also { it.timeZone = TimeZone.getTimeZone("UTC") }
                                .parse(dateStr)
                        } catch (_: Exception) { null }
                    }
                }
                else -> {
                    // Plain date string — parse directly in device timezone
                    SimpleDateFormat("yyyy-MM-dd", Locale.US)
                        .also { it.timeZone = deviceTz }
                        .parse(dateStr.take(10))
                }
            } ?: return dateStr

            // Build calendar in device timezone from the parsed date
            val dateCal = Calendar.getInstance(deviceTz).also { it.time = parsedDate!! }
            dateCal.set(Calendar.HOUR_OF_DAY, 0)
            dateCal.set(Calendar.MINUTE, 0)
            dateCal.set(Calendar.SECOND, 0)
            dateCal.set(Calendar.MILLISECOND, 0)

            val todayCal = Calendar.getInstance(deviceTz).apply {
                set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 0);      set(Calendar.MILLISECOND, 0)
            }
            val tomorrowCal = Calendar.getInstance(deviceTz).apply {
                set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 0);      set(Calendar.MILLISECOND, 0)
                add(Calendar.DAY_OF_YEAR, 1)
            }

            fun isSameDay(c1: Calendar, c2: Calendar) =
                c1.get(Calendar.YEAR)        == c2.get(Calendar.YEAR) &&
                        c1.get(Calendar.DAY_OF_YEAR) == c2.get(Calendar.DAY_OF_YEAR)

            val day  = dateCal.get(Calendar.DAY_OF_MONTH)
            val year = dateCal.get(Calendar.YEAR)

            when {
                isSameDay(dateCal, todayCal)    -> "Today"
                isSameDay(dateCal, tomorrowCal) -> "Tomorrow"
                else -> String.format("%s %02d, %d",
                    dateCal.getDisplayName(Calendar.MONTH, Calendar.SHORT, Locale.getDefault()),
                    day, year)
            }
        } catch (e: Exception) { dateStr }
    }

    private fun String.capitalizeWords(): String =
        split(" ").joinToString(" ") { it.replaceFirstChar { c -> c.uppercase() } }

    companion object DiffCallback : DiffUtil.ItemCallback<RecurringTransaction>() {
        override fun areItemsTheSame(a: RecurringTransaction, b: RecurringTransaction) = a.id == b.id
        override fun areContentsTheSame(a: RecurringTransaction, b: RecurringTransaction) = a == b
    }
}