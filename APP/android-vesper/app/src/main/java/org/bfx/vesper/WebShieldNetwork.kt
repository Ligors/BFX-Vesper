package org.bfx.vesper

import java.net.HttpURLConnection
import java.net.URI
import java.net.URL

/** Redirects are checked before opening the next connection. No WebView network fallback. */
class WebShieldNetwork(private val connect: (String) -> HttpURLConnection = { URL(it).openConnection() as HttpURLConnection }) {
    sealed class Result {
        data class Page(val bytes: ByteArray, val mime: String, val encoding: String, val url: String) : Result()
        data class Redirect(val url: String) : Result()
        data class Block(val url: String, val reason: String) : Result()
    }

    fun load(raw: String, mainFrame: Boolean, policy: WebShieldPolicy): Result {
        var next = raw
        val visited = hashSetOf<String>()
        repeat(9) {
            val decision = policy.check(next)
            if (decision.blocked) return Result.Block(next, decision.reason!!)
            val url = decision.address!!.url
            if (!visited.add(url)) return Result.Block(url, "Redirect loop stopped.")
            val connection = connect(url)
            try {
                connection.instanceFollowRedirects = false
                connection.connectTimeout = 10_000
                connection.readTimeout = 10_000
                connection.useCaches = false
                connection.requestMethod = "GET"
                connection.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36 VesperWebShield/1.0")
                connection.setRequestProperty("Accept-Encoding", "identity")
                val status = connection.responseCode
                if (status in setOf(301, 302, 303, 307, 308)) {
                    val location = connection.getHeaderField("Location") ?: return Result.Block(url, "The website returned an invalid redirect.")
                    next = URI(url).resolve(location).toString()
                    val target = policy.check(next)
                    if (target.blocked) return Result.Block(next, "Redirect stopped. " + target.reason)
                    if (mainFrame) return Result.Redirect(target.address!!.url)
                } else {
                    if (status !in 200..299) return Result.Block(url, "The website returned HTTP $status. Nothing was opened.")
                    if (connection.getHeaderField("Content-Disposition")?.contains("attachment", true) == true) return Result.Block(url, "Downloads are blocked in Web Shield.")
                    val type = connection.contentType.orEmpty()
                    val mime = type.substringBefore(';').trim().lowercase()
                    val permitted = mime in setOf("text/html", "text/plain", "text/css", "application/xhtml+xml") || mime.startsWith("image/") || mime.startsWith("font/")
                    if (!permitted) return Result.Block(url, "This content type is not supported in protected browsing. Downloads are blocked.")
                    val encoding = Regex("charset=([^; ]+)", RegexOption.IGNORE_CASE).find(type)?.groupValues?.get(1)?.trim('"', '\'') ?: "UTF-8"
                    val bytes = connection.inputStream.use { input ->
                        val out = java.io.ByteArrayOutputStream()
                        val buffer = ByteArray(8192)
                        while (true) {
                            val count = input.read(buffer)
                            if (count < 0) break
                            if (out.size() + count > 6 * 1024 * 1024) return Result.Block(url, "This page or file is too large for protected browsing.")
                            out.write(buffer, 0, count)
                        }
                        out.toByteArray()
                    }
                    return Result.Page(bytes, mime, encoding, url)
                }
            } finally { connection.disconnect() }
        }
        return Result.Block(next, "Too many redirects. Navigation stopped.")
    }
}
