package com.rakshapulse.womensafety

import java.util.Calendar

/**
 * 24-Hour Time Period Risk Engine.
 * Evaluates the 24-hour smartwatch internal clock to determine if current time is within
 * the high-risk night window (default 20:00 to 06:00).
 */
object NightTimeRiskEvaluator {

    var nightStartHour: Int = 20 // 8:00 PM (20:00 in 24-hr format)
    var nightEndHour: Int = 6    // 6:00 AM (06:00 in 24-hr format)

    /**
     * Checks if current device time falls into night risk period.
     */
    fun isNightRiskWindow(): Boolean {
        val calendar = Calendar.getInstance()
        val currentHour24 = calendar.get(Calendar.HOUR_OF_DAY) // 0 to 23

        return if (nightStartHour > nightEndHour) {
            // Overnights (e.g., 20:00 to 06:00)
            currentHour24 >= nightStartHour || currentHour24 < nightEndHour
        } else {
            currentHour24 in nightStartHour until nightEndHour
        }
    }

    /**
     * Returns formatted 24-hr timestamp string (e.g., "23:42:15 IST")
     */
    fun getFormatted24HourTime(): String {
        val cal = Calendar.getInstance()
        return String.format(
            "%02d:%02d:%02d",
            cal.get(Calendar.HOUR_OF_DAY),
            cal.get(Calendar.MINUTE),
            cal.get(Calendar.SECOND)
        )
    }
}
