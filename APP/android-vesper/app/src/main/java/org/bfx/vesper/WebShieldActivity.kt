package org.bfx.vesper

import android.annotation.SuppressLint
import android.app.AlertDialog
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color
import android.net.http.SslError
import android.os.Bundle
import android.os.Build
import android.text.InputType
import android.view.View
import android.view.inputmethod.EditorInfo
import android.webkit.*
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.activity.OnBackPressedCallback
import java.io.ByteArrayInputStream
import java.util.concurrent.atomic.AtomicInteger

class WebShieldActivity : AppCompatActivity() {
    private lateinit var browser: WebView
    private lateinit var content: FrameLayout
    private lateinit var address: EditText
    private lateinit var status: TextView
    private lateinit var progress: ProgressBar
    private lateinit var store: WebShieldStore
    @Volatile private var policy: WebShieldPolicy? = null
    private var phishing = emptySet<String>()
    private var gambling = emptySet<String>()
    private var currentUrl = ""
    private var blockedUrl = ""
    private var redirectCount = 0
    private val navigation = AtomicInteger()
    private val ink = Color.rgb(24, 47, 44)
    private val paper = Color.rgb(247, 247, 239)
    private val network = WebShieldNetwork()
    private var initialized = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() { if (currentUrl.isNotEmpty() || blockedUrl.isNotEmpty()) showHome() else finish() }
        })
        store = WebShieldStore(this)
        val root = column()
        root.setBackgroundColor(paper)
        val bar = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        bar.addView(button("Home") { showHome() })
        bar.addView(label("Web Shield", 21), LinearLayout.LayoutParams(0, -2, 1f))
        bar.addView(button("Rules") { authorize { settings() } })
        root.addView(bar)
        val entry = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        address = EditText(this).apply {
            hint = "Enter a website address"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI
            isSingleLine = true
            imeOptions = EditorInfo.IME_ACTION_GO
            setTextColor(ink)
            setOnEditorActionListener { _, action, _ -> if (action == EditorInfo.IME_ACTION_GO) { navigate(text.toString()); true } else false }
        }
        entry.addView(address, LinearLayout.LayoutParams(0, -2, 1f))
        entry.addView(button("Open") { navigate(address.text.toString()) })
        root.addView(entry)
        status = label("Loading protection lists…", 13)
        status.setPadding(dp(12), dp(6), dp(12), dp(6))
        root.addView(status)
        progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal)
        root.addView(progress, LinearLayout.LayoutParams(-1, dp(3)))
        content = FrameLayout(this)
        root.addView(content, LinearLayout.LayoutParams(-1, 0, 1f))
        setContentView(root)
        browser = WebView(this)
        configureBrowser()
        showHome()
        Thread {
            try {
                phishing = readDomains("phishing.txt")
                gambling = readDomains("gambling.txt")
                check(phishing.size > 1000 && gambling.size > 1000)
                runOnUiThread {
                    if (isFinishing || isDestroyed) return@runOnUiThread
                    rebuildPolicy()
                    initialized = true
                    val incoming = incomingUrl(intent)
                    if (incoming.isNullOrBlank()) showHome() else navigate(incoming)
                }
            } catch (_: Exception) {
                runOnUiThread { if (!isFinishing && !isDestroyed) showBlocked("", "Protection lists could not be loaded. Browsing remains disabled. Reinstall the APK to restore the bundled lists.") }
            }
        }.start()
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        incomingUrl(intent)?.let { if (initialized) navigate(it) }
    }

    override fun onResume() {
        super.onResume()
        if (LockdownManager.isLocked(this)) finish()
    }

    private fun incomingUrl(intent: Intent?): String? {
        if (intent?.action == Intent.ACTION_SEND) {
            val shared = intent.getStringExtra(Intent.EXTRA_TEXT).orEmpty()
            return Regex("https?://[^\\s<>]+", RegexOption.IGNORE_CASE).find(shared)?.value ?: shared
        }
        return intent?.dataString ?: intent?.getStringExtra("url")
    }

    private fun readDomains(name: String): Set<String> = assets.open("webshield/$name").bufferedReader().useLines { lines ->
        lines.map { it.trim().lowercase() }.filter { it.isNotEmpty() && !it.startsWith('#') && it.matches(Regex("[a-z0-9_.-]+")) }.toHashSet()
    }

    private fun rebuildPolicy() { policy = WebShieldPolicy(phishing, gambling, store.rules(), store.blockGambling) }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureBrowser() {
        browser.settings.apply {
            javaScriptEnabled = false
            domStorageEnabled = false
            allowFileAccess = false
            allowContentAccess = false
            blockNetworkLoads = true // All allowed GET requests go through our checked loader.
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            cacheMode = WebSettings.LOAD_NO_CACHE
            safeBrowsingEnabled = true
            javaScriptCanOpenWindowsAutomatically = false
            setSupportMultipleWindows(true)
            builtInZoomControls = true
            displayZoomControls = false
        }
        // This WebView never receives the app's privileged VesperNative bridge.
        browser.setDownloadListener { url, _, _, _, _ -> showBlocked(url, "Downloads are blocked in Web Shield.") }
        browser.webChromeClient = object : WebChromeClient() {
            override fun onCreateWindow(view: WebView?, dialog: Boolean, gesture: Boolean, message: android.os.Message?): Boolean {
                status.text = "Pop-up stopped. Open a website using the address bar."
                return false
            }
            override fun onPermissionRequest(request: PermissionRequest?) { request?.deny() }
            override fun onProgressChanged(view: WebView?, value: Int) { progress.progress = value; progress.visibility = if (value < 100) View.VISIBLE else View.GONE }
        }
        browser.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                if (request == null) return true
                if (request.isForMainFrame) navigate(request.url.toString(), redirect = request.isRedirect)
                return true
            }
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                val decision = policy?.check(url.orEmpty())
                if (decision == null || decision.blocked) showBlocked(url.orEmpty(), decision?.reason ?: "Protection is still loading.")
                else { address.setText(url); status.text = "Protected browsing • scripts, forms and downloads disabled" }
            }
            override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest?): WebResourceResponse {
                if (request == null) return emptyResponse()
                val token = navigation.get()
                val url = request.url.toString()
                val activePolicy = policy ?: return emptyResponse()
                if (request.method != "GET") {
                    if (request.isForMainFrame) postBlock(token, url, "Form submissions are disabled in protected browsing.")
                    return emptyResponse()
                }
                val decision = activePolicy.check(url)
                if (decision.blocked) {
                    if (request.isForMainFrame) postBlock(token, url, decision.reason!!)
                    return emptyResponse()
                }
                if (decision.address?.host == "demo.vesper.invalid") return demoResponse(request, token)
                return try {
                    when (val result = network.load(url, request.isForMainFrame, activePolicy)) {
                        is WebShieldNetwork.Result.Block -> {
                            if (request.isForMainFrame) postBlock(token, result.url, result.reason)
                            emptyResponse()
                        }
                        is WebShieldNetwork.Result.Redirect -> {
                            runOnUiThread { if (token == navigation.get()) navigate(result.url, redirect = true) }
                            emptyResponse()
                        }
                        is WebShieldNetwork.Result.Page -> WebResourceResponse(result.mime, result.encoding, 200, "OK", securityHeaders(), ByteArrayInputStream(result.bytes))
                    }
                } catch (_: Exception) {
                    if (request.isForMainFrame) postBlock(token, url, "The page could not be loaded securely. Check your connection or try another address.")
                    emptyResponse()
                }
            }
            override fun onReceivedSslError(view: WebView?, handler: SslErrorHandler?, error: SslError?) {
                handler?.cancel()
                showBlocked(error?.url.orEmpty(), "The website's secure connection could not be verified.")
            }
            override fun onSafeBrowsingHit(view: WebView?, request: WebResourceRequest?, threatType: Int, callback: SafeBrowsingResponse?) {
                if (Build.VERSION.SDK_INT >= 27) callback?.backToSafety(true)
                showBlocked(request?.url.toString(), "Android Safe Browsing flagged this destination as unsafe.")
            }
            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                if (request?.isForMainFrame == true && blockedUrl.isEmpty()) showBlocked(request.url.toString(), "This page could not be opened. Protected browsing remains active.")
            }
        }
    }

    private fun securityHeaders() = mapOf(
        "Cache-Control" to "no-store",
        "X-Content-Type-Options" to "nosniff",
        "Content-Security-Policy" to "default-src 'none'; img-src http: https: data:; style-src http: https: 'unsafe-inline'; font-src http: https:; base-uri 'self'; form-action 'none'; frame-src 'none'; object-src 'none'"
    )
    private fun emptyResponse() = WebResourceResponse("text/plain", "UTF-8", 403, "Blocked", securityHeaders(), ByteArrayInputStream(ByteArray(0)))
    private fun postBlock(token: Int, url: String, reason: String) { runOnUiThread { if (token == navigation.get()) showBlocked(url, reason) } }

    private fun navigate(raw: String, redirect: Boolean = false) {
        val activePolicy = policy ?: run { Toast.makeText(this, "Wait for protection lists to finish loading.", Toast.LENGTH_SHORT).show(); return }
        if (LockdownManager.isLocked(this)) { finish(); return }
        if (redirect) redirectCount++ else redirectCount = 0
        if (redirectCount > 8) { showBlocked(raw, "Too many redirects. Navigation stopped."); return }
        val decision = activePolicy.check(raw)
        if (decision.blocked) { showBlocked(raw, decision.reason!!); return }
        navigation.incrementAndGet()
        currentUrl = decision.address!!.url
        blockedUrl = ""
        browser.stopLoading()
        content.removeAllViews()
        content.addView(browser, FrameLayout.LayoutParams(-1, -1))
        address.setText(currentUrl)
        status.text = "Checking destination…"
        browser.loadUrl(currentUrl)
    }

    private fun showBlocked(url: String, reason: String) {
        navigation.incrementAndGet()
        browser.stopLoading()
        blockedUrl = url.ifEmpty { "unknown" }
        progress.visibility = View.GONE
        content.removeAllViews()
        val panel = column().apply { setPadding(dp(24), dp(28), dp(24), dp(20)) }
        panel.addView(label("PAGE BLOCKED", 14).apply { setTextColor(Color.rgb(162, 37, 37)) })
        panel.addView(label("This page cannot open", 28))
        panel.addView(label(reason, 18))
        if (url.isNotBlank()) panel.addView(label(url.take(350), 14).apply { setTextIsSelectable(true) })
        panel.addView(label("There is no bypass button. A guardian can review custom rules from Rules.", 15))
        panel.addView(button("Back to Web Shield") { showHome() })
        content.addView(ScrollView(this).apply { addView(panel) })
        address.setText(url)
        status.text = "Blocked • protection remains active"
    }

    private fun showHome() {
        navigation.incrementAndGet()
        browser.stopLoading()
        currentUrl = ""
        blockedUrl = ""
        redirectCount = 0
        content.removeAllViews()
        address.setText("")
        progress.visibility = View.GONE
        val panel = column().apply { setPadding(dp(22), dp(18), dp(22), dp(18)) }
        panel.addView(label("A safer place to open links", 27))
        panel.addView(label("Protection applies to websites opened here. It does not block Chrome or other apps.", 16))
        panel.addView(label(if (policy == null) "Loading default protection…" else "${"%,d".format(phishing.size)} phishing domains\n${"%,d".format(gambling.size)} gambling domains ${if (store.blockGambling) "blocked" else "available in Rules"}\n${store.rules().size} custom rules", 19))
        panel.addView(label("Default lists: Block List Project. Bundled snapshot: 23 October 2026. New or unlisted threats may not be detected.", 13))
        panel.addView(button(if (store.hasPin) "Manage blocked websites / pages" else "Set guardian PIN & add blocked pages") { authorize { settings() } })
        panel.addView(button("Try safe blocking demo") { navigate("https://demo.vesper.invalid/") })
        panel.addView(label("Strict browsing", 19))
        panel.addView(label("Scripts, forms, pop-ups, embedded frames, downloads and app launches are disabled. Some interactive sites will not work. Website and page rules also apply to redirects.", 15))
        panel.addView(button("Return to Vesper") { finish() })
        content.addView(ScrollView(this).apply { addView(panel) })
        status.text = if (policy == null) "Loading protection lists…" else "Web Shield active • ${if (store.blockGambling) "gambling blocked" else "phishing protection on"}"
    }

    private fun demoResponse(request: WebResourceRequest, token: Int): WebResourceResponse {
        val path = request.url.path
        if (path == "/redirect") {
            runOnUiThread { if (token == navigation.get()) navigate("https://blocked.vesper.test/", redirect = true) }
            return emptyResponse()
        }
        val html = """<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:20px sans-serif;padding:24px;background:#f7f7ef;color:#182f2c}a{display:block;padding:18px;margin:16px 0;background:#e1eee6;color:#124d37;border-radius:12px}</style><h1>Web Shield test page</h1><p>This is a safe, offline demonstration.</p><a href="https://blocked.vesper.test/">1. Try a blocked direct link</a><a href="https://demo.vesper.invalid/redirect">2. Try a blocked redirect</a><a href="https://demo.vesper.invalid/private">3. Test a custom page rule</a><p>For test 3, add demo.vesper.invalid/private in Rules → One page. Other pages on this demo website stay available.</p>"""
        return WebResourceResponse("text/html", "UTF-8", 200, "OK", securityHeaders(), ByteArrayInputStream(html.toByteArray()))
    }

    private fun authorize(onSuccess: () -> Unit) {
        if (!store.hasPin) { setPin(onSuccess); return }
        if (store.retryAfter > 0) { message("Try again later", "Too many incorrect PINs. Wait ${(store.retryAfter / 1000) + 1} seconds."); return }
        val input = pinInput("Guardian PIN")
        val dialog = AlertDialog.Builder(this).setTitle("Guardian access").setView(input).setNegativeButton("Cancel", null).setPositiveButton("Unlock", null).create()
        dialog.setOnShowListener {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                if (store.verifyPin(input.text.toString())) { dialog.dismiss(); onSuccess() }
                else { input.error = "Incorrect PIN"; input.text.clear(); if (store.retryAfter > 0) { dialog.dismiss(); message("Temporarily locked", "Five incorrect attempts. Try again in five minutes.") } }
            }
        }
        dialog.show()
    }

    private fun setPin(onSuccess: () -> Unit) {
        val panel = column().apply { setPadding(dp(20), dp(8), dp(20), dp(8)) }
        panel.addView(label("Choose a separate six-digit PIN for Web Shield rules. Keep it with the guardian; there is no built-in recovery code.", 15))
        val first = pinInput("New PIN"); val second = pinInput("Repeat PIN")
        panel.addView(first); panel.addView(second)
        val dialog = AlertDialog.Builder(this).setTitle("Set Web Shield PIN").setView(panel).setNegativeButton("Cancel", null).setPositiveButton("Save PIN", null).create()
        dialog.setOnShowListener { dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
            val pin = first.text.toString()
            if (!pin.matches(Regex("[0-9]{6}"))) first.error = "Enter exactly six digits"
            else if (pin != second.text.toString()) second.error = "PINs do not match"
            else { store.setPin(pin); dialog.dismiss(); onSuccess() }
        } }
        dialog.show()
    }

    private fun settings() {
        val items = arrayOf("Add blocked website / page", "View or remove custom rules (${store.rules().size})", "Gambling: ${if (store.blockGambling) "ON — tap to turn off" else "OFF — tap to turn on"}", "Change guardian PIN", "Blocklist sources")
        AlertDialog.Builder(this).setTitle("Web Shield rules").setItems(items) { _, index -> when (index) {
            0 -> addRule()
            1 -> removeRule()
            2 -> { store.blockGambling = !store.blockGambling; rebuildPolicy(); showHome() }
            3 -> setPin { showHome() }
            4 -> message("Default blocklists", "Block List Project — public-domain lists.\nhttps://github.com/blocklistproject/Lists\n\nBundled on 23 October 2026; this version uses an offline snapshot. Phishing protection cannot be switched off. Gambling is a separate category. All matches include subdomains.\n\nPage rules ignore query strings and fragments so adding tracking parameters cannot bypass a rule.")
        } }.setNegativeButton("Close", null).show()
    }

    private fun addRule() {
        val panel = column().apply { setPadding(dp(20), dp(8), dp(20), dp(8)) }
        val input = EditText(this).apply { hint = "example.com or example.com/page"; inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI; setText(if (currentUrl.isNotEmpty()) currentUrl else "") }
        panel.addView(input)
        val group = RadioGroup(this)
        val optionIds = List(3) { View.generateViewId() }
        listOf("Whole website + subdomains", "Section + pages beneath it", "One page (all query variations)").forEachIndexed { i, title -> group.addView(RadioButton(this).apply { id = optionIds[i]; text = title; textSize = 16f }) }
        group.check(optionIds[0]); panel.addView(group)
        val dialog = AlertDialog.Builder(this).setTitle("Add a blocked destination").setView(panel).setNegativeButton("Cancel", null).setPositiveButton("Block", null).create()
        dialog.setOnShowListener { dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
            val scope = listOf("domain", "section", "page")[optionIds.indexOf(group.checkedRadioButtonId).coerceAtLeast(0)]
            val rule = WebShieldPolicy.rule(input.text.toString(), scope)
            if (rule == null) input.error = "Enter a valid public website address"
            else { store.saveRules(store.rules() + rule); rebuildPolicy(); dialog.dismiss(); showHome(); Toast.makeText(this, "Blocked: ${rule.label}", Toast.LENGTH_LONG).show() }
        } }
        dialog.show()
    }

    private fun removeRule() {
        val rules = store.rules()
        if (rules.isEmpty()) { message("Custom rules", "No custom rules yet. Default phishing and gambling lists are already active."); return }
        AlertDialog.Builder(this).setTitle("Select a rule to remove").setItems(rules.map { it.label }.toTypedArray()) { _, i ->
            AlertDialog.Builder(this).setTitle("Remove this rule?").setMessage(rules[i].label).setNegativeButton("Keep blocked", null).setPositiveButton("Remove") { _, _ ->
                store.saveRules(rules.filterIndexed { index, _ -> index != i }); rebuildPolicy(); showHome()
            }.show()
        }.setNegativeButton("Close", null).show()
    }

    private fun message(title: String, body: String) { AlertDialog.Builder(this).setTitle(title).setMessage(body).setPositiveButton("OK", null).show() }
    private fun pinInput(hintText: String) = EditText(this).apply { hint = hintText; inputType = InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_VARIATION_PASSWORD; filters = arrayOf(android.text.InputFilter.LengthFilter(6)) }
    private fun column() = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
    private fun label(value: String, size: Int) = TextView(this).apply { text = value; textSize = size.toFloat(); setTextColor(ink); setPadding(dp(8), dp(10), dp(8), dp(10)) }
    private fun button(value: String, action: () -> Unit) = Button(this).apply { text = value; isAllCaps = false; minHeight = dp(52); setOnClickListener { action() } }
    private fun dp(n: Int): Int = (n * resources.displayMetrics.density).toInt()
    override fun onDestroy() { navigation.incrementAndGet(); browser.stopLoading(); content.removeAllViews(); browser.destroy(); super.onDestroy() }
}
