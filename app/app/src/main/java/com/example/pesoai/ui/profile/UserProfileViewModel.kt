package com.example.pesoai.ui.profile

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.viewModelScope
import com.example.pesoai.api.models.UserProfile
import com.example.pesoai.data.repository.UserProfileRepository
import com.example.pesoai.utils.SingleLiveEvent
import kotlinx.coroutines.launch
import android.net.Uri
import java.io.File
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class UserProfileViewModel(application: Application) : AndroidViewModel(application) {

    private val repository = UserProfileRepository()

    private val _currentProfile = MutableLiveData<UserProfile?>()
    val currentProfile: LiveData<UserProfile?> = _currentProfile

    private val _isLoading = MutableLiveData<Boolean>()
    val isLoading: LiveData<Boolean> = _isLoading

    private val _error = MutableLiveData<String?>()
    val error: LiveData<String?> = _error

    private val _updateSuccess = SingleLiveEvent<Boolean>()
    val updateSuccess: LiveData<Boolean> = _updateSuccess

    private val _accountDeleted = SingleLiveEvent<Boolean>()
    val accountDeleted: LiveData<Boolean> = _accountDeleted

    private val _pendingImageUri = MutableLiveData<Uri?>(null)
    val pendingImageUri: LiveData<Uri?> = _pendingImageUri

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

    fun loadProfile() {
        viewModelScope.launch {
            try {
                _isLoading.value = true
                _error.value     = null
                val response = repository.getUserProfile(getToken(), getUserId())
                val details  = response.profile
                if (details != null) {
                    _currentProfile.value = UserProfile(
                        firstName      = details.firstName,
                        lastName       = details.lastName,
                        email          = details.email,
                        username       = details.username,
                        phone          = details.phone,
                        location       = details.location,
                        profilePicture = details.profilePicture,
                        daysActive     = details.daysActive,
                        goalsCount     = details.goalsCount,
                        totalSaved     = details.totalSaved,
                        createdAt      = details.createdAt
                    )
                    // Phase 2: cache risk_tolerance for budget validation
                    if (details.riskTolerance.isNotBlank()) {
                        getPrefs().edit()
                            .putString("risk_tolerance", details.riskTolerance)
                            .apply()
                    }
                } else {
                    _error.value = response.message ?: "Failed to load profile"
                }
            } catch (e: Exception) {
                _error.value = e.message
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun updateProfile(
        firstName: String,
        lastName: String?,
        email: String,
        username: String?,
        phone: String?,
        location: String?
    ) {
        viewModelScope.launch {
            try {
                _isLoading.value = true
                repository.updateProfile(
                    token     = getToken(),
                    userId    = getUserId(),
                    firstName = firstName,
                    lastName  = lastName,
                    email     = email,
                    username  = username,
                    phone     = phone,
                    location  = location
                )
                _updateSuccess.value = true
            } catch (e: Exception) {
                _error.value = e.message
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun setPendingImage(uri: Uri) {
        viewModelScope.launch(Dispatchers.IO) {
            try {
                val dest = File(getApplication<Application>().filesDir, "pending_profile.jpg")
                getApplication<Application>().contentResolver
                    .openInputStream(uri)?.use { input ->
                        dest.outputStream().use { output -> input.copyTo(output) }
                    }
                _pendingImageUri.postValue(Uri.fromFile(dest))
            } catch (e: Exception) {
                _pendingImageUri.postValue(uri)
            }
        }
    }

    fun clearPendingImage() {
        _pendingImageUri.value = null
    }

    fun deleteAccount(password: String) {
        viewModelScope.launch {
            try {
                val response = repository.deleteAccount(
                    token    = getToken(),
                    userId   = getUserId(),
                    password = password
                )
                if (response.success) {
                    _accountDeleted.value = true
                } else {
                    _error.value = response.message
                }
            } catch (e: Exception) {
                _error.value = e.message
            }
        }
    }
}