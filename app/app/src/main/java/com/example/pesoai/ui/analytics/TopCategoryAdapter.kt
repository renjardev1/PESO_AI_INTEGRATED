package com.example.pesoai.ui.analytics

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.example.pesoai.R
import com.example.pesoai.api.models.TopCategory
import com.example.pesoai.databinding.ItemTopCategoryBinding
import java.text.NumberFormat
import java.util.Locale

class TopCategoryAdapter : ListAdapter<TopCategory, TopCategoryAdapter.CategoryViewHolder>(CategoryDiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): CategoryViewHolder {
        val binding = ItemTopCategoryBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return CategoryViewHolder(binding)
    }

    override fun onBindViewHolder(holder: CategoryViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    class CategoryViewHolder(
        private val binding: ItemTopCategoryBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(category: TopCategory) {
            val formatter = NumberFormat.getNumberInstance(Locale.US)
            val (icon, bgRes) = getCategoryIconAndBackground(category.category)

            binding.tvCategoryIcon.text = icon
            binding.tvCategoryIcon.setBackgroundResource(bgRes)
            binding.tvCategoryName.text = category.category.capitalizeWords()
            binding.tvTransactionCount.text =
                "${category.transactionCount} transaction${if (category.transactionCount != 1) "s" else ""}"
            binding.tvCategoryTotal.text = formatter.format(category.total.toInt())
        }

        private fun getCategoryIconAndBackground(category: String): Pair<String, Int> {
            return when (category.lowercase()) {
                "food & dining", "food", "dining" -> "🍔" to R.drawable.circle_background_orange
                "groceries"                        -> "🛒" to R.drawable.circle_background_pink
                "transportation"                   -> "🚗" to R.drawable.circle_background_red
                "shopping"                         -> "🛍️" to R.drawable.circle_background_pink
                "entertainment"                    -> "🎬" to R.drawable.circle_background_orange
                "health"                           -> "⚕️" to R.drawable.circle_background_red
                "bills & utilities", "bills"       -> "📄" to R.drawable.circle_background_orange
                "income"                           -> "💸" to R.drawable.circle_background_green
                "savings"                          -> "🏦" to R.drawable.circle_background_teal
                else                               -> "💵" to R.drawable.circle_background_orange
            }
        }

        // ── Extension ─────────────────────────────────────────────────────────
        private fun String.capitalizeWords() =
            split(" ").joinToString(" ") { word ->
                word.replaceFirstChar { if (it.isLowerCase()) it.titlecase(Locale.getDefault()) else it.toString() }
            }
    }

    class CategoryDiffCallback : DiffUtil.ItemCallback<TopCategory>() {
        override fun areItemsTheSame(oldItem: TopCategory, newItem: TopCategory) =
            oldItem.category == newItem.category
        override fun areContentsTheSame(oldItem: TopCategory, newItem: TopCategory) =
            oldItem == newItem
    }
}