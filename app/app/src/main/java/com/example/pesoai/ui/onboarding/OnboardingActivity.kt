package com.example.pesoai.ui.onboarding

import android.content.Intent
import android.os.Bundle
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import com.example.pesoai.MainActivity
import com.example.pesoai.R
import com.example.pesoai.databinding.ActivityOnboardingBinding
import com.example.pesoai.ui.authentication.AuthActivity

class OnboardingActivity : AppCompatActivity() {

    private lateinit var binding: ActivityOnboardingBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityOnboardingBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // user_id is String (UUID) — use getString not getInt
        val prefs  = getSharedPreferences("PesoAI_Prefs", MODE_PRIVATE)
        val userId = prefs.getString("user_id", null)

        if (userId.isNullOrEmpty()) {
            finish()
            return
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() { showExitConfirmation() }
        })
    }

    private fun showExitConfirmation() {
        AlertDialog.Builder(this)
            .setTitle(getString(R.string.onboarding_exit_title))
            .setMessage(getString(R.string.onboarding_exit_message))
            .setPositiveButton(getString(R.string.onboarding_continue_setup)) { dialog, _ -> dialog.dismiss() }
            .setNegativeButton(getString(R.string.onboarding_exit)) { _, _ ->
                getSharedPreferences("PesoAI_Prefs", MODE_PRIVATE).edit().clear().apply()
                startActivity(Intent(this, AuthActivity::class.java))
                finish()
            }
            .setCancelable(false)
            .show()
    }

    fun navigateToMain() {
        getSharedPreferences("PesoAI_Prefs", MODE_PRIVATE).edit()
            .putBoolean("onboarding_completed", true).apply()
        startActivity(Intent(this, MainActivity::class.java))
        finish()
    }
}