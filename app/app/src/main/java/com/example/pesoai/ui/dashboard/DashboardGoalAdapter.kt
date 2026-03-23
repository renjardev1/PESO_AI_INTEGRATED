package com.example.pesoai.ui.dashboard

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.example.pesoai.R
import com.example.pesoai.api.models.SavingsGoal
import com.example.pesoai.databinding.ItemDashboardGoalBinding
import java.text.NumberFormat
import java.util.*

class DashboardGoalAdapter : ListAdapter<SavingsGoal, DashboardGoalAdapter.GoalViewHolder>(GoalDiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): GoalViewHolder {
        val binding = ItemDashboardGoalBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return GoalViewHolder(binding)
    }

    override fun onBindViewHolder(holder: GoalViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    class GoalViewHolder(
        private val binding: ItemDashboardGoalBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(goal: SavingsGoal) {
            val context   = binding.root.context
            val formatter = NumberFormat.getNumberInstance(Locale.US)

            binding.tvGoalIcon.text = goal.icon ?: "🎯"
            binding.tvGoalIcon.setBackgroundResource(
                when (goal.color) {
                    "#FF9800" -> R.drawable.circle_background_orange
                    "#E91E63" -> R.drawable.circle_background_pink
                    "#F44336" -> R.drawable.circle_background_red
                    else      -> R.drawable.circle_background_orange
                }
            )

            binding.tvGoalName.text = goal.goalName
            binding.tvGoalAmount.text =
                "₱${formatter.format(goal.currentAmount.toInt())} / ₱${formatter.format(goal.targetAmount.toInt())}"

            val progress = if (goal.targetAmount > 0)
                ((goal.currentAmount / goal.targetAmount) * 100).toInt() else 0
            binding.progressGoal.progress   = progress.coerceIn(0, 100)
            binding.tvGoalProgress.text     = "$progress%"

            // ✅ Progress color via R.color tokens
            val colorRes = when {
                progress >= 100 -> R.color.success_green
                progress >= 75  -> R.color.primary_blue
                progress >= 50  -> R.color.warning_orange
                else            -> R.color.error_red
            }
            val resolvedColor = ContextCompat.getColor(context, colorRes)
            binding.progressGoal.progressTintList =
                android.content.res.ColorStateList.valueOf(resolvedColor)
            binding.tvGoalProgress.setTextColor(resolvedColor)
        }
    }

    class GoalDiffCallback : DiffUtil.ItemCallback<SavingsGoal>() {
        override fun areItemsTheSame(oldItem: SavingsGoal, newItem: SavingsGoal) =
            oldItem.id == newItem.id
        override fun areContentsTheSame(oldItem: SavingsGoal, newItem: SavingsGoal) =
            oldItem == newItem
    }
}