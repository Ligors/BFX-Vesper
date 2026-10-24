# 🛡️ BFX VESPER (Raksha Kavach)
### *Autonomous On-Device & Cloud Anti-Scam Shield for Elders & Feature Phones*

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Hackathon Winner](https://img.shields.io/badge/VIT%20Hackathon-1st%20Place%20Winner%20%F0%9F%8F%86-gold)](#)
[![Privacy First](https://img.shields.io/badge/Privacy-100%25%20Offline%20First-green)](#)
[![BYOK](https://img.shields.io/badge/AI-Bring%20Your%20Own%20Key-purple)](#)

> **Winner of 1st Place at VIT Hackathon 2026 🏆**  
> Tailored specifically for Indian elders, senior citizens, and keypad phone users to combat digital arrests, fake payment mod APKs, parcel/courier drug scams, and SMS/OTP phishing.

---

## 🌟 What Makes Vesper Unique?

### 1. 📟 The Nokia Keypad Feature Phone AI Helpline
Most modern scam safety solutions assume everyone owns a flagship smartphone with high-speed 5G. In India, **millions of senior citizens still rely on ₹1,200 basic Nokia / button keypad phones**.
- **Speed-Dial `1` Protection:** Elders can speed-dial `1` on their keypad phone to connect to the Vesper Cloud Voice AI Helpline.
- **Multilingual Spoken Interaction:** The elder simply speaks (*"Inspector said my Aadhaar has a drugs parcel..."*).
- **Instant Voice Verdict & Guardian Alert:** Vesper speaks back to calm the elder down, confirms it's a 100% scam, and immediately dispatches an urgent alert to their family guardian on Telegram with the transcript and caller ID.

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
> **No shared backend bills or tracking:** Vesper is built with **Bring Your Own Key (BYOK)**. Users and developers can run it completely offline or enter their own free API keys in Settings.

---

## 🚀 Quick Start Guide

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- Free API keys (Optional for cloud models):
  - [Google AI Studio](https://aistudio.google.com/) (Gemini)
  - [Groq Cloud Console](https://console.groq.com/) (Groq Llama/Qwen)

### 1. Clone the Repository
```bash
git clone https://github.com/YOUR_USERNAME/bfx-vesper.git
cd bfx-vesper
```

### 2. Configure Environment (Optional)
```bash
cd APP/bfx-vesper
cp .env.example .env
```
*(You can also leave `.env` empty and input your keys directly in the web UI Settings!)*

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
- **Zero Credentials Committed:** All secret API keys and tokens have been scrubbed.
- **Local Storage:** Passcodes and guardian settings are stored securely in local browser storage or server config.

---

## 📜 License
This project is licensed under the [GNU General Public License v3.0 (GPL v3)](LICENSE).

> **Freedom & Anti-Patent Protection:** Under GPL v3, this software must remain 100% free and open-source forever. No company or individual can patent this code, restrict its distribution, or close-source derivatives.
