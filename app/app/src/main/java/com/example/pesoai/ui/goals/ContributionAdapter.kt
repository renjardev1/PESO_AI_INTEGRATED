package com.example.pesoai.ui.goals

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.example.pesoai.R
import com.example.pesoai.api.models.Contribution
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.*

class ContributionAdapter(
    private val contributions: List<Contribution>
) : RecyclerView.Adapter<ContributionAdapter.ViewHolder>() {

    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val tvAmount: TextView = view.findViewById(R.id.tvContributionAmount)
        val tvDate: TextView = view.findViewById(R.id.tvContributionDate)
        val tvNotes: TextView = view.findViewById(R.id.tvContributionNotes)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_contribution, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val contribution = contributions[position]
        val formatter = NumberFormat.getNumberInstance(Locale.US)

        holder.tvAmount.text = "₱${formatter.format(contribution.amount.toInt())}"

        // Format date: "2024-03-18T10:30:00.000Z" -> "Mar 18, 2024"
        try {
            val inputFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())
            val outputFormat = SimpleDateFormat("MMM dd, yyyy", Locale.getDefault())
            val date = inputFormat.parse(contribution.contributionDate.substring(0, 19))
            holder.tvDate.text = date?.let { outputFormat.format(it) } ?: contribution.contributionDate
        } catch (e: Exception) {
            holder.tvDate.text = contribution.contributionDate.substring(0, 10)
        }

        if (!contribution.notes.isNullOrEmpty()) {
            holder.tvNotes.text = contribution.notes
            holder.tvNotes.visibility = View.VISIBLE
        } else {
            holder.tvNotes.visibility = View.GONE
        }
    }

    override fun getItemCount() = contributions.size
}