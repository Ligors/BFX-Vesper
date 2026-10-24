package org.bfx.vesper

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

class VesperAccessibilityService : AccessibilityService() {

    companion object {
        private const val TAG = "VesperAccessibility"
        var isServiceRunning = false
            private set
        private var lastRelaunchTime = 0L
        @Volatile
        var speakerClickedForThisCall = false

        private val KNOWN_KEYBOARDS = setOf(
            "com.google.android.inputmethod.latin",
            "com.samsung.android.honeyboard",
            "com.touchtype.swiftkey",
            "com.android.inputmethod.latin",
            "com.sohu.inputmethod.sogou",
            "com.baidu.input",
            "com.syntellia.fleksy.keyboard",
            "com.oppo.keyboard",
            "com.miui.voiceassist"
        )
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        isServiceRunning = true
        Log.i(TAG, "BFX Vesper Accessibility Service Connected and Active")
    }

    private fun isInputMethod(pkgName: String): Boolean {
        if (pkgName.isBlank()) return false
        if (KNOWN_KEYBOARDS.contains(pkgName)) return true
        val lower = pkgName.lowercase()
        return lower.contains("inputmethod") ||
               lower.contains("keyboard") ||
               lower.contains("honeyboard") ||
               lower.contains("swiftkey") ||
               lower.contains("gboard") ||
               lower.contains("ime") ||
               lower.contains("latin") ||
               lower.contains("sogou") ||
               lower.contains("fleksy")
    }

    private fun isDialer(pkgName: String): Boolean {
        if (pkgName.isBlank()) return false
        val lower = pkgName.lowercase()
        return lower.contains("dialer") ||
               lower.contains("telecom") ||
               lower.contains("incall") ||
               (lower.contains("phone") && !lower.contains("phonepe") && !lower.contains("pay"))
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return

        // 1. Auto-turn on speakerphone on dialer UI when unknown call is answered
        if (CallStateManager.isCallGuardActive && !speakerClickedForThisCall) {
            checkAndClickSpeakerButton()
        }

        // 2. Zero-overhead fast path: exit immediately when phone is not in lockdown
        if (!LockdownManager.isLocked(applicationContext)) return
        if (event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return

        val pkgName = event.packageName?.toString() ?: return
        val myPkg = applicationContext.packageName
        if (pkgName == myPkg) return

        // NEVER block the soft keyboard (GBoard, Samsung HoneyBoard, SwiftKey, etc.)
        if (isInputMethod(pkgName)) {
            return
        }

        // Allow active phone call / dialer screen only
        if (isDialer(pkgName)) {
            return
        }

        // Prevent minimizing or switching to Launcher, Recent Apps, or other apps during lockdown
        val now = System.currentTimeMillis()
        if (now - lastRelaunchTime > 300L) {
            lastRelaunchTime = now
            Log.w(TAG, "LOCKED: Prevented switch to $pkgName during lockdown. Returning to Lockdown screen.")

            val intent = Intent(applicationContext, LockdownActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                putExtra("auto_call_guardian", false)
            }
            startActivity(intent)
        }
    }

    private fun checkAndClickSpeakerButton() {
        try {
            val root = rootInActiveWindow ?: return
            if (findAndClickSpeaker(root)) {
                speakerClickedForThisCall = true
                Log.i(TAG, "🎯 Speakerphone button successfully clicked on Dialer UI by Vesper Accessibility Service!")
            }
        } catch (e: Exception) {
            Log.w(TAG, "checkAndClickSpeakerButton error: ${e.message}")
        }
    }

    private fun findAndClickSpeaker(node: AccessibilityNodeInfo?): Boolean {
        if (node == null) return false

        val text = node.text?.toString()?.lowercase() ?: ""
        val desc = node.contentDescription?.toString()?.lowercase() ?: ""
        val viewId = node.viewIdResourceName?.lowercase() ?: ""

        val isSpeaker = text.contains("speaker") || desc.contains("speaker") ||
                text.contains("loudspeaker") || desc.contains("loudspeaker") ||
                text.contains("speakerphone") || desc.contains("speakerphone") ||
                viewId.contains("speaker") || viewId.contains("incall_speaker")

        if (isSpeaker) {
            if (node.isChecked || node.isSelected) {
                Log.i(TAG, "Speaker is already ON on dialer UI.")
                return true
            }
            if (node.isClickable) {
                node.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                return true
            }
            var p = node.parent
            while (p != null) {
                if (p.isClickable) {
                    p.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                    return true
                }
                p = p.parent
            }
        }

        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            if (findAndClickSpeaker(child)) return true
        }
        return false
    }

    override fun onInterrupt() {
        Log.w(TAG, "Vesper Accessibility Service Interrupted")
    }

    override fun onDestroy() {
        super.onDestroy()
        isServiceRunning = false
    }
}
