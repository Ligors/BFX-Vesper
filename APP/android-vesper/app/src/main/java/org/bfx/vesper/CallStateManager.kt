package org.bfx.vesper

import android.content.Context
import android.util.Log

object CallStateManager {
    private const val TAG = "CallStateManager"

    var isIncomingCall: Boolean = false
        private set

    var lastIncomingNumber: String? = null
        private set

    var isCallerSavedContact: Boolean = false
        private set

    var isCallGuardActive: Boolean = false

    fun onRinging(context: Context, incomingNumber: String?) {
        isIncomingCall = true
        if (!incomingNumber.isNullOrBlank()) {
            lastIncomingNumber = incomingNumber
        }
        isCallerSavedContact = ContactLookupHelper.isSavedContact(context, lastIncomingNumber)
        Log.i(TAG, "Ringing: '${lastIncomingNumber ?: "Unknown"}' | In Contacts: $isCallerSavedContact")
    }

    /**
     * Determines whether Call Guard should automatically turn on for this call.
     * Rules:
     * - Only incoming calls (not outgoing user calls).
     * - Only unknown numbers NOT found in user's saved contacts.
     */
    fun shouldAutoActivateCallGuard(): Boolean {
        if (!isIncomingCall) {
            Log.i(TAG, "Call is outgoing or direct offhook without ringing -> Skip auto Call Guard.")
            return false
        }
        if (isCallerSavedContact) {
            Log.i(TAG, "Caller '${lastIncomingNumber ?: ""}' is a saved contact -> Skip auto Call Guard.")
            return false
        }
        Log.i(TAG, "Caller '${lastIncomingNumber ?: "Unknown"}' is OUTSIDE contacts -> Auto-activating Call Guard!")
        return true
    }

    fun onCallEnded() {
        Log.i(TAG, "Call ended. Resetting call state.")
        isIncomingCall = false
        lastIncomingNumber = null
        isCallerSavedContact = false
        isCallGuardActive = false
    }
}
