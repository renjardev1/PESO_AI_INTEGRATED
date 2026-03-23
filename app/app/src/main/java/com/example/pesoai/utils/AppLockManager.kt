package com.example.pesoai.utils

import android.content.Context

object AppLockManager {

    private const val KEY_BYPASS = "app_lock_bypass"

    fun suppressForNextResume(context: Context) {
        context.getSharedPreferences("PesoAI_Prefs", Context.MODE_PRIVATE)
            .edit().putBoolean(KEY_BYPASS, true).apply()
    }

    fun shouldBypass(context: Context): Boolean {
        val prefs  = context.getSharedPreferences("PesoAI_Prefs", Context.MODE_PRIVATE)
        val bypass = prefs.getBoolean(KEY_BYPASS, false)
        if (bypass) prefs.edit().putBoolean(KEY_BYPASS, false).apply()
        return bypass
    }
}