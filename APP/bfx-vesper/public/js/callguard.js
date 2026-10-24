// Call Guard — live speech-to-text + on-device scam scoring + cloud AI confirmation.
import { analyzeText } from './engine.js';

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
export const speechSupported = !!SR;

const DANGER_PATTERNS = /(?:digital\s*arrest|cbi|police|customs|narcotics|parcel|drugs|warrant|arrest|urgent\s*otp|share\s*otp|transfer\s*money|transfer\s*your\s*savings|rbi\s*safe\s*account|anydesk|quicksupport|screen\s*share|खाता\s*ब्लॉक|डिजिटल\s*अरेस्ट|वारंट|गिरफ्तारी|டிஜிட்டல்\s*அரெஸ்ட்|போலீஸ்|சிபிஐ|வாரண்ட்|கைது|பணம்\s*அனுப்புங்கள்|డిజిటల్\s*అరెస్ట్|పోలీస్|సిబిఐ|డబ్బు\s*బదిలీ|వారంట్|ಡಿಜಿಟಲ್\s*ಅರೆಸ್ಟ್|ಪೊಲೀಸ್|ಸಿಬಿಐ|ವಾರಂಟ್|ಹಣ\s*ವರ್ಗಾವಣೆ|डिजिटल\s*अटक|पोलीस|सीबीर|ड्रग्ज|अटक\s*वॉरण्ट|पैसे\s*ट्रान्सफर|ડિજિટલ\s*અરેસ્ટ|પોલીસ|સીબીઆઈ|ધરપકડ\s*વોરંટ|પૈસા\s*ટ્રાન્સફર)/i;

const DEMO = {
  en: ['Hello, am I speaking with the account holder?', 'I am calling from Mumbai Cyber Crime branch, Inspector Sharma speaking.', 'A FedEx parcel in your name was seized with illegal drugs and fake passports.', 'Your Aadhaar is linked to a money laundering case. An arrest warrant is issued.', 'You are under digital arrest. Do not disconnect the call and do not tell anyone in your family.', 'To verify, transfer your savings to the RBI safe account immediately. Tell me the OTP you just received.'],
  hi: ['नमस्ते, क्या मैं खाताधारक से बात कर रहा हूँ?', 'मैं मुंबई साइबर क्राइम से इंस्पेक्टर शर्मा बोल रहा हूँ।', 'आपके नाम का एक FedEx पार्सल पकड़ा गया है जिसमें ड्रग्स हैं।', 'आपका आधार मनी लॉन्ड्रिंग केस से जुड़ा है, गिरफ्तार करने का वारंट है।', 'आप डिजिटल अरेस्ट में हैं। कॉल मत काटिए, किसी को मत बताइए।', 'जाँच के लिए तुरंत पैसे ट्रांसफर कीजिए। अभी आया OTP बताइए।'],
  ta: ['வணக்கம், கணக்கு வைத்திருப்பவரிடம் பேசுகிறேனா?', 'நான் மும்பை சைபர் கிரைம் போலீஸ் இன்ஸ்பெக்டர் சர்மா பேசுகிறேன்.', 'உங்கள் பெயரில் வந்த FedEx parcel-இல் drugs கண்டுபிடிக்கப்பட்டது.', 'உங்கள் ஆதார் money laundering வழக்கில் உள்ளது. உங்களைக் கைது செய்ய warrant உள்ளது.', 'நீங்கள் digital arrest-இல் இருக்கிறீர்கள். call cut செய்யாதீர்கள், யாரிடமும் சொல்ல வேண்டாம்.', 'சரிபார்க்க உடனே பணம் அனுப்புங்கள். இப்போது வந்த OTP சொல்லுங்க.'],
};

export class CallGuard {
  constructor({ lang = 'en', bcp = 'en-IN', onUpdate, onDanger, aiCheck }) {
    Object.assign(this, { lang, bcp, onUpdate, onDanger, aiCheck });
    this.lines = []; this.interim = ''; this.running = false; this.fired = false; this.result = analyzeText('', { mode: 'call' });
    this.lastAiLen = 0; this.aiScore = null; this.timers = []; this.lastInterimEval = 0;
  }
  get text() { return this.lines.join(' '); }
  emit() { this.onUpdate?.(this); }

  push(line) {
    const trimmed = String(line || '').trim();
    if (!trimmed) return;
    const last = this.lines[this.lines.length - 1];
    if (last) {
      if (last.toLowerCase() === trimmed.toLowerCase()) return;
      if (trimmed.toLowerCase().startsWith(last.toLowerCase())) {
        this.lines[this.lines.length - 1] = trimmed;
        this.evaluate();
        return;
      }
      if (last.toLowerCase().startsWith(trimmed.toLowerCase())) return;
    }
    this.lines.push(trimmed);
    this.evaluate();
  }
  evaluate() {
    const recent = this.lines.slice(-12).join(' ');
    // Instant real-time pattern match
    if (DANGER_PATTERNS.test(recent)) {
      this.result = { score: 92, verdict: 'SCAM', signals: [{ code: 'DIGITAL_ARREST', weight: 40 }, { code: 'ARREST_THREAT', weight: 30 }], safe: [], unknowns: [] };
      this.emit();
      return this.fire('realtime-keyword');
    }

    this.result = analyzeText(recent, { mode: 'call' });
    this.emit();
    if (this.result.score >= 72) return this.fire('on-device');

    // ask cloud AI for a second opinion when enough new words arrived
    if (this.aiCheck && recent.length - this.lastAiLen > 80 && this.result.score >= 25) {
      this.lastAiLen = recent.length;
      this.aiCheck(recent).then((r) => {
        if (!r || this.fired) return;
        this.aiScore = r.score; this.ai = r; this.emit();
        if (r.score >= 75) this.fire('cloud');
      }).catch(() => {});
    }
  }
  fire(by) {
    if (this.fired) return;
    this.fired = true;
    if ('speechSynthesis' in window) {
      try { speechSynthesis.cancel(); } catch { /* */ }
    }
    const reasons = this.ai?.ai?.scam_reasons?.map((x) => x.point) || null;
    this.onDanger?.({ score: Math.max(this.result.score, this.aiScore || 0, 88), local: this.result, ai: this.ai?.ai || null, reasons, transcript: this.text, by });
    this.stop();
  }

  start() {
    this.running = true; this.fired = false;

    // Native Android Speech Recognition (direct mic & speakerphone audio during phone calls)
    if (window.VesperNative?.startNativeSpeechRecognition) {
      console.log('CallGuard: Activating Native Android SpeechRecognizer with speakerphone audio...');
      this.interim = 'Listening to caller on speakerphone...';
      window.onNativeSpeechStatus = (st) => {
        console.log('CallGuard Native Speech Status:', st);
        if (st === 'listening' || st === 'speech') {
          if (!this.lines.length && !this.interim) {
            this.interim = 'Listening to caller on speakerphone...';
          }
          this.emit();
        }
      };
      window.onNativeSpeechResult = (text, isFinal) => {
        if (!this.running || this.fired) return;
        if (isFinal) {
          this.push(text);
          this.interim = '';
        } else {
          this.interim = text;
          if (DANGER_PATTERNS.test(text)) {
            this.result = { score: 92, verdict: 'SCAM', signals: [{ code: 'DIGITAL_ARREST', weight: 40 }, { code: 'ARREST_THREAT', weight: 30 }], safe: [], unknowns: [] };
            this.emit();
            return this.fire('realtime-keyword');
          }
        }
        this.emit();
      };
      window.VesperNative.startNativeSpeechRecognition(this.bcp || 'en-IN');
      this.emit();
      return;
    }

    if (!SR) throw new Error('nosupport');
    const rec = (this.rec = new SR());
    rec.lang = this.bcp; rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) {
          this.push(r[0].transcript);
        } else {
          interim += r[0].transcript;
        }
      }
      this.interim = interim;
      if (interim) {
        const recentWithInterim = (this.lines.slice(-6).join(' ') + ' ' + interim).trim();
        // Fast keyword check (O(1))
        if (DANGER_PATTERNS.test(recentWithInterim)) {
          this.result = { score: 92, verdict: 'SCAM', signals: [{ code: 'DIGITAL_ARREST', weight: 40 }, { code: 'ARREST_THREAT', weight: 30 }], safe: [], unknowns: [] };
          this.emit();
          return this.fire('realtime-keyword');
        }
        // Throttle heavy full-text scoring on interim to at most once every 350ms to keep 2GB RAM phones fast
        const now = Date.now();
        if (now - this.lastInterimEval > 350) {
          this.lastInterimEval = now;
          const tmp = analyzeText(recentWithInterim, { mode: 'call' });
          if (tmp.score >= 75) {
            this.result = tmp;
            this.emit();
            return this.fire('realtime-score');
          }
        }
      }
      this.emit();
    };
    rec.onerror = (e) => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { this.running = false; this.error = e.error; this.emit(); } };
    rec.onend = () => { if (this.running) { try { rec.start(); } catch { /* restart race */ } } };
    rec.start();
    this.emit();
  }
  stop() {
    this.running = false; this.interim = '';
    if (window.VesperNative?.stopNativeSpeechRecognition) {
      try { window.VesperNative.stopNativeSpeechRecognition(); } catch {}
    }
    try { this.rec?.stop(); } catch { /* */ }
    if ('speechSynthesis' in window) {
      try { speechSynthesis.cancel(); } catch { /* */ }
    }
    this.timers.forEach(clearTimeout); this.timers = [];
    this.emit();
  }
  demo({ speak = true } = {}) {
    const script = DEMO[this.lang] || DEMO.en;
    this.lines = []; this.fired = false; this.running = true; this.demoMode = true; this.emit();
    let t = 600;
    script.forEach((line) => {
      this.timers.push(setTimeout(() => {
        if (!this.running || this.fired) return;
        if (speak && 'speechSynthesis' in window) {
          try { speechSynthesis.cancel(); } catch { /* */ }
          const u = new SpeechSynthesisUtterance(line);
          u.lang = DEMO[this.lang] ? this.bcp : 'en-IN';
          u.rate = 1.05;
          speechSynthesis.speak(u);
        }
        this.push(line);
      }, t));
      t += 2600 + line.length * 18;
    });
  }
}
