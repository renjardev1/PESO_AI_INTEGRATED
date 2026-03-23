package com.example.pesoai.ui.transactions

import android.graphics.Color
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.example.pesoai.R
import com.example.pesoai.api.models.Category
import com.example.pesoai.api.models.Transaction
import com.example.pesoai.databinding.ItemTransactionBinding
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.*

// ── Sealed list item — either a section header or a real transaction ──────────
sealed class TransactionListItem {
    data class Header(val label: String) : TransactionListItem()
    data class Item(val transaction: Transaction) : TransactionListItem()
}

class TransactionAdapter(
    private val onItemClick: (Transaction) -> Unit,
    private val onDeleteClick: ((Transaction) -> Unit)? = null
) : ListAdapter<TransactionListItem, RecyclerView.ViewHolder>(DiffCallback()) {

    companion object {
        private const val VIEW_TYPE_HEADER = 0
        private const val VIEW_TYPE_ITEM   = 1
    }

    var categories: List<Category> = emptyList()

    override fun getItemViewType(position: Int) = when (getItem(position)) {
        is TransactionListItem.Header -> VIEW_TYPE_HEADER
        is TransactionListItem.Item   -> VIEW_TYPE_ITEM
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
        return if (viewType == VIEW_TYPE_HEADER) {
            val v = LayoutInflater.from(parent.context)
                .inflate(R.layout.item_transaction_header, parent, false)
            HeaderViewHolder(v)
        } else {
            val binding = ItemTransactionBinding.inflate(
                LayoutInflater.from(parent.context), parent, false
            )
            TransactionViewHolder(binding)
        }
    }

    override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
        when (val item = getItem(position)) {
            is TransactionListItem.Header -> (holder as HeaderViewHolder).bind(item.label)
            is TransactionListItem.Item   -> (holder as TransactionViewHolder).bind(item.transaction)
        }
    }

    // ── Header ViewHolder ────────────────────────────────────────────────────
    class HeaderViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        private val tvLabel: TextView = view.findViewById(R.id.tvSectionHeader)
        fun bind(label: String) { tvLabel.text = label }
    }

    // ── Transaction ViewHolder ───────────────────────────────────────────────
    inner class TransactionViewHolder(
        private val binding: ItemTransactionBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(transaction: Transaction) {
            val formatter = NumberFormat.getNumberInstance(Locale.US)
            val (icon, colorHex) = getCategoryIconAndColor(transaction.category)

            binding.tvCategoryIcon.text = icon
            try {
                val drawable = androidx.core.content.ContextCompat.getDrawable(
                    binding.root.context, R.drawable.circle_background_gray
                )?.mutate()
                drawable?.setTint(Color.parseColor(colorHex))
                binding.tvCategoryIcon.background = drawable
            } catch (_: Exception) {
                binding.tvCategoryIcon.setBackgroundResource(R.drawable.circle_background_gray)
            }

            binding.tvDescription.text = transaction.description
                ?: transaction.category.capitalizeWords()
            binding.tvCategory.text = transaction.category.capitalizeWords()
            binding.tvDate.text     = formatTime(transaction.createdAt)
            binding.tvAmount.text   = "₱ ${formatter.format(transaction.amount.toInt())}"
            binding.tvAmount.setTextColor(binding.root.context.getColor(R.color.text_primary))

            binding.root.setOnClickListener { onItemClick(transaction) }
        }

        // Inside a group header only show the time, not the full date
        private fun formatTime(createdAtIso: String?): String {
            if (createdAtIso.isNullOrBlank()) return ""
            val date = parseCreatedAt(createdAtIso) ?: return ""
            return SimpleDateFormat("h:mm a", Locale.getDefault())
                .also { it.timeZone = TimeZone.getDefault() }
                .format(date)
        }

        private fun getCategoryIconAndColor(category: String): Pair<String, String> {
            val userCat = categories.firstOrNull { it.name.lowercase() == category.lowercase() }
            if (userCat != null) return Pair(userCat.icon, userCat.color)
            return when (category.lowercase()) {
                "food & dining", "food", "dining" -> Pair("🍔", "#FF5722")
                "groceries"                        -> Pair("🛒", "#4CAF50")
                "transportation", "transport"      -> Pair("🚗", "#2196F3")
                "shopping"                         -> Pair("🛍️", "#9C27B0")
                "entertainment"                    -> Pair("🎮", "#3F51B5")
                "health", "healthcare"             -> Pair("💊", "#F44336")
                "bills & utilities", "bills"       -> Pair("💡", "#FF9800")
                "savings"                          -> Pair("🏦", "#4CAF50")
                "education"                        -> Pair("📚", "#2196F3")
                else                               -> Pair("📦", "#607D8B")
            }
        }

        private fun parseCreatedAt(raw: String): Date? {
            val formats = listOf(
                "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
                "yyyy-MM-dd'T'HH:mm:ss'Z'",
                "yyyy-MM-dd'T'HH:mm:ss.SSSXXX",
                "yyyy-MM-dd'T'HH:mm:ssXXX",
                "yyyy-MM-dd HH:mm:ss.SSS",
                "yyyy-MM-dd HH:mm:ss"
            )
            for (fmt in formats) {
                try {
                    return SimpleDateFormat(fmt, Locale.getDefault())
                        .also { it.timeZone = TimeZone.getTimeZone("UTC") }
                        .parse(raw)
                } catch (_: Exception) {}
            }
            return null
        }
    }

    class DiffCallback : DiffUtil.ItemCallback<TransactionListItem>() {
        override fun areItemsTheSame(a: TransactionListItem, b: TransactionListItem): Boolean {
            return when {
                a is TransactionListItem.Header && b is TransactionListItem.Header -> a.label == b.label
                a is TransactionListItem.Item   && b is TransactionListItem.Item   -> a.transaction.id == b.transaction.id
                else -> false
            }
        }
        override fun areContentsTheSame(a: TransactionListItem, b: TransactionListItem) = a == b
    }
}

// ── Grouping helper — called by TransactionFragment ──────────────────────────
fun groupTransactionsByPeriod(transactions: List<Transaction>): List<TransactionListItem> {
    val tz       = TimeZone.getDefault()
    val parser   = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).also { it.timeZone = tz }
    val now      = Calendar.getInstance(tz)

    fun cal(dateStr: String): Calendar? {
        return try {
            val d = parser.parse(dateStr.take(10)) ?: return null
            Calendar.getInstance(tz).also { it.time = d }
        } catch (_: Exception) { null }
    }

    fun isSameDay(a: Calendar, b: Calendar) =
        a.get(Calendar.YEAR) == b.get(Calendar.YEAR) &&
                a.get(Calendar.DAY_OF_YEAR) == b.get(Calendar.DAY_OF_YEAR)

    val today     = now.clone() as Calendar
    val yesterday = (now.clone() as Calendar).also { it.add(Calendar.DAY_OF_YEAR, -1) }
    val sevenAgo  = (now.clone() as Calendar).also { it.add(Calendar.DAY_OF_YEAR, -7) }

    // Only current month
    val currentMonth = now.get(Calendar.MONTH)
    val currentYear  = now.get(Calendar.YEAR)

    val groups = linkedMapOf(
        "Today"              to mutableListOf<Transaction>(),
        "Yesterday"          to mutableListOf(),
        "Last 7 Days"        to mutableListOf(),
        "Earlier This Month" to mutableListOf()
    )

    for (tx in transactions) {
        val c = cal(tx.transactionDate) ?: continue
        // Skip anything outside current month
        if (c.get(Calendar.YEAR) != currentYear || c.get(Calendar.MONTH) != currentMonth) continue
        when {
            isSameDay(c, today)     -> groups["Today"]!!.add(tx)
            isSameDay(c, yesterday) -> groups["Yesterday"]!!.add(tx)
            c.after(sevenAgo)       -> groups["Last 7 Days"]!!.add(tx)
            else                    -> groups["Earlier This Month"]!!.add(tx)
        }
    }

    return buildList {
        for ((label, items) in groups) {
            if (items.isEmpty()) continue
            add(TransactionListItem.Header(label))
            items.sortedByDescending { it.transactionDate }.forEach {
                add(TransactionListItem.Item(it))
            }
        }
    }
}

internal fun String.capitalizeWords(): String =
    split(" ").joinToString(" ") { word ->
        word.replaceFirstChar { if (it.isLowerCase()) it.titlecase(Locale.getDefault()) else it.toString() }
    }