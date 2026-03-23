package com.example.pesoai.ui.goals

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.viewModelScope
import com.example.pesoai.api.ApiClient
import com.example.pesoai.api.models.ContributionRequest
import com.example.pesoai.api.models.GoalRequest
import com.example.pesoai.api.models.SavingsGoal
import com.example.pesoai.utils.SingleLiveEvent
import com.example.pesoai.data.repository.SavingsGoalRepository
import kotlinx.coroutines.launch

class SavingsGoalViewModel(application: Application) : AndroidViewModel(application) {

    // ── Phase 2: Budget validation types ─────────────────────────────────────
    data class BudgetWarningData(
        val budget:      Double,
        val spent:       Double,
        val threshold:   Double,
        val newAmount:   Double,
        val newTotal:    Double,
        val blockLimit:  Double  = 0.0,
        val isHardBlock: Boolean = false
    )

    private data class PendingContribution(
        val token:  String,
        val goalId: String,
        val amount: Double
    )

    private enum class BudgetCheckResult { ALLOW, WARN, BLOCK, HARD_BLOCK }
    // ─────────────────────────────────────────────────────────────────────────

    val repository = SavingsGoalRepository()

    private val _goals = MutableLiveData<List<SavingsGoal>>()
    val goals: LiveData<List<SavingsGoal>> = _goals

    private val _isLoading = MutableLiveData<Boolean>()
    val isLoading: LiveData<Boolean> = _isLoading

    private val _error = MutableLiveData<String?>()
    val error: LiveData<String?> = _error

    // ✅ SingleLiveEvent — fires once after a successful contribution
    private val _contributeSuccess = SingleLiveEvent<Double>()
    val contributeSuccess: LiveData<Double> = _contributeSuccess

    // ── Phase 2: Budget validation events ────────────────────────────────────
    private val _budgetBlocked = SingleLiveEvent<BudgetWarningData>()
    val budgetBlocked: LiveData<BudgetWarningData> = _budgetBlocked

    private val _budgetWarning = SingleLiveEvent<BudgetWarningData>()
    val budgetWarning: LiveData<BudgetWarningData> = _budgetWarning

    /** MutableLiveData (not raw var) — survives config change, null = nothing pending. */
    private val _pendingContribution = MutableLiveData<PendingContribution?>(null)
    // ─────────────────────────────────────────────────────────────────────────

    private fun getToken(): String {
        val prefs = getApplication<Application>()
            .getSharedPreferences("PesoAI_Prefs", Context.MODE_PRIVATE)
        return "Bearer ${prefs.getString("jwt_token", "") ?: ""}"
    }

    // ✅ user_id is always String (UUID)
    private fun getUserId(): String {
        val prefs = getApplication<Application>()
            .getSharedPreferences("PesoAI_Prefs", Context.MODE_PRIVATE)
        return prefs.getString("user_id", "") ?: ""
    }

    private fun getPrefs() = getApplication<Application>()
        .getSharedPreferences("PesoAI_Prefs", Context.MODE_PRIVATE)

    private fun checkBudget(newAmount: Double): BudgetCheckResult {
        val budget    = getPrefs().getFloat("user_monthly_budget", 0f).toDouble()
        val spent     = getPrefs().getFloat("cached_total_spent",  0f).toDouble()
        val threshold = getPrefs().getFloat("budget_alert_limit",  (budget * 0.8).toFloat()).toDouble()
        val hardLimit = getPrefs().getFloat("balanced_hard_limit", (budget * 1.5).toFloat()).toDouble()
        val risk      = getPrefs().getString("risk_tolerance", "balanced") ?: "balanced"
        if (budget <= 0.0) return BudgetCheckResult.ALLOW
        val newTotal = spent + newAmount
        return when (risk) {
            "strict" ->
                if (spent >= budget || newTotal > budget)
                    BudgetCheckResult.BLOCK
                else
                    BudgetCheckResult.ALLOW

            "balanced" -> when {
                spent >= hardLimit || newTotal > hardLimit -> BudgetCheckResult.HARD_BLOCK
                spent >= threshold || newTotal > threshold -> BudgetCheckResult.WARN
                else                                       -> BudgetCheckResult.ALLOW
            }

            "flexible" ->
                if (spent >= budget || newTotal > budget)
                    BudgetCheckResult.WARN
                else
                    BudgetCheckResult.ALLOW

            else -> BudgetCheckResult.ALLOW
        }
    }

    private fun getBudgetWarningData(newAmount: Double): BudgetWarningData {
        val budget    = getPrefs().getFloat("user_monthly_budget", 0f).toDouble()
        val spent     = getPrefs().getFloat("cached_total_spent",  0f).toDouble()
        val threshold = getPrefs().getFloat("budget_alert_limit",  (budget * 0.8).toFloat()).toDouble()
        val hardLimit = getPrefs().getFloat("balanced_hard_limit", (budget * 1.5).toFloat()).toDouble()
        return BudgetWarningData(
            budget     = budget,
            spent      = spent,
            threshold  = threshold,
            newAmount  = newAmount,
            newTotal   = spent + newAmount,
            blockLimit = hardLimit
        )
    }

    // ─────────────────────────────────────────────────────────────────────────

    // ── Called from SavingsGoalFragment with explicit token + userId ──────────
    fun loadGoals(token: String, userId: String, status: String? = null) {
        viewModelScope.launch {
            try {
                _isLoading.value = true
                _error.value     = null
                val response = ApiClient.authApi.getGoalsFiltered(token, userId, status)
                if (response.isSuccessful) {
                    _goals.value = response.body()?.goals ?: emptyList()
                } else {
                    _error.value = "Failed to load goals: HTTP ${response.code()}"
                }
            } catch (e: Exception) {
                _error.value = e.message
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun addGoal(
        token: String,
        userId: String,
        name: String,
        targetAmount: Double,
        currentAmount: Double,
        deadline: String?,
        category: String?
    ) {
        viewModelScope.launch {
            try {
                _isLoading.value = true
                val request = GoalRequest(
                    userId        = userId,
                    goalName      = name,
                    targetAmount  = targetAmount,
                    currentAmount = currentAmount,
                    deadline      = deadline?.ifEmpty { null },
                    category      = category?.ifEmpty { null }
                )
                val response = ApiClient.authApi.addGoal(token, request)
                if (response.isSuccessful) {
                    loadGoals(token, userId)
                } else {
                    _error.value = "Failed to add goal: HTTP ${response.code()}"
                }
            } catch (e: Exception) {
                _error.value = e.message
            } finally {
                _isLoading.value = false
            }
        }
    }

    // ✅ goalId arrives as String from fragment (goal.id.toString()) — convert to Int for API
    fun contributeToGoal(token: String, goalId: String, amount: Double) {
        viewModelScope.launch {
            try {
                _isLoading.value = true
                // ── Phase 2: Risk-based budget gate ──────────────────────────
                when (checkBudget(amount)) {
                    BudgetCheckResult.BLOCK -> {
                        _budgetBlocked.value = getBudgetWarningData(amount)
                        return@launch
                    }
                    BudgetCheckResult.HARD_BLOCK -> {
                        _budgetBlocked.value = getBudgetWarningData(amount).copy(isHardBlock = true)
                        return@launch
                    }
                    BudgetCheckResult.WARN  -> {
                        _pendingContribution.value = PendingContribution(token, goalId, amount)
                        _budgetWarning.value = getBudgetWarningData(amount)
                        return@launch
                    }
                    BudgetCheckResult.ALLOW -> { /* fall through to API */ }
                }
                // ─────────────────────────────────────────────────────────────
                val userId    = getUserId()
                val goalIdInt = goalId.toIntOrNull() ?: run {
                    _error.value = "Invalid goal ID"; return@launch
                }
                val response = ApiClient.authApi.contributeToGoal(
                    token, userId, goalIdInt, ContributionRequest(amount)
                )
                if (response.isSuccessful) {
                    _contributeSuccess.value = amount
                    loadGoals(token, userId)
                } else {
                    // Parse error response to extract user-friendly message
                    val errorMessage = try {
                        val errorBody = response.errorBody()?.string()
                        if (errorBody != null) {
                            // Try to parse JSON error response
                            val jsonObject = org.json.JSONObject(errorBody)
                            jsonObject.optString("message", "Contribution failed")
                        } else {
                            "Contribution failed (${response.code()})"
                        }
                    } catch (e: Exception) {
                        "Contribution failed (${response.code()})"
                    }

                    android.util.Log.e("ContributeGoal", "HTTP ${response.code()}: $errorMessage")
                    _error.value = errorMessage
                }
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun forceContributeToGoal() {
        val pending = _pendingContribution.value ?: return
        _pendingContribution.value = null   // clear BEFORE launch — prevents double-fire
        viewModelScope.launch {
            try {
                _isLoading.value = true
                val userId    = getUserId()
                val goalIdInt = pending.goalId.toIntOrNull() ?: run {
                    _error.value = "Invalid goal ID"; return@launch
                }
                val response = ApiClient.authApi.contributeToGoal(
                    pending.token, userId, goalIdInt, ContributionRequest(pending.amount)
                )
                if (response.isSuccessful) {
                    _contributeSuccess.value = pending.amount
                    loadGoals(pending.token, userId)
                } else {
                    // Parse error response to extract user-friendly message
                    val errorMessage = try {
                        val errorBody = response.errorBody()?.string()
                        if (errorBody != null) {
                            val jsonObject = org.json.JSONObject(errorBody)
                            jsonObject.optString("message", "Contribution failed")
                        } else {
                            "Contribution failed (${response.code()})"
                        }
                    } catch (e: Exception) {
                        "Contribution failed (${response.code()})"
                    }

                    android.util.Log.e("ForceContribute", "HTTP ${response.code()}: $errorMessage")
                    _error.value = errorMessage
                }
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun cancelPendingContribution() {
        _pendingContribution.value = null
    }

    // ✅ goalId arrives as String from fragment — convert to Int for API
    fun updateGoal(
        token: String,
        goalId: String,
        name: String,
        targetAmount: Double,
        currentAmount: Double,
        deadline: String?,
        category: String?
    ) {
        viewModelScope.launch {
            try {
                _isLoading.value = true
                val userId    = getUserId()
                val goalIdInt = goalId.toIntOrNull() ?: run {
                    _error.value = "Invalid goal ID"; return@launch
                }
                val request = GoalRequest(
                    userId        = userId,
                    goalName      = name,
                    targetAmount  = targetAmount,
                    currentAmount = currentAmount,
                    deadline      = deadline?.ifEmpty { null },
                    category      = category?.ifEmpty { null }
                )
                val response = ApiClient.authApi.updateGoal(token, userId, goalIdInt, request)
                if (response.isSuccessful) {
                    loadGoals(token, userId)
                } else {
                    val errBody = response.errorBody()?.string() ?: "no body"
                    android.util.Log.e("UpdateGoal", "HTTP ${response.code()}: $errBody")
                    _error.value = "Update failed (${response.code()}): $errBody"
                }
            } catch (e: Exception) {
                android.util.Log.e("UpdateGoal", "Exception: ${e.message}", e)
                _error.value = "Update error: ${e.message}"
            } finally {
                _isLoading.value = false
            }
        }
    }

    // ✅ goalId arrives as String from fragment — convert to Int for API
    fun deleteGoal(token: String, goalId: String) {
        viewModelScope.launch {
            try {
                _isLoading.value = true
                val userId    = getUserId()
                val goalIdInt = goalId.toIntOrNull() ?: run {
                    _error.value = "Invalid goal ID"; return@launch
                }
                val response = ApiClient.authApi.deleteGoal(token, userId, goalIdInt)
                if (response.isSuccessful) {
                    loadGoals(token, userId)
                } else {
                    _error.value = "Failed to delete goal: HTTP ${response.code()}"
                }
            } catch (e: Exception) {
                _error.value = e.message
            } finally {
                _isLoading.value = false
            }
        }
    }
}