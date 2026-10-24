package org.bfx.vesper

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.view.inputmethod.InputMethodManager
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.activity.OnBackPressedCallback

class LockdownActivity : AppCompatActivity() {

    private var isEmergencyCalling = false
    private var isTypingPasscode = false
    private val handler = Handler(Looper.getMainLooper())
    private var autoCallRunnable: Runnable? = null

    private lateinit var tvCallingStatus: TextView
    private lateinit var etPasscode: EditText
    private lateinit var etPassphrase: EditText

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() { handleBackAttempt() }
        })

        // Make activity display over lock screen and wake up device
        @Suppress("DEPRECATION")
        window.addFlags(
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
            WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
        )

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        }

        // Soft input mode: resize window cleanly so keyboard is never blocked
        @Suppress("DEPRECATION")
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)

        setContentView(R.layout.activity_lockdown)

        val tvReason = findViewById<TextView>(R.id.tvLockReason)
        val tvScamScore = findViewById<TextView>(R.id.tvScamScore)
        tvCallingStatus = findViewById(R.id.tvCallingStatus)

        val llPasscodeSection = findViewById<LinearLayout>(R.id.llPasscodeSection)
        etPasscode = findViewById(R.id.etPasscode)
        val btnUnlock = findViewById<Button>(R.id.btnUnlock)
        val btnForgot = findViewById<Button>(R.id.btnForgot)

        val llForgotSection = findViewById<LinearLayout>(R.id.llForgotSection)
        etPassphrase = findViewById(R.id.etPassphrase)
        val btnUnlockWithPhrase = findViewById<Button>(R.id.btnUnlockWithPhrase)
        val btnBackToPasscode = findViewById<Button>(R.id.btnBackToPasscode)

        val btnCall1930 = findViewById<Button>(R.id.btnCall1930)
        val btnCallGuardian = findViewById<Button>(R.id.btnCallGuardian)

        val reason = LockdownManager.getLockReason(this)
        val score = LockdownManager.getScamScore(this)
        val guardianPhone = LockdownManager.getGuardianPhone(this)

        tvScamScore.text = "SCAM RISK SCORE: $score/100"
        tvReason.text = reason

        if (guardianPhone.isNotEmpty()) {
            btnCallGuardian.text = "📞 Call Guardian ($guardianPhone)"
        }

        // Setup input interactions
        val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager

        etPasscode.setOnClickListener {
            etPasscode.requestFocus()
            imm?.showSoftInput(etPasscode, InputMethodManager.SHOW_IMPLICIT)
        }

        etPasscode.setOnFocusChangeListener { v, hasFocus ->
            if (hasFocus) {
                imm?.showSoftInput(v, InputMethodManager.SHOW_IMPLICIT)
            }
        }

        etPassphrase.setOnClickListener {
            etPassphrase.requestFocus()
            imm?.showSoftInput(etPassphrase, InputMethodManager.SHOW_IMPLICIT)
        }

        etPassphrase.setOnFocusChangeListener { v, hasFocus ->
            if (hasFocus) {
                imm?.showSoftInput(v, InputMethodManager.SHOW_IMPLICIT)
            }
        }

        // Automatic Guardian Calling: triggers immediately on scam lockdown
        val shouldAutoCall = intent.getBooleanExtra("auto_call_guardian", true)
        val callTarget = if (guardianPhone.isNotBlank()) guardianPhone else "1930"
        if (shouldAutoCall && !LockdownManager.isEmergencyCallActive(this)) {
            tvCallingStatus.visibility = View.VISIBLE
            tvCallingStatus.text = "📞 Emergency Protocol: Auto-calling Guardian ($callTarget)..."

            autoCallRunnable = Runnable {
                if (!isFinishing && LockdownManager.isLocked(this@LockdownActivity)) {
                    Log.i("LockdownActivity", "Auto-executing emergency Guardian call to: $callTarget")
                    directCall(callTarget)
                }
            }
            handler.postDelayed(autoCallRunnable!!, 1500)
        }

        // Passcode unlock
        btnUnlock.setOnClickListener {
            cancelAutoCall()
            val code = etPasscode.text.toString().trim()
            if (LockdownManager.unlockWithPasscode(this, code)) {
                unlockAndExit("✅ Device Unlocked Successfully")
            } else {
                Toast.makeText(this, "❌ Incorrect Passcode. Try again or tap 'Forgot Passcode?'", Toast.LENGTH_SHORT).show()
                etPasscode.setText("")
                etPasscode.requestFocus()
                imm?.showSoftInput(etPasscode, InputMethodManager.SHOW_IMPLICIT)
            }
        }

        // Toggle to Forgot / Recovery Passphrase mode
        btnForgot.setOnClickListener {
            cancelAutoCall()
            isTypingPasscode = true
            llPasscodeSection.visibility = View.GONE
            llForgotSection.visibility = View.VISIBLE
            etPassphrase.requestFocus()
            imm?.showSoftInput(etPassphrase, InputMethodManager.SHOW_IMPLICIT)
        }

        // Toggle back to Passcode mode
        btnBackToPasscode.setOnClickListener {
            cancelAutoCall()
            isTypingPasscode = true
            llForgotSection.visibility = View.GONE
            llPasscodeSection.visibility = View.VISIBLE
            etPasscode.requestFocus()
            imm?.showSoftInput(etPasscode, InputMethodManager.SHOW_IMPLICIT)
        }

        // Passphrase unlock
        btnUnlockWithPhrase.setOnClickListener {
            cancelAutoCall()
            val phrase = etPassphrase.text.toString().trim()
            if (LockdownManager.unlockWithPassphrase(this, phrase)) {
                unlockAndExit("✅ Unlocked with Recovery Passphrase")
            } else {
                Toast.makeText(this, "❌ Incorrect Recovery Passphrase.", Toast.LENGTH_SHORT).show()
                etPassphrase.setText("")
                etPassphrase.requestFocus()
                imm?.showSoftInput(etPassphrase, InputMethodManager.SHOW_IMPLICIT)
            }
        }

        btnCall1930.setOnClickListener {
            cancelAutoCall()
            directCall("1930")
        }

        btnCallGuardian.setOnClickListener {
            cancelAutoCall()
            val phone = if (guardianPhone.isNotEmpty()) guardianPhone else "1930"
            directCall(phone)
        }

        // Auto focus passcode field and pop up keyboard after view layout
        handler.postDelayed({
            if (!isFinishing && LockdownManager.isLocked(this)) {
                etPasscode.requestFocus()
                imm?.showSoftInput(etPasscode, InputMethodManager.SHOW_IMPLICIT)
            }
        }, 350)
    }

    private fun cancelAutoCall() {
        autoCallRunnable?.let { handler.removeCallbacks(it) }
        autoCallRunnable = null
        if (::tvCallingStatus.isInitialized) {
            tvCallingStatus.visibility = View.GONE
        }
    }

    private fun unlockAndExit(msg: String) {
        cancelAutoCall()
        LockdownManager.setEmergencyCallActive(this, false)
        val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager
        currentFocus?.let { imm?.hideSoftInputFromWindow(it.windowToken, 0) }
        Toast.makeText(this, msg, Toast.LENGTH_LONG).show()
        MainActivity.instance?.onUnlockedFromNative()
        finish()
    }

    override fun onResume() {
        super.onResume()
        if (!LockdownManager.isEmergencyCallActive(this)) {
            isEmergencyCalling = false
        }
    }

    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        // Prevent minimizing while locked
        if (LockdownManager.isLocked(this) && !isEmergencyCalling) {
            val intent = Intent(this, LockdownActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                putExtra("auto_call_guardian", false)
            }
            startActivity(intent)
        }
    }

    override fun onPause() {
        super.onPause()
        // NEVER call startActivity(this) from onPause()! That was causing the black screen glitching loop!
    }

    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacksAndMessages(null)
    }

    private fun directCall(phone: String) {
        val clean = phone.replace(Regex("[^0-9+]"), "")
        if (clean.isEmpty()) return

        isEmergencyCalling = true
        LockdownManager.setEmergencyCallActive(this, true)
        // Reset emergency calling transitional flag after dialer opens
        handler.postDelayed({ isEmergencyCalling = false }, 2500)

        val hasPerm = checkSelfPermission(Manifest.permission.CALL_PHONE) == PackageManager.PERMISSION_GRANTED
        if (hasPerm) {
            try {
                val callIntent = Intent(Intent.ACTION_CALL, Uri.parse("tel:$clean")).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                startActivity(callIntent)
                return
            } catch (e: Exception) {
                Log.w("LockdownActivity", "ACTION_CALL failed, falling back to DIAL: ${e.message}")
            }
        }

        // Fallback to DIAL
        try {
            val dialIntent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$clean")).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            startActivity(dialIntent)
        } catch (e: Exception) {
            Log.e("LockdownActivity", "ACTION_DIAL failed: ${e.message}")
            Toast.makeText(this, "Could not open dialer for $clean", Toast.LENGTH_SHORT).show()
        }
    }

    private fun handleBackAttempt() {
        val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager
        if (imm?.isAcceptingText == true) {
            currentFocus?.let { imm.hideSoftInputFromWindow(it.windowToken, 0) }
        } else {
            Toast.makeText(this, "Locked by BFX Vesper. Enter app passcode or recovery passphrase.", Toast.LENGTH_SHORT).show()
        }
    }
}
