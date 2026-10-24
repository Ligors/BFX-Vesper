# BFX VESPER — scam shield for India's elders

A working prototype: an installable Android web app (PWA) plus a Node server.

| Feature | How it works |
|---|---|
| **Vesper Call Guard** | Phone on speaker → live speech-to-text (11 Indian languages) → on-device rule engine scores every sentence; Gemini/Groq gives a second opinion. Risk ≥ 72 (on-device) or ≥ 75 (AI) → alarm, full-screen **lockdown** of payment/SMS/browser shortcuts, **Telegram alert** to the guardian with risk score, reasons, transcript, GPS + address, device and time. |
| **Guardian unlock** | 6-digit passcode + passphrase, stored only as a salted PBKDF2-SHA256 hash. 5 wrong tries → 5-minute freeze + Telegram alert. After unlock, a report explains why the phone was locked. |
| **On-device AI** | The rule engine (`public/js/engine.js`) runs offline on any phone. Optional **Gemma 2 2B** (WebLLM, WebGPU, 1k context) for offline language understanding on capable phones. |
| **Payment screenshot check** | Gemini/Groq vision + Tesseract OCR + UPI rules (12-digit UTR, RRN↔date, future/old dates, amount mismatch, unknown UPI handle, odd status text). Score = 60% AI + 40% rules. Share a screenshot straight from WhatsApp to Vesper. |
| **SMS / OTP check** | Instant offline score, refined by cloud AI (65% AI + 35% on-device). Decodes TRAI sender headers (`AX-HDFCBK-T`: operator · business · P/S/T/G). |
| **Explained scores** | Every score is split into **why X% scam** and **why not 100%** (genuine signs + what could not be checked), with weights that add up to 100. |
| **Vesper Bait Bot** | WhatsApp Cloud API webhook. Scam detected → asks the user's permission → replies as "Kamala Paati", a slow, confused grandmother, in an endless loop. Counts the scammer's time wasted. Test mode works without WhatsApp. |
| **ScamTricks** | Safe-or-scam practice with feedback + "Learn the SMS codes". New AI-generated questions in the user's language. |

## Run
```bash
npm install
cp .env.example .env   # optional — keys can also be pasted in the app
node server.js         # http://localhost:3000
```
Speech recognition, microphone, GPS and install need **HTTPS** on a phone (deploy to Render/Railway/Fly, or use `cloudflared tunnel --url http://localhost:3000`).

**Telegram:** create a bot with @BotFather → paste the token → in onboarding press "Connect guardian's Telegram" → the guardian opens the link and presses **Start**.
**WhatsApp:** Meta developer app → WhatsApp → set the webhook to `https://YOUR-HOST/webhook/whatsapp`, verify token `vesper-verify`, subscribe to `messages`.

## Honest limits of the web version
A browser app **cannot** read the phone's call audio, hang up calls, or block other apps. In the PWA, Call Guard listens to the speakerphone, and lockdown is Vesper's own full-screen lock. Real call screening and app blocking need the native Android shell (Capacitor + Kotlin: `CallScreeningService`, an `AccessibilityService` to block payment apps, and on-device Gemma through MediaPipe LLM Inference). That shell reuses this UI and server unchanged.
