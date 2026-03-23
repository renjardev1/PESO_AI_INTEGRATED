package com.example.pesoai.ui.security

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.example.pesoai.MainActivity
import com.example.pesoai.R
import com.example.pesoai.api.ApiClient
import com.example.pesoai.api.models.VerifyPinRequest
import com.example.pesoai.databinding.ActivityAppLockBinding
import kotlinx.coroutines.launch

class AppLockActivity : AppCompatActivity() {

    private lateinit var binding: ActivityAppLockBinding

    private fun getPrefs() = getSharedPreferences("PesoAI_Prefs", Context.MODE_PRIVATE)
    private fun getToken()  = "Bearer ${getPrefs().getString("jwt_token", "") ?: ""}"
    // ✅ user_id always String UUID
    private fun getUserId() = getPrefs().getString("user_id", "") ?: ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityAppLockBinding.inflate(layoutInflater)
        setContentView(binding.root)
        setupPinInput()
        setupUnlockButton()
        // ✅ Try biometric first if enabled — PIN is the fallback
        if (isBiometricEnabled()) {
            showBiometricPrompt()
        }
    }

    // ── Biometric ─────────────────────────────────────────────────────────────

    private fun isBiometricEnabled(): Boolean {
        if (!getPrefs().getBoolean("biometric_enabled", false)) return false
        val manager = BiometricManager.from(this)
        return manager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK) ==
                BiometricManager.BIOMETRIC_SUCCESS
    }

    private fun showBiometricPrompt() {
        val executor = ContextCompat.getMainExecutor(this)

        val callback = object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                super.onAuthenticationSucceeded(result)
                recordUnlockAndProceed()
            }

            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                super.onAuthenticationError(errorCode, errString)
                // User tapped "Use PIN" or biometric is unavailable — do nothing,
                // PIN field is already visible as fallback
                if (errorCode != BiometricPrompt.ERROR_USER_CANCELED &&
                    errorCode != BiometricPrompt.ERROR_NEGATIVE_BUTTON
                ) {
                    Toast.makeText(
                        this@AppLockActivity,
                        getString(R.string.error_biometric_unavailable),
                        Toast.LENGTH_SHORT
                    ).show()
                }
            }

            override fun onAuthenticationFailed() {
                super.onAuthenticationFailed()
                // Individual attempt failed — biometric prompt handles retry UI automatically
            }
        }

        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle(getString(R.string.biometric_prompt_title))
            .setSubtitle(getString(R.string.biometric_prompt_subtitle))
            .setNegativeButtonText(getString(R.string.biometric_prompt_negative))
            .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_WEAK)
            .build()

        BiometricPrompt(this, executor, callback).authenticate(promptInfo)
    }

    // ── PIN input ─────────────────────────────────────────────────────────────

    private fun setupPinInput() {
        binding.btnUnlock.isEnabled = false
        binding.etPin.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun afterTextChanged(s: Editable?) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                val len = s?.length ?: 0
                binding.btnUnlock.isEnabled = len in 4..6
                if (len > 0) binding.tilPin.error = null
            }
        })
    }

    private fun setupUnlockButton() {
        binding.btnUnlock.setOnClickListener {
            val pin = binding.etPin.text.toString().trim()
            if (pin.length < 4) {
                binding.tilPin.error = getString(R.string.error_pin_length)
                return@setOnClickListener
            }
            verifyPin(pin)
        }
    }

    // ── Verify PIN against backend ────────────────────────────────────────────

    private fun verifyPin(pin: String) {
        binding.btnUnlock.isEnabled = false
        binding.tilPin.error        = null

        lifecycleScope.launch {
            try {
                val response = ApiClient.authApi.verifyPin(
                    getToken(), getUserId(), VerifyPinRequest(pin)
                )
                if (response.isSuccessful && response.body()?.success == true) {
                    recordUnlockAndProceed()
                } else {
                    binding.tilPin.error        = getString(R.string.error_incorrect_pin)
                    binding.etPin.text?.clear()
                    binding.btnUnlock.isEnabled = false
                }
            } catch (e: Exception) {
                Toast.makeText(
                    this@AppLockActivity,
                    getString(R.string.error_verification_failed),
                    Toast.LENGTH_SHORT
                ).show()
                binding.btnUnlock.isEnabled = true
            }
        }
    }

    // ── Shared unlock success handler ─────────────────────────────────────────

    private fun recordUnlockAndProceed() {
        getPrefs().edit()
            .putLong("last_unlock_time", System.currentTimeMillis())
            .apply()
        val intent = Intent(this@AppLockActivity, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        startActivity(intent)
        finish()
    }

    // ── Prevent back-press from bypassing the lock screen ────────────────────

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        // Intentionally blank — user must authenticate to proceed
    }
}