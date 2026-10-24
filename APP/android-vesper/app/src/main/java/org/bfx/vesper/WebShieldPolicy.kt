package org.bfx.vesper

import java.net.IDN
import java.net.URI
import java.net.URLDecoder
import java.util.Locale

/** Shared by address entry, navigation, redirects and the network loader. */
class WebShieldPolicy(
    private val phishing: Set<String>,
    private val gambling: Set<String>,
    private val rules: List<Rule> = emptyList(),
    private val blockGambling: Boolean = true
) {
    data class Address(val url: String, val host: String, val path: String)
    data class Rule(val host: String, val path: String, val scope: String) {
        val label: String get() = host + if (scope == "domain") " (whole website)" else path + if (scope == "section") " (section)" else " (page)"
    }
    data class Decision(val address: Address?, val reason: String?) {
        val blocked: Boolean get() = reason != null
    }

    fun check(raw: String): Decision {
        val a = parse(raw) ?: return Decision(null, "Unsupported address. Enter a public HTTP or HTTPS website. App links, files and disguised addresses are blocked.")
        if (rules.any { matches(it, a) }) return Decision(a, "Blocked by your custom website or page rule.")
        if (listed(a.host, phishing)) return Decision(a, "This domain is on the bundled phishing blocklist.")
        if (blockGambling && listed(a.host, gambling)) return Decision(a, "Gambling websites are blocked in Web Shield.")
        if (a.host == "blocked.vesper.test") return Decision(a, "Demonstration: this test domain is blocked. No harmful website was contacted.")
        if (a.path.lowercase(Locale.ROOT).endsWith(".apk")) return Decision(a, "APK downloads are blocked in Web Shield.")
        return Decision(a, null)
    }

    companion object {
        private fun listed(host: String, domains: Set<String>): Boolean {
            var h = host
            while (h.contains('.')) {
                if (domains.contains(h)) return true
                h = h.substringAfter('.')
            }
            return false
        }

        fun matches(rule: Rule, address: Address): Boolean {
            val sameHost = address.host == rule.host || address.host.endsWith("." + rule.host)
            if (!sameHost) return false
            return when (rule.scope) {
                "domain" -> true
                "section" -> rule.path == "/" || address.path == rule.path || address.path.startsWith(rule.path + "/")
                "page" -> address.path == rule.path
                else -> false
            }
        }

        fun rule(raw: String, scope: String): Rule? {
            if (scope !in setOf("domain", "section", "page")) return null
            val a = parse(raw) ?: return null
            return Rule(a.host.removePrefix("www."), if (scope == "domain") "/" else a.path, scope)
        }

        fun parse(raw: String): Address? = try {
            val trimmed = raw.trim()
            require(trimmed.isNotEmpty() && trimmed.length <= 4096)
            require(!trimmed.any { it.isISOControl() } && !trimmed.contains('\\'))
            val text = if (trimmed.startsWith("//")) "https:$trimmed" else if (Regex("^[a-zA-Z][a-zA-Z0-9+.-]*:").containsMatchIn(trimmed)) trimmed else "https://$trimmed"
            val u = URI(text)
            val scheme = u.scheme?.lowercase(Locale.ROOT)
            require(scheme == "https" || scheme == "http")
            val authority = u.rawAuthority ?: error("No host")
            require(!authority.contains('@') && !authority.contains('%') && !authority.contains('['))
            val hostPart = authority.substringBefore(':').trimEnd('.')
            val host = IDN.toASCII(hostPart, IDN.USE_STD3_ASCII_RULES).lowercase(Locale.ROOT)
            require(host.length <= 253 && host.contains('.') && host.split('.').all { it.isNotEmpty() && it.length <= 63 })
            require(!Regex("[0-9.]+").matches(host) && !host.startsWith("0x"))
            if (authority.contains(':')) {
                val port = authority.substringAfter(':').toIntOrNull()
                require(port == 80 && scheme == "http" || port == 443 && scheme == "https")
            }
            var path = u.rawPath.orEmpty().ifEmpty { "/" }
            repeat(4) { if (path.contains('%')) path = URLDecoder.decode(path.replace("+", "%2B"), "UTF-8") }
            require(!path.contains('%') && !path.contains('\\') && !path.any { it.isISOControl() })
            val segments = mutableListOf<String>()
            for (part in path.split('/')) when (part) {
                "", "." -> Unit
                ".." -> if (segments.isNotEmpty()) segments.removeAt(segments.lastIndex)
                else -> segments.add(part)
            }
            val normalizedPath = "/" + segments.joinToString("/")
            val normalizedUrl = "$scheme://$host${u.rawPath.orEmpty().ifEmpty { "/" }}${u.rawQuery?.let { "?$it" }.orEmpty()}${u.rawFragment?.let { "#$it" }.orEmpty()}"
            Address(normalizedUrl, host, normalizedPath)
        } catch (_: Exception) { null }
    }
}
