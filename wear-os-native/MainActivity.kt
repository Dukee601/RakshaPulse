package com.rakshapulse.womensafety

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

/**
 * Main Activity for Wear OS Standalone Watch Interface.
 * Displays real-time BPM, fear threat level, and emergency SOS controls.
 */
class MainActivity : ComponentActivity() {

    private lateinit var tvBpm: TextView
    private lateinit var tvStatus: TextView
    private lateinit var btnCancel: Button
    private lateinit var btnManualSos: Button

    private val REQUIRED_PERMISSIONS = arrayOf(
        Manifest.permission.BODY_SENSORS,
        Manifest.permission.ACCESS_FINE_LOCATION,
        Manifest.permission.SEND_SMS,
        Manifest.permission.CALL_PHONE
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        tvBpm = findViewById(R.id.tvBpm)
        tvStatus = findViewById(R.id.tvStatus)
        btnCancel = findViewById(R.id.btnCancel)
        btnManualSos = findViewById(R.id.btnManualSos)

        checkAndRequestPermissions()

        btnManualSos.setOnClickListener {
            val intent = Intent(this, EmergencyDispatchManager::class.java).apply {
                action = EmergencyDispatchManager.ACTION_TRIGGER_COUNTDOWN
                putExtra("DETECTED_BPM", 160f)
            }
            startService(intent)
        }

        btnCancel.setOnClickListener {
            val intent = Intent(this, EmergencyDispatchManager::class.java).apply {
                action = EmergencyDispatchManager.ACTION_CANCEL_COUNTDOWN
            }
            startService(intent)
        }

        // Start background continuous fear detection service
        val serviceIntent = Intent(this, HeartRateFearDetectorService::class.java)
        ContextCompat.startForegroundService(this, serviceIntent)
    }

    private fun checkAndRequestPermissions() {
        val missingPermissions = REQUIRED_PERMISSIONS.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missingPermissions.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, missingPermissions.toTypedArray(), 101)
        }
    }
}
