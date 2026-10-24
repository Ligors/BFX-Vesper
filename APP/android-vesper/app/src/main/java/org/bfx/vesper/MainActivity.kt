package org.bfx.vesper

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.View
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.ProgressBar
import android.os.Handler
import android.os.Looper
import android.telephony.PhoneStateListener
import android.telephony.TelephonyCallback
import android.telephony.TelephonyManager
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.webkit.WebViewAssetLoader

class MainActivity : AppCompatActivity() {

    companion object {
        var instance: MainActivity? = null
    }

    private lateinit var webView: WebView
    private lateinit var progressBar: ProgressBar
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var nativeSpeechManager: NativeSpeechManager? = null
    private val handler = Handler(Looper.getMainLooper())

    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == RESULT_OK) {
            val clipData = result.data?.clipData
            val dataUri = result.data?.data
            val results: Array<Uri>? = when {
                clipData != null -> Array(clipData.itemCount) { i -> clipData.getItemAt(i).uri }
                dataUri != null -> arrayOf(dataUri)
                else -> null
            }
            filePathCallback?.onReceiveValue(results)
        } else {
            filePathCallback?.onReceiveValue(null)
        }
        filePathCallback = null
    }

    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { _ -> }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        instance = this

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        }

        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)
        progressBar = findViewById(R.id.progressBar)

        requestRequiredPermissions()
        setupWebView()
        registerTelephonyListener()

        nativeSpeechManager = NativeSpeechManager(this).apply {
            onSpeechResultListener = { text, isFinal ->
                runOnUiThread {
                    val safeText = text.replace("\\", "\\\\").replace("'", "\\'").replace("\n", " ").replace("\r", " ")
                    webView.evaluateJavascript("if (window.onNativeSpeechResult) { window.onNativeSpeechResult('$safeText', $isFinal); }", null)
                }
            }
            onStatusListener = { status ->
                runOnUiThread {
                    webView.evaluateJavascript("if (window.onNativeSpeechStatus) { window.onNativeSpeechStatus('$status'); }", null)
                }
            }
        }

        // Load via secure HTTPS WebViewAssetLoader to support ES Modules and local files
        webView.loadUrl("https://appassets.androidplatform.net/assets/www/index.html")
    }

    override fun onDestroy() {
        super.onDestroy()
        nativeSpeechManager?.stopListening()
        nativeSpeechManager = null
        if (instance == this) instance = null
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (intent?.action == "org.bfx.vesper.ACTION_INCOMING_CALL_ACTIVE") {
            val caller = intent.getStringExtra("caller_number") ?: ""
            onIncomingCallAnswered(caller)
        }
    }

    fun startNativeSpeechRecognition(lang: String = "en-IN") {
        nativeSpeechManager?.startListening(lang)
    }

    fun stopNativeSpeechRecognition() {
        nativeSpeechManager?.stopListening()
    }

    fun onIncomingCallAnswered(callerNumber: String = "") {
        runOnUiThread {
            val safeCaller = callerNumber.replace("'", "\\'")
            webView.evaluateJavascript("if (window.autoStartCallGuard) { window.autoStartCallGuard('$safeCaller'); }", null)
        }
    }

    fun onCallEnded() {
        runOnUiThread {
            stopNativeSpeechRecognition()
            AudioRoutingHelper.resetAudioRouting(this)
            webView.evaluateJavascript("if (window.autoStopCallGuard) { window.autoStopCallGuard(); }", null)
        }
    }

    fun onUnlockedFromNative() {
        runOnUiThread {
            webView.evaluateJavascript("if (window.onNativeUnlocked) { window.onNativeUnlocked(); }", null)
        }
    }

    private fun registerTelephonyListener() {
        val tm = getSystemService(TELEPHONY_SERVICE) as? TelephonyManager ?: return
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                tm.registerTelephonyCallback(mainExecutor, object : TelephonyCallback(), TelephonyCallback.CallStateListener {
                    override fun onCallStateChanged(state: Int) {
                        handleCallState(state, null)
                    }
                })
            } else {
                @Suppress("DEPRECATION")
                tm.listen(object : PhoneStateListener() {
                    @Deprecated("Deprecated in Java")
                    override fun onCallStateChanged(state: Int, phoneNumber: String?) {
                        handleCallState(state, phoneNumber)
                    }
                }, PhoneStateListener.LISTEN_CALL_STATE)
            }
        } catch (_: Exception) {}
    }

    private fun handleCallState(state: Int, phoneNumber: String? = null) {
        when (state) {
            TelephonyManager.CALL_STATE_RINGING -> {
                CallStateManager.onRinging(this, phoneNumber)
            }
            TelephonyManager.CALL_STATE_OFFHOOK -> {
                if (!CallStateManager.isCallGuardActive && CallStateManager.shouldAutoActivateCallGuard()) {
                    CallStateManager.isCallGuardActive = true
                    CallGuardForegroundService.start(this)
                    // Force speakerphone immediately
                    AudioRoutingHelper.routeToSpeakerphone(this)
                    // Re-apply after delays — telecom stack resets audio routing after connect
                    AudioRoutingHelper.forceRerouteToSpeakerphone(this, 400L)
                    AudioRoutingHelper.forceRerouteToSpeakerphone(this, 900L)
                    val caller = CallStateManager.lastIncomingNumber ?: ""
                    // Delay speech recognition start by 1s to let speakerphone fully activate
                    handler.postDelayed({ onIncomingCallAnswered(caller) }, 1000L)
                }
            }
            TelephonyManager.CALL_STATE_IDLE -> {
                if (CallStateManager.isCallGuardActive) {
                    onCallEnded()
                }
                CallStateManager.onCallEnded()
            }
        }
    }

    private fun requestRequiredPermissions() {
        val perms = mutableListOf(
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.MODIFY_AUDIO_SETTINGS,
            Manifest.permission.CALL_PHONE,
            Manifest.permission.READ_PHONE_STATE,
            Manifest.permission.READ_CALL_LOG,
            Manifest.permission.READ_CONTACTS
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            perms.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        val needed = perms.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (needed.isNotEmpty()) {
            requestPermissionLauncher.launch(needed.toTypedArray())
        }
    }

    fun requestCallPhonePermission() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CALL_PHONE) != PackageManager.PERMISSION_GRANTED) {
            requestPermissionLauncher.launch(arrayOf(Manifest.permission.CALL_PHONE))
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        @Suppress("DEPRECATION")
        settings.setRenderPriority(WebSettings.RenderPriority.HIGH)
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        settings.userAgentString = "${settings.userAgentString} BFXVesperNativeAndroid/1.0"

        // Inject Native JavaScript Bridge
        webView.addJavascriptInterface(VesperNativeBridge(this), "VesperNative")

        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .addPathHandler("/res/", WebViewAssetLoader.ResourcesPathHandler(this))
            .build()

        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest?) {
                request?.grant(request.resources)
            }

            override fun onShowFileChooser(
                view: WebView?,
                filePath: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                filePathCallback?.onReceiveValue(null)
                filePathCallback = filePath

                val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    val accepts = fileChooserParams?.acceptTypes?.filter { it.isNotBlank() }
                    if (!accepts.isNullOrEmpty()) {
                        if (accepts.size == 1) {
                            type = accepts[0]
                        } else {
                            type = "*/*"
                            putExtra(Intent.EXTRA_MIME_TYPES, accepts.toTypedArray())
                        }
                    } else {
                        type = "*/*"
                    }
                }
                fileChooserLauncher.launch(Intent.createChooser(intent, "Select File"))
                return true
            }

            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                if (newProgress < 100) {
                    progressBar.visibility = View.VISIBLE
                    progressBar.progress = newProgress
                } else {
                    progressBar.visibility = View.GONE
                }
            }
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView?,
                request: WebResourceRequest?
            ): WebResourceResponse? {
                val url = request?.url ?: return null
                return assetLoader.shouldInterceptRequest(url)
            }

            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: return false
                if (url.startsWith("tel:")) {
                    val clean = url.substring(4).replace(Regex("[^0-9+]"), "")
                    val hasPerm = checkSelfPermission(Manifest.permission.CALL_PHONE) == PackageManager.PERMISSION_GRANTED
                    val intent = if (hasPerm) {
                        Intent(Intent.ACTION_CALL, Uri.parse("tel:$clean"))
                    } else {
                        Intent(Intent.ACTION_DIAL, Uri.parse("tel:$clean"))
                    }
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    try {
                        startActivity(intent)
                    } catch (_: Exception) {
                        val fallback = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$clean")).apply {
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        }
                        startActivity(fallback)
                    }
                    return true
                }
                if (url.startsWith("mailto:") || url.startsWith("https://t.me/")) {
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                    startActivity(intent)
                    return true
                }
                val uri = request?.url ?: return true
                if (uri.scheme == "https" && uri.host == "appassets.androidplatform.net") return false
                if (uri.scheme == "https" || uri.scheme == "http") {
                    startActivity(Intent(this@MainActivity, WebShieldActivity::class.java).putExtra("url", url))
                }
                // Keep arbitrary websites out of the WebView holding the native bridge.
                return true
            }
        }
    }

    override fun onBackPressed() {
        if (LockdownManager.isLocked(this)) {
            val intent = Intent(this, LockdownActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
            }
            startActivity(intent)
            return
        }
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    override fun onPause() {
        super.onPause()
        webView.onPause()
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
        if (LockdownManager.isLocked(this)) {
            val intent = Intent(this, LockdownActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
            startActivity(intent)
        }
    }

    override fun onTrimMemory(level: Int) {
        super.onTrimMemory(level)
        if (level >= TRIM_MEMORY_MODERATE) {
            webView.clearCache(false)
        }
    }

    override fun onLowMemory() {
        super.onLowMemory()
        webView.clearCache(false)
    }
}
