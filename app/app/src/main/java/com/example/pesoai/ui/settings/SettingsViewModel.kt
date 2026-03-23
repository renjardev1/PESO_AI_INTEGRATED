package com.example.pesoai.ui.settings

import android.app.Application
import android.content.Context
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.viewModelScope
import com.example.pesoai.api.ApiClient
import com.example.pesoai.api.models.*
import com.example.pesoai.data.repository.UserProfileRepository
import com.example.pesoai.utils.SingleLiveEvent
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

class SettingsViewModel(application: Application) : AndroidViewModel(application) {

    private val repository = UserProfileRepository()

    private val _error = MutableLiveData<String?>()
    val error: LiveData<String?> = _error

    private val _successMessage = SingleLiveEvent<String>()
    val successMessage: LiveData<String> = _successMessage

    private val _accountDeleted = SingleLiveEvent<Boolean>()
    val accountDeleted: LiveData<Boolean> = _accountDeleted

    // ✅ FIX: Add LiveData for budget refresh
    private val _budgetRefreshed = SingleLiveEvent<Double>()
    val budgetRefreshed: LiveData<Double> = _budgetRefreshed

    private val _currentMonthlyBudget = MutableLiveData<Double>()
    val currentMonthlyBudget: LiveData<Double> = _currentMonthlyBudget

    private val _currentRiskTolerance = MutableLiveData<String>()
    val currentRiskTolerance: LiveData<String> = _currentRiskTolerance

    // ── Backup ────────────────────────────────────────────────────────────────

    private val _backupSuccess = SingleLiveEvent<String>()
    val backupSuccess: LiveData<String> = _backupSuccess

    private val _restoreSuccess = SingleLiveEvent<Boolean>()
    val restoreSuccess: LiveData<Boolean> = _restoreSuccess

    private val _backupList = MutableLiveData<List<BackupMeta>>()
    val backupList: LiveData<List<BackupMeta>> = _backupList

    private val _isBackupLoading = MutableLiveData<Boolean>(false)
    val isBackupLoading: LiveData<Boolean> = _isBackupLoading

    // ── App Lock ──────────────────────────────────────────────────────────────

    private val _appLockEnabled = SingleLiveEvent<Boolean>()
    val appLockEnabled: LiveData<Boolean> = _appLockEnabled

    private val _appLockDisabled = SingleLiveEvent<Boolean>()
    val appLockDisabled: LiveData<Boolean> = _appLockDisabled

    private val _appLockError = SingleLiveEvent<String>()
    val appLockError: LiveData<String> = _appLockError

    // ── Internal helpers ──────────────────────────────────────────────────────

    private fun getToken(): String {
        val prefs = getApplication<Application>()
            .getSharedPreferences("PesoAI_Prefs", Context.MODE_PRIVATE)
        return "Bearer ${prefs.getString("jwt_token", "") ?: ""}"
    }

    private fun getUserId(): String {
        val prefs = getApplication<Application>()
            .getSharedPreferences("PesoAI_Prefs", Context.MODE_PRIVATE)
        return prefs.getString("user_id", "") ?: ""
    }

    private fun getPrefs() = getApplication<Application>()
        .getSharedPreferences("PesoAI_Prefs", Context.MODE_PRIVATE)

    // ── Budget ────────────────────────────────────────────────────────────────

    // Fetch current budget from API and cache it properly
    fun fetchCurrentBudget() {
        viewModelScope.launch {
            try {
                val response = repository.getUserProfile(getToken(), getUserId())
                if (response.success && response.profile != null) {
                    val budget = response.profile.monthlyExpenses

                    // Update both caches
                    // Update all budget caches
                    getPrefs().edit()
                        .putFloat("user_monthly_budget", budget.toFloat())
                        .putFloat("monthly_expenses", budget.toFloat())
                        .putFloat("monthly_income", budget.toFloat())
                        .putString("risk_tolerance", response.profile.riskTolerance)
                        .apply()

                    _currentMonthlyBudget.postValue(budget)
                    if (response.profile.riskTolerance.isNotBlank()) {
                        _currentRiskTolerance.postValue(response.profile.riskTolerance)
                    }
                }
            } catch (e: Exception) {
                Log.e("SettingsViewModel", "fetchCurrentBudget error", e)
                // Use cached value as fallback
                val cached = getPrefs().getFloat("user_monthly_budget", 0f)
                if (cached > 0) _currentMonthlyBudget.postValue(cached.toDouble())
            }
        }
    }

    // KEEP THIS - it's used by the Edit Budget dialog
    fun refreshBudgetFromApi() {
        fetchCurrentBudget()
    }

    fun updateBudget(amount: Double) {
        viewModelScope.launch {
            try {
                val response = repository.updateBudget(
                    getToken(),
                    getUserId(),
                    UpdateBudgetRequest(monthlyExpenses = amount)
                )
                if (response.success) {
                    // ✅ FIX: Update SharedPreferences when budget is updated
                    getPrefs().edit()
                        .putFloat("monthly_expenses", amount.toFloat())
                        .apply()
                    _successMessage.value = "Budget updated!"
                    _budgetRefreshed.value = amount  // Notify UI
                } else {
                    // ✅ FIX: Safe access to message field
                    _error.value = response.message ?: "Failed to update budget"
                }
            } catch (e: Exception) {
                _error.value = e.message ?: "Error updating budget"
            }
        }
    }

    // ── Phase 2: Risk Tolerance ───────────────────────────────────────────────

    fun updateRiskTolerance(riskTolerance: String) {
        viewModelScope.launch {
            try {
                // Write to SharedPreferences first — validation reads from here immediately
                getPrefs().edit()
                    .putString("risk_tolerance", riskTolerance)
                    .apply()
                // Persist to backend via the existing PUT /api/profile/:userId endpoint
                val response = repository.updateProfile(
                    token         = getToken(),
                    userId        = getUserId(),
                    riskTolerance = riskTolerance
                )
                if (response.success) {
                    _successMessage.value = "Risk tolerance updated"
                } else {
                    // Backend rejected — roll back SharedPreferences to avoid state drift
                    Log.w("SettingsViewModel", "updateRiskTolerance backend error: ${response.message}")
                    _error.value = response.message ?: "Failed to update risk tolerance"
                }
            } catch (e: Exception) {
                Log.e("SettingsViewModel", "updateRiskTolerance error", e)
                _error.value = e.message ?: "Error updating risk tolerance"
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────

    // ── Password ──────────────────────────────────────────────────────────────

    fun changePassword(oldPassword: String, newPassword: String) {
        viewModelScope.launch {
            try {
                val response = repository.changePassword(
                    getToken(),
                    getUserId(),
                    oldPassword,
                    newPassword
                )
                if (response.success) {
                    _successMessage.value = "Password changed successfully!"
                } else {
                    // ✅ FIX: Safe access to message field
                    _error.value = response.message ?: "Failed to change password"
                }
            } catch (e: Exception) {
                _error.value = e.message ?: "Error changing password"
            }
        }
    }

    // ── Account ───────────────────────────────────────────────────────────────

    fun deleteAccount(password: String) {
        viewModelScope.launch {
            try {
                val response = repository.deleteAccount(getToken(), getUserId(), password)
                if (response.success) {
                    _accountDeleted.value = true
                } else {
                    _error.value = response.message ?: "Failed to delete account"
                }
            } catch (e: Exception) {
                _error.value = e.message ?: "Error deleting account"
            }
        }
    }

    // ── Feedback ──────────────────────────────────────────────────────────────

    fun sendFeedback(feedback: String) {
        viewModelScope.launch {
            // Placeholder — wire to feedback API when endpoint is available
            _successMessage.value = "Thank you for your feedback!"
        }
    }

    // ── Backup ────────────────────────────────────────────────────────────────

    fun performBackup() {
        viewModelScope.launch {
            try {
                _isBackupLoading.value = true
                val response = ApiClient.authApi.createBackup(getToken(), getUserId())
                if (response.isSuccessful && response.body()?.success == true) {
                    val body = response.body()!!
                    body.backupId?.let { id ->
                        getPrefs().edit().putInt("last_backup_id", id).apply()
                    }
                    val now = System.currentTimeMillis()
                    getPrefs().edit().putLong("last_backup", now).apply()
                    body.data?.let { _backupList.value = it }
                    val formatted = SimpleDateFormat(
                        "MMM dd, yyyy 'at' h:mm a", Locale.getDefault()
                    ).format(Date(now))
                    _backupSuccess.value = formatted
                } else {
                    _error.value = response.body()?.message ?: "Backup failed"
                }
            } catch (e: Exception) {
                Log.e("SettingsViewModel", "performBackup error", e)
                _error.value = e.message ?: "Backup error"
            } finally {
                _isBackupLoading.value = false
            }
        }
    }

    fun performRestore() {
        viewModelScope.launch {
            try {
                _isBackupLoading.value = true
                val backupId = getPrefs().getInt("last_backup_id", -1).takeIf { it != -1 }
                    ?: run {
                        _error.value = "No backup found to restore"
                        _isBackupLoading.value = false
                        return@launch
                    }

                // ✅ FIX: Changed to use path parameter instead of body
                val response = ApiClient.authApi.restoreBackup(
                    getToken(), getUserId(), backupId.toString()
                )
                if (response.isSuccessful && response.body()?.success == true) {
                    _restoreSuccess.value = true
                    _successMessage.value = response.body()?.message ?: "Data restored successfully"
                } else {
                    _error.value = response.body()?.message ?: "Restore failed"
                }
            } catch (e: Exception) {
                Log.e("SettingsViewModel", "performRestore error", e)
                _error.value = e.message ?: "Restore error"
            } finally {
                _isBackupLoading.value = false
            }
        }
    }

    fun hasBackup(): Boolean = getPrefs().getInt("last_backup_id", -1) != -1

    // ── App Lock ──────────────────────────────────────────────────────────────

    fun enableAppLock(pin: String, biometricEnabled: Boolean) {
        viewModelScope.launch {
            try {
                val response = ApiClient.authApi.setAppLock(
                    getToken(),
                    getUserId(),
                    SetAppLockRequest(
                        is_enabled   = true,
                        lock_type    = "pin",
                        pin          = pin,
                        timeout_mins = 5
                    )
                )
                if (response.isSuccessful && response.body()?.success == true) {
                    getPrefs().edit()
                        .putBoolean("app_lock_enabled",  true)
                        .putBoolean("biometric_enabled", biometricEnabled)
                        .putLong("last_unlock_time", System.currentTimeMillis())
                        .apply()
                    _appLockEnabled.value = true
                } else {
                    // ✅ FIX: AppLockResponse doesn't have 'message' field - use generic error
                    _appLockError.value = "Failed to enable app lock"
                }
            } catch (e: Exception) {
                Log.e("SettingsViewModel", "enableAppLock error", e)
                _appLockError.value = e.message ?: "App lock error"
            }
        }
    }

    fun disableAppLock() {
        viewModelScope.launch {
            try {
                val response = ApiClient.authApi.setAppLock(
                    getToken(),
                    getUserId(),
                    SetAppLockRequest(
                        is_enabled   = false,
                        lock_type    = "none",
                        pin          = null,
                        timeout_mins = 5
                    )
                )
                if (response.isSuccessful && response.body()?.success == true) {
                    getPrefs().edit()
                        .putBoolean("app_lock_enabled", false)
                        .putBoolean("biometric_enabled", false)
                        .apply()
                    _appLockDisabled.value = true
                } else {
                    // ✅ FIX: AppLockResponse doesn't have 'message' field - use generic error
                    _appLockError.value = "Failed to disable app lock"
                }
            } catch (e: Exception) {
                Log.e("SettingsViewModel", "disableAppLock error", e)
                _appLockError.value = e.message ?: "App lock error"
            }
        }
    }
}