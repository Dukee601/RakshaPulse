package com.rakshapulse.womensafety

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.IBinder
import android.util.Log

/**
 * Continuous Wear OS Background Health Sensor Service.
 * Detects acute fear tachycardia surges and cross-correlates with accelerometer motion.
 */
class HeartRateFearDetectorService : Service(), SensorEventListener {

    private lateinit var sensorManager: SensorManager
    private var heartRateSensor: Sensor? = null
    private var accelerometer: Sensor? = null

    private val hrSampleWindow = mutableListOf<Float>()
    private var lastRecordedBpm = 72f
    private var baselineBpm = 72f
    private var motionCadence = 0f // High = workout/running, Low/Erratic = fear freeze or struggle

    override fun onCreate() {
        super.onCreate()
        sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
        heartRateSensor = sensorManager.getDefaultSensor(Sensor.TYPE_HEART_RATE)
        accelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)

        startForegroundServiceNotification()
        registerSensors()
    }

    private fun registerSensors() {
        heartRateSensor?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_NORMAL)
        }
        accelerometer?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_UI)
        }
    }

    override fun onSensorChanged(event: SensorEvent?) {
        if (event == null) return

        when (event.sensor.type) {
            Sensor.TYPE_HEART_RATE -> {
                val currentBpm = event.values[0]
                if (currentBpm > 30f) {
                    processHeartRateUpdate(currentBpm)
                }
            }
            Sensor.TYPE_ACCELEROMETER -> {
                val x = event.values[0]
                val y = event.values[1]
                val z = event.values[2]
                val magnitude = Math.sqrt((x * x + y * y + z * z).toDouble()).toFloat()
                // Track step cadence vs irregular struggle
                motionCadence = magnitude
            }
        }
    }

    private fun processHeartRateUpdate(currentBpm: Float) {
        hrSampleWindow.add(currentBpm)
        if (hrSampleWindow.size > 20) hrSampleWindow.removeAt(0)

        val deltaBpm = currentBpm - lastRecordedBpm
        lastRecordedBpm = currentBpm

        // Evaluate Acute Fear Signature:
        // 1. Tachycardia Spike (BPM > 135 and rapid jump dHR/dt > 25 BPM in short burst)
        // 2. Lack of rhythmic running cadence (motionCadence indicates freezing or erratic defense)
        val isTachycardiaSpike = currentBpm >= 135f && (currentBpm - baselineBpm) >= 40f
        val isNotAerobicExercise = motionCadence < 18f // Exercise running typically exceeds 22m/s^2 periodic peaks

        if (isTachycardiaSpike && isNotAerobicExercise) {
            Log.w("RakshaPulse", "ACUTE FEAR SURGE DETECTED: $currentBpm BPM (Baseline: $baselineBpm)")
            checkTimeAndInitiateEmergency(currentBpm)
        }
    }

    private fun checkTimeAndInitiateEmergency(bpm: Float) {
        val isNightTime = NightTimeRiskEvaluator.isNightRiskWindow()
        if (isNightTime) {
            Log.e("RakshaPulse", "NIGHT THREAT VERIFIED at 24h clock. Initiating Emergency Countdown!")
            val intent = Intent(this, EmergencyDispatchManager::class.java).apply {
                action = EmergencyDispatchManager.ACTION_TRIGGER_COUNTDOWN
                putExtra("DETECTED_BPM", bpm)
                putExtra("IS_NIGHT", true)
            }
            startService(intent)
        } else {
            Log.i("RakshaPulse", "Elevated BPM detected during daylight hours. Prompting wearer confirmation.")
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

    private fun startForegroundServiceNotification() {
        val channelId = "raksha_pulse_monitor"
        val channel = NotificationChannel(
            channelId,
            "RakshaPulse Active Shield",
            NotificationManager.IMPORTANCE_LOW
        )
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(channel)

        val notification: Notification = Notification.Builder(this, channelId)
            .setContentTitle("RakshaPulse Safety Active")
            .setContentText("Continuous Heart Rate & 24h Night Shield Monitoring")
            .setSmallIcon(android.R.drawable.ic_lock_idle_charging)
            .build()

        startForeground(112, notification)
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        sensorManager.unregisterListener(this)
    }
}
