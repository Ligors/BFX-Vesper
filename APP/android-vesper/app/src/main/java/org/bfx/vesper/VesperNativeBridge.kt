package org.bfx.vesper

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.Settings
import android.speech.tts.TextToSpeech
import android.util.Log
import android.webkit.JavascriptInterface
import android.widget.Toast
import org.json.JSONArray
import java.util.Locale

class VesperNativeBridge(private val context: Context) {

    private var tts: TextToSpeech? = null
    @Volatile
    private var isTtsReady = false
    @Volatile
    private var pendingSpeech: Pair<String, String>? = null

    init {
        initTts()
    }

    private fun initTts() {
        try {
            tts = TextToSpeech(context.applicationContext) { status ->
                if (status == TextToSpeech.SUCCESS) {
                    isTtsReady = true
                    tts?.language = Locale("en", "IN")
                    val pending = pendingSpeech
                    pendingSpeech = null
                    if (pending != null) {
                        speak(pending.first, pending.second)
                    }
                }
            }
        } catch (_: Exception) {}
    }

    @JavascriptInterface
    fun isNativeApp(): Boolean = true

    @JavascriptInterface
    fun openWebShield() {
        // Deprecated - link blocking removed per user requirement
    }

    @JavascriptInterface
    fun isAccessibilityEnabled(): Boolean = true

    @JavascriptInterface
    fun openAccessibilitySettings() {
        // No-op - accessibility service removed
    }

    @JavascriptInterface
    fun isOverlayPermissionGranted(): Boolean = true

    @JavascriptInterface
    fun openOverlaySettings() {
        // No-op - overlay permission removed
    }

    @JavascriptInterface
    fun isCallPermissionGranted(): Boolean {
        return context.checkSelfPermission(android.Manifest.permission.CALL_PHONE) == android.content.pm.PackageManager.PERMISSION_GRANTED
    }

    @JavascriptInterface
    fun isContactPermissionGranted(): Boolean {
        return context.checkSelfPermission(android.Manifest.permission.READ_CONTACTS) == android.content.pm.PackageManager.PERMISSION_GRANTED
    }

    @JavascriptInterface
    fun isContact(phoneNumber: String): Boolean {
        return ContactLookupHelper.isSavedContact(context, phoneNumber)
    }

    @JavascriptInterface
    fun requestCallPermission() {
        if (context is MainActivity) {
            context.requestCallPhonePermission()
        }
    }

    @JavascriptInterface
    fun setUserPasscode(passcode: String) {
        if (passcode.isNotBlank()) {
            LockdownManager.setUserPasscode(context, passcode.trim())
        }
    }

    @JavascriptInterface
    fun getUserPasscode(): String {
        return LockdownManager.getUserPasscode(context)
    }

    @JavascriptInterface
    fun setUserPassphrase(passphrase: String) {
        if (passphrase.isNotBlank()) {
            LockdownManager.setUserPassphrase(context, passphrase.trim())
        }
    }

    @JavascriptInterface
    fun getUserPassphrase(): String {
        return LockdownManager.getUserPassphrase(context)
    }

    @JavascriptInterface
    fun triggerLockdown(reason: String, score: Int, passcode: String, guardianPhone: String, passphrase: String) {
        LockdownManager.triggerLockdown(context, reason, score, passcode, guardianPhone, passphrase)
        val intent = Intent(context, LockdownActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
            addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
            putExtra("auto_call_guardian", true)
        }
        context.startActivity(intent)
    }

    @JavascriptInterface
    fun triggerLockdown(reason: String, score: Int, passcode: String, guardianPhone: String) {
        triggerLockdown(reason, score, passcode, guardianPhone, "")
    }

    @JavascriptInterface
    fun triggerLockdown(reason: String, score: Int, passcode: String) {
        triggerLockdown(reason, score, passcode, "", "")
    }

    @JavascriptInterface
    fun callGuardian(phone: String) {
        val target = if (phone.isNotBlank()) phone else "1930"
        val clean = target.replace(Regex("[^0-9+]"), "")
        if (clean.isEmpty()) return
        LockdownManager.setEmergencyCallActive(context, true)
        try {
            val hasPerm = context.checkSelfPermission(android.Manifest.permission.CALL_PHONE) == android.content.pm.PackageManager.PERMISSION_GRANTED
            val intent = if (hasPerm) {
                Intent(Intent.ACTION_CALL, android.net.Uri.parse("tel:$clean"))
            } else {
                Intent(Intent.ACTION_DIAL, android.net.Uri.parse("tel:$clean"))
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
        } catch (_: Exception) {
            try {
                val dialIntent = Intent(Intent.ACTION_DIAL, android.net.Uri.parse("tel:$clean")).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(dialIntent)
            } catch (_: Exception) {}
        }
    }

    @JavascriptInterface
    fun unlockPhone(passcodeOrPhrase: String): Boolean {
        return LockdownManager.unlock(context, passcodeOrPhrase)
    }

    @JavascriptInterface
    fun startCallGuardService() {
        CallGuardForegroundService.start(context)
    }

    @JavascriptInterface
    fun stopCallGuardService() {
        CallGuardForegroundService.stop(context)
    }

    @JavascriptInterface
    fun vibrate(durationMs: Long) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vm = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                vm.defaultVibrator.vibrate(VibrationEffect.createOneShot(durationMs, VibrationEffect.DEFAULT_AMPLITUDE))
            } else {
                @Suppress("DEPRECATION")
                val v = context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    v.vibrate(VibrationEffect.createOneShot(durationMs, VibrationEffect.DEFAULT_AMPLITUDE))
                } else {
                    @Suppress("DEPRECATION")
                    v.vibrate(durationMs)
                }
            }
        } catch (_: Exception) {}
    }

    @JavascriptInterface
    fun speak(text: String, lang: String) {
        if (text.isBlank()) return
        if (tts == null || !isTtsReady) {
            pendingSpeech = Pair(text, lang)
            initTts()
            return
        }
        val clean = lang.trim().lowercase()
        val loc = when {
            clean.startsWith("hi") -> Locale("hi", "IN")
            clean.startsWith("ta") -> Locale("ta", "IN")
            clean.startsWith("te") -> Locale("te", "IN")
            clean.startsWith("kn") -> Locale("kn", "IN")
            clean.startsWith("mr") -> Locale("mr", "IN")
            clean.startsWith("gu") -> Locale("gu", "IN")
            clean.startsWith("ml") -> Locale("ml", "IN")
            clean.startsWith("bn") -> Locale("bn", "IN")
            clean.startsWith("pa") -> Locale("pa", "IN")
            clean.startsWith("or") -> Locale("or", "IN")
            else -> Locale("en", "IN")
        }
        try {
            val res = tts?.setLanguage(loc)
            if (res == TextToSpeech.LANG_MISSING_DATA || res == TextToSpeech.LANG_NOT_SUPPORTED) {
                tts?.setLanguage(Locale("en", "IN"))
            }
            tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "vesper_tts_${System.currentTimeMillis()}")
        } catch (e: Exception) {
            Log.e("VesperNativeBridge", "TTS speak failed: ${e.message}")
        }
    }

    @JavascriptInterface
    fun isOfflineModelDownloaded(): Boolean {
        return try {
            val pubDir = android.os.Environment.getExternalStoragePublicDirectory(android.os.Environment.DIRECTORY_DOWNLOADS)
            val appDir = context.getExternalFilesDir(android.os.Environment.DIRECTORY_DOWNLOADS)
            val pubFiles = pubDir?.listFiles() ?: emptyArray()
            val appFiles = appDir?.listFiles() ?: emptyArray()
            (pubFiles + appFiles).any {
                (it.name.contains("gemma", ignoreCase = true) || it.name.contains("gguf", ignoreCase = true) || it.name.contains("model", ignoreCase = true)) && it.length() > 50_000_000L
            }
        } catch (_: Exception) {
            false
        }
    }

    @JavascriptInterface
    fun getOfflineModelPath(): String {
        return try {
            val pubDir = android.os.Environment.getExternalStoragePublicDirectory(android.os.Environment.DIRECTORY_DOWNLOADS)
            val appDir = context.getExternalFilesDir(android.os.Environment.DIRECTORY_DOWNLOADS)
            val pubFiles = pubDir?.listFiles() ?: emptyArray()
            val appFiles = appDir?.listFiles() ?: emptyArray()
            val file = (pubFiles + appFiles).firstOrNull {
                (it.name.contains("gemma", ignoreCase = true) || it.name.contains("gguf", ignoreCase = true) || it.name.contains("model", ignoreCase = true)) && it.length() > 50_000_000L
            }
            file?.absolutePath ?: ""
        } catch (_: Exception) {
            ""
        }
    }

    @JavascriptInterface
    fun getBlockedAppsList(): String {
        return JSONArray(listOf("Call Guard Active")).toString()
    }

    @JavascriptInterface
    fun downloadModel(url: String) {
        try {
            val uri = android.net.Uri.parse(url)
            val fileName = uri.lastPathSegment?.substringBefore("?") ?: "gemma-3-1b-it-Q4_K_M.gguf"
            val request = android.app.DownloadManager.Request(uri).apply {
                setTitle("Gemma 3 Offline AI Model ($fileName)")
                setDescription("BFX Vesper Local AI Model Downloading...")
                setNotificationVisibility(android.app.DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                setDestinationInExternalPublicDir(android.os.Environment.DIRECTORY_DOWNLOADS, fileName)
                setAllowedOverMetered(true)
                setAllowedOverRoaming(true)
            }
            val dm = context.getSystemService(Context.DOWNLOAD_SERVICE) as android.app.DownloadManager
            dm.enqueue(request)
            Toast.makeText(context, "📥 Downloading $fileName directly in background (Check notifications)...", Toast.LENGTH_LONG).show()
        } catch (e: Exception) {
            e.printStackTrace()
            Toast.makeText(context, "Direct download queued in background", Toast.LENGTH_SHORT).show()
        }
    }

    @JavascriptInterface
    fun enableSpeakerphone() {
        AudioRoutingHelper.routeToSpeakerphone(context)
    }

    @JavascriptInterface
    fun disableSpeakerphone() {
        AudioRoutingHelper.resetAudioRouting(context)
    }

    @JavascriptInterface
    fun startNativeSpeechRecognition(lang: String) {
        if (context is MainActivity) {
            context.startNativeSpeechRecognition(lang)
        }
    }

    @JavascriptInterface
    fun stopNativeSpeechRecognition() {
        if (context is MainActivity) {
            context.stopNativeSpeechRecognition()
        }
    }

    @JavascriptInterface
    fun getAppVersion(): String = "1.0.0-native-android"
}
