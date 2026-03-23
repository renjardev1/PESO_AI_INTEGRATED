package com.example.pesoai.ui.recurring

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.viewModelScope
import com.example.pesoai.api.ApiClient
import com.example.pesoai.api.models.RecurringRequest
import com.example.pesoai.api.models.RecurringTransaction
import com.example.pesoai.utils.SingleLiveEvent
import kotlinx.coroutines.launch

class RecurringViewModel(application: Application) : AndroidViewModel(application) {

    private val _recurring   = MutableLiveData<List<RecurringTransaction>>()
    val recurring: LiveData<List<RecurringTransaction>> = _recurring

    private val _isLoading   = MutableLiveData(false)
    val isLoading: LiveData<Boolean> = _isLoading

    private val _error       = MutableLiveData<String?>()
    val error: LiveData<String?> = _error

    private val _success     = SingleLiveEvent<String>()
    val success: LiveData<String> = _success

    // ── ADD THIS ─────────────────────────────────────────────────────────────
    private var currentStatus: String? = null  // Track current filter
    // ─────────────────────────────────────────────────────────────────────────

    private fun getPrefs() = getApplication<Application>()
        .getSharedPreferences("PesoAI_Prefs", Context.MODE_PRIVATE)

    private fun token()  = "Bearer ${getPrefs().getString("jwt_token",  "") ?: ""}"
    private fun userId() = getPrefs().getString("user_id", "") ?: ""

    fun loadRecurring(status: String? = null) {
        val uid = userId()
        if (uid.isBlank()) { _error.value = "User not logged in."; return }

        currentStatus = status  // ← SAVE current filter

        viewModelScope.launch {
            _isLoading.value = true
            try {
                val resp = ApiClient.authApi.getRecurringFiltered(token(), uid, status)
                if (resp.isSuccessful && resp.body()?.success == true) {
                    _recurring.value = resp.body()!!.data
                } else {
                    _error.value = "Failed to load recurring transactions."
                }
            } catch (e: Exception) {
                _error.value = "Connection error: ${e.message}"
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun updateRecurring(recurringId: Int, request: RecurringRequest) {
        val uid = userId()
        if (uid.isBlank()) return
        viewModelScope.launch {
            _isLoading.value = true
            try {
                val resp = ApiClient.authApi.updateRecurring(token(), uid, recurringId, request)
                if (resp.isSuccessful && resp.body()?.success == true) {
                    _success.value = "Recurring transaction updated."
                    loadRecurring(currentStatus)  // ← PRESERVE filter
                } else {
                    _error.value = "Failed to update recurring transaction."
                }
            } catch (e: Exception) {
                _error.value = "Connection error: ${e.message}"
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun cancelRecurring(recurringId: Int) {
        val uid = userId()
        if (uid.isBlank()) return
        viewModelScope.launch {
            try {
                val resp = ApiClient.authApi.cancelRecurring(token(), uid, recurringId)
                if (resp.isSuccessful && resp.body()?.success == true) {
                    _success.value = "Recurring transaction cancelled."
                    loadRecurring(currentStatus)
                } else {
                    _error.value = "Failed to cancel recurring transaction."
                }
            } catch (e: Exception) {
                _error.value = "Connection error: ${e.message}"
            }
        }
    }

    fun deleteRecurring(recurringId: Int) {
        val uid = userId()
        if (uid.isBlank()) return
        viewModelScope.launch {
            try {
                val resp = ApiClient.authApi.deleteRecurring(token(), uid, recurringId)
                if (resp.isSuccessful && resp.body()?.success == true) {
                    _success.value = "Recurring transaction permanently deleted."
                    loadRecurring(currentStatus)
                } else {
                    _error.value = "Failed to delete recurring transaction."
                }
            } catch (e: Exception) {
                _error.value = "Connection error: ${e.message}"
            }
        }
    }

    fun markAsPaid(recurringId: Int) {
        val uid = userId()
        if (uid.isBlank()) return
        viewModelScope.launch {
            _isLoading.value = true
            try {
                val resp = ApiClient.authApi.markRecurringAsPaid(token(), uid, recurringId)
                if (resp.isSuccessful && resp.body()?.success == true) {
                    _success.value = "Recurring transaction marked as paid."
                    loadRecurring(currentStatus)  // ← PRESERVE filter
                } else {
                    _error.value = "Failed to mark as paid."
                }
            } catch (e: Exception) {
                _error.value = "Connection error: ${e.message}"
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun dismissForMonth(recurringId: Int) {
        val uid = userId()
        if (uid.isBlank()) return
        viewModelScope.launch {
            _isLoading.value = true
            try {
                val resp = ApiClient.authApi.dismissRecurring(token(), uid, recurringId)
                if (resp.isSuccessful && resp.body()?.success == true) {
                    _success.value = "Recurring transaction dismissed for this period."
                    loadRecurring(currentStatus)  // ← PRESERVE filter
                } else {
                    _error.value = "Failed to dismiss recurring transaction."
                }
            } catch (e: Exception) {
                _error.value = "Connection error: ${e.message}"
            } finally {
                _isLoading.value = false
            }
        }
    }
}