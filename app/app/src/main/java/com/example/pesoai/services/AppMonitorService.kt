package com.example.pesoai.services

import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.IBinder

/**
 * Minimal service whose only job is to intercept onTaskRemoved().
 *
 * Android calls onTaskRemoved() on any running Service when the user swipes
 * the app away from the Recents screen. We use this to zero out
 * last_unlock_time so the next cold launch forces the user through App Lock.
 *
 * The service is START_STICKY so it survives low-memory kills and is
 * automatically restarted if the OS kills it.
 *
 * Register in AndroidManifest.xml inside <application>:
 *   <service
 *       android:name=".services.AppMonitorService"
 *       android:stopWithTask="false" />   ← false = service stays alive when task is removed
 */
class AppMonitorService : Service() {

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int =
        START_STICKY   // survive low-memory kills; OS will restart the service

    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        // App was swiped from Recents — force App Lock on next launch
        val prefs = getSharedPreferences("PesoAI_Prefs", Context.MODE_PRIVATE)
        if (prefs.getBoolean("app_lock_enabled", false)) {
            prefs.edit().putLong("last_unlock_time", 0L).apply()
        }
        stopSelf()
    }
}