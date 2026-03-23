package com.example.pesoai.ui.settings

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.RadioButton
import android.widget.RadioGroup
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.core.content.edit
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import com.example.pesoai.R
import com.example.pesoai.api.ApiClient
import com.example.pesoai.api.models.ChangePasswordRequest
import com.example.pesoai.api.models.UpdateBudgetPeriodRequest
import com.example.pesoai.api.models.UpdateBudgetRequest
import com.example.pesoai.databinding.FragmentSettingsBinding
import com.example.pesoai.ui.authentication.AuthActivity
import com.example.pesoai.ui.notifications.NotificationViewModel
import com.example.pesoai.utils.SocketManager
import com.google.android.material.button.MaterialButton
import com.google.android.material.checkbox.MaterialCheckBox
import com.google.android.material.textfield.TextInputEditText
import com.google.android.material.textfield.TextInputLayout
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class SettingsFragment : Fragment() {

    private var _binding: FragmentSettingsBinding? = null
    private val binding get() = _binding!!

    private val viewModel: SettingsViewModel by viewModels()

    // Shared with NotificationsFragment so settings changes propagate immediately
    private val notificationViewModel: NotificationViewModel by activityViewModels()

    private var isSettingLockProgrammatically = false

    private fun getPrefs() =
        requireActivity().getSharedPreferences("PesoAI_Prefs", Context.MODE_PRIVATE)

    private fun getToken()  = "Bearer ${getPrefs().getString("jwt_token", "") ?: ""}"
    private fun getUserId() = getPrefs().getString("user_id", "") ?: ""

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentSettingsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        loadSettings()
        viewModel.refreshBudgetFromApi()
        setupObservers()
        setupClickListeners()
    }

    private fun loadSettings() {
        val prefs     = getPrefs()
        val formatter = NumberFormat.getNumberInstance(Locale.US)

        viewModel.fetchCurrentBudget()

        val cachedBudget = prefs.getFloat("user_monthly_budget",
            prefs.getFloat("monthly_expenses", 10000f))
        binding.tvCurrentMonthlyBudget.text = "₱${formatter.format(cachedBudget.toInt())}"

        val alertLimit = prefs.getFloat("budget_alert_limit", cachedBudget * 0.8f)
        binding.tvCurrentBudget.text = "Alert at ₱${formatter.format(alertLimit.toInt())}"

        binding.tvCurrentPeriod.text = prefs.getString("budget_period", "Monthly") ?: "Monthly"

        binding.switchBudgetAlerts.isChecked      = prefs.getBoolean("budget_alerts",      true)
        binding.switchDailyReminders.isChecked    = prefs.getBoolean("daily_reminders",    false)
        binding.switchPushNotifications.isChecked = prefs.getBoolean("push_notifications", true)

        isSettingLockProgrammatically = true
        binding.switchAppLock.isChecked = prefs.getBoolean("app_lock_enabled", false)
        isSettingLockProgrammatically = false

        binding.switchShareAnalytics.isChecked = prefs.getBoolean("share_analytics", true)

        val currentRisk = prefs.getString("risk_tolerance", "balanced") ?: "balanced"
        binding.tvCurrentRiskTolerance.text = when (currentRisk) {
            "strict"   -> getString(R.string.risk_strict)
            "flexible" -> getString(R.string.risk_flexible)
            else       -> getString(R.string.risk_balanced)
        }

        val isBalanced = currentRisk == "balanced"
        binding.layoutBalancedHardLimit.visibility  = if (isBalanced) View.VISIBLE else View.GONE
        binding.dividerBalancedHardLimit.visibility = if (isBalanced) View.VISIBLE else View.GONE

        if (isBalanced) {
            val budget    = prefs.getFloat("user_monthly_budget", 0f).toDouble()
            val hardLimit = prefs.getFloat("balanced_hard_limit", (budget * 1.5).toFloat()).toDouble()
            binding.tvCurrentBalancedHardLimit.text =
                "Block at ₱${NumberFormat.getNumberInstance(Locale.US).format(hardLimit.toInt())}"
        }

        val lastBackup = prefs.getLong("last_backup", 0)
        binding.tvLastBackup.text = if (lastBackup > 0) {
            getString(R.string.settings_last_backup,
                SimpleDateFormat("MMM dd, yyyy 'at' h:mm a", Locale.getDefault()).format(Date(lastBackup)))
        } else getString(R.string.settings_never_backed_up)
    }

    private fun setupObservers() {
        viewModel.successMessage.observe(viewLifecycleOwner) { msg ->
            if (!msg.isNullOrEmpty()) Toast.makeText(requireContext(), msg, Toast.LENGTH_SHORT).show()
        }
        viewModel.error.observe(viewLifecycleOwner) { err ->
            if (!err.isNullOrEmpty()) Toast.makeText(requireContext(), err, Toast.LENGTH_LONG).show()
        }
        viewModel.accountDeleted.observe(viewLifecycleOwner) { deleted ->
            if (deleted == true) performLogout()
        }
        viewModel.currentMonthlyBudget.observe(viewLifecycleOwner) { budget ->
            val formatter = NumberFormat.getNumberInstance(Locale.US)
            binding.tvCurrentMonthlyBudget.text = "₱${formatter.format(budget.toInt())}"
        }
        viewModel.currentRiskTolerance.observe(viewLifecycleOwner) { risk ->
            binding.tvCurrentRiskTolerance.text = when (risk) {
                "strict"   -> getString(R.string.risk_strict)
                "flexible" -> getString(R.string.risk_flexible)
                else       -> getString(R.string.risk_balanced)
            }
            val isBalanced = risk == "balanced"
            val v = if (isBalanced) View.VISIBLE else View.GONE
            binding.layoutBalancedHardLimit.visibility  = v
            binding.dividerBalancedHardLimit.visibility = v
        }
        viewModel.backupSuccess.observe(viewLifecycleOwner) { timestamp ->
            binding.tvLastBackup.text = getString(R.string.settings_last_backup, timestamp)
            Toast.makeText(requireContext(), getString(R.string.backup_completed), Toast.LENGTH_SHORT).show()
        }
        viewModel.restoreSuccess.observe(viewLifecycleOwner) { success ->
            if (success == true)
                Toast.makeText(requireContext(), getString(R.string.restore_completed), Toast.LENGTH_SHORT).show()
        }
        viewModel.isBackupLoading.observe(viewLifecycleOwner) { loading ->
            binding.layoutDataBackup.isEnabled = !loading
        }
        viewModel.appLockEnabled.observe(viewLifecycleOwner) { enabled ->
            if (enabled == true) {
                isSettingLockProgrammatically = true
                binding.switchAppLock.isChecked = true
                isSettingLockProgrammatically = false
                Toast.makeText(requireContext(), getString(R.string.app_lock_enabled_msg), Toast.LENGTH_SHORT).show()
            }
        }
        viewModel.appLockDisabled.observe(viewLifecycleOwner) { disabled ->
            if (disabled == true) {
                isSettingLockProgrammatically = true
                binding.switchAppLock.isChecked = false
                isSettingLockProgrammatically = false
                Toast.makeText(requireContext(), getString(R.string.app_lock_disabled_msg), Toast.LENGTH_SHORT).show()
            }
        }
        viewModel.appLockError.observe(viewLifecycleOwner) { err ->
            if (!err.isNullOrEmpty()) {
                isSettingLockProgrammatically = true
                binding.switchAppLock.isChecked = getPrefs().getBoolean("app_lock_enabled", false)
                isSettingLockProgrammatically = false
                Toast.makeText(requireContext(), err, Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun setupClickListeners() {
        // Budget
        binding.layoutEditMonthlyBudget.setOnClickListener { showEditBudgetDialog() }
        binding.layoutMonthlyBudget.setOnClickListener     { showEditAlertLimitDialog() }
        binding.layoutBudgetCategories.setOnClickListener {
            findNavController().navigate(R.id.action_settings_to_budgetCategories)
        }
        binding.layoutBudgetPeriod.setOnClickListener  { showBudgetPeriodDialog() }
        binding.layoutRiskTolerance.setOnClickListener { showRiskToleranceDialog() }
        binding.layoutBalancedHardLimit.setOnClickListener { showBalancedHardLimitDialog() }

        // ── Notification + analytics switches → save locally AND push to API ──
        binding.switchBudgetAlerts.setOnCheckedChangeListener { _, checked ->
            savePreference("budget_alerts", checked)
            syncNotificationSettings()
        }
        binding.switchDailyReminders.setOnCheckedChangeListener { _, checked ->
            savePreference("daily_reminders", checked)
            syncNotificationSettings()
        }
        binding.switchPushNotifications.setOnCheckedChangeListener { _, checked ->
            savePreference("push_notifications", checked)
            syncNotificationSettings()
        }
        // FIX: share_analytics now calls API — web admin will respect this preference
        binding.switchShareAnalytics.setOnCheckedChangeListener { _, checked ->
            savePreference("share_analytics", checked)
            syncNotificationSettings()
        }

        // App Lock
        binding.switchAppLock.setOnCheckedChangeListener { _, isChecked ->
            if (isSettingLockProgrammatically) return@setOnCheckedChangeListener
            if (isChecked) {
                isSettingLockProgrammatically = true
                binding.switchAppLock.isChecked = false
                isSettingLockProgrammatically = false
                showSetPinDialog()
            } else {
                showDisableAppLockDialog()
            }
        }

        // Security
        binding.layoutChangePassword.setOnClickListener { showChangePasswordDialog() }

        // Data
        binding.layoutDataBackup.setOnClickListener    { showBackupDialog() }
        binding.layoutDeleteAccount.setOnClickListener { showDeleteAccountDialog() }

        // Support
        binding.layoutHelp.setOnClickListener     { showHelpDialog() }
        binding.layoutFeedback.setOnClickListener { showFeedbackDialog() }
        binding.layoutAbout.setOnClickListener    { showAboutDialog() }

        // Logout
        binding.btnLogout.setOnClickListener { showLogoutDialog() }
    }

    /**
     * Pushes all 4 toggle states to the API in one call.
     * Called whenever any toggle changes so the server (and web admin) stays in sync.
     */
    private fun syncNotificationSettings() {
        val prefs  = getPrefs()
        val budget = prefs.getFloat("user_monthly_budget",
            prefs.getFloat("monthly_expenses", 10000f)).toDouble()
        val alertLimit = prefs.getFloat("budget_alert_limit", (budget * 0.8).toFloat()).toDouble()
        // Convert peso alert limit → percentage (0-100) to fit numeric(5,2) column
        val thresholdPct = if (budget > 0) (alertLimit / budget * 100).coerceIn(0.0, 100.0) else 80.0
        notificationViewModel.updateSettings(
            budgetAlerts      = prefs.getBoolean("budget_alerts",      true),
            threshold         = thresholdPct,
            dailyReminders    = prefs.getBoolean("daily_reminders",    false),
            reminderTime      = prefs.getString("daily_reminder_time", "09:00:00") ?: "09:00:00",
            pushNotifications = prefs.getBoolean("push_notifications", true),
            shareAnalytics    = prefs.getBoolean("share_analytics",    true)
        )
    }

    private fun savePreference(key: String, value: Boolean) {
        getPrefs().edit { putBoolean(key, value) }
    }

    // ── Edit Monthly Budget ───────────────────────────────────────────────────

    private fun showEditBudgetDialog() {
        val dialogView = layoutInflater.inflate(R.layout.dialog_edit_budget, null)
        val dialog = AlertDialog.Builder(requireContext(), R.style.CustomDialogTheme)
            .setView(dialogView).create()
        dialog.window?.setBackgroundDrawableResource(android.R.color.transparent)

        val tilBudget = dialogView.findViewById<TextInputLayout>(R.id.tilBudget)
        val etBudget  = dialogView.findViewById<TextInputEditText>(R.id.etBudget)
        val btnCancel = dialogView.findViewById<MaterialButton>(R.id.btnCancel)
        val btnSave   = dialogView.findViewById<MaterialButton>(R.id.btnSave)

        etBudget.setText(getPrefs().getFloat("user_monthly_budget",
            getPrefs().getFloat("monthly_expenses", 10000f)).toInt().toString())

        btnCancel.setOnClickListener { dialog.dismiss() }
        btnSave.setOnClickListener {
            val newBudget = etBudget.text.toString().toDoubleOrNull()
            if (newBudget == null || newBudget <= 0) {
                tilBudget.error = getString(R.string.error_invalid_amount); return@setOnClickListener
            }
            tilBudget.error = null
            updateBudget(newBudget)
            dialog.dismiss()
        }
        dialog.show()
    }

    private fun updateBudget(newBudget: Double) {
        val userId = getUserId()
        if (userId.isEmpty()) {
            Toast.makeText(requireContext(), getString(R.string.error_user_not_found), Toast.LENGTH_SHORT).show()
            return
        }
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val response = ApiClient.authApi.updateBudget(
                    getToken(), userId, UpdateBudgetRequest(monthlyExpenses = newBudget)
                )
                withContext(Dispatchers.Main) {
                    if (response.isSuccessful && response.body()?.success == true) {
                        getPrefs().edit {
                            putFloat("user_monthly_budget", newBudget.toFloat())
                            putFloat("monthly_expenses",    newBudget.toFloat())
                            putFloat("monthly_income",      newBudget.toFloat())
                        }
                        binding.tvCurrentMonthlyBudget.text =
                            "₱${NumberFormat.getNumberInstance(Locale.US).format(newBudget.toInt())}"
                        viewModel.fetchCurrentBudget()
                        Toast.makeText(requireContext(), getString(R.string.budget_updated), Toast.LENGTH_SHORT).show()
                    } else {
                        Toast.makeText(requireContext(), getString(R.string.error_update_budget), Toast.LENGTH_SHORT).show()
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    Toast.makeText(requireContext(), getString(R.string.error_generic, e.message), Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    // ── Edit Budget Alert Limit ───────────────────────────────────────────────

    private fun showEditAlertLimitDialog() {
        val dialogView = layoutInflater.inflate(R.layout.dialog_edit_budget, null)
        val dialog = AlertDialog.Builder(requireContext(), R.style.CustomDialogTheme)
            .setView(dialogView).create()
        dialog.window?.setBackgroundDrawableResource(android.R.color.transparent)

        val tilBudget = dialogView.findViewById<TextInputLayout>(R.id.tilBudget)
        val etBudget  = dialogView.findViewById<TextInputEditText>(R.id.etBudget)
        val btnCancel = dialogView.findViewById<MaterialButton>(R.id.btnCancel)
        val btnSave   = dialogView.findViewById<MaterialButton>(R.id.btnSave)

        tilBudget.hint = "Warning threshold amount"
        val currentLimit = getPrefs().getFloat("budget_alert_limit",
            getPrefs().getFloat("monthly_expenses", 10000f))
        etBudget.setText(currentLimit.toInt().toString())

        btnCancel.setOnClickListener { dialog.dismiss() }
        btnSave.setOnClickListener {
            val limit = etBudget.text.toString().toDoubleOrNull()
            if (limit == null || limit <= 0) {
                tilBudget.error = getString(R.string.error_invalid_amount); return@setOnClickListener
            }
            tilBudget.error = null
            getPrefs().edit { putFloat("budget_alert_limit", limit.toFloat()) }
            binding.tvCurrentBudget.text =
                "Alert at ₱${NumberFormat.getNumberInstance(Locale.US).format(limit.toInt())}"
            Toast.makeText(requireContext(), "Spending warning threshold updated!", Toast.LENGTH_SHORT).show()
            dialog.dismiss()
        }
        dialog.show()
    }

    // ── Budget Period ─────────────────────────────────────────────────────────

    private fun showBudgetPeriodDialog() {
        val dialogView = layoutInflater.inflate(R.layout.dialog_budget_period, null)
        val dialog = AlertDialog.Builder(requireContext(), R.style.CustomDialogTheme)
            .setView(dialogView).create()
        dialog.window?.setBackgroundDrawableResource(android.R.color.transparent)

        val rgBudgetPeriod = dialogView.findViewById<android.widget.RadioGroup>(R.id.rgBudgetPeriod)
        val rbDaily        = dialogView.findViewById<com.google.android.material.radiobutton.MaterialRadioButton>(R.id.rbDaily)
        val rbWeekly       = dialogView.findViewById<com.google.android.material.radiobutton.MaterialRadioButton>(R.id.rbWeekly)
        val rbBiMonthly    = dialogView.findViewById<com.google.android.material.radiobutton.MaterialRadioButton>(R.id.rbBiMonthly)
        val rbMonthly      = dialogView.findViewById<com.google.android.material.radiobutton.MaterialRadioButton>(R.id.rbMonthly)
        val btnCancel      = dialogView.findViewById<MaterialButton>(R.id.btnCancel)
        val btnSave        = dialogView.findViewById<MaterialButton>(R.id.btnSave)

        when (getPrefs().getString("budget_period", "Monthly")) {
            "Daily"      -> rbDaily.isChecked     = true
            "Weekly"     -> rbWeekly.isChecked    = true
            "Bi-monthly" -> rbBiMonthly.isChecked = true
            else         -> rbMonthly.isChecked   = true
        }

        btnCancel.setOnClickListener { dialog.dismiss() }
        btnSave.setOnClickListener {
            val selected = when (rgBudgetPeriod.checkedRadioButtonId) {
                R.id.rbDaily     -> "Daily"
                R.id.rbWeekly    -> "Weekly"
                R.id.rbBiMonthly -> "Bi-monthly"
                else             -> "Monthly"
            }
            updateBudgetPeriod(selected)
            dialog.dismiss()
        }
        dialog.show()
    }

    private fun updateBudgetPeriod(period: String) {
        val userId = getUserId()
        if (userId.isEmpty()) {
            Toast.makeText(requireContext(), getString(R.string.error_user_not_found), Toast.LENGTH_SHORT).show()
            return
        }
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val response = ApiClient.authApi.updateBudgetPeriod(
                    getToken(), userId, UpdateBudgetPeriodRequest(budgetPeriod = period)
                )
                withContext(Dispatchers.Main) {
                    if (response.isSuccessful && response.body()?.success == true) {
                        getPrefs().edit { putString("budget_period", period) }
                        binding.tvCurrentPeriod.text = period
                        Toast.makeText(requireContext(), getString(R.string.period_updated, period), Toast.LENGTH_SHORT).show()
                    } else {
                        Toast.makeText(requireContext(), getString(R.string.error_update_period), Toast.LENGTH_SHORT).show()
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    Toast.makeText(requireContext(), getString(R.string.error_generic, e.message), Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    // ── Change Password ───────────────────────────────────────────────────────

    private fun showChangePasswordDialog() {
        val dialogView = layoutInflater.inflate(R.layout.dialog_change_password, null)
        val dialog = AlertDialog.Builder(requireContext(), R.style.CustomDialogTheme)
            .setView(dialogView).create()
        dialog.window?.setBackgroundDrawableResource(android.R.color.transparent)

        val tilOldPassword     = dialogView.findViewById<TextInputLayout>(R.id.tilOldPassword)
        val etOldPassword      = dialogView.findViewById<TextInputEditText>(R.id.etOldPassword)
        val tilNewPassword     = dialogView.findViewById<TextInputLayout>(R.id.tilNewPassword)
        val etNewPassword      = dialogView.findViewById<TextInputEditText>(R.id.etNewPassword)
        val tilConfirmPassword = dialogView.findViewById<TextInputLayout>(R.id.tilConfirmPassword)
        val etConfirmPassword  = dialogView.findViewById<TextInputEditText>(R.id.etConfirmPassword)
        val btnCancel          = dialogView.findViewById<MaterialButton>(R.id.btnCancel)
        val btnChange          = dialogView.findViewById<MaterialButton>(R.id.btnChange)

        btnCancel.setOnClickListener { dialog.dismiss() }
        btnChange.setOnClickListener {
            val old     = etOldPassword.text.toString()
            val new     = etNewPassword.text.toString()
            val confirm = etConfirmPassword.text.toString()
            var hasError = false
            if (old.isEmpty())  { tilOldPassword.error     = getString(R.string.error_old_password_required); hasError = true } else tilOldPassword.error     = null
            if (new.length < 6) { tilNewPassword.error     = getString(R.string.error_password_min_length);   hasError = true } else tilNewPassword.error     = null
            if (new != confirm) { tilConfirmPassword.error = getString(R.string.error_passwords_no_match);    hasError = true } else tilConfirmPassword.error = null
            if (!hasError) { changePassword(old, new); dialog.dismiss() }
        }
        dialog.show()
    }

    private fun changePassword(oldPassword: String, newPassword: String) {
        val userId = getUserId()
        if (userId.isEmpty()) {
            Toast.makeText(requireContext(), getString(R.string.error_user_not_found), Toast.LENGTH_SHORT).show()
            return
        }
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val response = ApiClient.authApi.changePassword(
                    getToken(), userId,
                    ChangePasswordRequest(oldPassword = oldPassword, newPassword = newPassword)
                )
                withContext(Dispatchers.Main) {
                    if (response.isSuccessful && response.body()?.success == true) {
                        Toast.makeText(requireContext(), getString(R.string.password_changed), Toast.LENGTH_SHORT).show()
                    } else {
                        Toast.makeText(requireContext(),
                            response.body()?.message ?: getString(R.string.error_change_password),
                            Toast.LENGTH_SHORT).show()
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    Toast.makeText(requireContext(), getString(R.string.error_generic, e.message), Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    // ── App Lock ──────────────────────────────────────────────────────────────

    private fun showSetPinDialog() {
        val dialogView = layoutInflater.inflate(R.layout.dialog_set_pin, null)
        val dialog = AlertDialog.Builder(requireContext(), R.style.CustomDialogTheme)
            .setView(dialogView).create()
        dialog.window?.setBackgroundDrawableResource(android.R.color.transparent)

        val tilPin        = dialogView.findViewById<TextInputLayout>(R.id.tilPin)
        val etPin         = dialogView.findViewById<TextInputEditText>(R.id.etPin)
        val tilConfirmPin = dialogView.findViewById<TextInputLayout>(R.id.tilConfirmPin)
        val etConfirmPin  = dialogView.findViewById<TextInputEditText>(R.id.etConfirmPin)
        val cbBiometric   = dialogView.findViewById<MaterialCheckBox>(R.id.cbBiometric)
        val btnCancel     = dialogView.findViewById<MaterialButton>(R.id.btnCancel)
        val btnSetPin     = dialogView.findViewById<MaterialButton>(R.id.btnSetPin)

        cbBiometric.visibility = if (isBiometricAvailable()) View.VISIBLE else View.GONE

        btnCancel.setOnClickListener { dialog.dismiss() }
        btnSetPin.setOnClickListener {
            val pin     = etPin.text.toString().trim()
            val confirm = etConfirmPin.text.toString().trim()
            var hasError = false
            if (pin.length < 4) { tilPin.error = getString(R.string.error_pin_too_short); hasError = true } else tilPin.error = null
            if (pin != confirm) { tilConfirmPin.error = getString(R.string.error_pin_mismatch); hasError = true } else tilConfirmPin.error = null
            if (!hasError) {
                dialog.dismiss()
                viewModel.enableAppLock(pin, cbBiometric.isChecked && isBiometricAvailable())
            }
        }
        dialog.show()
    }

    private fun showDisableAppLockDialog() {
        AlertDialog.Builder(requireContext())
            .setTitle(getString(R.string.dialog_title_disable_lock))
            .setMessage(getString(R.string.dialog_msg_disable_lock))
            .setPositiveButton(getString(R.string.btn_disable)) { _, _ -> viewModel.disableAppLock() }
            .setNegativeButton(getString(R.string.btn_cancel)) { _, _ ->
                isSettingLockProgrammatically = true
                binding.switchAppLock.isChecked = true
                isSettingLockProgrammatically = false
            }
            .setOnCancelListener {
                isSettingLockProgrammatically = true
                binding.switchAppLock.isChecked = true
                isSettingLockProgrammatically = false
            }
            .show()
    }

    private fun isBiometricAvailable(): Boolean {
        return try {
            val bm = androidx.biometric.BiometricManager.from(requireContext())
            bm.canAuthenticate(androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_WEAK) ==
                    androidx.biometric.BiometricManager.BIOMETRIC_SUCCESS
        } catch (e: Exception) { false }
    }

    // ── Backup + Restore ──────────────────────────────────────────────────────

    private fun showBackupDialog() {
        val dialogView = layoutInflater.inflate(R.layout.dialog_backup, null)
        val dialog = AlertDialog.Builder(requireContext(), R.style.CustomDialogTheme)
            .setView(dialogView).create()
        dialog.window?.setBackgroundDrawableResource(android.R.color.transparent)

        val tvLastBackupTime = dialogView.findViewById<android.widget.TextView>(R.id.tvLastBackupTime)
        val btnBackup        = dialogView.findViewById<MaterialButton>(R.id.btnBackup)
        val btnRestore       = dialogView.findViewById<MaterialButton>(R.id.btnRestore)
        val btnCancel        = dialogView.findViewById<MaterialButton>(R.id.btnCancel)

        val lastBackup = getPrefs().getLong("last_backup", 0)
        tvLastBackupTime.text = if (lastBackup > 0)
            SimpleDateFormat("MMM dd, yyyy 'at' h:mm a", Locale.getDefault()).format(Date(lastBackup))
        else getString(R.string.settings_never_backed_up)

        btnRestore.isEnabled = viewModel.hasBackup()
        btnBackup.setOnClickListener  { dialog.dismiss(); viewModel.performBackup() }
        btnRestore.setOnClickListener { dialog.dismiss(); showRestoreConfirmDialog() }
        btnCancel.setOnClickListener  { dialog.dismiss() }
        dialog.show()
    }

    private fun showRestoreConfirmDialog() {
        AlertDialog.Builder(requireContext())
            .setTitle(getString(R.string.dialog_title_restore))
            .setMessage(getString(R.string.dialog_msg_restore))
            .setPositiveButton(getString(R.string.btn_restore)) { _, _ -> viewModel.performRestore() }
            .setNegativeButton(getString(R.string.btn_cancel), null)
            .show()
    }

    // ── Delete Account ────────────────────────────────────────────────────────

    private fun showDeleteAccountDialog() {
        val dialogView = layoutInflater.inflate(R.layout.dialog_delete_account, null)
        val dialog = AlertDialog.Builder(requireContext(), R.style.CustomDialogTheme)
            .setView(dialogView).create()
        dialog.window?.setBackgroundDrawableResource(android.R.color.transparent)

        val tilPassword = dialogView.findViewById<TextInputLayout>(R.id.tilPassword)
        val etPassword  = dialogView.findViewById<TextInputEditText>(R.id.etPassword)
        val btnCancel   = dialogView.findViewById<MaterialButton>(R.id.btnCancel)
        val btnDelete   = dialogView.findViewById<MaterialButton>(R.id.btnDelete)

        btnCancel.setOnClickListener { dialog.dismiss() }
        btnDelete.setOnClickListener {
            val password = etPassword.text.toString()
            if (password.isEmpty()) {
                tilPassword.error = getString(R.string.error_password_required_confirm)
                return@setOnClickListener
            }
            tilPassword.error = null
            viewModel.deleteAccount(password)
            dialog.dismiss()
        }
        dialog.show()
    }

    // ── Support dialogs ───────────────────────────────────────────────────────

    private fun showHelpDialog() {
        val dialogView = layoutInflater.inflate(R.layout.dialog_help, null)
        val dialog = AlertDialog.Builder(requireContext(), R.style.CustomDialogTheme)
            .setView(dialogView).create()
        dialog.window?.setBackgroundDrawableResource(android.R.color.transparent)
        dialogView.findViewById<MaterialButton>(R.id.btnOk).setOnClickListener { dialog.dismiss() }
        dialog.show()
    }

    private fun showFeedbackDialog() {
        val dialogView = layoutInflater.inflate(R.layout.dialog_feedback, null)
        val dialog = AlertDialog.Builder(requireContext(), R.style.CustomDialogTheme)
            .setView(dialogView).create()
        dialog.window?.setBackgroundDrawableResource(android.R.color.transparent)

        val tilFeedback = dialogView.findViewById<TextInputLayout>(R.id.tilFeedback)
        val etFeedback  = dialogView.findViewById<TextInputEditText>(R.id.etFeedback)
        val btnCancel   = dialogView.findViewById<MaterialButton>(R.id.btnCancel)
        val btnSend     = dialogView.findViewById<MaterialButton>(R.id.btnSend)

        btnCancel.setOnClickListener { dialog.dismiss() }
        btnSend.setOnClickListener {
            val feedback = etFeedback.text.toString().trim()
            if (feedback.isEmpty()) { tilFeedback.error = getString(R.string.error_feedback_required); return@setOnClickListener }
            tilFeedback.error = null
            viewModel.sendFeedback(feedback)
            dialog.dismiss()
        }
        dialog.show()
    }

    private fun showAboutDialog() {
        val dialogView = layoutInflater.inflate(R.layout.dialog_about, null)
        val dialog = AlertDialog.Builder(requireContext(), R.style.CustomDialogTheme)
            .setView(dialogView).create()
        dialog.window?.setBackgroundDrawableResource(android.R.color.transparent)
        dialogView.findViewById<MaterialButton>(R.id.btnOk).setOnClickListener { dialog.dismiss() }
        dialog.show()
    }

    // ── Logout ────────────────────────────────────────────────────────────────

    private fun showLogoutDialog() {
        AlertDialog.Builder(requireContext())
            .setTitle(getString(R.string.dialog_title_logout))
            .setMessage(getString(R.string.dialog_msg_logout))
            .setPositiveButton(getString(R.string.btn_logout)) { _, _ -> performLogout() }
            .setNegativeButton(getString(R.string.btn_cancel), null)
            .show()
    }

    private fun performLogout() {
        SocketManager.disconnect()
        getPrefs().edit().clear().apply()
        val intent = Intent(requireContext(), AuthActivity::class.java)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
        startActivity(intent)
        requireActivity().finish()
    }

    // ── Spending Mode dialog ──────────────────────────────────────────────────

    private fun showRiskToleranceDialog() {
        val dialogView = layoutInflater.inflate(R.layout.dialog_risk_tolerance, null)
        val dialog = AlertDialog.Builder(requireContext(), R.style.CustomDialogTheme)
            .setView(dialogView).create()
        dialog.window?.setBackgroundDrawableResource(android.R.color.transparent)

        val rg             = dialogView.findViewById<RadioGroup>(R.id.rgRiskTolerance)
        val rbConservative = dialogView.findViewById<RadioButton>(R.id.rbConservative)
        val rbModerate     = dialogView.findViewById<RadioButton>(R.id.rbModerate)
        val rbAggressive   = dialogView.findViewById<RadioButton>(R.id.rbAggressive)
        val btnCancel      = dialogView.findViewById<MaterialButton>(R.id.btnRiskCancel)
        val btnSave        = dialogView.findViewById<MaterialButton>(R.id.btnRiskSave)

        when (getPrefs().getString("risk_tolerance", "balanced")) {
            "strict"   -> rbConservative.isChecked = true
            "flexible" -> rbAggressive.isChecked   = true
            else       -> rbModerate.isChecked     = true
        }

        btnCancel.setOnClickListener { dialog.dismiss() }
        btnSave.setOnClickListener {
            val selected = when (rg.checkedRadioButtonId) {
                R.id.rbConservative -> "strict"
                R.id.rbAggressive   -> "flexible"
                else                -> "balanced"
            }
            viewModel.updateRiskTolerance(selected)
            binding.tvCurrentRiskTolerance.text = when (selected) {
                "strict"   -> getString(R.string.risk_strict)
                "flexible" -> getString(R.string.risk_flexible)
                else       -> getString(R.string.risk_balanced)
            }
            val isBalanced = selected == "balanced"
            val v = if (isBalanced) View.VISIBLE else View.GONE
            binding.layoutBalancedHardLimit.visibility  = v
            binding.dividerBalancedHardLimit.visibility = v
            dialog.dismiss()
        }
        dialog.show()
        dialog.window?.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
    }

    // ── Balanced Hard Limit dialog ────────────────────────────────────────────

    private fun showBalancedHardLimitDialog() {
        val dialogView = layoutInflater.inflate(R.layout.dialog_edit_budget, null)
        val dialog = AlertDialog.Builder(requireContext(), R.style.CustomDialogTheme)
            .setView(dialogView).create()
        dialog.window?.setBackgroundDrawableResource(android.R.color.transparent)

        val tilBudget = dialogView.findViewById<TextInputLayout>(R.id.tilBudget)
        val etBudget  = dialogView.findViewById<TextInputEditText>(R.id.etBudget)
        val btnCancel = dialogView.findViewById<MaterialButton>(R.id.btnCancel)
        val btnSave   = dialogView.findViewById<MaterialButton>(R.id.btnSave)

        tilBudget.hint = getString(R.string.settings_balanced_hard_limit_hint)
        val budget  = getPrefs().getFloat("user_monthly_budget", 0f).toDouble()
        val current = getPrefs().getFloat("balanced_hard_limit", (budget * 1.5).toFloat()).toDouble()
        etBudget.setText(current.toInt().toString())

        btnCancel.setOnClickListener { dialog.dismiss() }
        btnSave.setOnClickListener {
            val limit = etBudget.text.toString().toDoubleOrNull()
            if (limit == null || limit <= 0) { tilBudget.error = getString(R.string.error_invalid_amount); return@setOnClickListener }
            tilBudget.error = null
            getPrefs().edit().putFloat("balanced_hard_limit", limit.toFloat()).apply()
            binding.tvCurrentBalancedHardLimit.text =
                "Block at ₱${NumberFormat.getNumberInstance(Locale.US).format(limit.toInt())}"
            Toast.makeText(requireContext(), "Hard limit updated", Toast.LENGTH_SHORT).show()
            dialog.dismiss()
        }
        dialog.show()
        dialog.window?.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}