package org.bfx.vesper

import android.content.Context
import android.content.SharedPreferences

object LockdownManager {
    private const val PREFS_NAME = "vesper_lockdown_prefs"
    private const val KEY_IS_LOCKED = "is_locked"
    private const val KEY_PASSCODE = "guardian_passcode"
    private const val KEY_PASSPHRASE = "recovery_passphrase"
    private const val KEY_LOCK_REASON = "lock_reason"
    private const val KEY_SCAM_SCORE = "scam_score"
    private const val KEY_GUARDIAN_PHONE = "guardian_phone"
    private const val KEY_EMERGENCY_CALL_ACTIVE_TIME = "emergency_call_active_time"

    @Volatile
    private var cachedIsLocked: Boolean? = null

    @Volatile
    private var cachedEmergencyCallTime: Long? = null

    private fun getPrefs(context: Context): SharedPreferences {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    fun isLocked(context: Context): Boolean {
        cachedIsLocked?.let { return it }
        val locked = getPrefs(context).getBoolean(KEY_IS_LOCKED, false)
        cachedIsLocked = locked
        return locked
    }

    fun setUserPasscode(context: Context, code: String) {
        val clean = code.trim()
        if (clean.isNotEmpty()) {
            getPrefs(context).edit().putString(KEY_PASSCODE, clean).apply()
        }
    }

    fun getUserPasscode(context: Context): String {
        return getPrefs(context).getString(KEY_PASSCODE, "") ?: ""
    }

    fun setUserPassphrase(context: Context, phrase: String) {
        val clean = phrase.trim()
        if (clean.isNotEmpty()) {
            getPrefs(context).edit().putString(KEY_PASSPHRASE, clean).apply()
        }
    }

    fun getUserPassphrase(context: Context): String {
        return getPrefs(context).getString(KEY_PASSPHRASE, "") ?: ""
    }

    fun triggerLockdown(
        context: Context,
        reason: String,
        score: Int,
        defaultPasscode: String = "",
        guardianPhone: String = "",
        defaultPassphrase: String = ""
    ) {
        val prefs = getPrefs(context)
        val existingPasscode = prefs.getString(KEY_PASSCODE, "") ?: ""
        val finalCode = when {
            existingPasscode.isNotBlank() -> existingPasscode
            defaultPasscode.isNotBlank() -> defaultPasscode.trim()
            else -> ""
        }

        val existingPhrase = prefs.getString(KEY_PASSPHRASE, "") ?: ""
        val finalPhrase = when {
            existingPhrase.isNotBlank() -> existingPhrase
            defaultPassphrase.isNotBlank() -> defaultPassphrase.trim()
            else -> ""
        }

        cachedIsLocked = true

        prefs.edit()
            .putBoolean(KEY_IS_LOCKED, true)
            .putString(KEY_LOCK_REASON, reason)
            .putInt(KEY_SCAM_SCORE, score)
            .putString(KEY_PASSCODE, finalCode)
            .putString(KEY_PASSPHRASE, finalPhrase)
            .putString(KEY_GUARDIAN_PHONE, guardianPhone)
            .apply()
    }

    fun setEmergencyCallActive(context: Context, active: Boolean) {
        val time = if (active) System.currentTimeMillis() else 0L
        cachedEmergencyCallTime = time
        getPrefs(context).edit().putLong(KEY_EMERGENCY_CALL_ACTIVE_TIME, time).apply()
    }

    fun isEmergencyCallActive(context: Context): Boolean {
        val time = cachedEmergencyCallTime ?: run {
            val t = getPrefs(context).getLong(KEY_EMERGENCY_CALL_ACTIVE_TIME, 0L)
            cachedEmergencyCallTime = t
            t
        }
        if (time == 0L) return false
        // Emergency call window lasts up to 5 minutes
        if (System.currentTimeMillis() - time > 300_000L) {
            setEmergencyCallActive(context, false)
            return false
        }
        return true
    }

    fun getGuardianPhone(context: Context): String {
        return getPrefs(context).getString(KEY_GUARDIAN_PHONE, "") ?: ""
    }

    fun unlockWithPasscode(context: Context, enteredCode: String): Boolean {
        val entered = enteredCode.trim()
        if (entered.isEmpty()) return false
        val saved = getUserPasscode(context).trim()
        // Accept either the user's custom passcode or fallback defaults (839174 / 123456)
        if ((saved.isNotEmpty() && entered == saved) || entered == "839174" || entered == "123456") {
            cachedIsLocked = false
            setEmergencyCallActive(context, false)
            getPrefs(context).edit().putBoolean(KEY_IS_LOCKED, false).apply()
            return true
        }
        return false
    }

    fun unlockWithPassphrase(context: Context, enteredPhrase: String): Boolean {
        val entered = enteredPhrase.trim()
        if (entered.isEmpty()) return false
        val saved = getUserPassphrase(context).trim()
        // Accept either custom recovery passphrase or default ("vesper")
        if ((saved.isNotEmpty() && entered.equals(saved, ignoreCase = true)) || entered.equals("vesper", ignoreCase = true)) {
            cachedIsLocked = false
            setEmergencyCallActive(context, false)
            getPrefs(context).edit().putBoolean(KEY_IS_LOCKED, false).apply()
            return true
        }
        return false
    }

    fun unlock(context: Context, enteredCodeOrPhrase: String): Boolean {
        return unlockWithPasscode(context, enteredCodeOrPhrase) || unlockWithPassphrase(context, enteredCodeOrPhrase)
    }

    fun getLockReason(context: Context): String {
        return getPrefs(context).getString(KEY_LOCK_REASON, "Scam activity detected by Vesper Call Guard.") ?: ""
    }

    fun getScamScore(context: Context): Int {
        return getPrefs(context).getInt(KEY_SCAM_SCORE, 85)
    }
}
