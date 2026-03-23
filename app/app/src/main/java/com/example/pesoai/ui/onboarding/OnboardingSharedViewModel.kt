package com.example.pesoai.ui.onboarding

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel

// Extends AndroidViewModel so it can read SharedPreferences for token/userId
class OnboardingSharedViewModel(application: Application) : AndroidViewModel(application) {

    // ── Step 1 — Personal Info ─────────────────────────────
    var age: Int = 0
    var gender: String = ""
    var occupation: String = ""

    // ── Step 2 — Financial Info ────────────────────────────
    var monthlyIncome: Double = 0.0
    var financialGoals: MutableList<String> = mutableListOf()
    var riskTolerance: String = ""

    // ── Step 2 — Savings Goal ──────────────────────────────
    var savingsGoal: Double = 0.0

    // ── Step 3 — Category Selection ───────────────────────
    var selectedCategories: MutableList<String> = mutableListOf()

    // ── Token helper ───────────────────────────────────────
    fun getToken(): String {
        val prefs = getApplication<Application>()
            .getSharedPreferences("PesoAI_Prefs", Context.MODE_PRIVATE)
        return "Bearer ${prefs.getString("jwt_token", "") ?: ""}"
    }

    // ── user_id is String (UUID) ───────────────────────────
    fun getUserId(): String {
        val prefs = getApplication<Application>()
            .getSharedPreferences("PesoAI_Prefs", Context.MODE_PRIVATE)
        return prefs.getString("user_id", "") ?: ""
    }
}