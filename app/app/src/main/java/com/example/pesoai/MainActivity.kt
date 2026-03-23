package com.example.pesoai

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.MotionEvent
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.navigation.NavController
import androidx.navigation.NavOptions
import androidx.navigation.fragment.NavHostFragment
import androidx.activity.viewModels
import com.example.pesoai.utils.AppLockManager
import com.example.pesoai.ui.notifications.NotificationsBottomSheet
import com.example.pesoai.ui.notifications.NotificationViewModel
import com.example.pesoai.services.AppMonitorService
import com.example.pesoai.databinding.ActivityMainBinding
import com.example.pesoai.ui.security.AppLockActivity

class MainActivity : AppCompatActivity() {

    private lateinit var binding:       ActivityMainBinding
    private lateinit var navController: NavController

    // GROUP K: Initialized here so SocketManager connects at app start,
    // not lazily when BottomSheet/Fragment first opens.
    private val notificationViewModel: NotificationViewModel by viewModels()

    // ── Inactivity timer ──────────────────────────────────────────────────────

    private val inactivityHandler = Handler(Looper.getMainLooper())
    private val inactivityRunnable = Runnable {
        val prefs = getSharedPreferences("PesoAI_Prefs", Context.MODE_PRIVATE)
        if (prefs.getBoolean("app_lock_enabled", false)) {
            // Zero out unlock time so onResume forces lock if user returns without AppLock
            prefs.edit().putLong("last_unlock_time", 0L).apply()
            startActivity(Intent(this, AppLockActivity::class.java))
            // Do NOT finish() — keep MainActivity in back stack
        }
    }

    private fun resetInactivityTimer() {
        val prefs = getSharedPreferences("PesoAI_Prefs", Context.MODE_PRIVATE)
        if (!prefs.getBoolean("app_lock_enabled", false)) return
        inactivityHandler.removeCallbacks(inactivityRunnable)
        inactivityHandler.postDelayed(inactivityRunnable, INACTIVITY_TIMEOUT_MS)
    }

    private fun cancelInactivityTimer() {
        inactivityHandler.removeCallbacks(inactivityRunnable)
    }

    /** Any touch resets the 5-minute countdown. */
    override fun dispatchTouchEvent(ev: MotionEvent): Boolean {
        resetInactivityTimer()
        return super.dispatchTouchEvent(ev)
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        setupNavigation()
        setupTopBar()
        initNotifications()
        startService(Intent(this, AppMonitorService::class.java))
    }

    // ── Notifications ─────────────────────────────────────────────────────────

    private fun initNotifications() {
        // Accessing the VM here triggers its init block:
        //   → SocketManager.connect() → socket joins user room
        //   → setNotificationListener registered
        // Badge updates whenever unreadCount changes — even when no
        // notification fragment is visible.
        notificationViewModel.unreadCount.observe(this) { count ->
            updateNotificationBadge(count)
        }
        // Load initial unread count so badge is correct on app start
        notificationViewModel.loadNotifications()
    }

    override fun onResume() {
        super.onResume()
        if (AppLockManager.shouldBypass(this)) return
        val prefs       = getSharedPreferences("PesoAI_Prefs", Context.MODE_PRIVATE)
        val lockEnabled = prefs.getBoolean("app_lock_enabled", false)
        if (lockEnabled) {
            val lastUnlock  = prefs.getLong("last_unlock_time", 0L)
            val elapsedMins = (System.currentTimeMillis() - lastUnlock) / 60_000L
            if (elapsedMins >= INACTIVITY_TIMEOUT_MINS) {
                startActivity(Intent(this, AppLockActivity::class.java))
            } else {
                resetInactivityTimer()
            }
        }
    }

    override fun onPause() {
        super.onPause()
        // Stop timer when app is backgrounded — onResume handles re-check
        cancelInactivityTimer()
    }

    override fun onDestroy() {
        super.onDestroy()
        cancelInactivityTimer()
    }

    // ── Navigation ────────────────────────────────────────────────────────────

    private fun setupNavigation() {
        val navHostFragment = supportFragmentManager
            .findFragmentById(R.id.nav_host_fragment) as NavHostFragment
        navController = navHostFragment.navController

        binding.bottomNavigation.setOnItemSelectedListener { item ->
            if (navController.currentDestination?.id != item.itemId) {
                navController.navigate(
                    item.itemId,
                    null,
                    NavOptions.Builder()
                        .setLaunchSingleTop(true)
                        .setRestoreState(true)
                        .setPopUpTo(R.id.DashboardFragment, false)
                        .build()
                )
            }
            true
        }

        navController.addOnDestinationChangedListener { _, destination, _ ->
            when (destination.id) {
                R.id.DashboardFragment    ->
                    binding.bottomNavigation.selectedItemId = R.id.DashboardFragment
                R.id.AnalyticsFragment    ->
                    binding.bottomNavigation.selectedItemId = R.id.AnalyticsFragment
                R.id.TransactionsFragment ->
                    binding.bottomNavigation.selectedItemId = R.id.TransactionsFragment
                R.id.AdvisorFragment      ->
                    binding.bottomNavigation.selectedItemId = R.id.AdvisorFragment
                R.id.SettingsFragment     ->
                    binding.bottomNavigation.selectedItemId = R.id.SettingsFragment
                R.id.ProfileFragment, R.id.GoalsFragment -> { /* keep existing selection */ }
            }
        }
    }

    // ── Top bar ───────────────────────────────────────────────────────────────

    private fun setupTopBar() {
        binding.btnNotifications.setOnClickListener { showNotifications() }
        binding.btnProfile.setOnClickListener {
            navController.navigate(R.id.ProfileFragment)
        }
        hideNotificationBadge()
    }

    private fun showNotifications() {
        if (supportFragmentManager.findFragmentByTag(NotificationsBottomSheet.TAG) == null) {
            NotificationsBottomSheet()
                .show(supportFragmentManager, NotificationsBottomSheet.TAG)
        }
    }

    // ── Public helpers for fragments ──────────────────────────────────────────

    fun updateNotificationBadge(count: Int) {
        if (count > 0) {
            binding.tvNotificationBadge.text       = if (count > 9) "9+" else count.toString()
            binding.tvNotificationBadge.visibility = View.VISIBLE
        } else {
            binding.tvNotificationBadge.visibility = View.GONE
        }
    }

    fun showNotificationBadge() {
        binding.tvNotificationBadge.visibility = View.VISIBLE
        if (binding.tvNotificationBadge.text.isNullOrEmpty())
            binding.tvNotificationBadge.text = ""
    }

    fun hideNotificationBadge() {
        binding.tvNotificationBadge.visibility = View.GONE
    }

    fun setTopBarVisible(visible: Boolean) {
        binding.topBar.visibility = if (visible) View.VISIBLE else View.GONE
    }

    fun getNotificationCount(): Int {
        if (binding.tvNotificationBadge.visibility != View.VISIBLE) return 0
        return try {
            val text = binding.tvNotificationBadge.text.toString()
            if (text == "9+") 10 else text.toIntOrNull() ?: 0
        } catch (e: Exception) { 0 }
    }

    fun selectBottomNavItem(itemId: Int) {
        binding.bottomNavigation.selectedItemId = itemId
    }

    override fun onSupportNavigateUp(): Boolean {
        return navController.navigateUp() || super.onSupportNavigateUp()
    }

    companion object {
        private const val INACTIVITY_TIMEOUT_MINS = 5L
        private const val INACTIVITY_TIMEOUT_MS   = INACTIVITY_TIMEOUT_MINS * 60 * 1000L
    }
}