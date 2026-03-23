package com.example.pesoai.ui.notifications

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.viewModelScope
import com.example.pesoai.api.models.AppNotification
import com.example.pesoai.api.models.NotificationSettings
import com.example.pesoai.api.models.NotificationSettingsRequest
import com.example.pesoai.data.repository.NotificationRepository
import com.example.pesoai.utils.SocketManager
import kotlinx.coroutines.launch

class NotificationViewModel(application: Application) : AndroidViewModel(application) {

    private val repository = NotificationRepository()
    private val prefs = application.getSharedPreferences("PesoAI_Prefs", Context.MODE_PRIVATE)

    // ── State ─────────────────────────────────────────────────────────────────

    private val _notifications  = MutableLiveData<List<AppNotification>>()
    val notifications: LiveData<List<AppNotification>> = _notifications

    private val _settings       = MutableLiveData<NotificationSettings?>()
    val settings: LiveData<NotificationSettings?> = _settings

    private val _unreadCount    = MutableLiveData(0)
    val unreadCount: LiveData<Int> = _unreadCount

    private val _isLoading      = MutableLiveData(false)
    val isLoading: LiveData<Boolean> = _isLoading

    private val _errorMessage   = MutableLiveData<String?>()
    val errorMessage: LiveData<String?> = _errorMessage

    private val _successMessage = MutableLiveData<String?>()
    val successMessage: LiveData<String?> = _successMessage

    // ── Helpers ───────────────────────────────────────────────────────────────

    private fun userId(): String = prefs.getString("user_id", "") ?: ""
    private fun token(): String  = "Bearer ${prefs.getString("jwt_token", "") ?: ""}"
    fun clearMessages() { _errorMessage.value = null; _successMessage.value = null }

    // ── WebSocket real-time delivery ──────────────────────────────────────────

    init {
        val uid = userId()
        if (uid.isNotBlank()) {
            SocketManager.connect(getApplication(), uid)
            SocketManager.setNotificationListener { newNotif ->
                val current = _notifications.value?.toMutableList() ?: mutableListOf()
                if (current.none { it.id == newNotif.id }) {
                    current.add(0, newNotif)
                    _notifications.postValue(current)
                    _unreadCount.postValue(current.count { !it.isRead })
                }
            }
        }
    }

    // ── Load ──────────────────────────────────────────────────────────────────

    fun loadNotifications() {
        val uid = userId()
        if (uid.isBlank()) { _errorMessage.value = "User not logged in."; return }
        viewModelScope.launch {
            _isLoading.value = true
            try {
                val resp = repository.getNotifications(token(), uid)
                if (resp.isSuccessful && resp.body()?.success == true) {
                    val body = resp.body()!!
                    _notifications.value = body.notifications
                    _settings.value      = body.settings
                    _unreadCount.value   = body.notifications.count { !it.isRead }
                } else {
                    _errorMessage.value = "Failed to load notifications."
                }
            } catch (e: Exception) {
                _errorMessage.value = "Connection error: ${e.message}"
            } finally {
                _isLoading.value = false
            }
        }
    }

    // ── Mark single read ──────────────────────────────────────────────────────

    fun markRead(notificationId: Int) {
        val uid = userId()
        if (uid.isBlank()) return
        viewModelScope.launch {
            try {
                val resp = repository.markRead(token(), uid, notificationId)
                if (resp.isSuccessful && resp.body()?.success == true) {
                    _notifications.value = _notifications.value?.map { n ->
                        if (n.id == notificationId)
                            AppNotification(n.id, n.title, n.body, n.type, true, n.createdAt)
                        else n
                    }
                    _unreadCount.value = _notifications.value?.count { !it.isRead } ?: 0
                }
            } catch (_: Exception) { /* silent */ }
        }
    }

    // ── Mark all read ─────────────────────────────────────────────────────────

    fun markAllRead() {
        val uid = userId()
        if (uid.isBlank()) return
        viewModelScope.launch {
            try {
                val resp = repository.markAllRead(token(), uid)
                if (resp.isSuccessful && resp.body()?.success == true) {
                    _notifications.value = _notifications.value?.map { n ->
                        AppNotification(n.id, n.title, n.body, n.type, true, n.createdAt)
                    }
                    _unreadCount.value    = 0
                    _successMessage.value = "All notifications marked as read."
                }
            } catch (e: Exception) {
                _errorMessage.value = "Failed to mark all as read."
            }
        }
    }

    // ── Update settings ───────────────────────────────────────────────────────
    // FIX: added shareAnalytics parameter — now sent to API so web admin
    //      respects the user's data-sharing preference.

    fun updateSettings(
        budgetAlerts:      Boolean,
        threshold:         Double,
        dailyReminders:    Boolean,
        reminderTime:      String,
        pushNotifications: Boolean,
        shareAnalytics:    Boolean   // ← NEW
    ) {
        val uid = userId()
        if (uid.isBlank()) { _errorMessage.value = "User not logged in."; return }
        viewModelScope.launch {
            _isLoading.value = true
            try {
                val resp = repository.updateSettings(
                    token(), uid,
                    NotificationSettingsRequest(
                        budgetAlerts         = budgetAlerts,
                        budgetAlertThreshold = threshold,
                        dailyReminders       = dailyReminders,
                        dailyReminderTime    = reminderTime,
                        pushNotifications    = pushNotifications,
                        shareAnalytics       = shareAnalytics   // ← NEW
                    )
                )
                if (resp.isSuccessful && resp.body()?.success == true) {
                    _settings.value       = resp.body()!!.data
                    _successMessage.value = "Settings saved."
                } else {
                    _errorMessage.value = "Failed to save settings."
                }
            } catch (e: Exception) {
                _errorMessage.value = "Connection error: ${e.message}"
            } finally {
                _isLoading.value = false
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        SocketManager.setNotificationListener(null)
    }
}