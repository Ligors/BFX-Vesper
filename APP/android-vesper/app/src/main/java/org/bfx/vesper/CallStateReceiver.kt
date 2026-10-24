package org.bfx.vesper

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.telephony.TelephonyManager
import android.util.Log

class CallStateReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "CallStateReceiver"
        private var lastState = TelephonyManager.EXTRA_STATE_IDLE
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != TelephonyManager.ACTION_PHONE_STATE_CHANGED) return

        val state = intent.getStringExtra(TelephonyManager.EXTRA_STATE) ?: return
        if (state == lastState) return
        lastState = state

        Log.i(TAG, "Phone State Changed: $state")

        when (state) {
            TelephonyManager.EXTRA_STATE_RINGING -> {
                val incomingNumber = intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER)
                CallStateManager.onRinging(context, incomingNumber)
            }

            TelephonyManager.EXTRA_STATE_OFFHOOK -> {
                if (!CallStateManager.isCallGuardActive && CallStateManager.shouldAutoActivateCallGuard()) {
                    CallStateManager.isCallGuardActive = true
                    val caller = CallStateManager.lastIncomingNumber ?: "Unknown Caller"
                    Log.i(TAG, "Unknown caller ($caller) outside contacts answered. Auto-activating Call Guard...")

                    // 1. Start foreground Call Guard service with persistent notification
                    CallGuardForegroundService.start(context)

                    // 2. Force speakerphone ON immediately so caller voice hits the speaker
                    AudioRoutingHelper.routeToSpeakerphone(context)

                    // 3. Re-apply speakerphone after 400ms and 900ms — Android telecom stack
                    //    often resets audio routing right after call connect, this defeats it.
                    AudioRoutingHelper.forceRerouteToSpeakerphone(context, 400L)
                    AudioRoutingHelper.forceRerouteToSpeakerphone(context, 900L)

                    // 4. Bring MainActivity to foreground and navigate to Call Guard
                    val mainIntent = Intent(context, MainActivity::class.java).apply {
                        action = "org.bfx.vesper.ACTION_INCOMING_CALL_ACTIVE"
                        putExtra("caller_number", caller)
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                    }
                    context.startActivity(mainIntent)

                    // 5. Trigger native speech recognition after a 1s delay (wait for speaker to be active)
                    android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                        MainActivity.instance?.onIncomingCallAnswered(caller)
                    }, 1000L)
                } else {
                    Log.i(TAG, "Call answered but caller is in saved contacts or outgoing call. Call Guard will NOT activate.")
                }
            }

            TelephonyManager.EXTRA_STATE_IDLE -> {
                Log.i(TAG, "Call ended (IDLE).")
                if (CallStateManager.isCallGuardActive) {
                    AudioRoutingHelper.resetAudioRouting(context)
                    CallGuardForegroundService.stop(context)
                    MainActivity.instance?.onCallEnded()
                }
                CallStateManager.onCallEnded()
            }
        }
    }
}
