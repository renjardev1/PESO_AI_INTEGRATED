package com.example.pesoai.ui.goals

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.example.pesoai.R
import com.example.pesoai.api.models.SavingsGoal
import com.example.pesoai.databinding.ItemSavingsGoalBinding
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.*

class SavingsGoalAdapter(
    private val onGoalClick: (SavingsGoal) -> Unit,
    private val onContribute: (SavingsGoal) -> Unit
) : ListAdapter<SavingsGoal, SavingsGoalAdapter.ViewHolder>(GoalDiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemSavingsGoalBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return ViewHolder(binding, onGoalClick, onContribute)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    class ViewHolder(
        private val binding: ItemSavingsGoalBinding,
        private val onGoalClick: (SavingsGoal) -> Unit,
        private val onContribute: (SavingsGoal) -> Unit
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(goal: SavingsGoal) {
            val context   = binding.root.context
            val formatter = NumberFormat.getNumberInstance(Locale.US)

            binding.tvGoalName.text = goal.goalName

            val saved  = goal.currentAmount
            val target = goal.targetAmount
            val pct    = if (target > 0) ((saved / target) * 100).toInt().coerceIn(0, 100) else 0

            binding.tvSavedAmount.text  = "₱${formatter.format(saved.toInt())}"
            binding.tvTargetAmount.text = "₱${formatter.format(target.toInt())}"
            binding.tvProgress.text     = "$pct%"
            binding.pbGoalProgress.progress = pct

            // Category badge
            binding.tvCategory.text = goal.category ?: "General"

            // ✅ FIX: Display deadline if available
            if (!goal.deadline.isNullOrBlank()) {
                try {
                    // Parse deadline from YYYY-MM-DD format
                    val inputFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
                    val outputFormat = SimpleDateFormat("MMM dd, yyyy", Locale.getDefault())
                    val date = inputFormat.parse(goal.deadline)

                    if (date != null) {
                        val formattedDate = outputFormat.format(date)
                        binding.tvDeadline.text = "Due: $formattedDate"
                        binding.layoutDeadline.visibility = View.VISIBLE
                    } else {
                        binding.layoutDeadline.visibility = View.GONE
                    }
                } catch (e: Exception) {
                    // If parsing fails, hide deadline
                    binding.layoutDeadline.visibility = View.GONE
                }
            } else {
                binding.layoutDeadline.visibility = View.GONE
            }

            // ✅ Progress color via R.color tokens — no hardcoded hex
            val colorRes = when {
                pct >= 100 -> R.color.success_green
                pct >= 75  -> R.color.primary_blue
                pct >= 50  -> R.color.warning_orange
                else       -> R.color.primary_blue
            }
            val resolvedColor = ContextCompat.getColor(context, colorRes)
            binding.pbGoalProgress.progressTintList =
                android.content.res.ColorStateList.valueOf(resolvedColor)
            binding.tvProgress.setTextColor(resolvedColor)

// ── ADD THIS SECTION ─────────────────────────────────────────────────
// ✅ Disable contribute button for completed goals
            // ✅ Simple version: Just hide button for completed goals
            if (goal.status == "completed" || saved >= target) {
                binding.btnContribute.isEnabled = false
                binding.btnContribute.alpha = 0.5f
                binding.btnContribute.text = "Completed"
            } else {
                binding.btnContribute.isEnabled = true
                binding.btnContribute.alpha = 1.0f
                binding.btnContribute.text = "Contribute"
            }
// ─────────────────────────────────────────────────────────────────────

            binding.root.setOnClickListener         { onGoalClick(goal) }
            binding.btnContribute.setOnClickListener { onContribute(goal) }
        }
    }

    class GoalDiffCallback : DiffUtil.ItemCallback<SavingsGoal>() {
        override fun areItemsTheSame(oldItem: SavingsGoal, newItem: SavingsGoal) =
            oldItem.id == newItem.id
        override fun areContentsTheSame(oldItem: SavingsGoal, newItem: SavingsGoal) =
            oldItem == newItem
    }
}