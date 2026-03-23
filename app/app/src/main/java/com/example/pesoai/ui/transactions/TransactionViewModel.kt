package com.example.pesoai.ui.transactions

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.viewModelScope
import com.example.pesoai.api.models.MonthlySummaryResponse
import com.example.pesoai.api.models.Transaction
import com.example.pesoai.data.repository.TransactionRepository
import com.example.pesoai.utils.SingleLiveEvent
import kotlinx.coroutines.launch

class TransactionViewModel(application: Application) : AndroidViewModel(application) {

    // ── Phase 2: Budget validation types ─────────────────────────────────────
    /** Exposed to Fragment for building both BLOCKED and WARN dialogs. */
    data class BudgetWarningData(
        val budget:      Double,
        val spent:       Double,
        val threshold:   Double,
        val newAmount:   Double,
        val newTotal:    Double,
        val blockLimit:  Double  = 0.0,   // balanced hard limit; 0 = N/A
        val isHardBlock: Boolean = false  // true = blocked at hard limit (balanced mode)
    )

    /** Lifecycle-safe pending-transaction holder — cleared on use or cancel. */
    private data class PendingTransaction(
        val amount:          Double,
        val category:        String,
        val description:     String?,
        val transactionType: String,
        val transactionDate: String
    )

    private enum class BudgetCheckResult { ALLOW, WARN, BLOCK, HARD_BLOCK }
    // ─────────────────────────────────────────────────────────────────────────

    private val repository = TransactionRepository()

    private val _transactions = MutableLiveData<List<Transaction>>()
    val transactions: LiveData<List<Transaction>> = _transactions

    private val _monthlySummary = MutableLiveData<MonthlySummaryResponse>()
    val monthlySummary: LiveData<MonthlySummaryResponse> = _monthlySummary

    private val _isLoading = MutableLiveData<Boolean>()
    val isLoading: LiveData<Boolean> = _isLoading

    private val _error = MutableLiveData<String?>()
    val error: LiveData<String?> = _error

    private val _addSuccess = SingleLiveEvent<Boolean>()
    val addSuccess: LiveData<Boolean> = _addSuccess

    // ── Phase 2: Budget validation events ────────────────────────────────────
    private val _budgetBlocked = SingleLiveEvent<BudgetWarningData>()
    val budgetBlocked: LiveData<BudgetWarningData> = _budgetBlocked

    private val _budgetWarning = SingleLiveEvent<BudgetWarningData>()
    val budgetWarning: LiveData<BudgetWarningData> = _budgetWarning

    /** MutableLiveData (not raw var) — survives config change, null = nothing pending. */
    private val _pendingTransaction = MutableLiveData<PendingTransaction?>(null)
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

    // ── No-param: called internally after add / update / delete ──────────────
    // ── Phase 2: Budget validation helpers ───────────────────────────────────

    private fun getPrefs() = getApplication<Application>()
        .getSharedPreferences("PesoAI_Prefs", Context.MODE_PRIVATE)

    private fun checkBudget(newAmount: Double): BudgetCheckResult {
        val budget    = getPrefs().getFloat("user_monthly_budget", 0f).toDouble()
        val spent     = getPrefs().getFloat("cached_total_spent",  0f).toDouble()
        val threshold = getPrefs().getFloat("budget_alert_limit",  (budget * 0.8).toFloat()).toDouble()
        val hardLimit = getPrefs().getFloat("balanced_hard_limit", (budget * 1.5).toFloat()).toDouble()
        val risk      = getPrefs().getString("risk_tolerance", "balanced") ?: "balanced"
        // Safety: no budget set → never block/warn a fresh account
        if (budget <= 0.0) return BudgetCheckResult.ALLOW
        val newTotal = spent + newAmount
        return when (risk) {
            "strict" ->
                if (spent >= budget || newTotal >= budget)
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
                    BudgetCheckResult.WARN   // warn only, never block
                else
                    BudgetCheckResult.ALLOW

            else -> BudgetCheckResult.ALLOW
        }
    }

    private fun getBudgetWarningData(newAmount: Double): BudgetWarningData {
        val budget    = getPrefs().getFloat("user_monthly_budget", 0f).toDouble()
        val spent     = getPrefs().getFloat("cached_total_spent",  0f).toDouble()
        val threshold = getPrefs().getFloat("budget_alert_limit",  (budget * 0.8).toFloat()).toDouble()
        val risk      = getPrefs().getString("risk_tolerance", "balanced") ?: "balanced"
        // Only include hard limit for balanced mode — strict uses budget as the hard ceiling
        val hardLimit = if (risk == "balanced")
            getPrefs().getFloat("balanced_hard_limit", (budget * 1.5).toFloat()).toDouble()
        else budget
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

    // ── No-param: called internally after add / update / delete ──────────────
    fun loadTransactions() {
        viewModelScope.launch {
            try {
                _isLoading.value = true
                _error.value     = null
                _transactions.value = repository.getTransactions(getToken(), getUserId())
            } catch (e: Exception) {
                _error.value = e.message
            } finally {
                _isLoading.value = false
            }
        }
    }

    // ── With dates: called from TransactionFragment with period range ─────────
    fun loadTransactions(token: String, userId: String, startDate: String, endDate: String) {
        viewModelScope.launch {
            try {
                _isLoading.value = true
                _error.value     = null
                _transactions.value = repository.getTransactions(token, userId, startDate, endDate)
            } catch (e: Exception) {
                _error.value = e.message
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun loadMonthlySummary(year: Int, month: Int) {
        viewModelScope.launch {
            try {
                _monthlySummary.value = repository.getMonthlySummary(getToken(), getUserId())
            } catch (e: Exception) {
                _error.value = e.message
            }
        }
    }

    fun addTransaction(
        amount: Double,
        category: String,         // ✅ already lowercase when called from fragment
        description: String?,
        transactionType: String,  // ✅ "expense"
        transactionDate: String   // ✅ YYYY-MM-DD
    ) {
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
                        // Balanced mode: blocked at user-configured hard limit
                        _budgetBlocked.value = getBudgetWarningData(amount).copy(isHardBlock = true)
                        return@launch
                    }
                    BudgetCheckResult.WARN  -> {
                        _pendingTransaction.value = PendingTransaction(
                            amount, category, description, transactionType, transactionDate
                        )
                        _budgetWarning.value = getBudgetWarningData(amount)
                        return@launch
                    }
                    BudgetCheckResult.ALLOW -> { /* fall through to API */ }
                }
                // ─────────────────────────────────────────────────────────────
                repository.addTransaction(
                    getToken(), getUserId(), amount, category,
                    description, transactionType, transactionDate
                )
                _addSuccess.value = true
                loadTransactions()
            } catch (e: Exception) {
                _error.value      = e.message
                _addSuccess.value = false
            } finally {
                _isLoading.value = false
            }
        }
    }

    /**
     * Phase 2: Called after user taps "Proceed Anyway" in the Moderate warning dialog.
     * Reads the typed pending data, clears it atomically before the launch to prevent
     * double-fire on rapid taps, then executes the same API path as addTransaction().
     */
    fun forceAddTransaction() {
        val pending = _pendingTransaction.value ?: return
        _pendingTransaction.value = null   // clear BEFORE launch — prevents double-fire
        viewModelScope.launch {
            try {
                _isLoading.value = true
                repository.addTransaction(
                    getToken(), getUserId(),
                    pending.amount, pending.category, pending.description,
                    pending.transactionType, pending.transactionDate
                )
                _addSuccess.value = true
                loadTransactions()
            } catch (e: Exception) {
                _error.value      = e.message
                _addSuccess.value = false
            } finally {
                _isLoading.value = false
            }
        }
    }

    /**
     * Phase 2: Called when user taps Cancel in the warning dialog,
     * or from Fragment.onDestroyView() for lifecycle safety.
     */
    fun cancelPendingTransaction() {
        _pendingTransaction.value = null
    }

    // ✅ transactionId is Int from Transaction model
    fun deleteTransaction(transactionId: Int) {
        viewModelScope.launch {
            try {
                repository.deleteTransaction(getToken(), getUserId(), transactionId)
                loadTransactions()
            } catch (e: Exception) {
                _error.value = e.message
            }
        }
    }

    fun updateTransaction(
        transactionId: Int,
        amount: Double,
        category: String,
        description: String?,
        transactionType: String,
        transactionDate: String
    ) {
        viewModelScope.launch {
            try {
                _isLoading.value = true
                repository.updateTransaction(
                    getToken(), getUserId(), transactionId, amount, category,
                    description, transactionType, transactionDate
                )
                _addSuccess.value = true
                loadTransactions()
            } catch (e: Exception) {
                _error.value      = e.message
                _addSuccess.value = false
            } finally {
                _isLoading.value = false
            }
        }
    }
}