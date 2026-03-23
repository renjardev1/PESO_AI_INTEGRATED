package com.example.pesoai.ui.chat

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.example.pesoai.R
import com.google.android.material.button.MaterialButton
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import java.util.TimeZone

// ── Local UI model — populated from ConversationHistory API response ──────────
data class HistoryItem(
    val id:               Int,
    val date:             String,
    val mode:             String,
    val exchangeCount:    Int,
    val firstUserMessage: String,
    val firstAiResponse:  String
)

class HistoryAdapter(
    private val historyItems: MutableList<HistoryItem>,
    private val onItemClick:   (Int) -> Unit,          // historyId
    private val onDeleteClick: (Int, Int) -> Unit      // (historyId, adapterPosition)
) : RecyclerView.Adapter<HistoryAdapter.HistoryViewHolder>() {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): HistoryViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_history, parent, false)
        return HistoryViewHolder(view)
    }

    override fun onBindViewHolder(holder: HistoryViewHolder, position: Int) {
        holder.bind(historyItems[position], position, onItemClick, onDeleteClick)
    }

    override fun getItemCount() = historyItems.size

    fun removeAt(position: Int) {
        if (position in 0 until historyItems.size) {
            historyItems.removeAt(position)
            notifyItemRemoved(position)
            notifyItemRangeChanged(position, historyItems.size)
        }
    }

    // ── ViewHolder ────────────────────────────────────────────────────────────

    class HistoryViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        private val tvConversationDate: TextView      = view.findViewById(R.id.tvConversationDate)
        private val tvExchangeCount:    TextView      = view.findViewById(R.id.tvExchangeCount)
        private val tvUserMessage:      TextView      = view.findViewById(R.id.tvUserMessage)
        private val tvAIResponse:       TextView      = view.findViewById(R.id.tvAIResponse)
        private val cardHistory:        View          = view.findViewById(R.id.cardHistory)
        private val btnDelete:          MaterialButton = view.findViewById(R.id.btnDeleteHistory)

        fun bind(
            item:     HistoryItem,
            position: Int,
            onClick:  (Int) -> Unit,
            onDelete: (Int, Int) -> Unit
        ) {
            tvConversationDate.text = formatDate(item.date)
            tvExchangeCount.text    =
                "${item.exchangeCount} exchange${if (item.exchangeCount > 1) "s" else ""}"
            tvUserMessage.text = item.firstUserMessage
            tvAIResponse.text  = item.firstAiResponse

            cardHistory.setOnClickListener { onClick(item.id) }
            btnDelete.setOnClickListener   { onDelete(item.id, bindingAdapterPosition) }
        }

        private fun formatDate(dateStr: String): String {
            return try {
                val inputFmt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault())
                    .also { it.timeZone = TimeZone.getTimeZone("UTC") }
                val date = inputFmt.parse(dateStr) ?: return dateStr

                val now  = Calendar.getInstance()
                val then = Calendar.getInstance().also { it.time = date }

                when {
                    isSameDay(now, then)   ->
                        "Today, ${SimpleDateFormat("h:mm a", Locale.getDefault()).format(date)}"
                    isYesterday(now, then) ->
                        "Yesterday, ${SimpleDateFormat("h:mm a", Locale.getDefault()).format(date)}"
                    else                   ->
                        SimpleDateFormat("MMM d, h:mm a", Locale.getDefault()).format(date)
                }
            } catch (e: Exception) { dateStr }
        }

        private fun isSameDay(cal1: Calendar, cal2: Calendar) =
            cal1.get(Calendar.YEAR)        == cal2.get(Calendar.YEAR) &&
                    cal1.get(Calendar.DAY_OF_YEAR) == cal2.get(Calendar.DAY_OF_YEAR)

        private fun isYesterday(today: Calendar, date: Calendar): Boolean {
            val yesterday = (today.clone() as Calendar).also { it.add(Calendar.DAY_OF_YEAR, -1) }
            return isSameDay(yesterday, date)
        }
    }
}