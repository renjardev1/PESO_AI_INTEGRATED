package com.example.pesoai.ui.authentication

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.viewModelScope
import com.example.pesoai.api.ApiClient
import com.example.pesoai.api.models.ForgotPasswordRequest
import com.example.pesoai.api.models.LoginRequest
import com.example.pesoai.api.models.ResetPasswordRequest
import com.example.pesoai.api.models.SignupRequest
import kotlinx.coroutines.launch

sealed class AuthResult {
    data class Success(
        val token:               String,
        val userId:              String,
        val username:            String,
        val firstName:           String,
        val lastName:            String,
        val email:               String,
        val onboardingCompleted: Boolean
    ) : AuthResult()
    data class Error(val message: String) : AuthResult()
}

class AuthViewModel(application: Application) : AndroidViewModel(application) {

    private val _authResult  = MutableLiveData<AuthResult?>()
    val authResult: LiveData<AuthResult?> = _authResult

    private val _isLoading   = MutableLiveData(false)
    val isLoading: LiveData<Boolean> = _isLoading

    // ── Forgot Password state ─────────────────────────────────────────────────

    private val _forgotPasswordResult = MutableLiveData<String?>()
    val forgotPasswordResult: LiveData<String?> = _forgotPasswordResult

    private val _resetPasswordResult  = MutableLiveData<String?>()
    val resetPasswordResult: LiveData<String?> = _resetPasswordResult

    private val _forgotPasswordError  = MutableLiveData<String?>()
    val forgotPasswordError: LiveData<String?> = _forgotPasswordError

    private val _resetPasswordError   = MutableLiveData<String?>()
    val resetPasswordError: LiveData<String?> = _resetPasswordError

    // ── Login ─────────────────────────────────────────────────────────────────

    // REMOVED: rememberMe param — Remember Me feature removed
    fun login(usernameOrEmail: String, password: String) {
        _isLoading.value  = true
        _authResult.value = null

        viewModelScope.launch {
            try {
                val isEmail = usernameOrEmail.contains("@")
                val request = if (isEmail)
                    LoginRequest(username = "", email = usernameOrEmail, password = password)
                else
                    LoginRequest(username = usernameOrEmail, email = "", password = password)

                val response = ApiClient.authApi.login(request)

                if (response.isSuccessful) {
                    val body = response.body()!!
                    _authResult.value = AuthResult.Success(
                        token               = body.token,
                        userId              = body.user.id,
                        username            = body.user.username,
                        firstName           = body.user.firstName,
                        lastName            = body.user.lastName,
                        email               = body.user.email,
                        onboardingCompleted = body.user.onboardingCompleted
                    )
                } else {
                    val msg = response.errorBody()?.string() ?: "Login failed."
                    _authResult.value = AuthResult.Error(msg)
                }

            } catch (e: Exception) {
                _authResult.value = AuthResult.Error(e.message ?: "Network error.")
            } finally {
                _isLoading.value = false
            }
        }
    }

    // ── Signup ────────────────────────────────────────────────────────────────

    fun signup(
        firstName: String, lastName: String, username: String,
        email: String, password: String
    ) {
        _isLoading.value  = true
        _authResult.value = null

        viewModelScope.launch {
            try {
                val request  = SignupRequest(firstName, lastName, username, email, password)
                val response = ApiClient.authApi.signup(request)

                if (response.isSuccessful) {
                    val body = response.body()!!
                    _authResult.value = AuthResult.Success(
                        token               = body.token,
                        userId              = body.user.id,
                        username            = body.user.username,
                        firstName           = body.user.firstName,
                        lastName            = body.user.lastName,
                        email               = body.user.email,
                        onboardingCompleted = body.user.onboardingCompleted
                    )
                } else {
                    val msg = response.errorBody()?.string() ?: "Signup failed."
                    _authResult.value = AuthResult.Error(msg)
                }

            } catch (e: Exception) {
                _authResult.value = AuthResult.Error(e.message ?: "Network error.")
            } finally {
                _isLoading.value = false
            }
        }
    }

    // ── Forgot Password — Step 1 ──────────────────────────────────────────────

    fun requestPasswordReset(email: String) {
        _isLoading.value            = true
        _forgotPasswordResult.value = null
        _forgotPasswordError.value  = null

        viewModelScope.launch {
            try {
                val response = ApiClient.authApi.forgotPassword(ForgotPasswordRequest(email))
                if (response.isSuccessful && response.body()?.success == true) {
                    _forgotPasswordResult.value =
                        response.body()?.message ?: "Reset code sent. Check your email."
                } else {
                    _forgotPasswordError.value =
                        response.body()?.message ?: "Failed to send reset code."
                }
            } catch (e: Exception) {
                _forgotPasswordError.value = "Network error. Please check your connection."
            } finally {
                _isLoading.value = false
            }
        }
    }

    // ── Forgot Password — Step 2 ──────────────────────────────────────────────

    fun resetPassword(email: String, otp: String, newPassword: String) {
        _isLoading.value           = true
        _resetPasswordResult.value = null
        _resetPasswordError.value  = null

        viewModelScope.launch {
            try {
                val response = ApiClient.authApi.resetPassword(
                    ResetPasswordRequest(email = email, otp = otp, newPassword = newPassword)
                )
                if (response.isSuccessful && response.body()?.success == true) {
                    _resetPasswordResult.value =
                        response.body()?.message ?: "Password reset successfully."
                } else {
                    _resetPasswordError.value =
                        response.body()?.message ?: "Invalid or expired code."
                }
            } catch (e: Exception) {
                _resetPasswordError.value = "Network error. Please check your connection."
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun clearForgotPasswordState() {
        _forgotPasswordResult.value = null
        _forgotPasswordError.value  = null
        _resetPasswordResult.value  = null
        _resetPasswordError.value   = null
    }

    fun clearResult() { _authResult.value = null }

    // ── Session helpers ───────────────────────────────────────────────────────

    // REMOVED: rememberMe param and all remember_me/remembered_credential prefs
    fun saveSession(result: AuthResult.Success) {
        getApplication<Application>()
            .getSharedPreferences("PesoAI_Prefs", Context.MODE_PRIVATE)
            .edit()
            .putString("jwt_token",             result.token)
            .putString("user_id",               result.userId)
            .putString("username",              result.username)
            .putString("first_name",            result.firstName)
            .putString("last_name",             result.lastName)
            .putString("email",                 result.email)
            .putBoolean("onboarding_completed", result.onboardingCompleted)
            // Clean up any stale Remember Me keys from old builds
            .remove("remember_me")
            .remove("remembered_credential")
            .apply()
    }
}