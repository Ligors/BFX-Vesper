package org.bfx.vesper

import android.content.Context
import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest
import java.security.SecureRandom
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec

class WebShieldStore(context: Context) {
    private val prefs = context.getSharedPreferences("web_shield_v1", Context.MODE_PRIVATE)
    var blockGambling: Boolean
        get() = prefs.getBoolean("gambling", true)
        set(value) { prefs.edit().putBoolean("gambling", value).apply() }
    val hasPin: Boolean get() = prefs.contains("pin_hash")
    val retryAfter: Long get() = (prefs.getLong("retry_at", 0) - System.currentTimeMillis()).coerceAtLeast(0)

    fun rules(): List<WebShieldPolicy.Rule> = try {
        val a = JSONArray(prefs.getString("rules", "[]"))
        (0 until a.length()).map { i -> a.getJSONObject(i).let { WebShieldPolicy.Rule(it.getString("host"), it.getString("path"), it.getString("scope")) } }
    } catch (_: Exception) { emptyList() }

    fun saveRules(rules: List<WebShieldPolicy.Rule>) {
        val a = JSONArray()
        rules.distinct().forEach { a.put(JSONObject().put("host", it.host).put("path", it.path).put("scope", it.scope)) }
        prefs.edit().putString("rules", a.toString()).commit()
    }

    fun setPin(pin: String) {
        require(pin.matches(Regex("[0-9]{6}")))
        val salt = ByteArray(16).also { SecureRandom().nextBytes(it) }
        prefs.edit().putString("pin_salt", Base64.encodeToString(salt, Base64.NO_WRAP))
            .putString("pin_hash", Base64.encodeToString(derive(pin, salt), Base64.NO_WRAP))
            .putInt("failures", 0).putLong("retry_at", 0).commit()
    }

    fun verifyPin(pin: String): Boolean {
        if (!hasPin || retryAfter > 0) return false
        val valid = try {
            val salt = Base64.decode(prefs.getString("pin_salt", ""), Base64.NO_WRAP)
            val expected = Base64.decode(prefs.getString("pin_hash", ""), Base64.NO_WRAP)
            MessageDigest.isEqual(derive(pin, salt), expected)
        } catch (_: Exception) { false }
        val failures = if (valid) 0 else prefs.getInt("failures", 0) + 1
        prefs.edit().putInt("failures", if (failures >= 5) 0 else failures)
            .putLong("retry_at", if (failures >= 5) System.currentTimeMillis() + 300_000 else 0).commit()
        return valid
    }

    private fun derive(pin: String, salt: ByteArray): ByteArray {
        val spec = PBEKeySpec(pin.toCharArray(), salt, 120_000, 256)
        return try { SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).encoded } finally { spec.clearPassword() }
    }
}
