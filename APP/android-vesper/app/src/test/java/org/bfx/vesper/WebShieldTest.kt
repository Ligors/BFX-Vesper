package org.bfx.vesper

import org.junit.Assert.*
import org.junit.Test
import java.io.ByteArrayInputStream
import java.net.HttpURLConnection
import java.net.URL

class WebShieldTest {
    private fun policy(rules: List<WebShieldPolicy.Rule> = emptyList(), gambling: Boolean = true) =
        WebShieldPolicy(setOf("phish.example"), setOf("bets.example"), rules, gambling)

    @Test fun directPhishingAndSubdomainsBlocked() {
        for (url in listOf("phish.example", "https://login.phish.example/a", "HTTP://PHISH.EXAMPLE./", "https://phish.example:443/")) assertTrue(url, policy().check(url).blocked)
    }
    @Test fun innocentLookalikesAreNotOverblocked() {
        for (url in listOf("https://notphish.example", "https://phish.example.innocent.example", "https://example.org")) assertFalse(url, policy().check(url).blocked)
    }
    @Test fun gamblingSwitchDoesNotDisablePhishing() {
        assertTrue(policy().check("bets.example").blocked)
        assertFalse(policy(gambling = false).check("bets.example").blocked)
        assertTrue(policy(gambling = false).check("phish.example").blocked)
    }
    @Test fun pageRuleAllowsOtherPagesButCoversTrackingAndSubdomains() {
        val p = policy(listOf(WebShieldPolicy.rule("example.org/private", "page")!!))
        for (url in listOf("example.org/private", "example.org/private/", "example.org/private?ref=123#top", "www.example.org/private")) assertTrue(url, p.check(url).blocked)
        assertFalse(p.check("example.org/public").blocked)
        assertFalse(p.check("example.org/private-other").blocked)
    }
    @Test fun encodedPathsCannotBypassCustomRule() {
        val p = policy(listOf(WebShieldPolicy.rule("example.org/private", "page")!!))
        for (url in listOf("https://example.org/%70rivate", "https://example.org/%2570rivate", "https://example.org/a/../private", "https://example.org/a/%2e%2e/private", "https://example.org//private")) assertTrue(url, p.check(url).blocked)
    }
    @Test fun sectionHasPathBoundary() {
        val p = policy(listOf(WebShieldPolicy.rule("example.org/bet", "section")!!))
        assertTrue(p.check("example.org/bet").blocked)
        assertTrue(p.check("example.org/bet/sports").blocked)
        assertFalse(p.check("example.org/better").blocked)
    }
    @Test fun wholeDomainIncludesWwwAndDeepSubdomains() {
        val p = policy(listOf(WebShieldPolicy.rule("www.example.org/something", "domain")!!))
        assertTrue(p.check("example.org").blocked)
        assertTrue(p.check("a.b.example.org/other").blocked)
    }
    @Test fun internationalDomainNormalizesToPunycode() {
        val rule = WebShieldPolicy.rule("https://bücher.example/path", "domain")!!
        assertEquals("xn--bcher-kva.example", rule.host)
        assertTrue(policy(listOf(rule)).check("https://xn--bcher-kva.example").blocked)
    }
    @Test fun unsupportedAndDisguisedUrlsFailClosed() {
        for (url in listOf("javascript:alert(1)", "intent://example.org", "file:///etc/passwd", "data:text/html,hello", "https://good.example@bad.example/", "https://evil%2eexample/", "https://127.0.0.1/", "https://[::1]/", "https://example.org:8080/", "https://example.org/\\private", "https://example.org/%00", "https://example.org/%ZZ", "")) assertTrue(url, policy().check(url).blocked)
    }
    @Test fun apkDownloadAndDemoDomainBlocked() {
        assertTrue(policy().check("https://example.org/update.APK?download=1").blocked)
        assertTrue(policy().check("https://blocked.vesper.test").blocked)
    }
    @Test fun ruleRejectsUnknownScopeAndInvalidUrl() {
        assertNull(WebShieldPolicy.rule("example.org", "anything"))
        assertNull(WebShieldPolicy.rule("javascript:foo()", "domain"))
    }

    private data class Response(val code: Int = 200, val location: String? = null, val mime: String = "text/html; charset=UTF-8", val disposition: String? = null)
    private fun network(responses: Map<String, Response>, opened: MutableList<String>): WebShieldNetwork = WebShieldNetwork { url ->
        opened.add(url)
        val r = responses[url] ?: error("Unexpected network request: $url")
        object : HttpURLConnection(URL(url)) {
            override fun connect() {}
            override fun disconnect() {}
            override fun usingProxy() = false
            override fun getResponseCode() = r.code
            override fun getContentType() = r.mime
            override fun getHeaderField(name: String?) = when (name) { "Location" -> r.location; "Content-Disposition" -> r.disposition; else -> null }
            override fun getInputStream() = ByteArrayInputStream("<p>Allowed</p>".toByteArray())
        }
    }

    @Test fun blockedDirectRequestNeverTouchesNetwork() {
        val opened = mutableListOf<String>()
        val result = network(emptyMap(), opened).load("https://phish.example/", true, policy())
        assertTrue(result is WebShieldNetwork.Result.Block)
        assertTrue(opened.isEmpty())
    }
    @Test fun serverRedirectToBlockedDomainStopsBeforeTargetConnection() {
        val opened = mutableListOf<String>()
        val result = network(mapOf("https://good.example/" to Response(302, "https://phish.example/")), opened).load("https://good.example/", true, policy())
        assertTrue(result is WebShieldNetwork.Result.Block)
        assertEquals(listOf("https://good.example/"), opened)
    }
    @Test fun redirectToCustomPageStopsBeforeTargetConnection() {
        val opened = mutableListOf<String>()
        val p = policy(listOf(WebShieldPolicy.rule("good.example/private", "page")!!))
        val result = network(mapOf("https://good.example/" to Response(307, "/%70rivate?tracking=1")), opened).load("https://good.example/", true, p)
        assertTrue(result is WebShieldNetwork.Result.Block)
        assertEquals(1, opened.size)
    }
    @Test fun safeMainRedirectReturnsNewUrlForCorrectBrowserOrigin() {
        val opened = mutableListOf<String>()
        val result = network(mapOf("https://good.example/" to Response(301, "/news")), opened).load("https://good.example/", true, policy())
        assertEquals(WebShieldNetwork.Result.Redirect("https://good.example/news"), result)
        assertEquals(1, opened.size)
    }
    @Test fun resourceRedirectChainAlsoChecksEveryDestination() {
        val opened = mutableListOf<String>()
        val result = network(mapOf("https://good.example/a" to Response(302, "/b"), "https://good.example/b" to Response(308, "https://bets.example/")), opened).load("https://good.example/a", false, policy())
        assertTrue(result is WebShieldNetwork.Result.Block)
        assertEquals(listOf("https://good.example/a", "https://good.example/b"), opened)
    }
    @Test fun resourceRedirectLoopTerminates() {
        val opened = mutableListOf<String>()
        val result = network(mapOf("https://good.example/a" to Response(302, "/b"), "https://good.example/b" to Response(302, "/a")), opened).load("https://good.example/a", false, policy())
        assertTrue(result is WebShieldNetwork.Result.Block)
        assertEquals(2, opened.size)
    }
    @Test fun externalAppRedirectIsBlocked() {
        val opened = mutableListOf<String>()
        val result = network(mapOf("https://good.example/" to Response(302, "intent://launch/app")), opened).load("https://good.example/", true, policy())
        assertTrue(result is WebShieldNetwork.Result.Block)
        assertEquals(1, opened.size)
    }
    @Test fun attachmentCannotOpenAsPage() {
        val result = network(mapOf("https://good.example/" to Response(disposition = "attachment; filename=download.html")), mutableListOf()).load("https://good.example/", true, policy())
        assertTrue(result is WebShieldNetwork.Result.Block)
    }
    @Test fun unknownBinaryContentIsBlocked() {
        val result = network(mapOf("https://good.example/" to Response(mime = "application/octet-stream")), mutableListOf()).load("https://good.example/", true, policy())
        assertTrue(result is WebShieldNetwork.Result.Block)
    }
    @Test fun normalHtmlCanLoad() {
        val result = network(mapOf("https://good.example/" to Response()), mutableListOf()).load("https://good.example/", true, policy())
        assertTrue(result is WebShieldNetwork.Result.Page)
    }
}
