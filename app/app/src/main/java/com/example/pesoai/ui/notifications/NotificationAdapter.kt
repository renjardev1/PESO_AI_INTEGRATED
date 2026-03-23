package com.example.pesoai.ui.notifications

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.example.pesoai.R
import com.example.pesoai.api.models.AppNotification
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import java.util.TimeZone

class NotificationAdapter(
    private val onItemClick: (AppNotification) -> Unit
) : ListAdapter<AppNotification, NotificationAdapter.ViewHolder>(DiffCallback) {

    inner class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val tvTitle:    TextView = view.findViewById(R.id.tvNotificationTitle)
        val tvBody:     TextView = view.findViewById(R.id.tvNotificationBody)
        val tvTime:     TextView = view.findViewById(R.id.tvNotificationTime)
        val viewUnread: View     = view.findViewById(R.id.viewUnreadDot)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val v = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_notification, parent, false)
        return ViewHolder(v)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val notif = getItem(position)

        holder.tvTitle.text = notif.title
        holder.tvBody.text  = notif.body
        holder.tvTime.text  = formatDate(notif.createdAt)

        // Unread dot visibility
        holder.viewUnread.visibility = if (!notif.isRead) View.VISIBLE else View.INVISIBLE

        // Dim read notifications slightly
        val alpha = if (notif.isRead) 0.6f else 1.0f
        holder.tvTitle.alpha = alpha
        holder.tvBody.alpha  = alpha

        holder.itemView.setOnClickListener { onItemClick(notif) }
    }

    // NEW CODE:
    private fun formatDate(raw: String): String {
        return try {
            val deviceTz = java.util.TimeZone.getDefault()

            // Try all known timestamp formats — always parse as UTC
            val formats = listOf(
                "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
                "yyyy-MM-dd'T'HH:mm:ss'Z'",
                "yyyy-MM-dd'T'HH:mm:ss.SSSXXX",
                "yyyy-MM-dd'T'HH:mm:ssXXX",
                "yyyy-MM-dd HH:mm:ss.SSS",
                "yyyy-MM-dd HH:mm:ss"
            )

            val parsed = formats.firstNotNullOfOrNull { fmt ->
                try {
                    SimpleDateFormat(fmt, Locale.US)
                        .also { it.timeZone = java.util.TimeZone.getTimeZone("UTC") }
                        .parse(raw)
                } catch (_: Exception) { null }
            } ?: return raw.take(10)

            // Compare dates in device timezone for Today/Yesterday labels
            val dateCal = java.util.Calendar.getInstance(deviceTz).also { it.time = parsed }
            val todayCal = java.util.Calendar.getInstance(deviceTz).apply {
                set(java.util.Calendar.HOUR_OF_DAY, 0); set(java.util.Calendar.MINUTE, 0)
                set(java.util.Calendar.SECOND, 0);      set(java.util.Calendar.MILLISECOND, 0)
            }
            val yesterdayCal = java.util.Calendar.getInstance(deviceTz).apply {
                set(java.util.Calendar.HOUR_OF_DAY, 0); set(java.util.Calendar.MINUTE, 0)
                set(java.util.Calendar.SECOND, 0);      set(java.util.Calendar.MILLISECOND, 0)
                add(java.util.Calendar.DAY_OF_YEAR, -1)
            }

            fun isSameDay(c1: java.util.Calendar, c2: java.util.Calendar) =
                c1.get(java.util.Calendar.YEAR)        == c2.get(java.util.Calendar.YEAR) &&
                        c1.get(java.util.Calendar.DAY_OF_YEAR) == c2.get(java.util.Calendar.DAY_OF_YEAR)

            val timeFmt = SimpleDateFormat("h:mm a", Locale.getDefault())
                .also { it.timeZone = deviceTz }

            when {
                isSameDay(dateCal, todayCal)     -> "Today, ${timeFmt.format(parsed)}"
                isSameDay(dateCal, yesterdayCal) -> "Yesterday, ${timeFmt.format(parsed)}"
                else -> SimpleDateFormat("MMM d, h:mm a", Locale.getDefault())
                    .also { it.timeZone = deviceTz }.format(parsed)
            }
        } catch (_: Exception) { raw.take(10) }
    }

    companion object DiffCallback : DiffUtil.ItemCallback<AppNotification>() {
        override fun areItemsTheSame(a: AppNotification, b: AppNotification) = a.id == b.id
        override fun areContentsTheSame(a: AppNotification, b: AppNotification) = a == b
    }
}