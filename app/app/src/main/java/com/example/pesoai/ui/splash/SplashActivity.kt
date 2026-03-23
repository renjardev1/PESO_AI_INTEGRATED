package com.example.pesoai.ui.splash

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import com.example.pesoai.databinding.ActivitySplashBinding
import com.example.pesoai.ui.authentication.AuthActivity
import com.example.pesoai.ui.onboarding.OnboardingActivity
import com.example.pesoai.MainActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.URL

class SplashActivity : AppCompatActivity() {

    private lateinit var binding: ActivitySplashBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySplashBinding.inflate(layoutInflater)
        setContentView(binding.root)

        requestNotificationPermission()
        // Check maintenance first, then route after delay
        Handler(Looper.getMainLooper()).postDelayed({ checkMaintenanceThenRoute() }, SPLASH_DELAY_MS)
    }

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(
                    this, Manifest.permission.POST_NOTIFICATIONS
                ) != PackageManager.PERMISSION_GRANTED
            ) {
                ActivityCompat.requestPermissions(
                    this,
                    arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                    100
                )
            }
        }
    }

    /**
     * Hits GET /api/maintenance before routing.
     * If active → show a non-dismissible alert dialog. On "OK" → finish() (exits the app).
     * If not active or network error → proceed with normal routing.
     */
    private fun checkMaintenanceThenRoute() {
        CoroutineScope(Dispatchers.IO).launch {
            var isActive:  Boolean
            var title:     String
            var message:   String

            try {
                val prefs   = getSharedPreferences("PesoAI_Prefs", Context.MODE_PRIVATE)
                val baseUrl = getBaseUrl()               // reads from same ApiClient constant
                val url     = URL("${baseUrl}maintenance")
                val conn    = url.openConnection() as java.net.HttpURLConnection
                conn.connectTimeout = 5_000
                conn.readTimeout    = 5_000
                conn.requestMethod  = "GET"

                // Attach token if available so the server can respond properly
                val token = prefs.getString("jwt_token", null)
                if (!token.isNullOrEmpty()) conn.setRequestProperty("Authorization", "Bearer $token")

                val responseCode = conn.responseCode
                if (responseCode == 200) {
                    val body = conn.inputStream.bufferedReader().readText()
                    val json = JSONObject(body)
                    isActive = json.optBoolean("active", false)
                    title    = json.optString("title",   "App Maintenance")
                    message  = json.optString("message", "PESO AI is currently under maintenance. Please try again later.")
                } else {
                    // Non-200 — treat as no maintenance so app doesn't get stuck
                    isActive = false
                    title    = ""
                    message  = ""
                }
                conn.disconnect()
            } catch (e: Exception) {
                // Network error — assume no maintenance so offline users aren't blocked
                isActive = false
                title    = ""
                message  = ""
            }

            withContext(Dispatchers.Main) {
                if (isActive) {
                    showMaintenanceDialog(title, message)
                } else {
                    route()
                }
            }
        }
    }

    /**
     * Non-cancellable dialog. Tapping OK calls finish() which exits the app entirely.
     * Back button is suppressed via setCancelable(false).
     */
    private fun showMaintenanceDialog(title: String, message: String) {
        AlertDialog.Builder(this)
            .setTitle(title.ifBlank { "App Under Maintenance" })
            .setMessage(message.ifBlank { "PESO AI is currently undergoing maintenance. Please check back later." })
            .setCancelable(false)                   // back button does nothing
            .setPositiveButton("OK") { _, _ ->
                // Exit the app cleanly
                finishAffinity()
            }
            .show()
    }

    private fun route() {
        val prefs     = getSharedPreferences("PesoAI_Prefs", Context.MODE_PRIVATE)
        val userId    = prefs.getString("user_id",  null)
        val token     = prefs.getString("jwt_token", null)
        val onboarded = prefs.getBoolean("onboarding_completed", false)

        val target = when {
            userId.isNullOrEmpty() || token.isNullOrEmpty() -> AuthActivity::class.java
            !onboarded                                       -> OnboardingActivity::class.java
            else                                             -> MainActivity::class.java
        }

        startActivity(Intent(this, target))
        finish()
    }

    /**
     * Returns the API base URL — must match ApiClient.BASE_URL exactly.
     * Update both here and in ApiClient when changing server address.
     */
    private fun getBaseUrl(): String = BASE_URL

    companion object {
        private const val SPLASH_DELAY_MS = 1500L
        // Keep in sync with ApiClient.BASE_URL
        private const val BASE_URL = "http://192.168.68.51:3000/api/"
    }


}