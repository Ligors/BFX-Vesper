# 🛡️ BFX VESPER
### *Autonomous On-Device & Cloud Anti-Scam Shield for Elders & Feature Phones*

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Hackathon Winner](https://img.shields.io/badge/VIT%20Hackathon-1st%20Place%20Winner%20%F0%9F%8F%86-gold)](#)
[![Privacy First](https://img.shields.io/badge/Privacy-100%25%20Offline%20First-green)](#)
[![BYOK](https://img.shields.io/badge/AI-Bring%20Your%20Own%20Key-purple)](#)

> **Winner of 1st Place at VIT Hackathon 2026 🏆**  
> Tailored specifically for Indian elders, senior citizens, and keypad phone users to combat digital arrests, fake payment mod APKs, parcel/courier drug scams, and SMS/OTP phishing.

---

## 🌟 What Makes BFX Vesper Unique?

### 1. 📟 The Nokia Keypad Feature Phone AI Helpline
Most modern scam safety solutions assume everyone owns a flagship smartphone with high-speed 5G. In India, **millions of senior citizens still rely on ₹1,200 basic Nokia / button keypad phones**.
- **Speed-Dial `1` Protection:** Elders can speed-dial `1` on their keypad phone to connect to the Vesper Cloud Voice AI Helpline.
- **Multilingual Spoken Interaction:** The elder simply speaks (*"Inspector said my Aadhaar has a drugs parcel..."*).
- **Instant Voice Verdict & Guardian Alert:** Vesper speaks back to calm the elder down, confirms it's a 100% scam, and immediately dispatches an urgent alert to their family guardian on Telegram with the transcript and caller ID.

> [!IMPORTANT]
> **📢 Community Call — Real Nokia & Telecom Implementation:**  
> The Nokia button phone feature is currently fully implemented and simulated in the Cloud Voice AI pipeline (with real-time STT, audio feedback, scam classification, and guardian Telegram dispatch). Because we are students who built this during a hackathon, we don't have the funding to purchase enterprise Indian telecom IVR lines / toll-free numbers and integrate carrier SIP gateways for live dumb phones.  
> **If anyone from the telecom or open-source community is interested in taking this forward to real keypad phones across India, please feel free to fork or import this code and connect real telecom lines!** The underlying AI detection and cloud logic work 100% and are completely ready.

### 2. 🛡️ Autonomous Call Guard & App Isolation
- **Coercion & Urgency Engine:** Listens on speakerphone for Indian cybercrime coercion tactics (*"digital arrest"*, *"urgent OTP"*, *"CBI Mumbai"*, *"electricity disconnection in 10 minutes"*).
- **Auto-Hangup & Shield:** Automatically isolates sensitive apps (**PhonePe, Google Pay, Paytm, SBI YONO, SMS**) to prevent coerced fund transfers.
- **2-Factor Guardian Unlock:** Only the designated guardian can unlock the device using a secure passcode + passphrase.

### 3. 🔍 Fake Payment Mod APK & Screenshot OCR Engine
- Evaluates forged screenshots from fake payment apps (*SpoofPay*, *Fake PhonePe*, *Fake Paytm*).
- **Multi-Factor Forensics:**
  1. **12-digit NPCI UTR Reference Validator** (detects truncated or alphanumeric fraud codes).
  2. **Font & Subpixel Artifact Detection** (flags standard system fonts replacing official app typography).
  3. **Dual Percentage Scoring:** Explains both *why it gave X% scam probability* and *why it didn't give 100%*.

### 4. 👵 WhatsApp "DebateBot" (Counter-Scam Baiting)
- Operates under elder consent.
- Plays the persona of a slow, confused grandmother (*"Lost my glasses"*, *"Grandson put a lock on the phone"*, *"Should I put a 5-rupee coin in the charger?"*).
- Hooks fraudsters into infinite conversational loops, wasting their time while keeping money safe (`₹0.00 lost`).

### 5. 📨 Indian TRAI DLT SMS Header Inspector
- Decodes official 6-character registered headers (e.g. `AD-HDFCBK-T` where `A`=Airtel, `D`=Delhi, `HDFCBK`=Bank, `-T`=Transactional).
- Instantly flags regular 10-digit personal mobile numbers claiming to be banks or police as **100% FRAUD**.

---

## 🧠 Privacy-First Architecture: 100% Offline + BYOK

| Mode | Engine | Cost | Privacy |
|---|---|---|---|
| **Tier 1: Offline Default** | Deterministic Regex & Rule Engine (`engine.js`) + **Gemma 2B** via WebLLM / WebGPU | **₹0 (Free)** | **100% Local (0% Cloud)** |
| **Tier 2: BYOK Cloud** | Free Groq API (Llama 3 / Qwen) or Google Gemini 2.0 Flash | **₹0 (Free)** | Direct Device-to-AI (No middleman server) |

> [!NOTE]
> **No shared backend bills or tracking:** BFX Vesper is built with **Bring Your Own Key (BYOK)**. Users and developers can run it completely offline or enter their own free API keys in Settings.

---

## 🔑 How to Get Free API Keys (Step-by-Step)

You can run BFX Vesper 100% free using your own API keys. Here is how to obtain them in 60 seconds:

### 1. Groq API Key (Recommended for Ultra-Fast Audio Transcription & Text)
1. Go to the [Groq Cloud Console](https://console.groq.com/keys).
2. Sign up or log in with your GitHub or Google account (Free tier includes generous RPM limits).
3. Click **"Create API Key"**, give it a name, and copy the key (starts with `gsk_...`).
4. Paste the key in `APP/bfx-vesper/.env` under `GROQ_API_KEY=` or enter it directly in the app's **Settings ⚙️ $\rightarrow$ Custom API Key**.

### 2. Google Gemini API Key
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Sign in with your Google account.
3. Click **"Create API Key"** $\rightarrow$ select a project $\rightarrow$ copy the key (starts with `AIza...`).
4. Paste the key in `APP/bfx-vesper/.env` under `GEMINI_API_KEY=` or select `GEMINI` in the app's Settings.

### 3. Telegram Guardian Bot Token & Chat ID (Optional — for live alert alerts)
1. Open the **Telegram** app and search for `@BotFather`.
2. Send `/newbot`, choose a name and username for your bot, and copy the **HTTP API Token**.
3. To find your Chat ID, start a chat with `@userinfobot` on Telegram and copy your `Id`.
4. Paste them into `APP/bfx-vesper/.env` under `TELEGRAM_BOT_TOKEN=` and `TELEGRAM_CHAT_ID=`.

### 4. 100% Offline Mode (Zero Keys Needed!)
If you don't want to use any API keys, simply select **Offline Mode** in the app's Settings! The app will use the local rule engine and browser-based Gemma model without touching the internet.

---

## 🚀 Quick Start Guide

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)

### 1. Clone the Repository
```bash
git clone https://github.com/Ligors/BFX-Vesper.git
cd BFX-Vesper
```

### 2. Configure Environment (Optional)
```bash
cd APP/bfx-vesper
cp .env.example .env
```
*(You can also leave `.env` empty and enter your keys directly in the web UI Settings!)*

### 3. Install & Start
```bash
npm install
node server.js
```
Open **[http://localhost:5000](http://localhost:5000)** in your browser!

---

## 📱 Android App (Native Wrapper)
The native Android wrapper is located in `APP/android-vesper/`.
- Includes background call listening, foreground notification services, and webview integration.
- Can be compiled using Android Studio or Gradle:
```bash
cd APP/android-vesper
./gradlew assembleDebug
```

---

## 🔒 Security & Disclosure
- **Zero Credentials Committed:** All secret API keys and tokens have been scrubbed from this repository.
- **Local Storage:** Passcodes and guardian settings are stored securely in local browser storage or server config.

---

## 📜 License
This project is licensed under the [GNU General Public License v3.0 (GPL v3)](LICENSE).

> **Freedom & Anti-Patent Protection:** Under GPL v3, this software must remain 100% free and open-source forever. No company or individual can patent this code, restrict its distribution, or close-source derivatives.
