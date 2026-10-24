package org.bfx.vesper

import android.content.Context
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log

object AudioRoutingHelper {
    private const val TAG = "AudioRoutingHelper"

    /**
     * Aggressively routes communication audio to the physical loudspeaker so the caller's voice
     * is loudly projected through the device speakers and can be captured by the microphone.
     * Uses safe, non-crashing calls on all Android versions (Android 8 to 15).
     */
    fun routeToSpeakerphone(context: Context) {
        try {
            val am = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return

            // 1. Set mode to MODE_IN_COMMUNICATION (allowed for third-party apps, does NOT require MODIFY_PHONE_STATE)
            try {
                @Suppress("DEPRECATION")
                am.mode = AudioManager.MODE_IN_COMMUNICATION
                Log.i(TAG, "Audio mode set to MODE_IN_COMMUNICATION")
            } catch (e: Exception) {
                Log.w(TAG, "Could not set MODE_IN_COMMUNICATION: ${e.message}")
            }

            // 2. Android 12+ (API 31+): Route using setCommunicationDevice to TYPE_BUILTIN_SPEAKER
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                try {
                    val speakerDevice = am.availableCommunicationDevices.firstOrNull {
                        it.type == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER
                    }
                    if (speakerDevice != null) {
                        val ok = am.setCommunicationDevice(speakerDevice)
                        Log.i(TAG, "setCommunicationDevice(BUILTIN_SPEAKER) result: $ok")
                    } else {
                        Log.w(TAG, "BUILTIN_SPEAKER not in availableCommunicationDevices")
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "setCommunicationDevice error: ${e.message}")
                }
            }

            // 3. Set isSpeakerphoneOn = true (works universally on Android)
            try {
                @Suppress("DEPRECATION")
                am.isSpeakerphoneOn = true
                Log.i(TAG, "am.isSpeakerphoneOn = true set")
            } catch (e: Exception) {
                Log.w(TAG, "isSpeakerphoneOn error: ${e.message}")
            }

            // 4. Maximize Voice Call stream volume so caller's voice is loud enough to be clearly heard by mic
            try {
                val maxCallVol = am.getStreamMaxVolume(AudioManager.STREAM_VOICE_CALL)
                am.setStreamVolume(AudioManager.STREAM_VOICE_CALL, maxCallVol, 0)
                Log.i(TAG, "STREAM_VOICE_CALL volume set to maximum: $maxCallVol")
            } catch (e: Exception) {
                Log.w(TAG, "setStreamVolume error: ${e.message}")
            }

            Log.i(TAG, "✅ Speakerphone routing applied successfully")
        } catch (e: Exception) {
            Log.e(TAG, "routeToSpeakerphone unexpected error: ${e.message}")
        }
    }

    /**
     * Forcefully re-applies speakerphone routing after delay to defeat Android telecom stack
     * resets that occur after connection.
     */
    fun forceRerouteToSpeakerphone(context: Context, delayMs: Long = 500L) {
        Handler(Looper.getMainLooper()).postDelayed({
            routeToSpeakerphone(context)
            Log.i(TAG, "🔁 Speakerphone re-applied after ${delayMs}ms delay")
        }, delayMs)
    }

    /**
     * Resets audio routing back to normal handset mode.
     */
    fun resetAudioRouting(context: Context) {
        try {
            val am = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                try { am.clearCommunicationDevice() } catch (_: Exception) {}
            }
            try {
                @Suppress("DEPRECATION")
                am.isSpeakerphoneOn = false
            } catch (_: Exception) {}
            try {
                @Suppress("DEPRECATION")
                am.mode = AudioManager.MODE_NORMAL
            } catch (_: Exception) {}
            Log.i(TAG, "Audio routing reset to normal.")
        } catch (e: Exception) {
            Log.e(TAG, "Error resetting audio routing: ${e.message}")
        }
    }
}
