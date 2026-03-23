package com.example.pesoai.ui.analytics

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.viewModelScope
import com.example.pesoai.api.ApiClient
import com.example.pesoai.api.models.AnalyticsResponse
import com.example.pesoai.api.models.InsightsResponse
import com.example.pesoai.api.models.TrendDataResponse
import com.example.pesoai.data.repository.AnalyticsRepository
import kotlinx.coroutines.launch

class AnalyticsViewModel(application: Application) : AndroidViewModel(application) {

    private val repository = AnalyticsRepository()

    private val _analyticsData = MutableLiveData<AnalyticsResponse?>()
    val analyticsData: LiveData<AnalyticsResponse?> = _analyticsData

    // FIX 2: Added trend data LiveData
    private val _trendData = MutableLiveData<TrendDataResponse?>()
    val trendData: LiveData<TrendDataResponse?> = _trendData

    // FIX 3: Added insights LiveData
    private val _insightsData = MutableLiveData<InsightsResponse?>()
    val insightsData: LiveData<InsightsResponse?> = _insightsData

    private val _isLoading = MutableLiveData<Boolean>()
    val isLoading: LiveData<Boolean> = _isLoading

    // FIX 3: Separate loading state for insights
    private val _isInsightsLoading = MutableLiveData<Boolean>()
    val isInsightsLoading: LiveData<Boolean> = _isInsightsLoading

    private val _error = MutableLiveData<String?>()
    val error: LiveData<String?> = _error

    // ── Token / userId helpers ────────────────────────────────────────────────

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

    // ── Analytics (daily spending + category + summary) ───────────────────────

    fun loadAnalytics(startDate: String, endDate: String) {
        viewModelScope.launch {
            try {
                _isLoading.value = true
                _error.value     = null
                val data = repository.getAnalytics(getToken(), getUserId(), startDate, endDate)
                _analyticsData.value = data
            } catch (e: Exception) {
                _error.value = e.message
            } finally {
                _isLoading.value = false
            }
        }
    }

    // FIX 2: Load trend chart data — period: "week" | "month" | "year"
    fun loadTrendData(period: String) {
        viewModelScope.launch {
            try {
                val response = ApiClient.authApi.getTrendData(getToken(), getUserId(), period)
                if (response.isSuccessful) {
                    _trendData.value = response.body()
                }
            } catch (e: Exception) {
                // Trend chart failure is non-critical — don't surface to user
            }
        }
    }

    // FIX 3: Load AI insights
    fun loadInsights() {
        viewModelScope.launch {
            try {
                _isInsightsLoading.value = true
                val response = ApiClient.authApi.getAIInsights(getToken(), getUserId())
                if (response.isSuccessful) {
                    _insightsData.value = response.body()
                } else {
                    _insightsData.value = InsightsResponse(success = false, message = "Failed to load insights")
                }
            } catch (e: Exception) {
                _insightsData.value = InsightsResponse(success = false, message = e.message)
            } finally {
                _isInsightsLoading.value = false
            }
        }
    }
}