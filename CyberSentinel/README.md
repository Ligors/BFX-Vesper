# CyberSentinel (Raksha Kavach) — Senior Citizen Online Scam Shield

> **Indian Senior Anti-Scam Prototype & Interactive Demo**  
> Tailored for elder citizens and youngsters to combat rising online fraud, fake payment mod APKs, voice coercion, and phishing attacks.

---

## 🌟 Live Demo URLs
- **Local Browser:** `http://localhost:3000/`
- **Mobile Device on Wi-Fi:** `http://10.43.203.34:3000/`

---

## 🛡️ Core Features Implemented in the Prototype

### 1. On-Device Call Guardian & Automated App Lockdown
- **Model Engine:** Emulates an on-device quantized **Gemma 2B Mini** running locally (low memory footprint of ~380MB, 0% cloud latency, 100% data privacy).
- **Live Call Audio & Transcription:** Real-time speech visualizer and transcription stream.
- **Urgent Coercion Detection:** Triggers on coercive scam phrases like *"urgent OTP"*, *"digital arrest warrant"*, *"electricity disconnection in 10 minutes"*, *"immediate ₹50,000 transfer"*.
- **Auto-Hangup:** AI automatically cuts the scam call immediately upon risk threshold breach.
- **Automated Lockdown:** Isolates vulnerable apps (**PhonePe, Google Pay, Paytm, SBI YONO, SMS Messages, Chrome**).
- **Telegram Bot Guardian Alert:** Dispatches detailed threat report with caller ID, timestamp, simulated GPS coordinates (*Indiranagar, Bengaluru*), and transcript. Supports live Telegram Bot API tokens or instant realistic simulation.
- **Two-Factor Guardian Unlock:** Guardian enters **Passcode** (default: `9442`) and **Passphrase** (default: `KAVACH-SHIELD-2026`).
- **Post-Incident Forensic Audit:** Details why the phone was isolated and offers one-touch dialing for the Indian Cyber Crime Helpline (`1930`).

---

### 2. Fake Payment Screenshot Analyzer (OCR + Groq / Gemini API)
- **Targets Indian Mod APKs:** Identifies fake screenshots from *SpoofPay*, *Fake PhonePe*, and *Fake Paytm* apps commonly used against shopkeepers and elders.
- **Multi-Factor Forensic OCR Engine:**
  1. **12-Digit NPCI UTR Check:** Detects truncated 6-8 digit references or fake alphanumeric prefixes.
  2. **Font Discrepancy:** Flags standard system Roboto/Arial fonts overriding official app typography on amounts.
  3. **Visual Alignment & Artifacts:** Evaluates subpixel anti-aliasing on checkmarks and status bar timestamps.
- **Dual Percentage Scoring Breakdown:**
  - **Why it gave this scam percentage (e.g. 65%):** Specific itemized forensic discrepancies.
  - **Why it did not give the remaining percentage (e.g. 35%):** Details authentic visual elements and reasons why certainty cannot reach 100% without querying bank servers directly.
- **Senior Audio Assistance:** Reads out the verdict and elder guidance in regional languages.

---

### 3. WhatsApp Counter-Scam "DebateBot"
- **Elder Consent Guard:** Detects scammer WhatsApp messages and requests senior permission: *"Allow DebateBot to bait this scammer?"*.
- **Endless Counter-Baiting Loop:** DebateBot acts as a confused, slow-moving elder (*"Spectacles lost"*, *"Grandson put a lock on the phone"*, *"Should I put a 5-rupee coin in the charger?"*), keeping fraudsters hooked for hours.
- **Scammer Intelligence Extraction:** Auto-logs scammer phone numbers and mule UPI IDs for law enforcement reporting.
- **Real-Time Counters:** Displays scammer time wasted and money lost (`₹0.00`).

---

### 4. ScamTricks — Interactive Senior Training
- **Indian TRAI SMS Header Decoder:**
  - Visual breakdown of registered 6-character sender headers (e.g., `AD-HDFCBK`: `A`=Airtel, `D`=Delhi, `HDFCBK`=Bank).
  - Explains government suffixes (`SG-GOVTIN`, ending with `G` for government entities).
  - Highlights personal 10-digit mobile numbers as **100% FRAUD** when claiming to be banks or police.
- **Interactive Practice Trials:** 3 realistic Indian fraud quizzes with instant audio feedback and celebration confetti on safe decisions.

---

### 5. SMS & Fake OTP Inspector
- **Scam Score (0 to 100%):** Evaluates threats, APK download links (`.apk`), bit.ly phishing links, and OTP demands.
- **Dual Explanation:** Shows why risk points were assigned and why remaining points were unflagged.
- **Preloaded Indian Templates:** Includes Electricity cut-off, SBI YONO KYC block APK, Income Tax Refund, and legitimate bank debit alerts.

---

## 🌐 Multilingual Support (13 Languages)
Instant real-time switching between:
1. **English**
2. **Hindi (हिन्दी)**
3. **Tamil (தமிழ்)**
4. **Telugu (తెలుగు)**
5. **Kannada (ಕನ್ನಡ)**
6. **Malayalam (മലയാളം)**
7. **Marathi (मराठी)**
8. **Bengali (বাংলা)**
9. **Gujarati (ગુજરાતી)**
10. **Punjabi (ਪੰਜਾਬੀ)**
11. **Odia (ଓଡ଼ିଆ)**
12. **Assamese (অসমীয়া)**
13. **Urdu (اردو)**

---

## 🎨 Accessible Senior UI Design Principles
- **No Purple Gradients / No Glassmorphism Slop:** High-contrast, clean slate & ivory surfaces with solid borders.
- **Typography:** Uses Google's **Lexend** (designed to reduce visual stress and optimize reading comprehension) paired with **Plus Jakarta Sans**.
- **Elder Controls:**
  - `A / A+ / A++` font scale adjuster.
  - Large touch targets (52px+).
  - Spoken Voice Assistance via Web Speech API (`window.speechSynthesis`).
  - Android Phone Frame mode & Expanded Fullscreen Presentation mode.

---

## 🚀 How to Run the App
```bash
cd CyberSentinel/app
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in any browser.
