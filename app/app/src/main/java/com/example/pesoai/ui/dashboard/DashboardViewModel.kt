package com.example.pesoai.ui.dashboard

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.viewModelScope
import com.example.pesoai.api.models.DashboardData
import com.example.pesoai.api.models.SavingsGoal
import com.example.pesoai.data.repository.DashboardRepository
import com.example.pesoai.data.repository.SavingsGoalRepository
import kotlinx.coroutines.launch

class DashboardViewModel(application: Application) : AndroidViewModel(application) {

    private val dashboardRepository = DashboardRepository()
    private val goalsRepository     = SavingsGoalRepository()

    private val _dashboardData = MutableLiveData<DashboardData?>()
    val dashboardData: LiveData<DashboardData?> = _dashboardData

    private val _savingsGoals = MutableLiveData<List<SavingsGoal>>()
    val savingsGoals: LiveData<List<SavingsGoal>> = _savingsGoals

    private val _isLoading = MutableLiveData<Boolean>()
    val isLoading: LiveData<Boolean> = _isLoading

    private val _error = MutableLiveData<String?>()
    val error: LiveData<String?> = _error

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

    // No-param — reads token/userId internally
    fun loadDashboardData() {
        viewModelScope.launch {
            try {
                _isLoading.value = true
                _error.value = null
                val data = dashboardRepository.getDashboardData(getToken(), getUserId())
                _dashboardData.value = data
            } catch (e: Exception) {
                _error.value = e.message
            } finally {
                _isLoading.value = false
            }
        }
    }

    // Loads up to 3 active savings goals for the dashboard preview
    fun loadSavingsGoals() {
        viewModelScope.launch {
            try {
                val goals = goalsRepository.getGoals(getToken(), getUserId(), status = "active")
                _savingsGoals.value = goals.take(3)
            } catch (e: Exception) {
                _error.value = e.message
            }
        }
    }
}