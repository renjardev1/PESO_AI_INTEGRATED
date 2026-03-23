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

/**
 * Compact horizontal-scroll adapter for the Upcoming Recurring preview
 * strip inside TransactionFragment. Uses item_recurring_preview.xml.
 * Tapping any card navigates to the full Recurring screen.
 */
class RecurringPreviewAdapter(
    private val onClick: (RecurringTransaction) -> Unit
) : ListAdapter<RecurringTransaction, RecurringPreviewAdapter.ViewHolder>(DiffCallback) {

    inner class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val tvIcon:      TextView = view.findViewById(R.id.tvPreviewIcon)
        val tvCategory:  TextView = view.findViewById(R.id.tvPreviewCategory)
        val tvAmount:    TextView = view.findViewById(R.id.tvPreviewAmount)
        val tvFrequency: TextView = view.findViewById(R.id.tvPreviewFrequency)
        val tvNextDue:   TextView = view.findViewById(R.id.tvPreviewNextDue)

        init {
            view.setOnClickListener { onClick(getItem(bindingAdapterPosition)) }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_recurring_preview, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val rec = getItem(position)
        val fmt = NumberFormat.getNumberInstance(Locale.US)

        holder.tvIcon.text      = getCategoryEmoji(rec.category)
        holder.tvCategory.text  = rec.description?.takeIf { it.isNotBlank() }
            ?: rec.category.split(" ").joinToString(" ") { it.replaceFirstChar { c -> c.uppercase() } }
        holder.tvAmount.text    = "-₱${fmt.format(rec.amount.toInt())}"
        holder.tvFrequency.text = formatFrequency(rec.frequency)
        holder.tvNextDue.text   = "Due ${formatDate(rec.nextRunDate)}"
    }

    private fun getCategoryEmoji(category: String): String = when (category.lowercase()) {
        "food & dining"     -> "🍔"
        "transport",
        "transportation"    -> "🚗"
        "shopping"          -> "🛍️"
        "bills & utilities" -> "💡"
        "health"            -> "❤️"
        "entertainment"     -> "🎬"
        "savings"           -> "💰"
        else                -> "🔁"
    }

    private fun formatFrequency(frequency: String): String = when (frequency) {
        "daily"    -> "Daily"
        "weekly"   -> "Weekly"
        "biweekly" -> "Bi-weekly"
        "monthly"  -> "Monthly"
        "yearly"   -> "Yearly"
        else       -> frequency.replaceFirstChar { it.uppercase() }
    }

    private fun formatDate(dateStr: String): String {
        return try {
            val deviceTz = TimeZone.getDefault()
            val parsedDate = when {
                dateStr.length > 10 -> {
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
                else -> SimpleDateFormat("yyyy-MM-dd", Locale.US)
                    .also { it.timeZone = deviceTz }
                    .parse(dateStr.take(10))
            } ?: return dateStr

            SimpleDateFormat("MMM d", Locale.getDefault())
                .also { it.timeZone = deviceTz }
                .format(parsedDate)
        } catch (e: Exception) { dateStr }
    }

    companion object DiffCallback : DiffUtil.ItemCallback<RecurringTransaction>() {
        override fun areItemsTheSame(a: RecurringTransaction, b: RecurringTransaction) = a.id == b.id
        override fun areContentsTheSame(a: RecurringTransaction, b: RecurringTransaction) = a == b
    }
}