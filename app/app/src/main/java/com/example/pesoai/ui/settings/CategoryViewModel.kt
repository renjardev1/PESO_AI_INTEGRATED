package com.example.pesoai.ui.settings

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.viewModelScope
import androidx.fragment.app.activityViewModels
import com.example.pesoai.api.models.Category  // ✅ FIX: Added import
import com.example.pesoai.data.repository.CategoryRepository
import kotlinx.coroutines.launch

class CategoryViewModel(application: Application) : AndroidViewModel(application) {

    private val repository = CategoryRepository()
    private val prefs = application.getSharedPreferences("PesoAI_Prefs", Context.MODE_PRIVATE)

    // ── State ────────────────────────────────────────────────────────────────

    private val _categories     = MutableLiveData<List<Category>>()
    val categories: LiveData<List<Category>> = _categories

    private val _isLoading      = MutableLiveData(false)
    val isLoading: LiveData<Boolean> = _isLoading

    private val _errorMessage   = MutableLiveData<String?>()
    val errorMessage: LiveData<String?> = _errorMessage

    private val _successMessage = MutableLiveData<String?>()
    val successMessage: LiveData<String?> = _successMessage

    // ── Helpers ──────────────────────────────────────────────────────────────

    private fun userId(): String = prefs.getString("user_id", "") ?: ""
    // ✅ FIX: Added token helper
    private fun token(): String = "Bearer ${prefs.getString("jwt_token", "") ?: ""}"

    private fun setLoading(v: Boolean) { _isLoading.value = v }
    fun clearMessages() { _errorMessage.value = null; _successMessage.value = null }

    // ── Load ─────────────────────────────────────────────────────────────────

    fun loadCategories() {
        val uid = userId()
        val tkn = token()  // ✅ FIX: Get token
        if (uid.isBlank()) { _errorMessage.value = "User not logged in."; return }
        viewModelScope.launch {
            setLoading(true)
            try {
                // ✅ FIX: Pass token to repository
                val resp = repository.getCategories(tkn, uid)
                if (resp.isSuccessful && resp.body()?.success == true) {
                    _categories.value = resp.body()!!.categories
                } else {
                    _errorMessage.value = "Failed to load categories."
                }
            } catch (e: Exception) {
                _errorMessage.value = "Connection error: ${e.message}"
            } finally {
                setLoading(false)
            }
        }
    }

    // ── Add ──────────────────────────────────────────────────────────────────

    fun addCategory(name: String, icon: String, color: String) {
        val uid = userId()
        val tkn = token()  // ✅ FIX: Get token
        if (uid.isBlank()) { _errorMessage.value = "User not logged in."; return }
        if (name.isBlank()) { _errorMessage.value = "Category name cannot be empty."; return }
        viewModelScope.launch {
            setLoading(true)
            try {
                // ✅ FIX: Pass token to repository
                val resp = repository.addCategory(tkn, uid, name.trim(), icon, color)
                if (resp.isSuccessful && resp.body()?.success == true) {
                    _successMessage.value = "Category \"${name.trim()}\" added."
                    loadCategories()
                } else {
                    _errorMessage.value = resp.body()?.message ?: "Failed to add category."
                }
            } catch (e: Exception) {
                _errorMessage.value = "Connection error: ${e.message}"
            } finally {
                setLoading(false)
            }
        }
    }

    // ── Update ───────────────────────────────────────────────────────────────

    fun updateCategory(categoryId: Int, name: String, icon: String, color: String) {
        val uid = userId()
        val tkn = token()  // ✅ FIX: Get token
        if (uid.isBlank()) { _errorMessage.value = "User not logged in."; return }
        if (name.isBlank()) { _errorMessage.value = "Category name cannot be empty."; return }
        viewModelScope.launch {
            setLoading(true)
            try {
                // ✅ FIX: Pass token to repository
                val resp = repository.updateCategory(tkn, uid, categoryId, name.trim(), icon, color)
                if (resp.isSuccessful && resp.body()?.success == true) {
                    _successMessage.value = "Category updated."
                    loadCategories()
                } else {
                    _errorMessage.value = resp.body()?.message ?: "Failed to update category."
                }
            } catch (e: Exception) {
                _errorMessage.value = "Connection error: ${e.message}"
            } finally {
                setLoading(false)
            }
        }
    }

    // ── Delete ───────────────────────────────────────────────────────────────

    fun deleteCategory(categoryId: Int, name: String) {
        val uid = userId()
        val tkn = token()  // ✅ FIX: Get token
        if (uid.isBlank()) { _errorMessage.value = "User not logged in."; return }

        viewModelScope.launch {
            setLoading(true)
            try {
                val resp = repository.deleteCategory(tkn, uid, categoryId)
                if (resp.isSuccessful && resp.body()?.success == true) {
                    _successMessage.value = "Category \"$name\" deleted."
                    loadCategories()
                } else {
                    // Read error body for non-2xx responses (e.g. 409 delete protection)
                    val errorMsg = try {
                        val errorJson = resp.errorBody()?.string()
                        if (!errorJson.isNullOrBlank()) {
                            val obj = org.json.JSONObject(errorJson)
                            obj.optString("message", "Failed to delete category.")
                        } else {
                            "Failed to delete category."
                        }
                    } catch (_: Exception) {
                        "Failed to delete category."
                    }
                    _errorMessage.value = errorMsg
                }
            } catch (e: Exception) {
                _errorMessage.value = "Connection error: ${e.message}"
            } finally {
                setLoading(false)
            }
        }
    }
}