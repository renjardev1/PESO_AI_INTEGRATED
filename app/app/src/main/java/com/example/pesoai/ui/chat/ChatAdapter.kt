package com.example.pesoai.ui.chat

import android.graphics.Typeface
import android.text.Spannable
import android.text.SpannableString
import android.text.style.StyleSpan
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import com.example.pesoai.R
import com.example.pesoai.api.models.ChatMessage
import com.google.android.material.button.MaterialButton
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class ChatAdapter(
    private val messages: MutableList<ChatMessage>,
    private val onRetryClick:  (Int) -> Unit,
    private val onCopyClick:   (String) -> Unit,
    private val onDeleteClick: (Int) -> Unit
) : RecyclerView.Adapter<RecyclerView.ViewHolder>() {

    companion object {
        private const val VIEW_TYPE_USER     = 1
        private const val VIEW_TYPE_AI       = 2
        private const val VIEW_TYPE_THINKING = 3
    }

    private var isThinking = false

    override fun getItemViewType(position: Int): Int = when {
        position == messages.size && isThinking -> VIEW_TYPE_THINKING
        messages[position].isUser               -> VIEW_TYPE_USER
        else                                    -> VIEW_TYPE_AI
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
        return when (viewType) {
            VIEW_TYPE_USER -> {
                val view = LayoutInflater.from(parent.context)
                    .inflate(R.layout.item_chat_message_user, parent, false)
                UserMessageViewHolder(view, onRetryClick, onCopyClick, onDeleteClick)
            }
            VIEW_TYPE_THINKING -> {
                val view = LayoutInflater.from(parent.context)
                    .inflate(R.layout.item_chat_thinking, parent, false)
                ThinkingViewHolder(view)
            }
            else -> {
                val view = LayoutInflater.from(parent.context)
                    .inflate(R.layout.item_chat_message_ai, parent, false)
                AIMessageViewHolder(view, onRetryClick, onCopyClick)
            }
        }
    }

    override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
        when (holder) {
            is UserMessageViewHolder -> holder.bind(messages[position], position)
            is AIMessageViewHolder   -> holder.bind(messages[position], position)
            is ThinkingViewHolder    -> holder.bind()
        }
    }

    override fun getItemCount() = messages.size + if (isThinking) 1 else 0

    fun updateMessages(newMessages: List<ChatMessage>) {
        messages.clear()
        messages.addAll(newMessages)
        notifyDataSetChanged()
    }

    fun showThinking() {
        if (!isThinking) { isThinking = true; notifyItemInserted(messages.size) }
    }

    fun hideThinking() {
        if (isThinking) { val pos = messages.size; isThinking = false; notifyItemRemoved(pos) }
    }

    // ==================== THINKING ViewHolder ====================

    class ThinkingViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val tvThinking: TextView = itemView.findViewById(R.id.tvThinking)
        fun bind() { tvThinking.text = itemView.context.getString(R.string.ai_thinking) }
    }

    // ==================== USER MESSAGE ViewHolder ====================

    class UserMessageViewHolder(
        itemView: View,
        private val onRetryClick:  (Int) -> Unit,
        private val onCopyClick:   (String) -> Unit,
        private val onDeleteClick: (Int) -> Unit
    ) : RecyclerView.ViewHolder(itemView) {
        private val tvMessage:   TextView      = itemView.findViewById(R.id.tvMessage)
        private val tvTimestamp: TextView      = itemView.findViewById(R.id.tvTimestamp)
        private val btnCopy:     MaterialButton = itemView.findViewById(R.id.btnCopy)
        private val btnRetry:    MaterialButton = itemView.findViewById(R.id.btnRetry)
        private val btnDelete:   MaterialButton = itemView.findViewById(R.id.btnDelete)

        fun bind(message: ChatMessage, position: Int) {
            tvMessage.text   = message.message
            tvTimestamp.text = formatTimestamp(message.timestamp)

            btnCopy.setOnClickListener   { onCopyClick(message.message) }

            // ✅ bindingAdapterPosition avoids stale position crash after list mutations
            btnRetry.setOnClickListener {
                val pos = bindingAdapterPosition
                if (pos != RecyclerView.NO_ID.toInt()) onRetryClick(pos)
            }
            btnDelete.setOnClickListener {
                val pos = bindingAdapterPosition
                if (pos != RecyclerView.NO_ID.toInt()) onDeleteClick(pos)
            }
        }

        private fun formatTimestamp(ts: Long) =
            SimpleDateFormat("h:mm a", Locale.getDefault()).format(Date(ts))
    }

    // ==================== AI MESSAGE ViewHolder ====================

    class AIMessageViewHolder(
        itemView: View,
        private val onRetryClick: (Int) -> Unit,
        private val onCopyClick:  (String) -> Unit
    ) : RecyclerView.ViewHolder(itemView) {
        private val tvMessage:   TextView      = itemView.findViewById(R.id.tvMessage)
        private val tvTimestamp: TextView      = itemView.findViewById(R.id.tvTimestamp)
        private val btnCopy:     MaterialButton = itemView.findViewById(R.id.btnCopy)
        private val btnRetry:    MaterialButton = itemView.findViewById(R.id.btnRetry)

        fun bind(message: ChatMessage, position: Int) {
            tvMessage.text   = formatMessage(message.message)
            tvTimestamp.text = formatTimestamp(message.timestamp)

            btnCopy.setOnClickListener { onCopyClick(message.message) }

            // ✅ bindingAdapterPosition for safe retry
            btnRetry.setOnClickListener {
                val pos = bindingAdapterPosition
                if (pos != RecyclerView.NO_ID.toInt()) onRetryClick(pos)
            }

            // ✅ Color via R.color tokens — no hardcoded resource IDs
            btnRetry.setTextColor(
                if (message.isFailed)
                    ContextCompat.getColor(itemView.context, R.color.error_red)
                else
                    ContextCompat.getColor(itemView.context, R.color.text_secondary)
            )
        }

        // ── Bold markdown (**text**) rendered as SpannableString ─────────────
        private fun formatMessage(text: String): SpannableString {
            val cleaned = text
                .replace("\r\n", "\n")
                .replace(Regex("[ \\t]{2,}"), " ")
                .trim()

            val spannable    = SpannableString(cleaned)
            val boldPattern  = Regex("\\*\\*(.+?)\\*\\*")
            var offset       = 0
            var mutable      = cleaned
            var boldMatch    = boldPattern.find(mutable)

            while (boldMatch != null) {
                val start = boldMatch.range.first - offset
                val end   = start + boldMatch.groupValues[1].length
                if (start >= 0 && end <= spannable.length) {
                    spannable.setSpan(
                        StyleSpan(Typeface.BOLD), start, end,
                        Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
                    )
                }
                mutable  = mutable.replaceFirst("**${boldMatch.groupValues[1]}**", boldMatch.groupValues[1])
                offset  += 4
                boldMatch = boldPattern.find(mutable)
            }
            return spannable
        }

        private fun formatTimestamp(ts: Long) =
            SimpleDateFormat("h:mm a", Locale.getDefault()).format(Date(ts))
    }
}