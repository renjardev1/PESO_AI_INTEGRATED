package com.example.pesoai.utils

import android.content.Context
import android.util.Log
import com.example.pesoai.api.models.AppNotification
import com.google.gson.Gson
import io.socket.client.IO
import io.socket.client.Socket
import org.json.JSONObject
import java.net.URI

/**
 * GROUP K — WebSocket real-time notification delivery.
 *
 * Architecture:
 *   Cron → DB insert → socket.io emit (server)
 *       ↓
 *   SocketManager.on("notification:new") → BudgetNotificationHelper.notifyFromServer (app open)
 *       ↓
 *   NotificationPollingWorker → WorkManager fallback (app closed)
 *
 * IMPORTANT: SERVER_URL must match ApiClient BASE_URL host + port, without /api/ path.
 * Update this if ApiClient.BASE_URL changes.
 */
object SocketManager {

    // ── Config ────────────────────────────────────────────────────────────────
    // Keep in sync with ApiClient BASE_URL host:port
    private const val SERVER_URL = "http://192.168.68.51:3000"

    private val TAG = "SocketManager"
    private val gson = Gson()

    private var socket: Socket? = null
    private var onNewNotification: ((AppNotification) -> Unit)? = null

    // ── Connect ───────────────────────────────────────────────────────────────

    fun connect(context: Context, userId: String) {
        if (socket?.connected() == true) {
            // Already connected — just re-join the room in case userId changed
            socket?.emit("join", userId)
            return
        }

        try {
            val opts = IO.Options().apply {
                reconnection        = true
                reconnectionAttempts = 5
                reconnectionDelay   = 2000L
            }

            socket = IO.socket(URI.create(SERVER_URL), opts)

            socket?.on(Socket.EVENT_CONNECT) {
                Log.d(TAG, "Connected — joining room for user $userId")
                socket?.emit("join", userId)
            }

            socket?.on(Socket.EVENT_CONNECT_ERROR) { args ->
                Log.w(TAG, "Connection error: ${args.firstOrNull()}")
            }

            socket?.on(Socket.EVENT_DISCONNECT) {
                Log.d(TAG, "Disconnected from server")
            }

            socket?.on("notification:new") { args ->
                try {
                    Log.d(TAG, "notification:new received, args count=${args.size}, type=${args.getOrNull(0)?.javaClass?.simpleName}")

                    // socket.io Android client may deliver as JSONObject OR as String
                    val json: JSONObject = when (val raw = args.getOrNull(0)) {
                        is JSONObject -> raw
                        is String     -> JSONObject(raw)
                        else          -> {
                            Log.e(TAG, "Unexpected payload type: ${raw?.javaClass?.simpleName}")
                            return@on
                        }
                    }

                    val notif = AppNotification(
                        id        = json.optInt("id"),
                        title     = json.optString("title"),
                        body      = json.optString("body"),
                        type      = json.optString("type"),
                        isRead    = json.optBoolean("is_read", false),
                        createdAt = json.optString("created_at"),
                        isPushed  = json.optBoolean("is_pushed", false)  // ← ADD THIS
                    )

                    Log.d(TAG, "Parsed notification: id=${notif.id} title=${notif.title} type=${notif.type}")

                    // Fire Android push — runs fine on background thread
                    BudgetNotificationHelper.notifyFromServer(context.applicationContext, notif)

                    // Update in-app list via postValue (background-thread safe)
                    onNewNotification?.invoke(notif)

                } catch (e: Exception) {
                    Log.e(TAG, "notification:new parse error: ${e.message}", e)
                }
            }

            socket?.connect()
            Log.d(TAG, "Socket connecting to $SERVER_URL")

        } catch (e: Exception) {
            Log.e(TAG, "SocketManager.connect() failed: ${e.message}", e)
        }
    }

    // ── Register in-app listener ──────────────────────────────────────────────
    // Call from NotificationViewModel to refresh the list when app is open.
    // Pass null to unregister.

    fun setNotificationListener(listener: ((AppNotification) -> Unit)?) {
        onNewNotification = listener
    }

    // ── Disconnect ────────────────────────────────────────────────────────────

    fun disconnect() {
        onNewNotification = null
        socket?.disconnect()
        socket = null
        Log.d(TAG, "Socket disconnected and cleared")
    }

    fun isConnected(): Boolean = socket?.connected() == true
}