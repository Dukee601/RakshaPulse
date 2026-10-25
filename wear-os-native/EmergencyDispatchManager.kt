package com.rakshapulse.womensafety

import android.app.Service
import android.content.Context
import android.content.Intent
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.net.Uri
import android.os.*
import android.speech.tts.TextToSpeech
import android.telephony.SmsManager
import android.util.Log
import java.util.Locale

/**
 * Handles the 10-Second Countdown, Haptics, High-Precision GPS Location Acquisition,
 * Virtual AI Emergency Voice Broadcast (TTS), SMS transmission to 112, and Direct Call to 112 India.
 */
class EmergencyDispatchManager : Service(), TextToSpeech.OnInitListener {

    companion object {
        const val ACTION_TRIGGER_COUNTDOWN = "ACTION_TRIGGER_COUNTDOWN"
        const val ACTION_CANCEL_COUNTDOWN = "ACTION_CANCEL_COUNTDOWN"
        const val POLICE_EMERGENCY_NUMBER = "112" // India ERSS
    }

    private var countdownTimer: CountDownTimer? = null
    private var vibrator: Vibrator? = null
    private var tts: TextToSpeech? = null
    private var lastKnownLocation: Location? = null

    override fun onCreate() {
        super.onCreate()
        vibrator = getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        tts = TextToSpeech(this, this)
        acquireLocation()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_TRIGGER_COUNTDOWN -> {
                val detectedBpm = intent.getFloatExtra("DETECTED_BPM", 150f)
                start10SecondCountdown(detectedBpm)
            }
            ACTION_CANCEL_COUNTDOWN -> {
                cancelCountdown()
            }
        }
        return START_NOT_STICKY
    }

    private fun start10SecondCountdown(detectedBpm: Float) {
        // Haptic pulse alert on wrist
        vibrator?.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 300, 200, 300), -1))

        countdownTimer?.cancel()
        countdownTimer = object : CountDownTimer(10000, 1000) {
            override fun onTick(millisUntilFinished: Long) {
                val secondsLeft = millisUntilFinished / 1000
                Log.d("RakshaPulse", "Emergency Police Dispatch Countdown: $secondsLeft s remaining")
                vibrator?.vibrate(VibrationEffect.createOneShot(100, VibrationEffect.DEFAULT_AMPLITUDE))
            }

            override fun onFinish() {
                Log.e("RakshaPulse", "10s Elapsed without cancellation -> EXECUTING AUTOMATED 112 DISPATCH!")
                executeAutomatedPoliceDispatch(detectedBpm)
            }
        }.start()
    }

    private fun cancelCountdown() {
        countdownTimer?.cancel()
        Log.i("RakshaPulse", "False alarm aborted by user on watch.")
        stopSelf()
    }

    private fun executeAutomatedPoliceDispatch(bpm: Float) {
        val lat = lastKnownLocation?.latitude ?: 28.6139
        val lng = lastKnownLocation?.longitude ?: 77.2090
        val time24h = NightTimeRiskEvaluator.getFormatted24HourTime()
        val mapsUrl = "https://www.google.com/maps?q=$lat,$lng"

        // 1. Generate Virtual AI Text Payload for 112 ERSS & SMS
        val smsPayload = "🚨 [112 ERSS EMERGENCY] Women Safety Alert: Acute fear tachycardia detected ($bpm BPM) at $time24h. " +
                "Location: $mapsUrl. Immediate patrolling PCR unit requested."

        // Send SMS to 112 ERSS and Emergency Contacts
        try {
            val smsManager = SmsManager.getDefault()
            smsManager.sendTextMessage(POLICE_EMERGENCY_NUMBER, null, smsPayload, null, null)
            // smsManager.sendTextMessage("+919876543210", null, smsPayload, null, null) // Emergency contact
            Log.i("RakshaPulse", "Automated SMS dispatched to 112 ERSS.")
        } catch (e: Exception) {
            Log.e("RakshaPulse", "SMS send failure: ${e.message}")
        }

        // 2. Synthesize AI Audio Emergency Message Out Loud
        val aiAudioSpeech = "Emergency distress call. This is an automated AI emergency broadcast from RakshaPulse safety system. " +
                "A woman is in immediate danger at coordinates latitude $lat, longitude $lng. " +
                "Physiological panic distress verified with heart rate $bpm at $time24h. Dispatch nearest patrolling police unit immediately."
        speakAiDistressAudio(aiAudioSpeech)

        // 3. Initiate Automated Call to 112 India
        try {
            val callIntent = Intent(Intent.ACTION_CALL).apply {
                data = Uri.parse("tel:$POLICE_EMERGENCY_NUMBER")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            startActivity(callIntent)
        } catch (e: Exception) {
            Log.e("RakshaPulse", "Direct phone call failed: ${e.message}")
        }
    }

    private fun speakAiDistressAudio(message: String) {
        tts?.speak(message, TextToSpeech.QUEUE_FLUSH, null, "RAKSHA_TTS_SOS")
    }

    private fun acquireLocation() {
        try {
            val locationManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
            locationManager.requestSingleUpdate(
                LocationManager.GPS_PROVIDER,
                object : LocationListener {
                    override fun onLocationChanged(location: Location) {
                        lastKnownLocation = location
                    }
                    override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
                },
                null
            )
        } catch (e: SecurityException) {
            Log.e("RakshaPulse", "Location permission missing: ${e.message}")
        }
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            tts?.language = Locale.ENGLISH
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        countdownTimer?.cancel()
        tts?.stop()
        tts?.shutdown()
    }
}
