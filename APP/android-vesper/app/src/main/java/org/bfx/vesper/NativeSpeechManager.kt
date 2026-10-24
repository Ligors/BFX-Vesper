package org.bfx.vesper

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.telephony.TelephonyManager
import android.util.Log
import androidx.core.content.ContextCompat
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.atomic.AtomicBoolean

/**
 * NativeSpeechManager — High-reliability speech transcription for BFX Vesper Call Guard.
 *
 * Dedicated to capturing and transcribing the CALLER'S VOICE from the loudspeaker during calls,
 * as well as user speech.
 *
 * Audio Pipeline:
 *   AudioRecord(UNPROCESSED/MIC) → 2.5x Digital Gain Boost → 16-bit PCM WAV Chunks
 *   → Groq Whisper Large V3 Turbo (Primed with Cyber Crime terms) → Real-Time Scam Detection UI
 */
class NativeSpeechManager(private val context: Context) {

    companion object {
        private const val TAG = "NativeSpeechManager"
        private const val GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions"
        private const val GROQ_KEY = "" // BYOK: Set via app settings or build config
        private const val SAMPLE_RATE = 16000
        private const val CHUNK_SECONDS = 2 // 2-second fast chunks for real-time response
        private const val CHUNK_SAMPLES = SAMPLE_RATE * CHUNK_SECONDS
        private const val RMS_MIN_THRESHOLD = 2.0  // Extremely sensitive: capture quiet speech
        private const val PEAK_MIN_THRESHOLD = 50  // Minimum absolute peak amplitude
    }

    private val handler = Handler(Looper.getMainLooper())
    private val recording = AtomicBoolean(false)
    @Volatile private var listening = false
    private var lang = "en-IN"

    private var audioRecord: AudioRecord? = null
    private var recThread: Thread? = null
    private var speechRec: SpeechRecognizer? = null

    var onSpeechResultListener: ((String, Boolean) -> Unit)? = null
    var onStatusListener: ((String) -> Unit)? = null

    /** Entry point — called from JS via VesperNativeBridge */
    fun startListening(langTag: String = "en-IN") {
        handler.post {
            try {
                lang = normLang(langTag)
                listening = true
                stopAll()
                onStatusListener?.invoke("starting")

                Log.i(TAG, "Starting Native Speech Manager ($lang)")

                val tm = context.getSystemService(Context.TELEPHONY_SERVICE) as? TelephonyManager
                val isCallActive = tm?.callState != TelephonyManager.CALL_STATE_IDLE

                if (isCallActive) {
                    // Active cellular call: route to speakerphone and use AudioRecord pipeline to capture caller voice
                    AudioRoutingHelper.routeToSpeakerphone(context)
                    AudioRoutingHelper.forceRerouteToSpeakerphone(context, 400L)
                    AudioRoutingHelper.forceRerouteToSpeakerphone(context, 900L)
                    onStatusListener?.invoke("listening")

                    if (!startRecordPipeline()) {
                        Log.w(TAG, "AudioRecord init failed → falling back to Google SpeechRecognizer")
                        startGoogleSR()
                    }
                } else {
                    // In-app direct speech (e.g. Nokia Button Phone helpline): keep normal audio routing
                    AudioRoutingHelper.resetAudioRouting(context)
                    onStatusListener?.invoke("listening")

                    // Use Google SpeechRecognizer for real-time on-device transcription
                    if (SpeechRecognizer.isRecognitionAvailable(context)) {
                        try {
                            Log.i(TAG, "Starting Google SpeechRecognizer for direct user speech ($lang)")
                            startGoogleSR()
                        } catch (e: Exception) {
                            Log.w(TAG, "Google SR failed, falling back to AudioRecord: ${e.message}")
                            startRecordPipeline()
                        }
                    } else {
                        Log.i(TAG, "Google SR not available, using AudioRecord pipeline")
                        startRecordPipeline()
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "startListening error: ${e.message}")
                onStatusListener?.invoke("error")
            }
        }
    }

    fun stopListening() {
        listening = false
        handler.post {
            stopAll()
            onStatusListener?.invoke("idle")
        }
    }

    // ==================== PRIMARY PIPELINE: AudioRecord + Groq Whisper ====================

    private fun startRecordPipeline(): Boolean {
        val hasPerm = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
        if (!hasPerm) {
            Log.e(TAG, "Missing RECORD_AUDIO permission")
            onStatusListener?.invoke("error: no mic permission")
            return false
        }

        val minBuf = AudioRecord.getMinBufferSize(SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
        if (minBuf <= 0) {
            Log.e(TAG, "getMinBufferSize returned $minBuf")
            return false
        }
        val bufSize = maxOf(minBuf * 4, CHUNK_SAMPLES * 2)

        audioRecord = tryCreateAudioRecord(bufSize) ?: return false
        try {
            audioRecord!!.startRecording()
        } catch (e: Exception) {
            Log.e(TAG, "audioRecord.startRecording failed: ${e.message}")
            return false
        }

        recording.set(true)
        onStatusListener?.invoke("listening")

        recThread = Thread({ recordLoop() }, "VesperWhisperWorker").apply {
            priority = Thread.MAX_PRIORITY
            start()
        }
        return true
    }

    private fun tryCreateAudioRecord(bufSize: Int): AudioRecord? {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) return null

        val tm = context.getSystemService(Context.TELEPHONY_SERVICE) as? TelephonyManager
        val isCallActive = tm?.callState != TelephonyManager.CALL_STATE_IDLE

        val sources = mutableListOf<Int>()
        if (isCallActive) {
            // During cellular call on loudspeaker: bypass AEC with UNPROCESSED or VoIP channel
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                sources.add(MediaRecorder.AudioSource.UNPROCESSED)
            }
            sources.add(MediaRecorder.AudioSource.VOICE_COMMUNICATION)
            sources.add(MediaRecorder.AudioSource.MIC)
        } else {
            // Direct in-app microphone: standard high-clarity voice recognition & mic
            sources.add(MediaRecorder.AudioSource.VOICE_RECOGNITION)
            sources.add(MediaRecorder.AudioSource.MIC)
            sources.add(MediaRecorder.AudioSource.DEFAULT)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                sources.add(MediaRecorder.AudioSource.UNPROCESSED)
            }
        }

        for (src in sources) {
            try {
                val ar = AudioRecord(src, SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, bufSize)
                if (ar.state == AudioRecord.STATE_INITIALIZED) {
                    Log.i(TAG, "✅ AudioRecord initialized successfully with source=$src")
                    return ar
                }
                ar.release()
            } catch (e: Exception) {
                Log.w(TAG, "AudioRecord source=$src failed: ${e.message}")
            }
        }
        return null
    }

    private fun recordLoop() {
        val readBuf = ShortArray(1600) // 100ms chunks at 16kHz mono
        val chunk = ShortArray(CHUNK_SAMPLES)
        var pos = 0
        var hasSpeech = false

        Log.i(TAG, "Record loop started (${CHUNK_SECONDS}s chunks → Groq Whisper)")

        while (recording.get()) {
            val ar = audioRecord ?: break
            val n = ar.read(readBuf, 0, readBuf.size)
            if (n <= 0) {
                try { Thread.sleep(10) } catch (_: Exception) {}
                continue
            }

            // Software Gain: Boost audio 2.5x so caller's voice over speakerphone is loud and crisp
            boostAudio(readBuf, n, 2.5f)

            // RMS and peak amplitude calculation
            var sum = 0.0
            var maxAmp = 0
            for (i in 0 until n) {
                val s = readBuf[i].toDouble()
                sum += s * s
                val absS = kotlin.math.abs(readBuf[i].toInt())
                if (absS > maxAmp) maxAmp = absS
            }
            val rms = kotlin.math.sqrt(sum / n)

            // Mark speech if above sensitive thresholds
            if (rms >= RMS_MIN_THRESHOLD || maxAmp >= PEAK_MIN_THRESHOLD) {
                hasSpeech = true
            }

            // Append to chunk
            val copyLen = minOf(n, CHUNK_SAMPLES - pos)
            System.arraycopy(readBuf, 0, chunk, pos, copyLen)
            pos += copyLen

            // Chunk full → send to Groq Whisper
            if (pos >= CHUNK_SAMPLES) {
                if (hasSpeech) {
                    val pcm = shortsToBytes(chunk, pos)
                    val wavBytes = makeWav(pcm)
                    val currentLang = lang
                    Thread({
                        transcribeAndDeliver(wavBytes, currentLang)
                    }, "WhisperUploader").start()
                } else {
                    Log.d(TAG, "Chunk discarded (silent room)")
                }
                pos = 0
                hasSpeech = false
            }
        }

        Log.i(TAG, "Record loop stopped")
    }

    /**
     * Boosts 16-bit PCM audio samples by a multiplier factor with saturation clipping prevention.
     */
    private fun boostAudio(buf: ShortArray, len: Int, factor: Float = 2.5f) {
        for (i in 0 until len) {
            val v = (buf[i] * factor).toInt()
            buf[i] = v.coerceIn(-32767, 32767).toShort()
        }
    }

    private fun shortsToBytes(shorts: ShortArray, count: Int): ByteArray {
        val bytes = ByteArray(count * 2)
        for (i in 0 until count) {
            bytes[i * 2] = (shorts[i].toInt() and 0xFF).toByte()
            bytes[i * 2 + 1] = (shorts[i].toInt() shr 8 and 0xFF).toByte()
        }
        return bytes
    }

    private fun makeWav(pcm: ByteArray): ByteArray {
        val totalAudio = pcm.size
        val totalData = totalAudio + 36
        val h = ByteArray(44)
        // RIFF header
        h[0]='R'.code.toByte(); h[1]='I'.code.toByte(); h[2]='F'.code.toByte(); h[3]='F'.code.toByte()
        writeInt32LE(h, 4, totalData)
        h[8]='W'.code.toByte(); h[9]='A'.code.toByte(); h[10]='V'.code.toByte(); h[11]='E'.code.toByte()
        // fmt subchunk
        h[12]='f'.code.toByte(); h[13]='m'.code.toByte(); h[14]='t'.code.toByte(); h[15]=' '.code.toByte()
        writeInt32LE(h, 16, 16) // subchunk size
        writeInt16LE(h, 20, 1)  // PCM format
        writeInt16LE(h, 22, 1)  // mono
        writeInt32LE(h, 24, SAMPLE_RATE)
        writeInt32LE(h, 28, SAMPLE_RATE * 2) // byte rate
        writeInt16LE(h, 32, 2)  // block align
        writeInt16LE(h, 34, 16) // bits per sample
        // data subchunk
        h[36]='d'.code.toByte(); h[37]='a'.code.toByte(); h[38]='t'.code.toByte(); h[39]='a'.code.toByte()
        writeInt32LE(h, 40, totalAudio)
        val wav = ByteArray(44 + totalAudio)
        System.arraycopy(h, 0, wav, 0, 44)
        System.arraycopy(pcm, 0, wav, 44, totalAudio)
        return wav
    }

    private fun writeInt32LE(buf: ByteArray, off: Int, v: Int) {
        buf[off] = (v and 0xFF).toByte()
        buf[off+1] = (v shr 8 and 0xFF).toByte()
        buf[off+2] = (v shr 16 and 0xFF).toByte()
        buf[off+3] = (v shr 24 and 0xFF).toByte()
    }

    private fun writeInt16LE(buf: ByteArray, off: Int, v: Int) {
        buf[off] = (v and 0xFF).toByte()
        buf[off+1] = (v shr 8 and 0xFF).toByte()
    }

    private fun transcribeAndDeliver(wav: ByteArray, langTag: String) {
        if (!recording.get() && !listening) return
        try {
            val text = callWhisperAPI(wav, whisperLangCode(langTag))
            if (text.isNullOrBlank()) return
            val clean = cleanText(text)
            if (clean.isBlank()) return

            Log.i(TAG, "✅ Caller Spoke: \"$clean\"")
            handler.post {
                if (listening) {
                    onSpeechResultListener?.invoke(clean, true)
                    onStatusListener?.invoke("listening")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "transcribe error: ${e.message}")
        }
    }

    /**
     * Sends WAV audio to Groq Whisper using a pure byte multipart POST.
     * Includes conditioning prompt with common Indian scam terminology to maximize
     * recognition accuracy for caller speech across languages.
     */
    private fun callWhisperAPI(wav: ByteArray, langCode: String?): String? {
        val boundary = "----VesperBoundary${System.currentTimeMillis()}"
        val crlf = "\r\n".toByteArray(Charsets.US_ASCII)

        val body = ByteArrayOutputStream(wav.size + 1024)

        // Part 1: model
        body.write("--$boundary$crlf".encodeASCII())
        body.write("Content-Disposition: form-data; name=\"model\"$crlf$crlf".encodeASCII())
        body.write("whisper-large-v3-turbo".toByteArray(Charsets.US_ASCII))
        body.write(crlf)

        // Part 2: prompt (primes vocabulary for Indian phone scams)
        val promptText = "CBI, Police, Customs, Narcotics, Digital Arrest, Parcel, Drugs, OTP, Transfer, Bank, Aadhaar, Warrant, Court, Mumbai Police, Tamil, Hindi, Telugu, Marathi, Gujarati"
        body.write("--$boundary$crlf".encodeASCII())
        body.write("Content-Disposition: form-data; name=\"prompt\"$crlf$crlf".encodeASCII())
        body.write(promptText.toByteArray(Charsets.UTF_8))
        body.write(crlf)

        // Part 3: language (if specified e.g. "ta", "hi", "mr", "te"; if null, Whisper auto-detects)
        if (!langCode.isNullOrBlank()) {
            body.write("--$boundary$crlf".encodeASCII())
            body.write("Content-Disposition: form-data; name=\"language\"$crlf$crlf".encodeASCII())
            body.write(langCode.toByteArray(Charsets.US_ASCII))
            body.write(crlf)
        }

        // Part 4: response_format
        body.write("--$boundary$crlf".encodeASCII())
        body.write("Content-Disposition: form-data; name=\"response_format\"$crlf$crlf".encodeASCII())
        body.write("json".toByteArray(Charsets.US_ASCII))
        body.write(crlf)

        // Part 5: file (binary WAV)
        body.write("--$boundary$crlf".encodeASCII())
        body.write("Content-Disposition: form-data; name=\"file\"; filename=\"caller_voice.wav\"$crlf".encodeASCII())
        body.write("Content-Type: audio/wav$crlf$crlf".encodeASCII())
        body.write(wav)
        body.write(crlf)

        // End boundary
        body.write("--$boundary--$crlf".encodeASCII())

        val payload = body.toByteArray()

        val apiKey = GROQ_KEY.ifEmpty {
            context.getSharedPreferences("vesper_prefs", Context.MODE_PRIVATE).getString("groq_api_key", "") ?: ""
        }
        if (apiKey.isEmpty()) {
            Log.w(TAG, "No Groq API key configured. Provide an API key in settings.")
            return ""
        }

        val conn = (URL(GROQ_URL).openConnection() as HttpURLConnection).apply {
            connectTimeout = 7000
            readTimeout = 10000
            requestMethod = "POST"
            doOutput = true
            setRequestProperty("Authorization", "Bearer $apiKey")
            setRequestProperty("Content-Type", "multipart/form-data; boundary=$boundary")
            setRequestProperty("Content-Length", payload.size.toString())
        }

        try {
            conn.outputStream.use { it.write(payload) }
            val code = conn.responseCode
            val stream = if (code == 200) conn.inputStream else conn.errorStream
            val resp = stream?.bufferedReader()?.use { it.readText() } ?: ""

            if (code == 200) {
                return JSONObject(resp).optString("text", "")
            } else {
                Log.w(TAG, "Groq Whisper API $code: $resp")
                return null
            }
        } finally {
            conn.disconnect()
        }
    }

    private fun String.encodeASCII() = this.toByteArray(Charsets.US_ASCII)

    private fun cleanText(raw: String): String {
        var t = raw.trim()
        t = t.replace(Regex("\\[.*?]"), "").replace(Regex("\\(.*?\\)"), "").trim()
        if (t.all { it in ".,!?;:-_~`'\"/ " }) return ""
        val lo = t.lowercase()
        val hallucinations = setOf(
            "thank you.", "thank you", "thanks for watching!", "thanks for watching.",
            "you", "bye.", "bye", "subtitles by", "amara.org", "."
        )
        if (lo in hallucinations) return ""
        return t
    }

    /**
     * Map BCP-47 language tag to Whisper ISO 639-1 code.
     * If English, returns null to allow seamless auto-detection of mixed Indian English / regional words.
     */
    private fun whisperLangCode(langTag: String): String? {
        val c = langTag.trim().lowercase()
        return when {
            c.startsWith("ta") -> "ta" // Tamil
            c.startsWith("hi") -> "hi" // Hindi
            c.startsWith("te") -> "te" // Telugu
            c.startsWith("kn") -> "kn" // Kannada
            c.startsWith("mr") -> "mr" // Marathi
            c.startsWith("gu") -> "gu" // Gujarati
            c.startsWith("ml") -> "ml" // Malayalam
            c.startsWith("bn") -> "bn" // Bengali
            c.startsWith("pa") -> "pa" // Punjabi
            else -> null // Auto-detect for English & multi-lingual speech
        }
    }

    // ==================== SECONDARY FALLBACK: Google SpeechRecognizer ====================

    private fun startGoogleSR() {
        if (!listening) return
        try {
            speechRec = SpeechRecognizer.createSpeechRecognizer(context).apply {
                setRecognitionListener(object : RecognitionListener {
                    override fun onReadyForSpeech(p: Bundle?) {
                        Log.i(TAG, "Google SR ready ($lang)")
                        onStatusListener?.invoke("listening")
                    }
                    override fun onBeginningOfSpeech() { onStatusListener?.invoke("speech") }
                    override fun onRmsChanged(rms: Float) {}
                    override fun onBufferReceived(buf: ByteArray?) {}
                    override fun onEndOfSpeech() { onStatusListener?.invoke("processing") }

                    override fun onError(err: Int) {
                        Log.w(TAG, "Google SR error $err")
                        onStatusListener?.invoke("listening")
                        if (listening) {
                            if (err == SpeechRecognizer.ERROR_SERVER || err == SpeechRecognizer.ERROR_CLIENT || err == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS) {
                                Log.w(TAG, "Google SR error $err → falling back to AudioRecord pipeline")
                                handler.post {
                                    if (listening && !recording.get()) {
                                        startRecordPipeline()
                                    }
                                }
                            } else {
                                handler.postDelayed({ if (listening) restartGoogleSR() }, 400)
                            }
                        }
                    }

                    override fun onResults(results: Bundle?) {
                        val text = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull() ?: ""
                        if (text.isNotBlank()) {
                            Log.i(TAG, "✅ Google SR result: \"$text\"")
                            onSpeechResultListener?.invoke(text, true)
                        }
                        if (listening) handler.postDelayed({ if (listening) restartGoogleSR() }, 200)
                    }

                    override fun onPartialResults(partial: Bundle?) {
                        val text = partial?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull() ?: ""
                        if (text.isNotBlank()) onSpeechResultListener?.invoke(text, false)
                    }

                    override fun onEvent(t: Int, p: Bundle?) {}
                })
            }

            val intent = android.content.Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, lang)
                putExtra(RecognizerIntent.EXTRA_ONLY_RETURN_LANGUAGE_PREFERENCE, false)
                putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
                putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, context.packageName)
                putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 1500L)
                putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 1000L)
                putExtra("android.speech.extra.DICTATION_MODE", true)
            }
            speechRec?.startListening(intent)
            Log.i(TAG, "Google SpeechRecognizer started ($lang)")
            onStatusListener?.invoke("listening")
        } catch (e: Exception) {
            Log.e(TAG, "startGoogleSR failed: ${e.message}")
            onStatusListener?.invoke("error")
        }
    }

    private fun restartGoogleSR() {
        if (!listening) return
        try {
            speechRec?.stopListening(); speechRec?.cancel(); speechRec?.destroy(); speechRec = null
            startGoogleSR()
        } catch (e: Exception) { Log.w(TAG, "restartGoogleSR: ${e.message}") }
    }

    // ==================== CLEANUP ====================

    private fun stopAll() {
        recording.set(false)
        try { audioRecord?.stop() } catch (_: Exception) {}
        try { audioRecord?.release() } catch (_: Exception) {}
        audioRecord = null
        recThread?.interrupt(); recThread = null
        try { speechRec?.stopListening(); speechRec?.cancel(); speechRec?.destroy() } catch (_: Exception) {}
        speechRec = null
    }

    private fun normLang(l: String): String {
        val c = l.trim().lowercase()
        return when {
            c.startsWith("ta") -> "ta-IN"
            c.startsWith("mr") -> "mr-IN"
            c.startsWith("te") -> "te-IN"
            c.startsWith("kn") -> "kn-IN"
            c.startsWith("gu") -> "gu-IN"
            c.startsWith("hi") -> "hi-IN"
            c.startsWith("ml") -> "ml-IN"
            c.startsWith("bn") -> "bn-IN"
            c.startsWith("pa") -> "pa-IN"
            c.startsWith("or") -> "or-IN"
            else -> "en-IN"
        }
    }
}
