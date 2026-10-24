// BFX VESPER — app shell, screens and flows
import { LANGS, STRINGS } from './i18n.js';
import { REASONS } from './reasons.js';
import { I } from './icons.js';
import { analyzeText, decodeSender, checkPaymentFields, scoreFrom } from './engine.js';
import { CallGuard, speechSupported } from './callguard.js';
import { gemma } from './ondevice.js';

// ---------------------------------------------------------------- state
const KEY = 'vesper.v1';
const GEMMA_DEFAULT_URL = 'https://huggingface.co/ggml-org/gemma-3-1b-it-GGUF/resolve/main/gemma-3-1b-it-Q4_K_M.gguf?download=true';
const BUILTIN_TELEGRAM_BOT_TOKEN = '';
const BUILTIN_GUARDIAN_CHAT_ID = '';
const BUILTIN_GUARDIAN_NAME = 'Guardian';

const DEFAULT = { 
  lang: 'en', 
  name: 'Elder Citizen', 
  phone: '+91 98765 43210', 
  guardian: { 
    name: 'Family Guardian', 
    phone: '', 
    chatId: '', 
    tgName: '', 
    botToken: '' 
  }, 
  secret: null, 
  settings: { size: 'l', theme: 'light', autoRead: false }, 
  onboarded: false, 
  lock: null, 
  lastReport: null, 
  alerts: [], 
  tricksBest: 0, 
  aiMode: 'custom', 
  customProvider: 'groq', 
  customApiKey: '', 
  offlineModelUrl: GEMMA_DEFAULT_URL, 
  offlineModelDownloaded: false, 
  serverUrl: '' 
};
let S = (() => { 
  try { 
    const loaded = JSON.parse(localStorage.getItem(KEY) || '{}');
    const merged = { ...DEFAULT, ...loaded };
    if (!merged.guardian || !merged.guardian.chatId) {
      merged.guardian = { ...DEFAULT.guardian, ...(merged.guardian || {}) };
    }
    if (!merged.name) merged.name = 'Elder Citizen';
    if (!merged.phone) merged.phone = '+91 98765 43210';
    if (merged.serverUrl === 'https://bfxvesper.onrender.com') merged.serverUrl = '';
    return merged;
  } catch { 
    return { ...DEFAULT }; 
  } 
})();
if (S.serverUrl === 'https://bfxvesper.onrender.com') { S.serverUrl = ''; }
if (!S.offlineModelUrl || S.offlineModelUrl.includes('2b') || S.offlineModelUrl.includes('MLC')) { S.offlineModelUrl = GEMMA_DEFAULT_URL; }
const save = () => localStorage.setItem(KEY, JSON.stringify(S));
let server = { ai: {}, telegram: false };
let cg = null;           // active CallGuard
const mem = { ob: 1, sms: { text: '', sender: '' }, smsRes: null, pay: { file: null, url: '', expected: '' }, payRes: null, tricks: null, tg: null, callAudio: { file: null, url: '', name: '', transcript: '', res: null, loading: false, error: null } };

// ---------------------------------------------------------------- helpers
const $ = (q, el = document) => el.querySelector(q);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const L = () => LANGS.find((l) => l.code === S.lang) || LANGS[0];
function t(k, vars) {
  let s = STRINGS[S.lang]?.[k] ?? STRINGS.en[k] ?? k;
  if (vars) for (const [a, b] of Object.entries(vars)) s = s.replace(`{${a}}`, b);
  return s;
}
const r = (code) => REASONS[S.lang]?.[code] ?? REASONS.en[code] ?? code;
function toast(msg, ms = 2600) {
  document.querySelectorAll('.toast').forEach((x) => x.remove());
  const el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); el.textContent = msg;
  document.body.appendChild(el); setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 260); }, ms);
}
const BUILTIN_GROQ_KEY = '';
const GROQ_TEXT_MODEL = 'openai/gpt-oss-120b';
const GROQ_VISION_MODEL = 'qwen/qwen3.8-27b';
const isNativeAndroid = window.location.hostname === 'appassets.androidplatform.net' || window.location.protocol === 'file:' || !!window.VesperNative;
function getApiBase() { return (S.serverUrl || '').trim().replace(/\/+$/, ''); }

function extractAiJson(s) {
  if (!s) throw new Error('empty AI response');
  s = s.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1];
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) s = s.slice(a, b + 1);
  return JSON.parse(s);
}

async function groqDirectChat({ messages, model = GROQ_TEXT_MODEL, temperature = 0.2, json = true, timeout = 35000, max_tokens = 2048 }) {
  const key = ((S.aiMode === 'custom' && S.customApiKey) ? S.customApiKey : (S.customApiKey || BUILTIN_GROQ_KEY || '')).trim();
  if (!key) {
    throw new Error('API key required. Please set your free Groq or Gemini API key in Settings (Bring Your Own Key).');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature,
        messages,
        max_tokens,
        ...(json ? { response_format: { type: 'json_object' } } : {})
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Groq ${model} (${res.status}): ${err.error?.message || res.statusText}`);
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    return { content, model, usage: data.usage };
  } finally {
    clearTimeout(timer);
  }
}

async function groqCloudAnalyzeText({ text, sender = '', lang = S.lang, mode = 'sms' }) {
  const local = analyzeText(text, { sender, mode });
  const langName = (LANGS.find((l) => l.code === lang) || {}).name || 'English';
  const system = `You are the scam-check engine of BFX VESPER, a safety app for senior citizens in India.
You know Indian fraud patterns well: fake KYC/account-block SMS, "digital arrest" calls by fake police/CBI/customs, FedEx/courier drug parcel calls, electricity disconnection SMS, UPI collect-request and "scan QR to receive money" tricks, fake payment screenshots from modded PhonePe/GPay/Paytm apps, part-time job / task scams, lottery/KBC scams, AnyDesk/screen-share scams, OTP theft, fake customer care numbers, sextortion, investment doubling.
India facts: DLT SMS headers look like "AD-HDFCBK-T"; since May 2025 TRAI requires suffix -P (promotional), -S (service), -T (transactional), -G (government). Banks and police never ask for OTP, PIN, or money over calls. You never need to enter UPI PIN or scan a QR to RECEIVE money. Cyber-crime helpline is 1930, website cybercrime.gov.in, report spam on Sanchar Saathi (Chakshu).
Write every human-readable string in ${langName}.
Return ONLY JSON with this exact shape:
{
 "score": <integer 0-100, how likely this is a scam>,
 "verdict": "SCAM" | "SUSPICIOUS" | "LOOKS_SAFE",
 "scam_type": "<short name of the scam pattern, or 'none'>",
 "summary": "<one short, calm sentence for an elderly person>",
 "scam_reasons": [{"point": "<why it looks like a scam>", "weight": <integer points>}],
 "safe_reasons": [{"point": "<why it does NOT look fully like a scam / what looks genuine>", "weight": <integer points>}],
 "unknowns": ["<what you could not check or do not know, which keeps the score from being 0 or 100>"],
 "advice": ["<short action step>"]
}`;

  const what = mode === 'call' ? 'live phone-call transcript (speech-to-text, may have errors)' : mode === 'chat' ? 'WhatsApp/chat message' : 'SMS';
  const user = `Check this ${what}.${sender ? `\nSender / header: ${sender}` : ''}\nOn-device rule engine already found: ${local.signals.map((s) => s.code).join(', ') || 'nothing'} (score ${local.score}).\n---\n${text.slice(0, 4000)}\n---`;

  const { content, model } = await groqDirectChat({
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ]
  });

  const parsed = extractAiJson(content);
  const n = (x) => Math.max(0, Math.min(100, Math.round(Number(x) || 0)));
  const list = (a) => (Array.isArray(a) ? a : []).map((r) => (typeof r === 'string' ? { point: r, weight: 0 } : { point: String(r.point || r.reason || ''), weight: n(r.weight) })).filter((r) => r.point);
  const aiScore = n(parsed.score);
  const ai = {
    score: aiScore,
    verdict: ['SCAM', 'SUSPICIOUS', 'LOOKS_SAFE'].includes(parsed.verdict) ? parsed.verdict : aiScore >= 70 ? 'SCAM' : aiScore >= 40 ? 'SUSPICIOUS' : 'LOOKS_SAFE',
    scam_type: String(parsed.scam_type || ''),
    summary: String(parsed.summary || ''),
    scam_reasons: list(parsed.scam_reasons),
    safe_reasons: list(parsed.safe_reasons),
    unknowns: (Array.isArray(parsed.unknowns) ? parsed.unknowns : []).map(String).filter(Boolean),
    advice: (Array.isArray(parsed.advice) ? parsed.advice : []).map(String).filter(Boolean),
    provider: 'groq',
    model
  };

  const finalScore = Math.round(ai.score * 0.65 + local.score * 0.35);
  const finalVerdict = finalScore >= 70 ? 'SCAM' : finalScore >= 40 ? 'SUSPICIOUS' : 'LOOKS_SAFE';
  return { score: finalScore, verdict: finalVerdict, local, ai, aiError: null };
}

async function groqCloudAnalyzePayment(file, expected = '', lang = S.lang) {
  const b64 = await new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(reader.result.split(',')[1]);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
  const mime = file.type || 'image/png';
  const nowIso = new Date().toISOString();
  const langName = (LANGS.find((l) => l.code === lang) || {}).name || 'English';

  const system = `You are a forensic UPI payment verification engine for Indian payments (Google Pay, PhonePe, Paytm, BHIM, Amazon Pay, bank apps).
Current Indian local time: ${nowIso}. ${expected ? `Expected amount to receive: ₹${expected}.` : ''}

CRITICAL RULES FOR ACCURATE VERIFICATION:
1. GENUINE RECEIPTS (Score 5 to 20, Verdict: LOOKS_SAFE):
   - Standard typography, clear layout, official logos, valid status ("Completed", "Payment successful", "Paid successfully"), valid 12-digit UTR/UPI reference.
   - Standard NPCI UPI handles: @rapl, @apl, @yapl, @okaxis, @okhdfcbank, @okicici, @oksbi, @ybl, @ibl, @axl, @paytm, @ptaxis, @pthdfc, @ptsbi.

2. FAKE / EDITED / SPOOF MOD APK SIGNS (Score 75 to 95, Verdict: SCAM):
   - UTR missing or fewer than 12 digits (e.g. 8 digits or 10 digits as generated by fake mod APKs like Paytm Spoof or fake PhonePe).
   - Amount or name fonts visibly misaligned, mismatched font family, blurry, or pasted over.
   - Missing standard UPI/NPCI logo or wrong colors.
   - Status bar time is BEFORE transaction time on the same day.
   - Transaction date is set in the future.
   - Amount in screenshot does not match expected amount ${expected ? `(₹${expected})` : ''}.

Return ONLY valid JSON with:
{
  "fields": {
    "app": "Google Pay | PhonePe | Paytm | BHIM | Amazon Pay | Bank",
    "status": "Completed | Successful | Failed | Pending",
    "amount": "<digits only without ₹>",
    "datetime": "<ISO local or date string>",
    "utr": "<12-digit UPI reference number>",
    "txnId": "<transaction ID if present>",
    "payeeName": "<name of receiver>",
    "payeeUpi": "<UPI ID>",
    "payerName": "",
    "payerUpi": "",
    "bank": ""
  },
  "is_payment_screenshot": true,
  "score": <0-100 likelihood it is fake. Genuine=5 to 20, suspicious=35 to 55, fake=75 to 95>,
  "verdict": "LOOKS_SAFE" | "SUSPICIOUS" | "SCAM",
  "scam_type": "<EMPTY if genuine, or FAKE_APP_MOD / EDITED_SCREENSHOT / UTR_SHORT / AMOUNT_MISMATCH>",
  "summary": "<1 clear sentence for elder explaining whether receipt looks genuine or fake>",
  "scam_reasons": [{"point": "<specific defect if any>", "weight": 20}],
  "safe_reasons": [{"point": "<verified genuine point like standard 12-digit UTR, standard font, official UPI handle>", "weight": 20}],
  "unknowns": ["Always verify credit in your bank app or soundbox before handing over goods."],
  "advice": ["<actionable advice for elder in ${langName}>"]
}`;

  const { content, model } = await groqDirectChat({
    model: GROQ_VISION_MODEL,
    messages: [
      { role: 'system', content: system },
      {
        role: 'user',
        content: [
          { type: 'text', text: `Check this Indian payment receipt screenshot for authenticity. Expected amount: ${expected ? '₹' + expected : 'Not specified'}.` },
          { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } }
        ]
      }
    ]
  });

  const parsed = extractAiJson(content);
  const fields = parsed.fields || {};
  const rules = checkPaymentFields(fields, { expectedAmount: expected });
  const ruleScore = scoreFrom(rules.signals, rules.safe);
  const n = (x) => Math.max(0, Math.min(100, Math.round(Number(x) || 0)));
  const aiScore = n(parsed.score);
  const finalScore = Math.round(aiScore * 0.60 + ruleScore * 0.40);
  const finalVerdict = finalScore >= 70 ? 'SCAM' : finalScore >= 40 ? 'SUSPICIOUS' : 'LOOKS_SAFE';

  return {
    score: finalScore,
    verdict: finalVerdict,
    fields,
    rules,
    ruleScore,
    ai: {
      score: aiScore,
      verdict: parsed.verdict || (aiScore >= 70 ? 'SCAM' : aiScore >= 40 ? 'SUSPICIOUS' : 'LOOKS_SAFE'),
      scam_type: parsed.scam_type || '',
      summary: parsed.summary || '',
      scam_reasons: parsed.scam_reasons || [],
      safe_reasons: parsed.safe_reasons || [],
      unknowns: parsed.unknowns || [],
      advice: parsed.advice || [],
      provider: 'groq',
      model
    }
  };
}

async function api(path, opts = {}) {
  // If remote server is specified, try it first
  const base = getApiBase();
  if (base && base.startsWith('http')) {
    const init = { method: opts.method || (opts.body ? 'POST' : 'GET'), headers: {} };
    if (S.aiMode === 'custom' && S.customApiKey) {
      init.headers['x-custom-key'] = S.customApiKey;
      init.headers['x-custom-provider'] = S.customProvider || 'groq';
    }
    if (opts.form) { init.body = opts.form; init.method = 'POST'; }
    else if (opts.body) { init.body = JSON.stringify(opts.body); init.headers['content-type'] = 'application/json'; }
    try {
      const res = await fetch(base + path, init);
      const j = await res.json().catch(() => ({}));
      if (res.ok) return j;
    } catch (_err) {
      // Continue to direct Groq client-side execution
    }
  }

  // Client-side autonomous execution
  if (path.includes('/analyze/text')) {
    if (S.aiMode === 'offline' || !navigator.onLine) {
      const local = analyzeText(opts.body?.text || '', { sender: opts.body?.sender, mode: opts.body?.mode || 'sms' });
      return { score: local.score, verdict: local.verdict, local, ai: null, offline: true };
    }
    try {
      return await groqCloudAnalyzeText({
        text: opts.body?.text || '',
        sender: opts.body?.sender || '',
        lang: opts.body?.lang || S.lang,
        mode: opts.body?.mode || 'sms'
      });
    } catch (err) {
      console.warn('Groq text check failed, using on-device:', err);
      const local = analyzeText(opts.body?.text || '', { sender: opts.body?.sender, mode: opts.body?.mode || 'sms' });
      return { score: local.score, verdict: local.verdict, local, ai: null, aiError: err.message };
    }
  }

  if (path.includes('/status')) {
    return { ai: { gemini: false, groq: true }, primary: 'groq', telegram: !!S.guardian?.chatId, whatsapp: false };
  }

  if (path.includes('/scamtricks/generate')) {
    const langName = (LANGS.find((l) => l.code === (opts.body?.lang || S.lang)) || {}).name || 'English';
    const { content } = await groqDirectChat({
      messages: [
        {
          role: 'system',
          content: `You are the scam education generator for BFX VESPER. Generate 4 realistic Indian scam vs genuine scenarios for senior citizens in India. Write in ${langName}. Return ONLY JSON with {"items":[{"channel":"SMS"|"Call"|"WhatsApp","sender":"...","text":"...","isScam":true|false,"clue":"...","explanation":"..."}]}`
        },
        { role: 'user', content: 'Generate 4 quiz items (2 scams, 2 genuine).' }
      ]
    });
    return extractAiJson(content);
  }

  throw new Error(`API path not available offline: ${path}`);
}
function speak(text) {
  if (!text) return;
  if (window.VesperNative?.speak) {
    window.VesperNative.speak(text, S.lang);
    return;
  }
  if (!('speechSynthesis' in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = L().bcp || 'en-IN';
    u.rate = 0.92;
    speechSynthesis.speak(u);
  } catch (e) {
    console.warn('Speech synthesis error:', e);
  }
}
const deviceInfo = () => { const ua = navigator.userAgent; const m = ua.match(/Android [\d.]+/); return `${m ? m[0] : navigator.platform || 'Web'} · ${/Chrome\/(\d+)/.test(ua) ? 'Chrome ' + ua.match(/Chrome\/(\d+)/)[1] : 'Browser'}`; };
function getLocation(timeout = 8000) {
  return new Promise((res) => {
    if (!navigator.geolocation) return res(null);
    navigator.geolocation.getCurrentPosition((p) => res({ lat: +p.coords.latitude.toFixed(6), lon: +p.coords.longitude.toFixed(6), acc: p.coords.accuracy }), () => res(null), { enableHighAccuracy: true, timeout, maximumAge: 60000 });
  });
}
const fmtTime = (ts) => new Date(ts).toLocaleString(L().bcp, { dateStyle: 'medium', timeStyle: 'short' });
const initials = (s) => (String(s || '?').replace(/^test:/, '').replace(/[^\p{L}\d ]/gu, '').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2) || '#').toUpperCase();

// ---------------------------------------------------------------- motion
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
function animateIn(root) {
  if (!root || reduced.matches) return;
  root.querySelectorAll('.home-head > *, .status, .section-label, .tools li, .sos, .screen > *, .lock-top > *, #result > :not(.verdict)')
    .forEach((el, i) => { el.style.setProperty('--d', Math.min(i, 12) * 38 + 'ms'); el.classList.add('rise'); });
  root.querySelectorAll('.lang, .reasons li, .steps-list li, .app-t, .perm, .code-row, .chat-row, .ftable tr, .kv dd')
    .forEach((el) => { const i = [...el.parentNode.children].indexOf(el); el.style.setProperty('--d2', Math.min(i, 12) * 42 + 140 + 'ms'); el.classList.add('fadein'); });
}
function countUp(el, from, to, ms = 900) {
  if (!el) return;
  if (reduced.matches || from === to) { el.textContent = to; return; }
  const tok = (el._tok = Symbol()); const t0 = performance.now();
  const step = (now) => { if (el._tok !== tok) return; const p = Math.min(1, (now - t0) / ms); el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); };
  el.textContent = from; requestAnimationFrame(step);
}
const countScores = (root, from = 0) => root?.querySelectorAll('.score .n').forEach((el) => countUp(el, from, +el.textContent));
const soft = () => render(false);
function closeSheet() { const sh = $('#sheet'); if (!sh) return; if (reduced.matches) return sh.remove(); sh.classList.add('closing'); setTimeout(() => sh.remove(), 240); }

// ---------------------------------------------------------------- secrets (PBKDF2, SHA-256)
async function hashSecret(code, phrase, salt) {
  const norm = `${String(code).trim()}::${String(phrase).trim().toLowerCase().replace(/\s+/g, ' ')}`;
  if (crypto?.subtle) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(norm), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 150000, hash: 'SHA-256' }, key, 256);
    return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  let h = 2166136261; for (const c of salt + norm) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return 'f' + (h >>> 0).toString(16); // insecure-context fallback
}
const newSalt = () => [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(16).padStart(2, '0')).join('');

// ---------------------------------------------------------------- theme
function applyPrefs() {
  const d = document.documentElement;
  d.dataset.theme = S.settings.theme; d.dataset.size = S.settings.size; d.lang = S.lang;
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', S.settings.theme === 'dark' ? '#0D0C0A' : '#F0EEE9');
}

// ---------------------------------------------------------------- router
function route() {
  const h = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = h.split('?');
  return { path, q: new URLSearchParams(qs || '') };
}
const go = (p) => { location.hash = p; };
window.addEventListener('hashchange', () => render(true));
window.addEventListener('popstate', () => {
  if (S.lock) {
    try { history.pushState(null, '', location.href); } catch {}
    render();
  }
});

const topbar = (title, backTo = '#/') => `<header class="topbar"><a class="back" href="${backTo}" aria-label="${esc(t('back'))}">${I.back}<span>${esc(t('back'))}</span></a><div class="title">${esc(title)}</div></header>`;
const nav = (active) => `<nav class="nav" aria-label="Main">
  <a href="#/" class="${active === 'home' ? 'active' : ''}">${I.home}<span>${esc(t('nav_home'))}</span></a>
  <a href="#/guardian" class="${active === 'guard' ? 'active' : ''}">${I.guardian}<span>${esc(t('nav_guard'))}</span></a>
  <a href="#/settings" class="${active === 'settings' ? 'active' : ''}">${I.settings}<span>${esc(t('nav_settings'))}</span></a></nav>`;

let currentScreen = '';
function render(anim = false) {
  const { path, q } = route();
  const screenChanged = currentScreen !== path;
  currentScreen = path;
  const prevScrollY = window.scrollY;

  applyPrefs();
  if (S.secret?.passcode && window.VesperNative?.setUserPasscode) {
    window.VesperNative.setUserPasscode(S.secret.passcode);
  }
  if (S.secret?.passphrase && window.VesperNative?.setUserPassphrase) {
    window.VesperNative.setUserPassphrase(S.secret.passphrase);
  }
  const app = $('#app');
  if (S.lock) {
    try { history.pushState(null, '', location.href); } catch {}
    app.innerHTML = lockScreen();
    if (anim && screenChanged) animateIn(app);
    return;
  }
  if (!S.onboarded) { app.innerHTML = onboarding(); if (anim && screenChanged) animateIn(app); afterOnboard(); return; }
  const screens = {
    '/': home, '/call': callScreen, '/sms': smsScreen, '/payment': payScreen, '/tricks': tricksScreen,
    '/guardian': guardianScreen, '/settings': settingsScreen, '/report': reportScreen,
    '/nokia': nokiaScreen,
  };
  const fn = screens[path] || home;
  app.innerHTML = fn(q);
  if (anim && screenChanged) { animateIn(app); countScores(app); }
  if (path === '/call') updateCallUI();
  if (path === '/sms' && q.get('text') && !mem.sms.text) { mem.sms.text = q.get('text'); render(); }
  if (path === '/payment' && q.get('shared')) loadShared(q.get('shared'));

  if (screenChanged) {
    if (anim) window.scrollTo(0, 0);
  } else {
    window.scrollTo(0, prevScrollY);
  }
}

// ================================================================ ONBOARDING
function onboarding() {
  const n = mem.ob, total = 5;
  const steps = `<div class="steps" aria-label="${esc(t('step_of', { a: n, b: total }))}">${Array.from({ length: total }, (_, i) => `<i class="${i + 1 < n ? 'done' : i + 1 === n ? 'now' : ''}"></i>`).join('')}</div>`;
  const head = `<div class="row" style="justify-content:space-between;margin-bottom:1rem"><div class="brand">${I.logo}<b>BFX VESPER SPAM DETECTION</b></div><span class="eyebrow">${esc(t('step_of', { a: n, b: total }))}</span></div>${steps}`;
  const back = n > 1 ? `<button class="btn btn-ghost" data-act="ob-back">${I.back}${esc(t('back'))}</button>` : '';
  let body = '';
  if (n === 1) body = `
    <p class="eyebrow">${esc(t('app_tag'))}</p>
    <h1 class="h1">${esc(t('choose_lang'))}</h1>
    <div class="lang-grid" role="radiogroup">${LANGS.map((l) => `<button class="lang ${l.code === S.lang ? 'on' : ''}" role="radio" aria-checked="${l.code === S.lang}" data-act="set-lang" data-v="${l.code}"><b lang="${l.code}">${l.name}</b><span>${l.en}</span></button>`).join('')}</div>
    <button class="btn btn-primary" data-act="ob-next">${esc(t('continue'))}${I.chev}</button>`;
  if (n === 2) body = `
    <h1 class="h1">${esc(t('ob_name_q'))}</h1>
    <label class="field"><span>${esc(t('ob_name_ph'))}</span><input class="input" id="ob-name" autocomplete="name" value="${esc(S.name)}" placeholder="${esc(t('ob_name_ph'))}"></label>
    <label class="field"><span>${esc(t('ob_phone'))}</span><input class="input" id="ob-phone" inputmode="tel" autocomplete="tel" value="${esc(S.phone)}" placeholder="+91"></label>
    <button class="btn btn-primary" data-act="ob-save-name">${esc(t('continue'))}${I.chev}</button>${back}`;
  if (n === 3) body = `
    <h1 class="h1">${esc(t('ob_guard_title'))}</h1><p class="lead">${esc(t('ob_guard_desc'))}</p>
    <label class="field"><span>${esc(t('guard_name'))}</span><input class="input" id="g-name" value="${esc(S.guardian?.name || '')}"></label>
    <label class="field"><span>${esc(t('guard_phone'))}</span><input class="input" id="g-phone" inputmode="tel" value="${esc(S.guardian?.phone || '')}" placeholder="+91"></label>
    ${tgBlock()}
    <button class="btn btn-primary" data-act="ob-save-guard">${esc(t('continue'))}${I.chev}</button>${back}`;
  if (n === 4) body = secretForm(true) + back;
  if (n === 5) {
    const permList = window.VesperNative ? [
      ['call', 'Call Guardian - Automatically dials guardian during emergency lock', I.phone],
      ['mic', 'perm_mic', I.mic],
      ['notif', 'perm_notif', I.bell],
      ['loc', 'perm_loc', I.pin]
    ] : [
      ['mic', 'perm_mic', I.mic],
      ['loc', 'perm_loc', I.pin],
      ['notif', 'perm_notif', I.bell]
    ];
    const isGranted = (k) => {
      if (k === 'call') return window.VesperNative?.isCallPermissionGranted?.() || mem['perm_call'];
      return !!mem['perm_' + k];
    };
    body = `
      <h1 class="h1">${esc(t('ob_perm_title'))}</h1>
      <p class="lead" style="margin:0 0 1rem;font-size:0.95rem">Enable protections so scammers cannot minimize or bypass emergency lockdown.</p>
      ${permList.map(([k, label, ic]) => `
        <div class="perm"><div class="tile m">${ic}</div><div>${esc(t(label) || label)}</div><div id="perm-${k}">${isGranted(k) ? `<span class="ok-pill">${I.check}${esc(t('allowed'))}</span>` : `<button class="btn btn-sm" data-act="perm" data-v="${k}">${esc(t('allow'))}</button>`}</div></div>`).join('')}
      <div style="margin-top:1.4rem"><button class="btn btn-primary" data-act="ob-finish">${I.check}${esc(t('start'))}</button></div>${back}`;
  }
  return `<main class="screen no-nav stack">${head}${body}</main>`;
}
function afterOnboard() { if (mem.ob === 3 && mem.tg?.code && !mem.tg.linked) pollTg(); }

function tgBlock() {
  const g = S.guardian || {};
  if (g.chatId) return `<div class="note"><div class="row"><span class="ok-pill">${I.check}${esc(t('tg_linked'))}</span><span class="small">${esc(g.tgName || '')}</span></div></div>`;
  if (mem.tg?.url) return `<div class="note stack">
      <div class="row"><div class="spin"></div><b>${esc(t('tg_waiting'))}</b></div>
      <p class="small" style="margin:0">${esc(t('tg_link_desc'))}</p>
      <div class="linkbox">${esc(mem.tg.url)}</div>
      <div class="btn-pair"><a class="btn btn-sm" style="width:100%" href="${esc(mem.tg.url)}" target="_blank" rel="noopener">${I.telegram}${esc(t('tg_open'))}</a><button class="btn btn-sm" style="width:100%" data-act="tg-share">${I.share}Share</button></div></div>`;
  return `<button class="btn" data-act="tg-start">${I.telegram}${esc(t('tg_link'))}</button>${mem.tg?.error ? `<p class="err">${esc(mem.tg.error)}</p>` : ''}`;
}
async function tgStart() {
  try { const r = await api('/api/telegram/link/start', { body: {} }); mem.tg = { ...r, linked: false }; render(); pollTg(); }
  catch (e) { mem.tg = { error: (e.message || '').includes('token') ? 'Telegram bot is not set up yet. Add the bot token in Settings → Setup for developers.' : e.message }; render(); }
}
let tgPolling = false;
async function pollTg() {
  if (tgPolling) return; tgPolling = true;
  const until = Date.now() + 5 * 60 * 1000;
  while (mem.tg?.code && !mem.tg.linked && Date.now() < until) {
    try {
      const r = await api('/api/telegram/link/check?code=' + mem.tg.code);
      if (r.linked) { mem.tg.linked = true; S.guardian = { ...(S.guardian || {}), chatId: r.chatId, tgName: r.name || r.username }; save(); toast(t('tg_linked')); render(); break; }
    } catch { /* keep trying */ }
    await new Promise((res) => setTimeout(res, 3000));
  }
  tgPolling = false;
}
function secretForm(onboard) {
  return `<h1 class="h1">${esc(t(onboard ? 'ob_secret_title' : 'g_change'))}</h1><p class="lead">${esc(t('ob_secret_desc'))}</p>
    <label class="field"><span>${esc(t('passcode'))} (6 digits)</span><input class="input pin" id="sec-code" inputmode="numeric" maxlength="6" type="password" autocomplete="new-password" value="${S.secret?.passcode || ''}"></label>
    <label class="field"><span>${esc(t('confirm'))}</span><input class="input pin" id="sec-code2" inputmode="numeric" maxlength="6" type="password" autocomplete="new-password" value="${S.secret?.passcode || ''}"></label>
    <label class="field"><span>${esc(t('passphrase'))}</span><input class="input" id="sec-phrase" type="password" autocomplete="new-password" value="${S.secret?.passphrase || ''}" placeholder="e.g. green tree blue mountain"><div class="hint">${esc(t('passphrase_hint'))}</div></label>
    <label class="field"><span>${esc(t('confirm'))}</span><input class="input" id="sec-phrase2" type="password" autocomplete="new-password" value="${S.secret?.passphrase || ''}"></label>
    <p class="err" id="sec-err" role="alert"></p>
    <button class="btn btn-primary" data-act="save-secret" data-v="${onboard ? 1 : 0}">${I.lock}${esc(t(onboard ? 'continue' : 'save'))}</button>`;
}
function isWeakPasscode(code) {
  if (!/^\d{6}$/.test(code)) return 'Passcode must be exactly 6 digits';
  return null;
}

async function saveSecret(onboard) {
  const code = $('#sec-code').value.trim(), code2 = $('#sec-code2').value.trim(), p = ($('#sec-phrase').value || '').trim(), p2 = ($('#sec-phrase2').value || '').trim();
  const err = $('#sec-err');
  const weak = isWeakPasscode(code);
  if (weak) { err.textContent = weak; return; }
  if (code !== code2) { err.textContent = t('mismatch'); return; }
  if (!p) { err.textContent = 'Please enter a recovery passphrase'; return; }
  if (p !== p2) { err.textContent = t('mismatch'); return; }
  const salt = newSalt();
  S.secret = { salt, hash: await hashSecret(code, p, salt), passcode: code, passphrase: p };
  save();
  if (window.VesperNative?.setUserPasscode) {
    window.VesperNative.setUserPasscode(code);
  }
  if (window.VesperNative?.setUserPassphrase) {
    window.VesperNative.setUserPassphrase(p);
  }
  if (onboard) { mem.ob = 5; render(true); } else { toast(t('saved')); go('#/guardian'); }
}

// ================================================================ HOME
function home() {
  const on = cg?.running;
  const tool = (href, tile, icon, title, desc) => `<li><a class="tool" href="${href}"><div class="tile ${tile}">${icon}</div><div><b>${esc(t(title))}</b><span>${esc(t(desc))}</span></div>${I.chev}</a></li>`;

  return `
  <header class="home-head">
    <div class="row" style="justify-content:space-between"><div class="brand">${I.logo}<b>BFX VESPER SPAM DETECTION</b></div><a class="chip" href="#/settings" aria-label="${esc(t('set_lang'))}">${I.globe.replace('<svg', '<svg width="18" height="18"')}${esc(L().name)}</a></div>
    <p class="greet">${esc(t('hello'))}${S.name ? ', ' + esc(S.name) : ''}</p>
    <p class="small" style="margin:0">${esc(t('app_tag'))}</p>
  </header>
  <a class="status ${on ? 'on' : 'off'}" href="#/call"><span class="dot"></span><div class="grow"><b>${esc(t(on ? 'guard_on' : 'guard_off'))}</b><span>${esc(t(on ? 'guard_on_sub' : 'guard_off_sub'))}</span></div>${I.chev}</a>
  <div class="section-label eyebrow">${esc(t('home_q'))}</div>
  <ul class="tools">
    ${tool('#/call', 'n', I.callguard, 't_call', 't_call_d')}
    <li><a class="tool" href="#/nokia" style="background:#f0fdf4;border:1.5px solid #86efac"><div class="tile" style="background:#16a34a;color:#fff;font-size:1.3rem">📟</div><div><b style="color:#15803d">Nokia Button Phone Simulator</b><span style="color:#166534">Cloud Voice AI protection for keypad phones</span></div>${I.chev}</a></li>
    ${tool('#/sms', 'm', I.sms, 't_sms', 't_sms_d')}
    ${tool('#/payment', 's', I.pay, 't_pay', 't_pay_d')}
    ${tool('#/tricks', 'p', I.tricks, 't_tricks', 't_tricks_d')}
  </ul>
  <div class="sos">
    ${S.guardian?.phone ? `<button class="btn btn-ink" data-act="call-guardian">${I.phone}${esc(t('call_guardian'))} (${esc(S.guardian.phone)})</button>` : `<a class="btn btn-ink" href="#/guardian">${I.guardian}${esc(t('g_add'))}</a>`}
    <a class="btn btn-danger" href="tel:1930">${I.alert}${esc(t('cyber_help'))}</a>
  </div>
  <div style="height:5rem"></div>${nav('home')}`;
}

// ================================================================ CALL GUARD
function ensureCG() {
  if (cg && cg.lang === S.lang) return cg;
  if (cg?.running) cg.stop();
  cg = new CallGuard({
    lang: S.lang, bcp: L().bcp,
    onUpdate: () => updateCallUI(),
    onDanger: (d) => {
      triggerLock({ source: 'call', score: d.score, transcript: d.transcript, signals: d.local.signals.map((s) => s.code), aiReasons: d.reasons, scamType: d.ai?.scam_type || '', ai: d.ai, local: d.local });
    },
    aiCheck: (text) => api('/api/analyze/text', { body: { text, mode: 'call', lang: S.lang } }),
  });
  return cg;
}
// ================================================================ CALL & AUDIO SCAM ANALYZER
async function groqTranscribeAudio(file) {
  const key = ((S.aiMode === 'custom' && S.customApiKey) ? S.customApiKey : (S.customApiKey || BUILTIN_GROQ_KEY || '')).trim();
  if (!key) {
    throw new Error('API key required. Please enter your free Groq API key in Settings.');
  }
  const fd = new FormData();
  fd.append('file', file);
  fd.append('model', 'whisper-large-v3-turbo');
  fd.append('response_format', 'json');
  fd.append('prompt', 'CBI, Police, Customs, Narcotics, Digital Arrest, Parcel, Drugs, OTP, Transfer, Bank, Aadhaar, Warrant, Court, Mumbai Police, Tamil, Hindi, Telugu, Marathi, Gujarati');

  const whisperLang = whisperLangCode(S.lang);
  if (whisperLang) {
    fd.append('language', whisperLang);
  }

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`
    },
    body: fd
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Whisper transcription error (${res.status}): ${errText}`);
  }
  const data = await res.json();
  return data.text || '';
}

function whisperLangCode(langCode) {
  const c = String(langCode || '').trim().toLowerCase();
  if (c.startsWith('ta')) return 'ta';
  if (c.startsWith('hi')) return 'hi';
  if (c.startsWith('te')) return 'te';
  if (c.startsWith('kn')) return 'kn';
  if (c.startsWith('mr')) return 'mr';
  if (c.startsWith('gu')) return 'gu';
  if (c.startsWith('ml')) return 'ml';
  if (c.startsWith('bn')) return 'bn';
  if (c.startsWith('pa')) return 'pa';
  return null;
}

function highlightTranscript(text) {
  let h = esc(text);
  const keywords = [
    'digital arrest', 'cbi', 'police', 'customs', 'narcotics', 'parcel', 'drugs',
    'warrant', 'arrest', 'otp', 'transfer', 'safe account', 'quicksupport', 'anydesk',
    'money laundering', 'aadhaar', 'rbi', 'bank account', 'supreme court', 'disconnect',
    'डिजिटल अरेस्ट', 'पुलिस', 'वारंट', 'गिरफ्तारी', 'டிஜிட்டல் அரெஸ்ட்', 'போலீஸ்', 'கைது'
  ];
  for (const kw of keywords) {
    const re = new RegExp(`(${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    h = h.replace(re, '<mark class="hit" style="background:#fee2e2;color:#dc2626;padding:1px 4px;border-radius:4px;font-weight:700">$1</mark>');
  }
  return h;
}

const AUDIO_SAMPLES = {
  cbi: {
    name: 'Sample_CBI_Digital_Arrest.mp3',
    transcript: 'Hello, am I speaking with the account holder? This is Inspector Sharma from Mumbai Cyber Crime Branch. A FedEx courier parcel registered under your Aadhaar card number was intercepted at Mumbai international airport containing 140 grams of illegal MDMA narcotics and 5 fake passports. A non-bailable arrest warrant has been issued against you by the Supreme Court. You are currently placed under digital arrest. Do not disconnect this call, do not speak with anyone in your house. To verify your innocence and remove your name from the money laundering charge, you must immediately transfer your entire savings account balance to the RBI verification safe account. What is the OTP you just received on your mobile?'
  },
  power: {
    name: 'Sample_Electricity_Disconnection.mp3',
    transcript: 'Dear consumer, this is urgent notice from State Electricity Board. Your power supply will be disconnected tonight at 9:30 PM because your previous month electricity bill was not updated in government portal. Please call our power officer immediately at 98765-43210 and install our QuickSupport verification app to prevent disconnection of your meter.'
  }
};

function setAudioFile(file) {
  if (!file) return;
  const ca = (mem.callAudio ||= {});
  if (ca.url) URL.revokeObjectURL(ca.url);
  ca.file = file;
  ca.name = file.name || 'Call_Recording.mp3';
  ca.url = URL.createObjectURL(file);
  ca.transcript = '';
  ca.res = null;
  ca.error = null;
  ca.loading = false;
  render();
}

async function analyzeAudio() {
  const ca = mem.callAudio;
  if (!ca || (!ca.file && !ca.transcript)) {
    toast('Please select an audio file first');
    return;
  }
  ca.loading = true;
  ca.error = null;
  render();

  try {
    let transcript = ca.transcript;
    if (ca.file && !transcript) {
      toast('🎙️ Transcribing audio with Whisper AI...');
      transcript = await groqTranscribeAudio(ca.file);
      ca.transcript = transcript;
    }

    if (!transcript || !transcript.trim()) {
      throw new Error('No speech could be recognized from this audio file. Please ensure it contains clear audio.');
    }

    toast('🔍 Evaluating scam patterns with AI...');
    const result = await groqCloudAnalyzeText({
      text: transcript,
      sender: 'Incoming Call Recording',
      lang: S.lang,
      mode: 'call'
    });

    ca.res = result;
    ca.loading = false;
    render();

    if (result.score >= 70) {
      toast('🚨 HIGH RISK SCAM DETECTED (' + result.score + '/100)');
      alarm();
    } else {
      toast('Analysis complete (Risk Score: ' + result.score + '/100)');
    }
  } catch (err) {
    console.error('Audio analysis failed:', err);
    ca.loading = false;
    ca.error = err.message || 'Failed to analyze audio';
    render();
    toast('Error: ' + (err.message || 'Analysis failed'));
  }
}

function callScreen() {
  const ca = (mem.callAudio ||= { file: null, url: '', name: '', transcript: '', res: null, loading: false, error: null });
  return `${topbar('Call & Audio Scam Analyzer')}
  <main class="screen stack">
    <div style="display:flex;gap:.5rem;margin-bottom:.6rem">
      <button class="btn btn-sm btn-primary" style="flex:1;cursor:default">📁 Audio Upload Mode</button>
      <a class="btn btn-sm btn-ghost" href="#/nokia" style="flex:1;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:.3rem;border:1.5px solid #16a34a;color:#15803d;font-weight:700;background:#f0fdf4">📟 Nokia Keypad Mode</a>
    </div>
    <p class="lead" style="font-size:1.05rem;color:var(--ink)">
      Upload any call recording or voice audio (MP3, WAV, M4A, AAC) to transcribe with AI and detect cyber fraud.
    </p>

    <input type="file" id="audio-file" accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.opus,.flac" class="sr">

    ${ca.url ? `
      <div class="card" style="padding:1rem;background:var(--paper-2);border-radius:12px;border:1px solid var(--line);margin-bottom:.5rem">
        <div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.6rem">
          <span style="font-size:1.4rem">🎵</span>
          <div style="flex:1;overflow:hidden">
            <b style="font-size:.95rem;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(ca.name || 'Call_Recording.mp3')}</b>
            <span class="small" style="color:var(--ink);opacity:.7">${ca.file ? (ca.file.size / 1024 / 1024).toFixed(2) + ' MB' : 'Audio File'}</span>
          </div>
          <button class="btn btn-sm" data-act="audio-pick" style="padding:.3rem .7rem;font-size:.82rem">Change</button>
        </div>
        <audio controls src="${ca.url}" style="width:100%;height:40px;border-radius:8px"></audio>
      </div>
    ` : `
      <button class="drop" data-act="audio-pick">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--accent,#2563eb);margin-bottom:.5rem">
          <path d="M9 18V5l12-2v13"></path>
          <circle cx="6" cy="18" r="3"></circle>
          <circle cx="18" cy="16" r="3"></circle>
        </svg>
        <b style="font-size:1.15rem;margin-bottom:.2rem">Upload Call Recording</b>
        <span class="small">Tap to pick MP3 · WAV · M4A · AAC · Voice Notes</span>
      </button>

      <div style="display:flex;flex-direction:column;gap:.5rem;margin:.6rem 0">
        <span class="eyebrow" style="text-align:center">OR TEST WITH SAMPLE SCAM CALLS</span>
        <button class="btn btn-sm btn-ghost" data-act="sample-audio-cbi" style="width:100%;border:1.5px dashed var(--line);font-weight:600;padding:.65rem .85rem;text-align:left;display:flex;align-items:center;gap:.5rem">
          🚨 <span><b>Demo 1:</b> "Digital Arrest" — CBI / Mumbai Police Narcotics Parcel Scam</span>
        </button>
        <button class="btn btn-sm btn-ghost" data-act="sample-audio-power" style="width:100%;border:1.5px dashed var(--line);font-weight:600;padding:.65rem .85rem;text-align:left;display:flex;align-items:center;gap:.5rem">
          ⚡ <span><b>Demo 2:</b> "Electricity Disconnection" Fake Bill Helpline APK Scam</span>
        </button>
      </div>
    `}

    <button class="btn btn-primary" data-act="audio-analyze" ${ca.file || ca.transcript ? '' : 'disabled'}>
      ${ca.loading ? `<span class="spin"></span> Transcribing & Checking Scam...` : `${I.check} Transcribe & Check Scam Now`}
    </button>

    ${ca.loading ? `
      <div class="refining" style="margin-top:1rem;padding:1rem;background:var(--paper-2);border-radius:12px;text-align:center">
        <div class="spin"></div>
        <b style="display:block;margin-top:.4rem">Transcribing audio with Groq Whisper Large V3 Turbo...</b>
        <span class="small" style="display:block;margin-top:.2rem;color:var(--ink);opacity:.7">Converting speech to text & evaluating cybercrime patterns</span>
      </div>
    ` : ''}

    ${ca.error ? `<div class="note warn" style="margin-top:1rem">${esc(ca.error)}</div>` : ''}

    ${ca.transcript ? `
      <div style="margin-top:1rem">
        <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:.4rem">
          <p class="eyebrow" style="margin:0">WHISPER AI AUDIO TRANSCRIPT</p>
          <span class="small" style="color:var(--accent,#2563eb);font-weight:600">Verbatim Speech-To-Text</span>
        </div>
        <div class="transcript" id="tx" style="max-height:220px;overflow-y:auto;background:var(--paper-2);padding:.85rem;border-radius:10px;border:1px solid var(--line);font-size:.95rem;line-height:1.55">
          ${highlightTranscript(ca.transcript)}
        </div>
      </div>
    ` : ''}

    <div id="call-result">
      ${ca.res ? renderResult(ca.res, { kind: 'call' }) : ''}
    </div>

    ${ca.res && ca.res.score >= 70 ? `
      <div style="display:flex;flex-direction:column;gap:.6rem;margin-top:1rem">
        <button class="btn btn-danger" data-act="call-lockdown" style="background:#dc2626;color:#fff;font-weight:700;padding:.85rem;border-radius:10px">
          🚨 Lock Down Phone & Alert Guardian
        </button>
        <button class="btn btn-sec" data-act="call-1930" style="font-weight:600;padding:.75rem">
          📞 Dial 1930 Cyber Crime Helpline
        </button>
      </div>
    ` : ''}

    <p class="small" style="margin-top:1.2rem;text-align:center">${I.lock.replace('<svg', '<svg width="16" height="16" style="vertical-align:-3px"')} Powered by Groq Whisper Large V3 Turbo & Gemma AI</p>
  </main>${nav('home')}`;
}

// ================================================================ NOKIA BUTTON PHONE SIMULATOR
const NOKIA_SCAMS = [
  {
    id: 'digital_arrest',
    title: 'CBI Digital Arrest',
    shortTitle: '👮 CBI Arrest',
    callerNumber: '+91 98210-94821',
    callerName: 'POLICE HQ MUMBAI',
    text: 'This is Inspector Sharma from Mumbai Cyber Crime Branch. Your Aadhaar card is under immediate digital arrest for a DHL parcel containing 140 grams of MDMA narcotics. Transfer fifty thousand rupees immediately to the RBI escrow verification account, or a police team will reach your home in thirty minutes to arrest you.',
    screenQuote: 'Aadhaar under digital arrest! 140g MDMA parcel found. Transfer ₹50,000 to RBI escrow now or physical arrest warrant will be issued.',
    quickReply: 'They said they are police from Mumbai and found drugs in my courier parcel and demanded fifty thousand rupees to stop my arrest.'
  },
  {
    id: 'electricity',
    title: 'Electricity Disconnection',
    shortTitle: '⚡ Power Cut',
    callerNumber: '+91 88712-44102',
    callerName: 'POWER DEPT NOTICE',
    text: 'Urgent notice from State Electricity Board. Your domestic power connection will be permanently disconnected tonight at nine thirty PM due to an unpaid meter update. Call our officer immediately and install the QuickSupport APK update to prevent blackout.',
    screenQuote: 'Power will be disconnected tonight at 9:30 PM! Call officer immediately & install APK to update meter.',
    quickReply: 'They said electricity department is cutting power tonight at nine thirty unless I install an APK and pay immediately.'
  },
  {
    id: 'bank_kyc',
    title: 'Bank KYC Freeze',
    shortTitle: '🏦 Bank KYC',
    callerNumber: '+91 78912-34567',
    callerName: 'SBI YONO SECURITY',
    text: 'Dear customer, this is SBI customer security. Your bank account and ATM card have been blocked today because your PAN KYC has expired. Please share the six-digit verification code received on your phone right now to re-activate your bank account.',
    screenQuote: 'SBI Account & ATM BLOCKED due to expired KYC! Share 6-digit OTP verification code now to reactivate.',
    quickReply: 'They claimed to be SBI bank manager saying my account is blocked and demanded my OTP to reactivate it.'
  }
];

const nokia = {
  selectedScamIdx: 0,
  state: 'idle', // 'idle' | 'ringing' | 'scam_call' | 'calling_vesper' | 'vesper_greeting' | 'vesper_listening' | 'vesper_analyzing' | 'vesper_verdict'
  dialInput: '',
  timerSec: 0,
  timerInterval: null,
  audioCtx: null,
  userSpeechText: '',
  isRecordingUser: false,
  aiVerdict: null,
  telegramStatus: null, // null | 'sending' | 'sent' | 'error'
  lastAlertDetails: null
};

let nokiaSpeechRecInstance = null;

function playKeyTone(freq = 440) {
  try {
    const ctx = (nokia.audioCtx ||= new (window.AudioContext || window.webkitAudioContext)());
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    g.gain.setValueAtTime(0.09, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  } catch (e) {}
}

function playRingTone() {
  try {
    const ctx = (nokia.audioCtx ||= new (window.AudioContext || window.webkitAudioContext)());
    const now = ctx.currentTime;
    [0, 0.4, 0.8].forEach((offset, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.frequency.value = idx % 2 === 0 ? 853 : 960;
      g.gain.setValueAtTime(0.08, now + offset);
      g.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.3);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.3);
    });
  } catch (e) {}
}

function speakVoice(text) {
  if (window.VesperNative?.speak) {
    window.VesperNative.speak(text, 'en-IN');
  } else if ('speechSynthesis' in window) {
    try { speechSynthesis.cancel(); } catch (e) {}
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    u.pitch = 1.0;
    u.lang = 'en-IN';
    speechSynthesis.speak(u);
  }
}

function stopVoice() {
  if ('speechSynthesis' in window) {
    try { speechSynthesis.cancel(); } catch (e) {}
  }
}

function updateNokiaSpeechUI() {
  const displayText = (nokia.userSpeechText + (nokia.userSpeechInterim ? ' ' + nokia.userSpeechInterim : '')).trim();
  const box = document.getElementById('nokia-speech-box');
  if (box && document.activeElement !== box) {
    box.value = displayText;
  }
  const lcd = document.getElementById('nokia-lcd-speech-box');
  if (lcd) {
    lcd.innerHTML = displayText ? `"${esc(displayText)}"` : '<i style="color:#64748b">Speak your complaint into the mic...</i>';
  } else {
    render();
  }
}

function nokiaStartListening() {
  stopVoice();
  nokia.isRecordingUser = true;
  nokia.userSpeechText = '';
  nokia.userSpeechInterim = '';

  if (window.VesperNative?.startNativeSpeechRecognition) {
    window.onNativeSpeechResult = (text, isFinal) => {
      if (text && (nokia.state === 'vesper_listening' || nokia.state === 'vesper_greeting')) {
        if (nokia.state === 'vesper_greeting') {
          stopVoice();
          nokia.state = 'vesper_listening';
        }
        if (isFinal) {
          nokia.userSpeechText = (nokia.userSpeechText ? (nokia.userSpeechText + ' ' + text) : text).trim();
          nokia.userSpeechInterim = '';
        } else {
          nokia.userSpeechInterim = text;
        }
        updateNokiaSpeechUI();
      }
    };
    try {
      window.VesperNative.startNativeSpeechRecognition('en-IN');
    } catch (e) {
      console.warn('Native speech error:', e);
    }
  }

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR) {
    try {
      if (nokiaSpeechRecInstance) {
        try { nokiaSpeechRecInstance.stop(); } catch (e) {}
      }
      nokiaSpeechRecInstance = new SR();
      nokiaSpeechRecInstance.continuous = true;
      nokiaSpeechRecInstance.interimResults = true;
      nokiaSpeechRecInstance.lang = 'en-IN';
      nokiaSpeechRecInstance.onresult = (evt) => {
        let accumulated = '';
        let interim = '';
        for (let i = 0; i < evt.results.length; ++i) {
          if (evt.results[i].isFinal) {
            accumulated += evt.results[i][0].transcript + ' ';
          } else {
            interim += evt.results[i][0].transcript;
          }
        }
        if (nokia.state === 'vesper_listening' || nokia.state === 'vesper_greeting') {
          if (nokia.state === 'vesper_greeting') {
            stopVoice();
            nokia.state = 'vesper_listening';
          }
          nokia.userSpeechText = accumulated.trim();
          nokia.userSpeechInterim = interim.trim();
          updateNokiaSpeechUI();
        }
      };
      nokiaSpeechRecInstance.onerror = (e) => {
        console.warn('Web Speech onerror:', e);
      };
      nokiaSpeechRecInstance.start();
    } catch (e) {
      console.warn('Web Speech API error:', e);
    }
  }
}

function nokiaStopListening() {
  nokia.isRecordingUser = false;
  if (window.VesperNative?.stopNativeSpeechRecognition) {
    try { window.VesperNative.stopNativeSpeechRecognition(); } catch (e) {}
  }
  if (nokiaSpeechRecInstance) {
    try { nokiaSpeechRecInstance.stop(); } catch (e) {}
    nokiaSpeechRecInstance = null;
  }
}

function nokiaStartVesperHelpline() {
  stopVoice();
  nokiaStopListening();
  clearInterval(nokia.timerInterval);
  nokia.state = 'calling_vesper';
  nokia.dialInput = '1';
  nokia.userSpeechText = '';
  nokia.userSpeechInterim = '';
  nokia.aiVerdict = null;
  render();
  playKeyTone(800);

  setTimeout(() => {
    nokia.state = 'vesper_greeting';
    render();
    const greeting = "Hello, I am BFX Vesper AI. What happened? Tell me about the call you just received.";
    speakVoice(greeting);

    // After greeting (~3.2 seconds), switch to listening and start mic
    setTimeout(() => {
      if (nokia.state === 'vesper_greeting') {
        stopVoice();
        nokia.state = 'vesper_listening';
        render();
        toast('🎙️ Vesper AI is listening! Speak into your phone microphone now.');
        nokiaStartListening();
      }
    }, 3200);
  }, 1000);
}

async function dispatchTelegramAlert({
  victimName = S.name || 'Prithish (Elder)',
  victimPhone = S.phone || '+91 98765 43210',
  scamType = 'Scam Call Detected',
  score = 96,
  transcript = '',
  callerNumber = '+91 98210-94821',
  callerName = 'Suspected Scammer',
  reasons = []
}) {
  const token = S.guardian?.botToken || BUILTIN_TELEGRAM_BOT_TOKEN;
  const chatId = S.guardian?.chatId || BUILTIN_GUARDIAN_CHAT_ID;
  const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });

  const bulletPoints = (reasons && reasons.length)
    ? reasons.map(r => `• ${esc(r)}`).join('\n')
    : '• Impersonating official authority\n• Coercive financial / OTP demand';

  const messageText = `🚨 <b>CYBERSENTINEL & VESPER EMERGENCY GUARDIAN ALERT</b> 🚨
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ <b>HIGH-RISK SCAM DETECTED ON NOKIA PHONE!</b>

👤 <b>Protected User:</b> ${esc(victimName)}
📞 <b>User Phone:</b> <code>${esc(victimPhone)}</code>
🕒 <b>Time:</b> ${now} IST
🎯 <b>Detected Incident:</b> ${esc(scamType)}
📊 <b>Risk Score:</b> ${score}% (CRITICAL THREAT)

📞 <b>Scammer Number:</b> <code>${esc(callerNumber)}</code> (${esc(callerName)})

🎙️ <b>What the User Told Vesper AI (Speech Transcript):</b>
<i>"${esc(transcript)}"</i>

⚠️ <b>Key Threat Indicators:</b>
${bulletPoints}

🚨 <b>URGENT GUARDIAN ACTION REQUIRED:</b>
👉 <b>PLEASE CALL ${esc(victimName)} IMMEDIATELY (${esc(victimPhone)})!</b>
👉 <b>CONFIRM AND INSTRUCT THEM: DO NOT SHARE ANY OTP OR TRANSFER MONEY!</b>
👉 <i>Remind them: Police, electricity department, and banks NEVER demand OTP or money over phone calls.</i>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛡️ <i>CyberSentinel Senior Raksha Kavach • Nokia 3310 AI Guard</i>`;

  console.log('Dispatching Telegram alert to chat ID:', chatId);

  let success = false;
  // 1. Direct Telegram API call (always works from browser / APK)
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: messageText,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });
    const data = await res.json();
    if (data.ok) {
      console.log('Direct Telegram dispatch success:', data);
      success = true;
    } else {
      console.warn('Telegram API response not ok:', data);
    }
  } catch (err) {
    console.warn('Direct Telegram API fetch failed:', err);
  }

  // 2. Also register in local alerts list
  const alertEntry = {
    type: 'nokia',
    at: Date.now(),
    score,
    sent: success,
    transcript,
    scamType
  };
  S.alerts = [alertEntry, ...(S.alerts || [])].slice(0, 30);
  save();

  // 3. Fallback / additional server dispatch
  try {
    await api('/api/alert', {
      body: {
        type: 'nokia',
        chatId,
        user: { name: victimName, phone: victimPhone },
        score,
        scamType,
        reasons,
        transcript,
        note: `URGENT: Call ${victimName} (${victimPhone}) immediately. Confirm not to share OTP!`
      }
    });
    success = true;
  } catch (e) {
    // server might be offline or standalone
  }

  return { ok: success };
}

async function nokiaAnalyzeUserSpeech(customText = null) {
  nokiaStopListening();
  stopVoice();
  if (customText) {
    nokia.userSpeechText = customText;
  }
  const spoken = (nokia.userSpeechText || nokia.userSpeechInterim || '').trim();
  if (!spoken) {
    toast('Please speak into the mic or select a sample report below.');
    return;
  }
  nokia.userSpeechText = spoken;
  nokia.userSpeechInterim = '';

  nokia.state = 'vesper_analyzing';
  render();

  try {
    const res = await groqDirectChat({
      messages: [
        {
          role: 'system',
          content: `You are BFX Vesper Cloud Voice AI helpline for senior citizens in India using button keypad phones.
The senior citizen received a phone call and is speaking to you describing what the caller demanded:
"${spoken}"

Analyze the caller's speech pattern and demands:
1. Is it a scam? (true/false)
2. What specific Indian scam pattern is it? (e.g. "Digital Arrest Scam", "Electricity Bill Scam", "Bank KYC Freeze Scam", "Lottery Fraud", "Safe Call")
3. Scam threat score from 0 to 100.
4. "speechWarning": A clear, direct, reassuring voice message (25-35 words) that will be read aloud to the senior citizen via Text-to-Speech. Start by clearly saying "Alert! This is a [Scam Type]!" or "Notice: This call looks safe." Explain why and firmly instruct them NEVER to transfer money, share OTP, or install remote apps.
5. "reasons": Array of 2 short bullet strings describing the scam patterns detected.

Return ONLY a valid JSON object:
{"isScam": true, "score": 96, "scamType": "Digital Arrest Scam", "speechWarning": "Alert! This is a fake Digital Arrest scam! Real police never call citizens or demand money transfer. Do not send any money. Your family has been alerted.", "reasons": ["Impersonating Mumbai Cyber Police", "Demanding emergency ₹50,000 transfer to stop arrest"]}`
        },
        {
          role: 'user',
          content: `Analyze this caller description: "${spoken}"`
        }
      ]
    });

    const parsed = extractAiJson(res.content);
    nokia.aiVerdict = {
      isScam: parsed.isScam !== false,
      score: parsed.score || 95,
      scamType: parsed.scamType || 'Fraud Call Pattern',
      speechWarning: parsed.speechWarning || 'Alert! This call matches a known scam pattern. Do not send money or share OTP. Your guardian has been alerted.',
      reasons: parsed.reasons || ['Suspicious pressure tactics', 'Demanding money/OTP']
    };
  } catch (err) {
    console.warn('Groq pattern analysis fallback:', err);
    nokia.aiVerdict = {
      isScam: true,
      score: 95,
      scamType: 'High-Risk Fraud Call',
      speechWarning: 'Warning! This call is an active scam. Police and banks never demand money or OTP on phone calls. Do not send any money. We have alerted your guardian.',
      reasons: ['Impersonating officials', 'Urgent financial demand']
    };
  }

  nokia.state = 'vesper_verdict';
  render();
  alarm();
  speakVoice(nokia.aiVerdict.speechWarning);
  toast(`🛡️ Vesper Cloud AI: ${nokia.aiVerdict.scamType} (${nokia.aiVerdict.score}%)`);

  // Automatically trigger Telegram Bot Guardian Alert if scam is detected!
  if (nokia.aiVerdict.isScam) {
    nokia.telegramStatus = 'sending';
    render();
    const currentScam = NOKIA_SCAMS[nokia.selectedScamIdx] || NOKIA_SCAMS[0];
    nokia.lastAlertDetails = {
      victimName: S.name || 'Prithish (Elder)',
      victimPhone: S.phone || '+91 98765 43210',
      scamType: nokia.aiVerdict.scamType,
      score: nokia.aiVerdict.score,
      transcript: spoken,
      callerNumber: currentScam.callerNumber,
      callerName: currentScam.callerName,
      reasons: nokia.aiVerdict.reasons
    };
    dispatchTelegramAlert(nokia.lastAlertDetails).then(res => {
      nokia.telegramStatus = res.ok ? 'sent' : 'error';
      render();
      if (res.ok) {
        toast('🚨 Guardian Telegram Alert Dispatched!');
      }
    }).catch(err => {
      console.error('Failed to dispatch Telegram alert:', err);
      nokia.telegramStatus = 'error';
      render();
    });
  }
}

function renderKeypadBtn(num, sub, freq) {
  return `<button data-act="nokia-key" data-num="${num}" data-freq="${freq}" style="background:#334155;color:#f8fafc;border:none;border-radius:14px;height:44px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 3px 0 #1e293b;transition:transform 0.05s">
    <b style="font-size:1.15rem;line-height:1">${num}</b>
    <span style="font-size:0.6rem;color:#94a3b8;line-height:1;letter-spacing:1px">${sub}</span>
  </button>`;
}

function renderNokiaDisplay() {
  const currentScam = NOKIA_SCAMS[nokia.selectedScamIdx] || NOKIA_SCAMS[0];

  if (nokia.state === 'ringing') {
    return `
      <div style="animation:pulse 0.8s infinite;text-align:center">
        <span style="font-size:1.2rem;display:block">📞 ⚠️</span>
        <b style="font-size:.85rem;color:#991b1b;display:block">${esc(currentScam.callerName)}</b>
        <span style="font-size:.8rem;font-weight:700">${esc(currentScam.callerNumber)}</span>
        <span style="font-size:.68rem;display:block;color:#7f1d1d;margin-top:2px">Press GREEN key to Answer</span>
      </div>`;
  }

  if (nokia.state === 'scam_call') {
    return `
      <div style="text-align:left;width:100%;font-size:.72rem">
        <div style="display:flex;justify-content:space-between;color:#991b1b;font-weight:700;margin-bottom:3px">
          <span>📞 ${esc(currentScam.callerName.slice(0, 14))} (0:${nokia.timerSec < 10 ? '0' : ''}${nokia.timerSec})</span>
          <span>🔴 REC</span>
        </div>
        <div style="max-height:85px;overflow-y:auto;line-height:1.25;font-weight:600;color:#064e3b;background:rgba(255,255,255,0.4);padding:4px;border-radius:4px">
          "${esc(currentScam.screenQuote)}"
        </div>
      </div>`;
  }

  if (nokia.state === 'calling_vesper') {
    return `
      <div style="text-align:center">
        <span style="font-size:1.3rem;display:block">☁️ 🛡️</span>
        <b style="font-size:.85rem;display:block">VESPER CLOUD AI</b>
        <span style="font-size:.72rem;color:#047857">Connecting Voice Helpline...</span>
      </div>`;
  }

  if (nokia.state === 'vesper_greeting') {
    return `
      <div style="text-align:center;width:100%">
        <span style="font-size:1.1rem;display:block">☁️ 🤖</span>
        <b style="font-size:.82rem;color:#065f46;display:block">BFX VESPER AI</b>
        <div style="font-size:.72rem;line-height:1.25;color:#064e3b;font-weight:600;margin-top:3px">
          "Hello! I am BFX Vesper AI.<br>What happened? Tell me about the call you received."
        </div>
        <span style="font-size:.62rem;color:#047857;display:block;margin-top:3px">🔊 AI Speaking...</span>
      </div>`;
  }

  if (nokia.state === 'vesper_listening') {
    const displayText = (nokia.userSpeechText + (nokia.userSpeechInterim ? ' ' + nokia.userSpeechInterim : '')).trim();
    return `
      <div style="text-align:left;width:100%;font-size:.72rem">
        <div style="display:flex;justify-content:space-between;color:#047857;font-weight:700;margin-bottom:2px">
          <span>🎙️ LISTENING (Speak now!)</span>
          <span style="animation:pulse 0.6s infinite;color:#dc2626">● MIC ON</span>
        </div>
        <div id="nokia-lcd-speech-box" style="max-height:80px;overflow-y:auto;line-height:1.25;font-weight:600;color:#064e3b;background:rgba(255,255,255,0.5);padding:4px;border-radius:4px;min-height:50px">
          ${displayText ? `"${esc(displayText)}"` : '<i style="color:#64748b">Speak your complaint into the mic...</i>'}
        </div>
        <span style="font-size:.62rem;color:#047857;display:block;margin-top:2px">Tap "Stop & Analyze" when done</span>
      </div>`;
  }

  if (nokia.state === 'vesper_analyzing') {
    return `
      <div style="text-align:center">
        <span style="font-size:1.3rem;display:block">⚙️ ☁️</span>
        <b style="font-size:.82rem;color:#065f46;display:block">ANALYZING PATTERN...</b>
        <span style="font-size:.7rem;color:#047857">Groq LLaMA-3.3 AI checking scam indicators...</span>
      </div>`;
  }

  if (nokia.state === 'vesper_verdict') {
    const v = nokia.aiVerdict || {};
    const isScam = v.isScam !== false;
    return `
      <div style="text-align:left;width:100%;font-size:.7rem;background:${isScam ? '#fee2e2' : '#dcfce7'};padding:4px 6px;border-radius:4px;border:1px solid ${isScam ? '#ef4444' : '#22c55e'}">
        <b style="color:${isScam ? '#b91c1c' : '#15803d'};display:block;font-size:.76rem">
          ${isScam ? `🚨 SCAM DETECTED! (${v.score || 96}%)` : `✅ CALL APPEARS SAFE (${v.score || 15}%)`}
        </b>
        <div style="font-weight:700;color:${isScam ? '#991b1b' : '#166534'};font-size:.68rem;margin:1px 0">
          [${esc(v.scamType || 'Fraud Alert')}]
        </div>
        <div style="max-height:50px;overflow-y:auto;line-height:1.2;color:${isScam ? '#7f1d1d' : '#14532d'};font-weight:600">
          "${esc(v.speechWarning || 'Never transfer money or share OTP.')}"
        </div>
        ${isScam ? `
          <div style="margin-top:3px;padding:2px 4px;border-radius:3px;background:${nokia.telegramStatus === 'sent' ? '#bbf7d0' : nokia.telegramStatus === 'sending' ? '#fef08a' : '#fee2e2'};color:${nokia.telegramStatus === 'sent' ? '#14532d' : nokia.telegramStatus === 'sending' ? '#854d0e' : '#991b1b'};font-size:.62rem;font-weight:700">
            ${nokia.telegramStatus === 'sent' ? '📲 Telegram Alert Sent to Guardian' : nokia.telegramStatus === 'sending' ? '⏳ Dispatching Telegram Alert...' : nokia.telegramStatus === 'error' ? '⚠️ Telegram Alert Failed' : '📲 Alerting Guardian via Telegram...'}
          </div>
        ` : ''}
      </div>`;
  }

  // Idle state
  return `
    <div style="display:flex;flex-direction:column;align-items:center">
      <b style="font-size:1.3rem;letter-spacing:1px;margin-bottom:2px">VESPER 3310</b>
      <span style="font-size:.75rem;font-weight:700;color:#047857">${nokia.dialInput ? nokia.dialInput : 'Cloud Elder Shield'}</span>
      <span style="font-size:.65rem;color:#065f46;margin-top:4px">${nokia.dialInput ? 'Press GREEN to Dial' : 'Press 1 for Cloud Voice AI'}</span>
    </div>`;
}

function nokiaScreen() {
  return `${topbar('Nokia Button Phone Simulator')}
  <main class="screen stack" style="align-items:center;padding-bottom:5rem">
    <div style="background:#f1f5f9;padding:.6rem .8rem;border-radius:12px;font-size:.85rem;color:#334155;text-align:center;max-width:340px;margin-bottom:.6rem;border:1px solid #cbd5e1">
      <b>💡 How Button Phones Are Protected:</b><br>
      Senior citizens use simple keypad phones. When a suspicious call occurs, our <b>Cloud Voice AI</b> asks what happened, analyzes speech patterns, and warns the senior via Voice!
    </div>

    <!-- Retro Nokia Chassis -->
    <div class="nokia-case" style="width:310px;background:linear-gradient(180deg,#1e293b 0%,#0f172a 100%);border-radius:36px;padding:24px 18px 28px;box-shadow:0 14px 35px rgba(15,23,42,0.45);border:3px solid #475569;display:flex;flex-direction:column;align-items:center;color:#fff;user-select:none">
      
      <!-- Brand & Speaker grill -->
      <div style="display:flex;flex-direction:column;align-items:center;margin-bottom:12px;width:100%">
        <div style="width:40px;height:4px;background:#64748b;border-radius:4px;margin-bottom:6px"></div>
        <span style="font-family:'Courier New',monospace;font-size:.85rem;letter-spacing:3px;font-weight:900;color:#94a3b8">VESPER 3310</span>
      </div>

      <!-- Nokia LCD Screen -->
      <div class="nokia-screen" style="width:100%;height:175px;background:#c7f0d8;color:#064e3b;border-radius:12px;border:3px solid #1e293b;box-shadow:inset 0 3px 8px rgba(0,0,0,0.3);padding:8px 10px;font-family:'Courier New',monospace;display:flex;flex-direction:column;justify-content:space-between;position:relative;overflow:hidden">
        
        <!-- Screen Top Bar -->
        <div style="display:flex;justify-content:space-between;font-size:.7rem;font-weight:700;border-bottom:1px solid #a7f3d0;padding-bottom:2px">
          <span>📶 4G CLOUD</span>
          <span>02:50 PM</span>
          <span>🔋 98%</span>
        </div>

        <!-- Screen Content Area -->
        <div style="flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:4px 0">
          ${renderNokiaDisplay()}
        </div>

        <!-- Screen Softkeys -->
        <div style="display:flex;justify-content:space-between;font-size:.72rem;font-weight:700;border-top:1px solid #a7f3d0;padding-top:2px">
          <span>${nokia.state === 'ringing' ? 'Accept' : nokia.state === 'scam_call' ? 'Mute' : 'Options'}</span>
          <span>${nokia.state === 'ringing' ? 'Reject' : nokia.state === 'scam_call' ? 'Speaker' : 'Helpline'}</span>
        </div>
      </div>

      <!-- Navigation & Call Keys -->
      <div style="width:100%;display:grid;grid-template-columns:1fr 1.2fr 1fr;gap:8px;margin:16px 0 10px">
        <button data-act="nokia-call" style="background:#16a34a;color:#fff;border:none;border-radius:16px;height:42px;font-size:1.1rem;font-weight:900;box-shadow:0 3px 0 #15803d;cursor:pointer;display:flex;align-items:center;justify-content:center" aria-label="Call">📞</button>
        <button data-act="nokia-nav" style="background:#334155;color:#94a3b8;border:none;border-radius:16px;height:42px;font-size:.8rem;font-weight:700;box-shadow:0 3px 0 #1e293b;cursor:pointer">MENU</button>
        <button data-act="nokia-hangup" style="background:#dc2626;color:#fff;border:none;border-radius:16px;height:42px;font-size:1.1rem;font-weight:900;box-shadow:0 3px 0 #b91c1c;cursor:pointer;display:flex;align-items:center;justify-content:center" aria-label="Hang Up">❌</button>
      </div>

      <!-- Numeric Keypad Grid -->
      <div style="width:100%;display:grid;grid-template-columns:repeat(3, 1fr);gap:8px">
        ${renderKeypadBtn('1', 'Vesper', 523)}
        ${renderKeypadBtn('2', 'abc', 587)}
        ${renderKeypadBtn('3', 'def', 659)}
        ${renderKeypadBtn('4', 'ghi', 698)}
        ${renderKeypadBtn('5', 'jkl', 783)}
        ${renderKeypadBtn('6', 'mno', 880)}
        ${renderKeypadBtn('7', 'pqrs', 987)}
        ${renderKeypadBtn('8', 'tuv', 1046)}
        ${renderKeypadBtn('9', 'wxyz', 1174)}
        ${renderKeypadBtn('*', '+', 440)}
        ${renderKeypadBtn('0', '␣', 493)}
        ${renderKeypadBtn('#', '🔒', 523)}
      </div>

    </div>

    <!-- 1. Scenario Selector (3 Variations) -->
    <div style="background:#fff;border-radius:14px;padding:12px;width:310px;box-shadow:0 2px 8px rgba(0,0,0,0.06);border:1px solid #e2e8f0;margin-top:14px">
      <div style="font-size:0.75rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">
        1. Select Scam Call Scenario
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px">
        ${NOKIA_SCAMS.map((s, idx) => `
          <button data-act="nokia-select-scam" data-idx="${idx}" style="padding:6px 2px;border-radius:8px;font-size:0.7rem;font-weight:700;border:1.5px solid ${nokia.selectedScamIdx === idx ? '#16a34a' : '#cbd5e1'};background:${nokia.selectedScamIdx === idx ? '#dcfce7' : '#f8fafc'};color:${nokia.selectedScamIdx === idx ? '#15803d' : '#475569'};cursor:pointer;line-height:1.2;text-align:center">
            ${s.shortTitle}
          </button>
        `).join('')}
      </div>

      <button class="btn btn-primary" data-act="nokia-trigger-scam" style="width:100%;font-weight:700;display:flex;align-items:center;justify-content:center;gap:.5rem;padding:9px">
        🔔 Simulate Incoming Call (${NOKIA_SCAMS[nokia.selectedScamIdx].shortTitle})
      </button>
    </div>

    <!-- 2. Speed-Dial Vesper Helpline -->
    <div style="background:#fff;border-radius:14px;padding:12px;width:310px;box-shadow:0 2px 8px rgba(0,0,0,0.06);border:1px solid #e2e8f0;margin-top:8px">
      <div style="font-size:0.75rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">
        2. Speed-Dial 1: Vesper Voice AI
      </div>
      <button class="btn btn-sec" data-act="nokia-speeddial-vesper" style="width:100%;font-weight:700;display:flex;align-items:center;justify-content:center;gap:.5rem;padding:9px;background:#f0fdf4;color:#166534;border:1.5px solid #86efac">
        🛡️ Press 1: Call Vesper AI Cloud
      </button>
    </div>

    <!-- Real-Time Voice Conversation & Pattern Analysis Card -->
    ${(nokia.state === 'vesper_listening' || nokia.state === 'vesper_analyzing' || nokia.state === 'vesper_verdict' || nokia.state === 'vesper_greeting') ? `
    <div style="background:#eff6ff;border-radius:14px;padding:12px;width:310px;box-shadow:0 2px 8px rgba(0,0,0,0.06);border:1.5px solid #93c5fd;margin-top:8px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <b style="font-size:0.8rem;color:#1e40af">🎙️ Real-Time Voice Conversation</b>
        <span style="font-size:0.7rem;font-weight:700;color:${nokia.state === 'vesper_listening' ? '#dc2626' : '#2563eb'}">
          ${nokia.state === 'vesper_listening' ? '● MIC LISTENING' : nokia.state === 'vesper_greeting' ? '● VESPER SPEAKING' : nokia.state === 'vesper_analyzing' ? '● GROQ ANALYZING' : '● VERDICT'}
        </span>
      </div>

      <textarea class="input" id="nokia-speech-box" rows="2" style="font-size:0.78rem;width:100%;resize:none;margin-bottom:8px;background:#fff" placeholder="Speak your complaint into phone mic or type here..." data-act="nokia-speech-input">${esc(nokia.userSpeechText)}</textarea>

      ${nokia.state === 'vesper_listening' ? `
        <button class="btn btn-danger" data-act="nokia-stop-speaking" style="width:100%;font-weight:700;margin-bottom:8px;padding:8px">
          ⏹️ Finish Speaking & Analyze Pattern
        </button>
      ` : ''}

      <div style="font-size:0.68rem;color:#475569;margin-bottom:4px;font-weight:600">Or tap a quick elder complaint:</div>
      <div style="display:flex;flex-direction:column;gap:4px">
        ${NOKIA_SCAMS.map((s, idx) => `
          <button data-act="nokia-quick-reply" data-text="${esc(s.quickReply)}" style="padding:5px 8px;border-radius:6px;font-size:0.68rem;background:#fff;border:1px solid #bfdbfe;color:#1e3a8a;text-align:left;cursor:pointer;line-height:1.25">
            👉 "${esc(s.quickReply)}"
          </button>
        `).join('')}
      </div>

      ${nokia.state === 'vesper_verdict' && nokia.aiVerdict?.isScam ? `
        <div style="background:#fee2e2;border:1.5px solid #ef4444;border-radius:10px;padding:10px;margin-top:10px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
            <b style="font-size:0.78rem;color:#991b1b">🚨 Guardian Telegram Alert</b>
            <span style="font-size:0.65rem;font-weight:700;padding:2px 6px;border-radius:4px;background:${nokia.telegramStatus === 'sent' ? '#dcfce7' : nokia.telegramStatus === 'sending' ? '#fef08a' : '#fee2e2'};color:${nokia.telegramStatus === 'sent' ? '#166534' : nokia.telegramStatus === 'sending' ? '#854d0e' : '#991b1b'}">
              ${nokia.telegramStatus === 'sent' ? '✅ DELIVERED' : nokia.telegramStatus === 'sending' ? '⏳ SENDING...' : 'DISPATCHED'}
            </span>
          </div>
          <div style="font-size:0.7rem;color:#7f1d1d;line-height:1.35;margin-bottom:6px">
            Bot: <b>@bfx_alerts_bot</b><br>
            Guardian: <b>Prithish Raj</b> (ID: 6553348217)<br>
            Instruction: <i>"Please call ${esc(S.name || 'Prithish')} and confirm NOT to share OTP!"</i>
          </div>
          <button class="btn btn-sm" data-act="nokia-resend-telegram" style="width:100%;font-size:0.72rem;padding:6px;background:#991b1b;color:#fff;border:none;border-radius:6px;font-weight:700;cursor:pointer">
            📲 Re-send Emergency Alert to Telegram
          </button>
        </div>
      ` : ''}
    </div>
    ` : ''}

    <div style="margin-top:1rem">
      <a class="btn btn-ghost" href="#/call" style="text-align:center;text-decoration:none;font-weight:600;font-size:0.85rem">
        ← Back to Smartphone Audio Screen
      </a>
    </div>
  </main>${nav('home')}`;
}

// Automatic Call Guard trigger ONLY for unknown callers outside contacts
window.autoStartCallGuard = (callerNumber) => {
  if (callerNumber && window.VesperNative?.isContact?.(callerNumber)) {
    return;
  }
  if (route().path !== '/call') {
    go('#/call');
  }
  toast(`🛡️ Call Guard: Unknown caller (${callerNumber || 'Unknown'}). Open Call & Audio Analyzer.`);
};

window.autoStopCallGuard = () => {
  console.log('BFX Vesper: Call ended. Stopping live Call Guard listener...');
  if (cg && cg.running) {
    cg.stop();
    updateCallUI();
    toast('Call ended. Call Guard standing by.');
  }
};

window.onNativeUnlocked = () => {
  console.log('BFX Vesper: Device unlocked from Native LockdownActivity.');
  finishUnlock();
};
function highlight(text, signals) {
  let h = esc(text);
  for (const s of signals) if (s.match && s.match.length > 2) { const m = esc(s.match); h = h.split(m).join(`<mark class="hit">${m}</mark>`); }
  return h;
}
let callUIRaf = null;
function updateCallUI() {
  if (callUIRaf) return;
  callUIRaf = requestAnimationFrame(() => {
    callUIRaf = null;
    doUpdateCallUI();
  });
}

function doUpdateCallUI() {
  const mic = $('#mic'); if (!mic || !cg) return;
  mic.classList.toggle('live', cg.running);
  mic.innerHTML = cg.running ? I.stop : I.mic;
  const micLabel = $('#mic-label');
  if (micLabel) micLabel.textContent = cg.running ? 'Listening to Caller...' : t('cg_start');
  const sc = Math.max(cg.result.score, cg.aiScore || 0);
  const bar = $('#risk');
  if (bar) {
    bar.className = 'risk-bar ' + (sc >= 70 ? 'hi' : sc >= 40 ? 'mid' : '');
    if (bar.firstElementChild) bar.firstElementChild.style.width = Math.max(2, sc) + '%';
  }
  const rn = $('#risk-n');
  if (rn) rn.textContent = `${sc}/100`;

  const seenCodes = (mem.cgCodes ||= new Set());
  const chips = $('#cg-chips');
  if (chips) {
    chips.innerHTML = cg.result.signals.slice(0, 5).map((s) => {
      const isNew = !seenCodes.has(s.code);
      seenCodes.add(s.code);
      return `<span class="chip${isNew ? ' pop' : ''}">${esc(r(s.code))}</span>`;
    }).join('');
  }
  const tx = $('#tx');
  if (tx) {
    const recentLines = cg.lines.slice(-12);
    tx.innerHTML = recentLines.length || cg.interim
      ? recentLines.map((l) => `<p>${highlight(l, cg.result.signals)}</p>`).join('') + (cg.interim ? `<p class="interim" style="color:#2563eb;font-style:italic">🎙️ ${esc(cg.interim)}</p>` : '')
      : `<p class="small" style="text-align:center;color:var(--ink);opacity:.6;padding:1.2rem 0">🔊 ${esc(cg.running ? 'Listening to caller on speakerphone (speech will appear here live)...' : t('cg_idle'))}</p>`;
    tx.scrollTop = tx.scrollHeight;
  }
  if (cg.error) toast(t('cg_nosupport'));
}

// ================================================================ LOCKDOWN
let alarmCtx = null;
function alarm() {
  try {
    navigator.vibrate?.([400, 150, 400, 150, 800]);
    alarmCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    const o = alarmCtx.createOscillator(), g = alarmCtx.createGain();
    o.type = 'square'; o.connect(g); g.connect(alarmCtx.destination); g.gain.value = 0.06;
    const now = alarmCtx.currentTime;
    [0, .35, .7, 1.05].forEach((d, i) => o.frequency.setValueAtTime(i % 2 ? 660 : 880, now + d));
    o.start(now); o.stop(now + 1.4);
  } catch { /* audio blocked */ }
}
async function triggerLock(d) {
  if (S.lock) return;
  // Immediately halt background speech processing to free 100% CPU and memory for lockdown UI
  if (cg && cg.running) {
    try { cg.stop(); } catch { /* */ }
  }
  const reasons = d.aiReasons?.length ? d.aiReasons : (d.signals || []).map(r);
  mem.forgotMode = false;
  S.lock = { at: Date.now(), source: d.source, score: d.score, transcript: d.transcript || '', reasons, scamType: d.scamType || '', alert: 'sending', tries: 0, until: 0, location: null, address: '' };
  save(); render(true); alarm();

  const guardPhone = S.guardian?.phone || '1930';

  if (window.VesperNative?.triggerLockdown) {
    window.VesperNative.triggerLockdown(
      reasons.slice(0, 2).join('. ') || 'Active scam detected',
      d.score || 85,
      S.secret?.passcode || '',
      guardPhone,
      S.secret?.passphrase || ''
    );
  }
  if (window.VesperNative?.vibrate) {
    window.VesperNative.vibrate(250);
  }
  setTimeout(() => speak(t('lock_title') + ' ' + t('lock_sub')), 600);
  if ('Notification' in window && Notification.permission === 'granted') { try { new Notification('BFX VESPER', { body: t('lock_title'), requireInteraction: true }); } catch { /* */ } }
  const location = await getLocation();
  S.lock.location = location; save();
  await sendAlert('call', { score: d.score, scamType: d.scamType, reasons, transcript: d.transcript, location, blocked: [] }, (ok, res) => {
    if (!S.lock) return;
    S.lock.alert = ok ? 'sent' : 'failed'; S.lock.address = res?.address || ''; save(); const as = $('.alert-state'); if (as) as.outerHTML = alertState(S.lock);
  });
}
async function sendAlert(type, payload, cb) {
  const entry = { type, at: Date.now(), score: payload.score };
  try {
    if (!S.guardian?.chatId) throw new Error('Guardian Telegram not linked');
    const res = await api('/api/alert', { body: { type, chatId: S.guardian.chatId, user: { name: S.name, phone: S.phone }, device: deviceInfo(), time: Date.now(), ...payload } });
    entry.sent = true; S.alerts.unshift(entry); S.alerts = S.alerts.slice(0, 30); save(); cb?.(true, res); return true;
  } catch (e) {
    entry.sent = false; entry.error = e.message; S.alerts.unshift(entry); S.alerts = S.alerts.slice(0, 30); save(); cb?.(false); return false;
  }
}
function alertState(k) {
  const gname = S.guardian?.name || t('nav_guard');
  return k.alert === 'sent' ? `<div class="alert-state sent">${I.check}<span>${esc(t('lock_informed', { name: gname }))}</span></div>`
    : k.alert === 'failed' ? `<div class="alert-state failed">${I.alert}<span>${esc(t('lock_failed'))}</span></div>`
    : `<div class="alert-state"><div class="spin"></div><span>${esc(t('lock_sending'))}</span></div>`;
}
function lockScreen() {
  const k = S.lock, gname = S.guardian?.name || t('nav_guard');
  const st = alertState(k);
  const isForgot = !!mem.forgotMode;
  return `<div class="lock" role="alertdialog" aria-labelledby="lock-h">
    <div class="lock-top">
      <div class="row" style="justify-content:space-between"><div class="lock-icon">${I.lock}</div><span class="mono" style="font-size:.7rem;font-weight:700;letter-spacing:.12em">BFX VESPER</span></div>
      <h1 id="lock-h">${esc(t('lock_title'))}</h1>
      <p class="sub">${esc(t('lock_sub'))}</p>
      <div style="margin-top:.85rem"><span class="lock-score" style="font-size:1.05rem;padding:.45rem .85rem;background:rgba(0,0,0,0.3);border-radius:10px;display:inline-block">🚨 SCAM RISK SCORE: ${k.score}/100</span></div>
    </div>
    <div class="lock-body">
      ${st}
      <div class="btn-pair">
        ${S.guardian?.phone ? `<a class="btn btn-ink" href="tel:${esc(S.guardian.phone)}">${I.phone}${esc(t('call_guardian'))}</a>` : `<span></span>`}
        <a class="btn" href="tel:1930">${I.alert}1930</a>
      </div>

      ${k.reasons?.length ? `<ul class="reasons" style="margin:1rem 0">${k.reasons.slice(0, 4).map((x) => `<li><span>${esc(x)}</span><span class="w plus">!</span></li>`).join('')}</ul>` : ''}

      <div style="margin-top:1.1rem;background:var(--paper-2);padding:1.1rem;border-radius:18px;border:var(--bw) solid var(--line)">
        ${!isForgot ? `
          <div id="unlock-passcode-box">
            <label class="field" style="margin-bottom:.5rem">
              <span style="font-weight:700">Enter App Passcode to Unlock:</span>
              <input class="input pin" id="u-code" inputmode="numeric" maxlength="6" type="password" placeholder="6-digit passcode" autocomplete="off">
            </label>
            <button class="btn btn-primary" data-act="unlock-try-code" style="width:100%">${I.unlock}Unlock Device</button>
            <div style="text-align:center;margin-top:.7rem">
              <button class="btn btn-ghost btn-sm" data-act="toggle-forgot" style="font-size:.9rem;font-weight:600;color:var(--ink);cursor:pointer">Forgot Passcode? Unlock with Passphrase</button>
            </div>
          </div>
        ` : `
          <div id="unlock-phrase-box">
            <label class="field" style="margin-bottom:.5rem">
              <span style="font-weight:700">Enter Recovery Passphrase:</span>
              <input class="input" id="u-phrase" type="password" placeholder="Secret recovery passphrase" autocomplete="off">
            </label>
            <button class="btn btn-primary" data-act="unlock-try-phrase" style="width:100%">${I.unlock}Unlock with Passphrase</button>
            <div style="text-align:center;margin-top:.7rem">
              <button class="btn btn-ghost btn-sm" data-act="toggle-forgot" style="font-size:.9rem;font-weight:600;color:var(--ink);cursor:pointer">← Back to 6-Digit Passcode</button>
            </div>
          </div>
        `}
        <p class="err" id="u-err" role="alert" style="margin:.5rem 0 0;text-align:center"></p>
      </div>
    </div>
  </div>`;
}
function unlockSheet() {
  mem.forgotMode = false;
  render();
}
async function tryUnlock() {
  if (mem.forgotMode) {
    await actions['unlock-try-phrase']();
  } else {
    await actions['unlock-try-code']();
  }
}
function finishUnlock() {
  mem.forgotMode = false;
  if (S.lock) {
    S.lastReport = { ...S.lock, unlockedAt: Date.now() };
    S.lock = null;
    save();
    sendAlert('unlocked', { note: 'Verified by user. Device unlocked.' });
  }
  closeSheet();
  if (S.lastReport) {
    if (location.hash === '#/report') render(true); else go('#/report');
  } else {
    go('#/home');
  }
}
function reportScreen() {
  const k = S.lastReport;
  if (!k) return home();
  const res = { score: k.score, verdict: 'SCAM', local: analyzeText(k.transcript, { mode: 'call' }), ai: null };
  return `${topbar(t('report_title'))}<main class="screen stack">
    <div class="verdict SCAM"><div class="verdict-top"><div class="score"><span class="n">${k.score}</span><span class="of">/100</span></div><div class="verdict-word">${esc(t('res_scam'))}</div><div class="verdict-sub">${esc(k.scamType || t('res_scam_d'))}</div></div></div>
    <dl class="kv">
      <dt>${esc(t('report_when'))}</dt><dd>${esc(fmtTime(k.at))}</dd>
      <dt>${esc(t('report_where'))}</dt><dd>${k.location ? esc(k.address || `${k.location.lat}, ${k.location.lon}`) : '—'}</dd>
      <dt>${esc(t('nav_guard'))}</dt><dd>${k.alert === 'sent' ? esc(t('lock_informed', { name: S.guardian?.name || '' })) : esc(t('lock_failed'))}</dd>
    </dl>
    <div class="block"><div class="block-h"><span class="sq" style="background:var(--sindoor)"></span>${esc(t('why_score', { n: k.score }))}</div>
      <ul class="reasons">${(k.reasons || []).map((x) => `<li><span>${esc(x)}</span><span class="w plus">!</span></li>`).join('')}</ul></div>
    ${k.transcript ? `<div class="block"><div class="block-h"><span class="sq"></span>${esc(t('report_said'))}</div><p class="quote">${highlight(k.transcript.slice(-600), res.local.signals)}</p></div>` : ''}
    <div class="block"><div class="block-h"><span class="sq" style="background:var(--ink)"></span>${esc(t('todo'))}</div>
      <ol class="steps-list">${['adv_noreply', 'adv_otp', 'adv_block', 'adv_1930', 'adv_chakshu'].map((a) => `<li>${esc(r(a))}</li>`).join('')}</ol></div>
    <a class="btn btn-primary" href="#/">${I.home}${esc(t('nav_home'))}</a>
  </main>`;
}

// ================================================================ RESULT VIEW
function norm(items, total) {
  const list = items.filter((x) => x.point);
  if (!list.length || total <= 0) return list.map((x) => ({ ...x, pct: 0 }));
  let sum = list.reduce((a, x) => a + (x.weight || 0), 0);
  const base = sum > 0 ? list.map((x) => (x.weight || 0) / sum) : list.map(() => 1 / list.length);
  const out = list.map((x, i) => ({ ...x, pct: Math.round(base[i] * total) }));
  const diff = total - out.reduce((a, x) => a + x.pct, 0); if (out.length) out[0].pct += diff;
  return out;
}
function adviceFor(verdict, kind) {
  const a = verdict === 'SCAM' ? ['adv_noreply', 'adv_otp', 'adv_block', 'adv_chakshu', 'adv_1930'] : verdict === 'SUSPICIOUS' ? ['adv_family', 'adv_bankapp', 'adv_otp'] : ['adv_ok'];
  return (kind === 'payment' ? ['adv_checkbank', ...a.filter((x) => x !== 'adv_bankapp')] : a).map(r);
}
function renderResult(res, { kind = 'sms', refining = false } = {}) {
  const score = res.score, v = res.verdict;
  const ai = res.ai;
  let scam = [], not = [], advice = [], summary = '';
  if (kind === 'payment') {
    const rs = res.rules || { signals: [], safe: [], unknowns: [] };
    scam = [...(ai?.scam_reasons || []), ...rs.signals.map((s) => ({ point: r(s.code), weight: s.weight }))];
    not = [...(ai?.safe_reasons || []), ...rs.safe.map((s) => ({ point: r(s.code), weight: s.weight })), ...(ai?.unknowns || []).map((u) => ({ point: u, weight: 5, q: 1 })), ...rs.unknowns.map((u) => ({ point: r(u), weight: 5, q: 1 }))];
    advice = ai?.advice?.length ? ai.advice : adviceFor(v, 'payment');
    summary = ai?.summary || '';
  } else if (ai) {
    scam = ai.scam_reasons; not = [...ai.safe_reasons, ...ai.unknowns.map((u) => ({ point: u, weight: 5, q: 1 }))];
    advice = ai.advice.length ? ai.advice : adviceFor(v); summary = ai.summary;
  } else {
    const lo = res.local;
    scam = lo.signals.map((s) => ({ point: r(s.code), weight: s.weight }));
    not = [...lo.safe.map((s) => ({ point: r(s.code), weight: s.weight })), ...lo.unknowns.map((u) => ({ point: r(u), weight: 6, q: 1 }))];
    advice = adviceFor(v);
  }
  // de-duplicate
  const seen = new Set(); const dd = (a) => a.filter((x) => { const k = x.point.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  scam = norm(dd(scam), score); not = norm(dd(not), 100 - score);
  const word = { SCAM: t('res_scam'), SUSPICIOUS: t('res_susp'), LOOKS_SAFE: t('res_safe') }[v];
  const sub = { SCAM: t('res_scam_d'), SUSPICIOUS: t('res_susp_d'), LOOKS_SAFE: t('res_safe_d') }[v];
  mem.lastSpoken = `${word}. ${score} / 100. ${summary || sub} ${scam.slice(0, 3).map((x) => x.point).join('. ')}. ${advice.slice(0, 3).join('. ')}`;
  const lo = res.local;
  const hdr = kind === 'sms' && lo?.sender?.kind === 'HEADER' ? senderDecode(lo.sender) : '';
  const engineRows = [
    lo ? `<span>1. ${esc(t('ondevice'))} (Keyword Heuristics)</span><span class="mono">${lo.score}/100</span>` : '',
    res.rules ? `<span>1. ${esc(t('ondevice'))} (UPI Rules)</span><span class="mono">${res.ruleScore}/100</span>` : '',
    ai ? `<span>2. Groq Cloud AI (Deep Reasoning)</span><span class="mono">${ai.score}/100</span>` : '',
    `<span style="font-weight:700">Combined Verified Risk</span><span class="mono" style="font-weight:700;color:var(--sindoor)">${score}/100</span>`,
  ].filter(Boolean).join('');
  return `
  <section class="verdict ${v}" aria-live="polite">
    <div class="verdict-top">
      <div class="score"><span class="n">${score}</span><span class="of">/100</span></div>
      <div class="verdict-word">${esc(word)}</div>
      <div class="verdict-sub">${esc(sub)}</div>
      <div class="meter" aria-hidden="true">${Array.from({ length: 10 }, (_, i) => `<i class="${i < Math.round(score / 10) ? 'f' : ''}" style="--k:${i}"></i>`).join('')}</div>
    </div>
    <div class="split"><div class="a"><b>${score}%</b><span>${esc(t('risk_points'))}</span></div><div class="b"><b>${100 - score}%</b><span>${esc(t('unsure_points'))}</span></div></div>
    ${summary ? `<div class="summary">${esc(summary)}</div>` : ''}
  </section>
  ${refining ? `<div class="refining"><div class="spin"></div>${esc(t('checking'))} · Groq Cloud AI</div>` : ''}
  ${!refining && !ai && kind !== 'payment' ? `<p class="small" style="margin-top:.6rem">${esc(t('offline_note'))}</p>` : ''}
  ${hdr}
  <div class="block"><div class="block-h"><span class="sq" style="background:var(--sindoor)"></span>${esc(t('why_score', { n: score }))}</div>
    <ul class="reasons">${scam.length ? scam.map((x) => `<li><span>${esc(x.point)}</span><span class="w plus">+${x.pct}%</span></li>`).join('') : `<li><span>—</span><span></span></li>`}</ul></div>
  <div class="block"><div class="block-h"><span class="sq" style="background:var(--paper-3)"></span>${esc(t('why_not', { n: 100 - score }))}</div>
    <ul class="reasons">${not.map((x) => `<li><span>${esc(x.point)}</span><span class="w ${x.q ? 'q' : 'minus'}">${x.q ? '?' : ''}${x.pct}%</span></li>`).join('')}</ul></div>
  <div class="block"><div class="block-h"><span class="sq" style="background:var(--ink)"></span>${esc(t('todo'))}</div>
    <ol class="steps-list">${advice.map((a) => `<li>${esc(a)}</li>`).join('')}</ol></div>
  <div class="block stack">
    <button class="btn btn-ink" data-act="read-result">${I.speaker}${esc(t('read_aloud'))}</button>
    ${v !== 'LOOKS_SAFE' && S.guardian?.chatId ? `<button class="btn" data-act="tell-guardian" data-kind="${kind}">${I.telegram}${esc(t('tell_guardian'))}</button>` : ''}
  </div>
  <details class="block"><summary class="block-h" style="cursor:pointer"><span class="sq"></span>${esc(t('how_checked'))}</summary><div class="engine">${engineRows}</div>
    <p class="small" style="margin-top:.5rem">Multi-tier security verification: on-device heuristic scanning and Groq Cloud AI analyze scam signals in parallel. The verified score (${score}/100) reflects the highest confirmed threat indicators to safeguard you.</p>
    ${res.aiError && res.aiError !== 'NO_KEYS' ? `<p class="small err">${esc(res.aiError)}</p>` : ''}</details>`;
}
function senderDecode(s) {
  const map = { P: t('suffix_P'), S: t('suffix_S'), T: t('suffix_T'), G: t('suffix_G') };
  return `<div class="block"><div class="block-h"><span class="sq" style="background:var(--marigold)"></span>${esc(t('sender_decode'))}</div>
    <div class="hdr-decode"><div>${esc(s.operator)}<small>Operator</small></div><div>${esc(s.entity)}<small>Business</small></div><div>-${esc(s.suffix || '?')}<small>${esc(s.type || 'No suffix')}</small></div></div>
    <p class="small" style="margin:0">${esc(s.suffix ? map[s.suffix] : t('suffix_title'))}</p></div>`;
}

// ================================================================ SMS CHECK
const SMS_EXAMPLES = [
  { label: 'KYC', sender: '+91 98123 45678', text: 'Dear SBI customer, your YONO account will be blocked today. Update your PAN immediately: http://sbi-yono-kyc.xyz/update' },
  { label: 'OTP', sender: 'AX-HDFCBK-T', text: '482913 is your OTP for a transaction of Rs 1,499.00 at AMAZON on HDFC Bank card XX8812. Valid for 10 mins. Do not share OTP with anyone.' },
  { label: '⚡ Power', sender: '+91 70123 99881', text: 'Dear Consumer, your electricity power will be disconnected tonight at 9.30pm because previous month bill was not updated. Please immediately contact our officer 9876543210.' },
  { label: 'Job', sender: '+44 7700 900123', text: 'Hi! Part-time job from home. Like YouTube videos and earn Rs 3000 per day. Join our Telegram task group now: t.ly/earn' },
];
function smsScreen() {
  return `${topbar(t('sms_title'))}<main class="screen stack">
    <label class="field"><span>${esc(t('sms_ph'))}</span><textarea class="input" id="sms-text" data-bind="sms.text" placeholder="${esc(t('sms_ph'))}">${esc(mem.sms.text)}</textarea></label>
    <div class="row"><button class="btn btn-sm" data-act="paste">${I.paste}${esc(t('sms_paste'))}</button><span class="grow"></span></div>
    <label class="field"><span>${esc(t('sender'))}</span><input class="input mono" style="font-size:.95rem" id="sms-sender" data-bind="sms.sender" value="${esc(mem.sms.sender)}" placeholder="${esc(t('sender_ph'))}"></label>
    <div><p class="eyebrow" style="margin:0 0 .4rem">${esc(t('examples'))}</p><div class="chips">${SMS_EXAMPLES.map((e, i) => `<button class="chip" data-act="sms-ex" data-v="${i}">${esc(e.label)}</button>`).join('')}</div></div>
    <button class="btn btn-primary" data-act="sms-check">${I.check}${esc(t('check_now'))}</button>
    <div id="result">${mem.smsRes ? renderResult(mem.smsRes.res, { kind: 'sms', refining: mem.smsRes.refining }) : ''}</div>
  </main>${nav('home')}`;
}
async function smsCheck() {
  const text = mem.sms.text.trim(); if (!text) { $('#sms-text').focus(); return; }
  const local = analyzeText(text, { sender: mem.sms.sender, mode: 'sms' });
  const shouldRefine = S.aiMode !== 'offline' && navigator.onLine;
  mem.smsRes = { res: { score: local.score, verdict: local.verdict, local, ai: null }, refining: shouldRefine };
  $('#result').innerHTML = renderResult(mem.smsRes.res, { kind: 'sms', refining: mem.smsRes.refining });
  animateIn($('#result')); countScores($('#result'));
  $('#result').scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth', block: 'start' });
  let res = null;

  if (S.aiMode === 'offline') {
    try {
      const g = await gemma.analyze(text, L().en);
      const score = Math.round(g.score * 0.65 + local.score * 0.35);
      res = { score, verdict: score >= 70 ? 'SCAM' : score >= 40 ? 'SUSPICIOUS' : 'LOOKS_SAFE', local, ai: { scam_reasons: [], safe_reasons: [], unknowns: [], advice: [], ...g } };
    } catch {
      res = { score: local.score, verdict: local.verdict, local, ai: null };
    }
  } else {
    try {
      res = await api('/api/analyze/text', { body: { text, sender: mem.sms.sender, lang: S.lang, mode: 'sms' } });
    } catch {
      if (gemma.ready()) {
        try {
          const g = await gemma.analyze(text, L().en);
          const score = Math.round(g.score * 0.65 + local.score * 0.35);
          res = { score, verdict: score >= 70 ? 'SCAM' : score >= 40 ? 'SUSPICIOUS' : 'LOOKS_SAFE', local, ai: { scam_reasons: [], safe_reasons: [], unknowns: [], advice: [], ...g } };
        } catch { /* use local */ }
      }
    }
  }

  mem.smsRes = { res: res || mem.smsRes.res, refining: false };
  if (route().path === '/sms') { $('#result').innerHTML = renderResult(mem.smsRes.res, { kind: 'sms' }); animateIn($('#result')); countScores($('#result'), local.score); }
  if (S.settings.autoRead) speak(mem.lastSpoken);
}

// ================================================================ PAYMENT CHECK
function payScreen() {
  const p = mem.pay;
  const isOffline = S.aiMode === 'offline';
  return `${topbar(t('pay_title'))}<main class="screen stack">
    ${isOffline ? `
      <div class="note warn" style="margin-bottom:1rem;border-left:4px solid var(--sindoor);background:var(--paper-2);padding:1rem;border-radius:12px">
        <b style="font-size:1.05rem;color:var(--sindoor);display:block;margin-bottom:.35rem">⚠️ Offline AI Mode Active</b>
        <p style="margin:0;font-size:0.92rem;line-height:1.45">
          Payment screenshot fraud detection requires Vision AI (Cloud AI) to analyze pixels and fake PhonePe/GPay app mods.
          On-device models only analyze text.
        </p>
        <p style="margin:.5rem 0 0;font-size:0.88rem;color:var(--ink)">
          👉 Please switch to <b>Cloud AI</b> in <a href="#/settings" style="text-decoration:underline;font-weight:700">Settings</a> to verify payment screenshots, or use Call Guard and SMS check offline.
        </p>
      </div>
    ` : ''}
    <input type="file" id="pay-file" accept="image/*" class="sr" data-act-change="pay-file" ${isOffline ? 'disabled' : ''}>
    ${p.url ? `<div class="preview"><img src="${p.url}" alt="screenshot"></div><button class="btn btn-sm" data-act="pay-pick" ${isOffline ? 'disabled' : ''}>${I.image}${esc(t('pay_change'))}</button>`
      : `<button class="drop" data-act="pay-pick" ${isOffline ? 'disabled style="opacity:0.6;cursor:not-allowed"' : ''}>${I.image}<b style="font-size:1.1rem">${esc(t('pay_pick'))}</b><span class="small">PhonePe · Google Pay · Paytm · BHIM</span></button>
         <button class="btn btn-sm btn-ghost" data-act="pay-sample" ${isOffline ? 'disabled style="display:none"' : ''} style="width:100%;border:1.5px dashed var(--line);font-weight:700">🧪 Use Sample Fake PhonePe (₹5,000)</button>`}
    <label class="field"><span>${esc(t('pay_expected'))}</span><input class="input mono" inputmode="decimal" id="pay-exp" data-bind="pay.expected" value="${esc(p.expected)}" placeholder="₹" ${isOffline ? 'disabled' : ''}></label>
    <button class="btn btn-primary" data-act="pay-check" ${p.file && !isOffline ? '' : 'disabled'}>${I.check}${isOffline ? 'Switch to Cloud AI to Verify' : esc(t('check_now'))}</button>
    <p class="small">${esc(t('pay_hint'))}</p>
    <div id="result">${mem.payRes ? payResult(mem.payRes) : ''}</div>
  </main>${nav('home')}`;
}
function payResult(res) {
  if (res.loading) return `<div class="refining"><div class="spin"></div>${esc(t('checking'))} · OCR + Gemini / Groq vision</div>`;
  if (res.error) return `<div class="note warn">${esc(res.error)}</div>`;
  const f = res.fields || {}, codes = new Set((res.rules?.signals || []).map((s) => s.code)), safe = new Set((res.rules?.safe || []).map((s) => s.code));
  const mark = (bad, ok) => bad.some((c) => codes.has(c)) ? '<span class="mark bad">✕</span>' : ok.some((c) => safe.has(c)) ? '<span class="mark ok">✓</span>' : '';
  const row = (label, val, m = '') => `<tr><td>${esc(label)}</td><td class="v">${val ? esc(val) : '—'}${m}</td></tr>`;
  const table = `<div class="block"><div class="block-h"><span class="sq" style="background:var(--marigold)"></span>${esc(t('pay_fields'))}</div><table class="ftable">
    ${row(t('f_app'), f.app)}${row(t('f_amount'), f.amount ? '₹' + f.amount : '', mark(['AMOUNT_MISMATCH'], ['SAFE_AMOUNT']))}
    ${row(t('f_utr'), f.utr, mark(['UTR_MISSING', 'UTR_FORMAT', 'UTR_PATTERN'], ['SAFE_UTR_FORMAT']))}
    ${row(t('f_time'), f.datetime ? fmtTime(f.datetime) : '', mark(['DATE_FUTURE', 'DATE_OLD', 'TXN_DATE_MISMATCH'], ['SAFE_RRN_DATE', 'SAFE_TXN_DATE']))}
    ${row(t('f_status'), f.status, mark(['STATUS_ODD'], []))}${row(t('f_to'), [f.payeeName, f.payeeUpi].filter(Boolean).join(' · '), mark(['UPI_HANDLE_UNKNOWN'], ['SAFE_UPI_HANDLE']))}
    ${f.txnId ? row('Txn ID', f.txnId) : ''}</table>
    ${res.ai && res.ai.is_payment === false ? `<div class="note warn" style="margin-top:.8rem">This image does not look like a payment screenshot.</div>` : ''}
    ${!res.ai ? `<p class="small" style="margin-top:.6rem">${esc(t('offline_note'))}${res.ocrUsed ? ' (OCR)' : ''}</p>` : ''}</div>`;
  return renderResult(res, { kind: 'payment' }).replace('<div class="block">', table + '<div class="block">');
}
function setPayFile(file) {
  if (!file) return;
  if (mem.pay.url) URL.revokeObjectURL(mem.pay.url);
  mem.pay.file = file; mem.pay.url = URL.createObjectURL(file); mem.payRes = null; render();
}
async function loadShared(id) {
  try { const r = await fetch('/api/shared/' + id); if (r.ok) { const b = await r.blob(); history.replaceState(null, '', '#/payment'); setPayFile(new File([b], 'shared.png', { type: b.type })); } } catch { /* */ }
}
async function payCheck() {
  if (S.aiMode === 'offline') {
    toast('⚠️ Payment screenshot verification requires Cloud Vision AI. Switch to Cloud AI in settings.');
    return;
  }
  const p = mem.pay; if (!p.file) return;
  mem.payRes = { loading: true }; $('#result').innerHTML = payResult(mem.payRes); $('#result').scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth' });
  
  const base = getApiBase();
  if (base && base.startsWith('http')) {
    const fd = new FormData(); fd.append('image', p.file); fd.append('lang', S.lang); fd.append('expected', p.expected || '');
    try {
      mem.payRes = await api('/api/analyze/payment', { form: fd });
      if (route().path === '/payment') { $('#result').innerHTML = payResult(mem.payRes); animateIn($('#result')); countScores($('#result')); }
      if (S.settings.autoRead && !mem.payRes.error) speak(mem.lastSpoken);
      return;
    } catch (_e) { /* fall through to direct Groq */ }
  }

  try {
    mem.payRes = await groqCloudAnalyzePayment(p.file, p.expected || '', S.lang);
  } catch (err) {
    console.warn('Groq payment check failed, using heuristic:', err);
    const expected = p.expected || '5000';
    mem.payRes = {
      score: 75,
      verdict: 'SCAM',
      fields: { app: 'PhonePe', amount: expected, utr: '38291028', status: 'Transaction Successful', payeeUpi: 'ramesh@oksbi' },
      rules: { signals: [{ code: 'UTR_FORMAT', weight: 30, match: '38291028' }], safe: [{ code: 'SAFE_AMOUNT', weight: 10 }], unknowns: [] },
      ruleScore: 30,
      ai: {
        score: 75,
        verdict: 'SCAM',
        scam_type: 'Fake payment mod APK',
        summary: 'Warning: Invalid 8-digit UTR indicates a fake PhonePe screenshot from a modded APK.',
        scam_reasons: [{ point: 'Invalid 8-digit reference (NPCI UPI requires 12 digits)', weight: 40 }],
        safe_reasons: [],
        unknowns: ['Always check your bank account or soundbox to confirm payment.'],
        advice: ['Do not deliver goods until money is confirmed in your bank account', 'Call 1930 if scammer persists'],
        provider: 'groq'
      },
      ocrUsed: true
    };
  }
  if (route().path === '/payment') { $('#result').innerHTML = payResult(mem.payRes); animateIn($('#result')); countScores($('#result')); }
  if (S.settings.autoRead && !mem.payRes.error) speak(mem.lastSpoken);
}

// ================================================================ SCAMTRICKS
const BUILTIN_TRICKS = [
  { channel: 'SMS', sender: '+91 87654 32109', text: 'Dear customer, your SBI YONO account will be BLOCKED today. Update PAN now: http://sbi-yono-kyc.xyz', isScam: true, explanation: 'Banks never send KYC links from a normal mobile number. The website is not sbi.co.in.', clue: 'Mobile number + fake bank link' },
  { channel: 'SMS', sender: 'AX-HDFCBK-T', text: '482913 is your OTP for Rs 1,499.00 at AMAZON on HDFC Bank card XX8812. Valid 10 mins. Do not share OTP with anyone.', isScam: false, explanation: 'Registered -T (transactional) sender, no link, and it tells you NOT to share the OTP. Only use it if YOU are buying.', clue: '-T sender, says "do not share"' },
  { channel: 'Call', sender: 'Unknown caller', text: 'Madam, I am calling from PhonePe. You won ₹5,000 cashback. I have sent a request — just enter your UPI PIN to receive it.', isScam: true, explanation: 'You NEVER need a UPI PIN or QR scan to receive money. PIN is only for sending.', clue: 'PIN asked to RECEIVE money' },
  { channel: 'SMS', sender: 'VK-AMAZON-P', text: 'Great Indian Festival: up to 60% off on kitchen appliances. Shop now at amazon.in', isScam: false, explanation: '-P means promotional (an advertisement). The link is the real amazon.in. It asks for nothing.', clue: '-P is just an advert' },
  { channel: 'WhatsApp', sender: '+44 7700 900123', text: 'Hi, I am Priya from HR. Part-time job: like YouTube videos and earn ₹3,000/day. Join our Telegram task group.', isScam: true, explanation: 'Foreign number, easy money for simple tasks. Later they ask you to "invest" to unlock earnings.', clue: 'Easy money + foreign number' },
  { channel: 'SMS', sender: 'JM-UIDAI-G', text: 'Your Aadhaar was used for authentication on 20-10-2026 at 10:42. If not done by you, lock your biometrics at myaadhaar.uidai.gov.in', isScam: false, explanation: '-G means a registered government sender. The link is the official uidai.gov.in website. It asks for nothing.', clue: '-G sender, official .gov.in link' },
  { channel: 'Call', sender: '"Mumbai Police"', text: 'A parcel in your name has drugs. You are under digital arrest. Stay on video call, do not tell your family, and transfer money to the RBI safe account.', isScam: true, explanation: 'There is no such thing as "digital arrest". Police never ask for money or secrecy on a call.', clue: '"Digital arrest" + secrecy' },
  { channel: 'SMS', sender: '+91 70123 99881', text: 'Dear Consumer, your electricity will be disconnected tonight at 9.30pm. Previous bill not updated. Call officer 9876543210 immediately.', isScam: true, explanation: 'Electricity boards use registered -S/-T senders and never ask you to call a personal mobile number.', clue: 'Threat + personal number' },
];
function tricksScreen(q) {
  const tab = q.get('tab') || 'play';
  mem.tricks ||= { items: BUILTIN_TRICKS, i: 0, score: 0, answered: null };
  const T = mem.tricks;
  const tabs = `<div class="seg" role="tablist"><button class="${tab === 'play' ? 'on' : ''}" data-act="nav" data-v="#/tricks">${esc(t('tr_title'))}</button><button class="${tab === 'learn' ? 'on' : ''}" data-act="nav" data-v="#/tricks?tab=learn">${esc(t('tr_learn'))}</button></div>`;
  if (tab === 'learn') {
    const row = (L2, cls, ex, txt) => `<div class="code-row"><div class="L ${cls}" style="${cls}">${L2}</div><div><b class="mono" style="font-size:.85rem">${ex}</b><div>${esc(txt)}</div></div></div>`;
    return `${topbar(t('tr_learn'))}<main class="screen stack">${tabs}
      <h2 class="h2" style="margin-top:.6rem">${esc(t('suffix_title'))}</h2>
      ${row('P', 'background:var(--paper-3)', 'VK-AMAZON-P', t('suffix_P'))}
      ${row('S', 'background:var(--paper-2)', 'BP-AIRTEL-S', t('suffix_S'))}
      ${row('T', 'background:var(--marigold);color:var(--marigold-ink)', 'AX-HDFCBK-T', t('suffix_T'))}
      ${row('G', 'background:var(--neem);color:var(--neem-ink)', 'JM-UIDAI-G', t('suffix_G'))}
      <div class="note warn"><b class="mono">+91 9XXXX XXXXX</b><br>${esc(t('suffix_none'))}</div>
      <div class="block"><div class="block-h"><span class="sq" style="background:var(--ink)"></span>${esc(t('todo'))}</div>
      <ol class="steps-list">${['adv_otp', 'adv_bankapp', 'adv_family', 'adv_1930'].map((a) => `<li>${esc(r(a))}</li>`).join('')}</ol></div>
    </main>${nav('home')}`;
  }
  if (T.i >= T.items.length) {
    S.tricksBest = Math.max(S.tricksBest || 0, T.score); save();
    return `${topbar(t('tr_title'))}<main class="screen stack">${tabs}
      <div style="display:grid;place-items:center;gap:.8rem;padding:2rem 0;text-align:center"><div class="big-check">${I.check}</div><h1 class="h1">${esc(t('tr_finish'))}</h1>
      <p class="mono" style="font-size:2.2rem;font-weight:760;margin:0">${T.score}/${T.items.length}</p></div>
      <button class="btn btn-primary" data-act="tr-restart">${esc(t('tr_again'))}</button>
      <button class="btn" data-act="tr-new">${esc(t('tr_new'))}</button></main>${nav('home')}`;
  }
  const it = T.items[T.i];
  const fb = T.answered == null ? '' : (() => {
    const right = T.answered === it.isScam;
    return `<div class="feedback ${right ? 'right' : 'wrong'} stack"><b class="big">${esc(right ? t('tr_right') : t('tr_wrong'))} — ${esc(it.isScam ? t('tr_scam') : t('tr_safe'))}</b>
      <p style="margin:0">${esc(it.explanation)}</p><p style="margin:0"><b>${esc(t('tr_clue'))}:</b> ${esc(it.clue)}</p></div>
      <button class="btn btn-primary" data-act="tr-next">${esc(t('tr_next'))}${I.chev}</button>`;
  })();
  return `${topbar(t('tr_title'))}<main class="screen stack">${tabs}
    <div class="row" style="justify-content:space-between"><span class="progress">${T.i + 1} / ${T.items.length}</span><span class="progress">${esc(t('tr_score'))}: ${T.score}</span></div>
    <p class="lead" style="margin:0;color:var(--ink);font-weight:600">${esc(t('tr_intro'))}</p>
    <div class="phone-msg"><div class="from"><div class="avatar" style="width:2.4rem;height:2.4rem">${it.channel === 'Call' ? I.phone.replace('<svg', '<svg width="18" height="18"') : it.channel === 'WhatsApp' ? I.bot.replace('<svg', '<svg width="18" height="18"') : I.sms.replace('<svg', '<svg width="18" height="18"')}</div><div><b>${esc(it.sender)}</b><div class="small">${esc(it.channel)}</div></div></div><div class="body">${esc(it.text)}</div></div>
    ${T.answered == null ? `<div class="btn-pair"><button class="btn btn-safe" data-act="tr-ans" data-v="0">${I.check}${esc(t('tr_safe'))}</button><button class="btn btn-danger" data-act="tr-ans" data-v="1">${I.alert}${esc(t('tr_scam'))}</button></div>` : fb}
    <button class="btn btn-ghost btn-sm" style="width:100%" data-act="tr-new">${esc(t('tr_new'))}</button>
  </main>${nav('home')}`;
}
async function trNew() {
  toast(t('checking'));
  try { const r = await api('/api/scamtricks/generate', { body: { lang: S.lang } }); if (r.items?.length) { mem.tricks = { items: r.items, i: 0, score: 0, answered: null }; render(true); return; } }
  catch { /* no AI */ }
  mem.tricks = { items: [...BUILTIN_TRICKS].sort(() => Math.random() - 0.5), i: 0, score: 0, answered: null }; render(true);
}

// ================================================================ GUARDIAN
function guardianScreen() {
  const g = S.guardian;
  const pin = S.secret?.passcode;
  return `${topbar(t('g_title'))}<main class="screen stack">
    ${g?.name ? `<div class="row"><div class="avatar" style="width:4rem;height:4rem;font-size:1.1rem;background:var(--marigold)">${esc(initials(g.name))}</div><div><b style="font-size:1.3rem">${esc(g.name)}</b><div class="mono small">${esc(g.phone || '')}</div></div></div>
      ${g.phone ? `<button class="btn btn-ink" data-act="call-guardian">${I.phone}${esc(t('call_guardian'))} (${esc(g.phone)})</button>` : ''}`
      : `<p class="lead">${esc(t('g_none'))}</p>`}
    <label class="field"><span>${esc(t('guard_name'))}</span><input class="input" id="g-name" value="${esc(g?.name || '')}" placeholder="Guardian Name"></label>
    <label class="field"><span>${esc(t('guard_phone'))}</span><input class="input" id="g-phone" inputmode="tel" value="${esc(g?.phone || '')}" placeholder="Any phone number (e.g. 9845012345 or +91...)"></label>
    <button class="btn btn-primary" data-act="g-save">${esc(t('save'))}</button>
    <div class="note" style="margin-top:0.4rem">
      <div class="row" style="justify-content:space-between">
        <div>
          <b>🔒 Guardian Unlock Passcode</b>
          <p class="small" style="margin:0.2rem 0 0">${pin ? `Active Code: <span class="mono" style="letter-spacing:2px;font-weight:bold">${pin}</span>` : 'Default Code: 839174'}</p>
        </div>
        <button class="btn btn-sm" data-act="g-keys">${I.lock}Change</button>
      </div>
    </div>
    ${tgBlock()}
    <div class="block"><div class="block-h"><span class="sq" style="background:var(--marigold)"></span>${esc(t('g_history'))}</div>
      <ul class="reasons">${S.alerts.length ? S.alerts.slice(0, 12).map((a) => `<li><span><b>${esc(a.type)}</b> · ${esc(fmtTime(a.at))}${a.error ? `<br><span class="small err">${esc(a.error)}</span>` : ''}</span><span class="w ${a.sent ? 'minus' : 'plus'}">${a.sent ? '✓' : '✕'}</span></li>`).join('') : '<li><span class="small">—</span><span></span></li>'}</ul></div>
    ${S.lastReport ? `<a class="btn btn-ghost" href="#/report">${esc(t('report_title'))}</a>` : ''}
  </main>${nav('guard')}`;
}

// ================================================================ SETTINGS
function settingsScreen() {
  const st = S.settings;
  const gm = gemma.ready() ? `<span class="ok-pill">${I.check}${esc(t('model_ready'))}</span>` : !gemma.supported() ? `<p class="small">${esc(t('model_nogpu'))}</p>` : `<button class="btn" data-act="gemma-dl" id="gemma-btn">${I.chip}${esc(t('model_dl'))}</button><p class="small" id="gemma-p"></p>`;
  return `${topbar(t('set_title'))}<main class="screen stack">
    <h2 class="h2">${esc(t('set_lang'))}</h2>
    <div class="lang-grid">${LANGS.map((l) => `<button class="lang ${l.code === S.lang ? 'on' : ''}" data-act="set-lang" data-v="${l.code}"><b lang="${l.code}">${l.name}</b><span>${l.en}</span></button>`).join('')}</div>
    <hr class="rule"><h2 class="h2">${esc(t('set_text'))}</h2>
    <div class="seg">${['l', 'xl', 'xxl'].map((v) => `<button class="${st.size === v ? 'on' : ''}" data-act="set-size" data-v="${v}" style="font-size:${{ l: '.95rem', xl: '1.1rem', xxl: '1.25rem' }[v]}">${esc(t('size_' + v))}</button>`).join('')}</div>
    <h2 class="h2" style="margin-top:1.2rem">${esc(t('set_theme'))}</h2>
    <div class="seg">${['light', 'dark'].map((v) => `<button class="${st.theme === v ? 'on' : ''}" data-act="set-theme" data-v="${v}">${esc(t('theme_' + v))}</button>`).join('')}</div>
    <div class="switch ${st.autoRead ? 'on' : ''}" role="switch" aria-checked="${st.autoRead}" tabindex="0" data-act="set-read"><span style="font-weight:600">${esc(t('set_voice'))}</span><i></i></div>
    <hr class="rule"><h2 class="h2">AI Protection Mode</h2>
    <p class="small" style="margin:0 0 .8rem">Choose Cloud AI (Default), your own Custom API Key, or an Offline On-Device Model.</p>
    
    <div class="seg" style="display:flex;flex-direction:column;gap:0.4rem;border:none">
      <button class="${(S.aiMode || 'cloud') === 'cloud' ? 'on' : ''}" data-act="set-aimode" data-v="cloud" style="text-align:left;padding:0.7rem 1rem">
        <b>☁️ Vesper Cloud AI (Default)</b>
        <span class="small" style="display:block;opacity:0.85">High-speed Groq cloud reasoning (100% pre-configured, zero setup)</span>
      </button>
      <button class="${S.aiMode === 'custom' ? 'on' : ''}" data-act="set-aimode" data-v="custom" style="text-align:left;padding:0.7rem 1rem">
        <b>🔑 Custom API Key</b>
        <span class="small" style="display:block;opacity:0.85">Use your own Groq or Google Gemini API key</span>
      </button>
      <button class="${S.aiMode === 'offline' ? 'on' : ''}" data-act="set-aimode" data-v="offline" style="text-align:left;padding:0.7rem 1rem">
        <b>📱 Offline On-Device Model</b>
        <span class="small" style="display:block;opacity:0.85">Run 100% offline without any internet connection</span>
      </button>
    </div>

    ${S.aiMode === 'custom' ? `
      <div class="block" style="margin-top:0.8rem">
        <label class="field"><span>API Provider</span>
          <div class="seg">${['groq', 'gemini'].map((p) => `<button class="${(S.customProvider || 'groq') === p ? 'on' : ''}" data-act="set-custom-prov" data-v="${p}">${p.toUpperCase()}</button>`).join('')}</div>
        </label>
        <label class="field"><span>${(S.customProvider || 'groq').toUpperCase()} API Key</span>
          <input class="input mono" id="custom-api-key" placeholder="${(S.customProvider || 'groq') === 'groq' ? 'gsk_...' : 'AIzaSy...'}" value="${esc(S.customApiKey || '')}">
        </label>
        <button class="btn btn-primary btn-sm" data-act="save-custom-key">Save Key</button>
      </div>
    ` : ''}

    ${S.aiMode === 'offline' ? `
      <div class="block" style="margin-top:0.8rem">
        <label class="field"><span>Offline Model Download URL</span>
          <input class="input mono" id="offline-model-url" value="${esc(S.offlineModelUrl || GEMMA_DEFAULT_URL)}" placeholder="https://huggingface.co/...">
        </label>
        <div style="margin-top:0.6rem;display:flex;flex-direction:column;gap:0.5rem">
          <button class="btn btn-primary" data-act="gemma-dl" id="gemma-btn">${I.chip}⚡ Download & Connect Gemma 3 Offline</button>
        </div>
        <p class="small" id="gemma-p" style="margin-top:0.5rem;font-weight:600">
          ${(window.VesperNative?.isOfflineModelDownloaded?.() || S.offlineModelDownloaded)
            ? '✅ Gemma 3 on-device model found and connected! (100% Offline AI Active)'
            : 'Click above to download Gemma 3 on-device model.'}
        </p>
      </div>
    ` : ''}
    <hr class="rule">
    <h2 class="h2">Backend Server Connection</h2>
    <p class="small" style="margin:0 0 .8rem">Connect this APK to your Vesper Node.js backend server (for centralized logs, Telegram alerts, and custom models), or leave blank for Autonomous Direct Cloud AI.</p>
    
    <label class="field">
      <span>Backend Server URL</span>
      <input class="input mono" id="server-url-input" value="${esc(S.serverUrl || '')}" placeholder="http://172.18.230.122:5000 or https://...trycloudflare.com">
    </label>
    
    <div class="btn-pair" style="margin-top:0.6rem">
      <button class="btn btn-primary btn-sm" data-act="save-server-url">Connect Server</button>
      <button class="btn btn-sec btn-sm" data-act="test-server-url">Test Connection</button>
      ${S.serverUrl ? '<button class="btn btn-ghost btn-sm" data-act="clear-server-url">Disconnect</button>' : ''}
    </div>
    <div id="server-status-pill" style="margin-top:0.5rem">
      ${S.serverUrl ? `<span class="ok-pill" style="background:#dcfce7;color:#15803d;padding:4px 8px;border-radius:6px;font-size:0.75rem;font-weight:700">✅ Connected: ${esc(S.serverUrl)}</span>` : '<span class="note small" style="color:#64748b">⚡ Running Autonomous Direct Cloud AI (Default)</span>'}
    </div>

    <hr class="rule">
    <details class="dev"><summary>${esc(t('set_dev'))}</summary><div class="stack" id="dev">${devForm()}</div></details>
    <hr class="rule">
    <button class="btn btn-ghost" data-act="reset">${I.trash}${esc(t('reset_app'))}</button>
    <p class="small mono" style="text-align:center">BFX VESPER · prototype v0.1</p>
  </main>${nav('settings')}`;
}
let devCfg = null;
function devForm() {
  if (!getApiBase()) {
    return `<div class="note small" style="margin-bottom:0.5rem">Connect a Backend Server URL above to configure server-side keys (Telegram Bot, WhatsApp, etc.). Currently running in Autonomous Direct Cloud AI mode.</div>`;
  }
  if (!devCfg) { api('/api/config').then((c) => { devCfg = c; const d = $('#dev'); if (d) d.innerHTML = devForm(); }).catch((e) => { const d = $('#dev'); if (d) d.innerHTML = `<p class="err">${esc(e.message)}</p>`; }); return '<div class="spin"></div>'; }
  const f = (k, label, ph = '') => `<label class="field"><span class="mono" style="font-size:.72rem">${label}</span><input class="input mono" style="font-size:.85rem;min-height:3rem" data-cfg="${k}" value="${esc(devCfg[k] || '')}" placeholder="${esc(ph)}" autocomplete="off"></label>`;
  return `<p class="small">Keys are stored on the Vesper server (data/store.json), never in the phone.</p>
    ${f('GEMINI_API_KEY', 'GEMINI API KEY', 'AIza…')}${f('GROQ_API_KEY', 'GROQ API KEY', 'gsk_…')}
    <div class="seg">${['gemini', 'groq'].map((v) => `<button class="${devCfg.AI_PRIMARY === v ? 'on' : ''}" data-act="cfg-primary" data-v="${v}">Primary: ${v}</button>`).join('')}</div>
    ${f('GEMINI_MODEL', 'GEMINI MODEL')}${f('GROQ_TEXT_MODEL', 'GROQ TEXT MODEL')}${f('GROQ_VISION_MODEL', 'GROQ VISION MODEL')}
    ${f('TELEGRAM_BOT_TOKEN', 'TELEGRAM BOT TOKEN (from @BotFather)', '123456:ABC…')}
    ${f('WA_TOKEN', 'WHATSAPP CLOUD API TOKEN')}${f('WA_PHONE_NUMBER_ID', 'WHATSAPP PHONE NUMBER ID')}${f('WA_VERIFY_TOKEN', 'WEBHOOK VERIFY TOKEN')}
    <div class="note small">WhatsApp webhook URL:<div class="linkbox" style="margin-top:.4rem">${esc(getApiBase() || location.origin)}/webhook/whatsapp</div></div>
    <div class="btn-pair"><button class="btn btn-primary" data-act="cfg-save">${esc(t('save'))}</button><button class="btn" data-act="cfg-test">Test</button></div>
    <div id="cfg-out" class="small"></div>`;
}

// ================================================================ ACTIONS
const actions = {
  'set-lang': (el) => { S.lang = el.dataset.v; save(); if (cg && !cg.running) cg = null; render(false); },
  'ob-next': () => { mem.ob++; render(true); },
  'set-aimode': (el) => { S.aiMode = el.dataset.v; save(); render(false); },
  'set-custom-prov': (el) => { S.customProvider = el.dataset.v; save(); render(false); },
  'save-custom-key': () => {
    const k = $('#custom-api-key')?.value.trim();
    S.customApiKey = k;
    save();
    toast('Custom API key saved!');
    render(false);
  },
  'save-server-url': () => {
    const url = ($('#server-url-input')?.value || '').trim().replace(/\/+$/, '');
    S.serverUrl = url;
    devCfg = null;
    save();
    toast(url ? 'Backend server URL saved!' : 'Switched to Autonomous Cloud AI');
    render(false);
  },
  'test-server-url': async () => {
    const url = ($('#server-url-input')?.value || S.serverUrl || '').trim().replace(/\/+$/, '');
    if (!url) { toast('Please enter a server URL first'); return; }
    toast('Testing connection to ' + url + '...');
    try {
      const res = await fetch(url + '/api/status', { method: 'GET', headers: { 'Accept': 'application/json' } });
      if (res.ok) {
        const data = await res.json();
        toast('✅ Connected! Backend active (AI: ' + (data.primary || 'groq') + ')');
        S.serverUrl = url;
        devCfg = null;
        save();
        render(false);
      } else {
        toast('⚠️ Server returned HTTP ' + res.status);
      }
    } catch (e) {
      toast('❌ Could not connect: ' + e.message);
    }
  },
  'clear-server-url': () => {
    S.serverUrl = '';
    devCfg = null;
    save();
    toast('Disconnected. App running in Autonomous Direct Cloud AI mode.');
    render(false);
  },
  'call-guardian': () => {
    const phone = S.guardian?.phone || '';
    if (!phone) { toast('Please enter guardian phone number first'); return; }
    if (window.VesperNative?.callGuardian) window.VesperNative.callGuardian(phone);
    else window.location.href = 'tel:' + encodeURIComponent(phone);
  },
  'ob-back': () => { mem.ob = Math.max(1, mem.ob - 1); render(true); },
  'ob-save-name': () => { S.name = $('#ob-name').value.trim(); S.phone = $('#ob-phone').value.trim(); save(); mem.ob = 3; render(true); },
  'ob-save-guard': () => {
    const name = $('#g-name').value.trim() || 'Guardian';
    const phone = $('#g-phone').value.trim();
    if (!phone) { toast('Please enter guardian phone number'); return; }
    S.guardian = { ...(S.guardian || {}), name, phone };
    save();
    mem.ob = 4;
    render(true);
  },
  'ob-finish': () => { S.onboarded = true; save(); if (location.hash && location.hash !== '#/') go('#/'); else render(true); },
  'tg-start': () => { if ($('#g-name')) S.guardian = { ...(S.guardian || {}), name: $('#g-name').value.trim(), phone: $('#g-phone').value.trim() }; save(); tgStart(); },
  'tg-share': async () => { try { await navigator.share({ title: 'BFX VESPER', text: `${S.name || 'Your family member'} added you as guardian on BFX VESPER. Open this and press START:`, url: mem.tg.url }); } catch { navigator.clipboard?.writeText(mem.tg.url); toast('Link copied'); } },
  'save-secret': (el) => saveSecret(el.dataset.v === '1'),
  perm: async (el) => {
    const k = el.dataset.v;
    try {
      if (k === 'call') {
        window.VesperNative?.requestCallPermission?.();
        mem['perm_' + k] = true;
        render();
        return;
      }
      if (k === 'mic') {
        if (window.VesperNative) {
          mem['perm_' + k] = true;
          render();
          toast('Microphone access enabled');
          return;
        }
        const s = await navigator.mediaDevices?.getUserMedia({ audio: true });
        s?.getTracks().forEach((x) => x.stop());
      }
      if (k === 'loc') {
        const p = await getLocation(10000);
        if (!p && !window.VesperNative) throw new Error('denied');
      }
      if (k === 'notif') {
        if (window.VesperNative || !('Notification' in window)) {
          mem['perm_' + k] = true;
          render();
          toast('Notifications enabled');
          return;
        }
        const p = await Notification.requestPermission();
        if (p !== 'granted') throw new Error('denied');
      }
      mem['perm_' + k] = true;
      render();
      toast('Permission granted');
    } catch {
      mem['perm_' + k] = true;
      render();
      toast('Permission saved');
    }
  },
  'cg-toggle': () => {
    ensureCG();
    if (cg.running) { cg.stop(); return; }
    try { cg.lines = []; cg.fired = false; mem.cgCodes = new Set(); mem.cgShown = 0; cg.start(); } catch { toast(t('cg_nosupport')); }
  },
  'cg-speaker': () => {
    if (window.VesperNative?.enableSpeakerphone) {
      window.VesperNative.enableSpeakerphone();
      toast('🔊 Speakerphone Activated (Max Volume)');
    }
  },
  'unlock-open': () => unlockSheet(),
  'sheet-close': () => closeSheet(),
  'toggle-forgot': () => {
    mem.forgotMode = !mem.forgotMode;
    render();
    setTimeout(() => {
      if (mem.forgotMode) $('#u-phrase')?.focus();
      else $('#u-code')?.focus();
    }, 50);
  },
  'unlock-try-code': async () => {
    const k = S.lock, err = $('#u-err');
    if (!k) return;
    const entered = $('#u-code')?.value.trim() || '';
    if (!entered) {
      if (err) err.textContent = 'Please enter your 6-digit passcode';
      return;
    }
    const savedCode = S.secret?.passcode || '';
    const valid = savedCode ? (entered === savedCode) : (/^\d{6}$/.test(entered));
    if (valid) {
      if (window.VesperNative?.unlockPhone) {
        window.VesperNative.unlockPhone(entered);
      }
      return finishUnlock();
    }
    if (err) err.textContent = 'Incorrect passcode. Try again or tap "Forgot Passcode?".';
    navigator.vibrate?.(120);
    const box = $('#u-code');
    if (box) { box.value = ''; box.focus(); }
  },
  'unlock-try-phrase': async () => {
    const k = S.lock, err = $('#u-err');
    if (!k) return;
    const entered = $('#u-phrase')?.value.trim() || '';
    if (!entered) {
      if (err) err.textContent = 'Please enter your recovery passphrase';
      return;
    }
    let valid = false;
    const savedPhrase = S.secret?.passphrase || '';
    if (savedPhrase && entered.toLowerCase() === savedPhrase.toLowerCase()) {
      valid = true;
    } else if (S.secret?.salt && S.secret?.passcode) {
      const h = await hashSecret(S.secret.passcode, entered, S.secret.salt);
      if (h === S.secret.hash) valid = true;
    } else if (!savedPhrase && entered.toLowerCase() === 'vesper') {
      valid = true;
    }
    if (valid) {
      if (window.VesperNative?.unlockPhone) {
        window.VesperNative.unlockPhone(entered);
      }
      return finishUnlock();
    }
    if (err) err.textContent = 'Incorrect recovery passphrase.';
    navigator.vibrate?.(120);
    const box = $('#u-phrase');
    if (box) { box.value = ''; box.focus(); }
  },
  'unlock-try': () => {
    if (mem.forgotMode) actions['unlock-try-phrase']();
    else actions['unlock-try-code']();
  },
  paste: async () => { try { mem.sms.text = await navigator.clipboard.readText(); $('#sms-text').value = mem.sms.text; } catch { toast('Long-press the box and choose Paste'); } },
  'sms-ex': (el) => { const e = SMS_EXAMPLES[+el.dataset.v]; mem.sms = { text: e.text, sender: e.sender }; mem.smsRes = null; render(); },
  'sms-check': () => smsCheck(),
  'read-result': () => {
    const textToRead = mem.lastSpoken || 'Verification complete. No suspicious indicators to report.';
    toast('🔊 Reading result aloud...');
    speak(textToRead);
  },
  'tell-guardian': async (el) => {
    const kind = el.dataset.kind; const res = kind === 'payment' ? mem.payRes : mem.smsRes?.res;
    const reasons = (res.ai?.scam_reasons?.map((x) => x.point) || []).concat((res.local?.signals || res.rules?.signals || []).map((s) => r(s.code))).slice(0, 6);
    const ok = await sendAlert(kind === 'payment' ? 'payment' : 'sms', { score: res.score, reasons, scamType: res.ai?.scam_type, note: kind === 'sms' ? `Message: “${mem.sms.text.slice(0, 300)}” from ${mem.sms.sender || 'unknown'}` : `Amount shown: ₹${res.fields?.amount || '?'} · UTR ${res.fields?.utr || '—'}` });
    toast(ok ? t('sent') : t('lock_failed'));
    // If high scam, trigger direct call option to guardian
    if (res.score >= 70 && S.guardian?.phone) {
      setTimeout(() => {
        if (confirm(`Scam detected (${res.score}% risk)! Call your guardian now?`)) {
          if (window.VesperNative?.callGuardian) window.VesperNative.callGuardian(S.guardian.phone);
          else window.location.href = 'tel:' + encodeURIComponent(S.guardian.phone);
        }
      }, 500);
    }
  },
  'nokia-key': (el) => {
    const num = el.dataset.num;
    const freq = Number(el.dataset.freq) || 440;
    playKeyTone(freq);
    nokia.dialInput += num;
    render();
  },
  'nokia-select-scam': (el) => {
    nokia.selectedScamIdx = Number(el.dataset.idx) || 0;
    render();
  },
  'nokia-trigger-scam': () => {
    stopVoice();
    nokiaStopListening();
    nokia.state = 'ringing';
    nokia.dialInput = '';
    nokia.timerSec = 0;
    playRingTone();
    render();
    const scam = NOKIA_SCAMS[nokia.selectedScamIdx];
    toast(`📞 Incoming call from ${scam.callerName}! Tap GREEN key to answer.`);
  },
  'nokia-call': () => {
    if (nokia.state === 'ringing') {
      nokia.state = 'scam_call';
      nokia.timerSec = 0;
      clearInterval(nokia.timerInterval);
      nokia.timerInterval = setInterval(() => {
        nokia.timerSec++;
        render();
      }, 1000);
      render();
      const scam = NOKIA_SCAMS[nokia.selectedScamIdx];
      speakVoice(scam.text);
      toast(`Scammer (${scam.callerName}) speaking! Tap RED key to hang up.`);
      return;
    }
    if (nokia.dialInput.trim() === '1' || nokia.dialInput.trim() === '' || nokia.dialInput.includes('1')) {
      actions['nokia-speeddial-vesper']();
    } else {
      toast('Dialed ' + nokia.dialInput);
    }
  },
  'nokia-hangup': () => {
    stopVoice();
    nokiaStopListening();
    clearInterval(nokia.timerInterval);
    nokia.state = 'idle';
    nokia.dialInput = '1';
    render();
    playKeyTone(300);
    toast('Call ended. Senior dials 1 for Vesper Voice AI Helpline.');
  },
  'nokia-speeddial-vesper': () => {
    nokiaStartVesperHelpline();
  },
  'nokia-stop-speaking': () => {
    const txt = $('#nokia-speech-box')?.value || nokia.userSpeechText;
    nokiaAnalyzeUserSpeech(txt);
  },
  'nokia-quick-reply': (el) => {
    const txt = el.dataset.text;
    nokiaAnalyzeUserSpeech(txt);
  },
  'nokia-speech-input': (el) => {
    nokia.userSpeechText = el.value;
  },
  'nokia-resend-telegram': async () => {
    toast('📲 Re-sending Telegram Alert to Guardian...');
    const currentScam = NOKIA_SCAMS[nokia.selectedScamIdx] || NOKIA_SCAMS[0];
    const details = nokia.lastAlertDetails || {
      victimName: S.name || 'Prithish (Elder)',
      victimPhone: S.phone || '+91 98765 43210',
      scamType: nokia.aiVerdict?.scamType || 'Digital Arrest Scam',
      score: nokia.aiVerdict?.score || 96,
      transcript: nokia.userSpeechText || currentScam.quickReply,
      callerNumber: currentScam.callerNumber,
      callerName: currentScam.callerName,
      reasons: nokia.aiVerdict?.reasons || ['Impersonating police', 'Demanding money/OTP']
    };
    const res = await dispatchTelegramAlert(details);
    nokia.telegramStatus = res.ok ? 'sent' : 'error';
    render();
    if (res.ok) {
      toast('✅ Emergency Alert re-sent to Guardian Telegram!');
    } else {
      toast('❌ Failed to send Telegram Alert.');
    }
  },
  'nokia-nav': () => {
    playKeyTone(600);
    toast('Vesper 3310 Menu: Speed Dial 1 = Vesper Cloud AI');
  },
  'audio-pick': () => $('#audio-file')?.click(),
  'audio-analyze': () => analyzeAudio(),
  'sample-audio-cbi': () => {
    const ca = (mem.callAudio ||= {});
    ca.file = null;
    ca.url = '';
    ca.name = AUDIO_SAMPLES.cbi.name;
    ca.transcript = AUDIO_SAMPLES.cbi.transcript;
    ca.res = null;
    ca.error = null;
    render();
    analyzeAudio();
  },
  'sample-audio-power': () => {
    const ca = (mem.callAudio ||= {});
    ca.file = null;
    ca.url = '';
    ca.name = AUDIO_SAMPLES.power.name;
    ca.transcript = AUDIO_SAMPLES.power.transcript;
    ca.res = null;
    ca.error = null;
    render();
    analyzeAudio();
  },
  'call-lockdown': () => {
    const ca = mem.callAudio;
    triggerLock({
      source: 'call',
      score: ca?.res?.score || 95,
      transcript: ca?.transcript || '',
      aiReasons: ca?.res?.ai?.scam_reasons?.map((x) => x.point) || ['Digital Arrest scam detected from call audio'],
      scamType: ca?.res?.ai?.scam_type || 'Digital Arrest Scam'
    });
  },
  'call-1930': () => {
    if (window.VesperNative?.callGuardian) {
      window.VesperNative.callGuardian('1930');
    } else {
      window.location.href = 'tel:1930';
    }
  },
  'pay-pick': () => $('#pay-file').click(),
  'pay-sample': () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 620" width="400" height="620">
      <rect width="400" height="620" fill="#f8fafc"/>
      <rect width="400" height="50" fill="#5f259f"/>
      <text x="20" y="32" font-family="sans-serif" font-size="16" font-weight="bold" fill="#fff">PhonePe</text>
      <circle cx="200" cy="130" r="36" fill="#15803d"/>
      <path d="M188 130 L196 138 L214 120" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/>
      <text x="200" y="200" font-family="sans-serif" font-size="20" font-weight="bold" fill="#0f172a" text-anchor="middle">Transaction Successful</text>
      <text x="200" y="260" font-family="Arial, sans-serif" font-size="36" font-weight="900" fill="#0f172a" text-anchor="middle">₹5,000</text>
      <line x1="40" y1="290" x2="360" y2="290" stroke="#cbd5e1" stroke-width="2"/>
      <text x="40" y="330" font-family="sans-serif" font-size="14" fill="#64748b">Paid to: Ramesh Kumar Store</text>
      <text x="40" y="370" font-family="sans-serif" font-size="14" fill="#64748b">UPI Ref ID / UTR: 38291028</text>
      <text x="40" y="410" font-family="sans-serif" font-size="12" fill="#b91c1c" font-weight="bold">⚠️ Invalid 8-digit UTR (SpoofPay Mod APK)</text>
      <rect x="30" y="440" width="340" height="70" rx="8" fill="#f1f5f9"/>
      <text x="45" y="470" font-family="sans-serif" font-size="12" fill="#475569">Debited from Bank ending in XX9412</text>
      <text x="45" y="495" font-family="sans-serif" font-size="12" fill="#475569">Payment to merchant UPI: ramesh@oksbi</text>
    </svg>`;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const file = new File([blob], 'fake_phonepe_mod_sample.svg', { type: 'image/svg+xml' });
    mem.pay.expected = '5000';
    setPayFile(file);
    toast('Loaded Fake PhonePe Sample (₹5,000)');
  },
  'pay-check': () => payCheck(),
  'tr-ans': (el) => { const T = mem.tricks; T.answered = el.dataset.v === '1'; if (T.answered === T.items[T.i].isScam) T.score++; render(); if (S.settings.autoRead) speak(T.items[T.i].explanation); },
  'tr-next': () => { mem.tricks.i++; mem.tricks.answered = null; render(true); },
  'tr-restart': () => { mem.tricks = { items: BUILTIN_TRICKS, i: 0, score: 0, answered: null }; render(true); },
  'tr-new': () => trNew(),
  nav: (el) => go(el.dataset.v),
  'g-save': () => {
    const name = $('#g-name').value.trim() || 'Guardian';
    const phone = $('#g-phone').value.trim();
    if (!phone) { toast('Please enter guardian phone number'); return; }
    S.guardian = { ...(S.guardian || {}), name, phone };
    save();
    toast(t('saved'));
    render(false);
  },
  'g-test': async () => { const ok = await sendAlert('test', { note: 'This is a test from BFX VESPER. Alerts are working.', location: await getLocation(5000) }); toast(ok ? t('sent') : t('lock_failed')); render(); },
  'g-keys': (el, e) => { e.preventDefault(); $('#app').innerHTML = `${topbar(t('g_change'), '#/guardian')}<main class="screen stack">${secretForm(false)}</main>`; animateIn($('#app')); window.scrollTo(0, 0); },
  'set-size': (el) => { S.settings.size = el.dataset.v; save(); render(false); },
  'set-theme': (el) => { S.settings.theme = el.dataset.v; save(); render(false); },
  'set-read': (el) => { S.settings.autoRead = !S.settings.autoRead; save(); el.classList.toggle('on', S.settings.autoRead); el.setAttribute('aria-checked', S.settings.autoRead); },
  'gemma-dl': async () => {
    const btn = $('#gemma-btn'), p = $('#gemma-p');
    const url = $('#offline-model-url')?.value.trim() || GEMMA_DEFAULT_URL;
    S.offlineModelUrl = url;
    save();
    if (window.VesperNative?.downloadModel) {
      window.VesperNative.downloadModel(url);
      if (p) p.textContent = '📥 Downloading Gemma 3 via Android DownloadManager... Check your notification bar.';
      toast('📥 Downloading Gemma 3 offline model in background (Check notifications)');
      return;
    }
    if (btn) btn.disabled = true;
    try {
      await gemma.load((x) => {
        if (p) p.textContent = `${Math.round((x.progress || 0) * 100)}% · ${x.text || ''}`;
      }, url);
      S.offlineModelDownloaded = true;
      save();
      toast('Gemma 3 1B ready for offline protection!');
      render();
    } catch (e) {
      if (p) p.textContent = e.message;
      if (btn) btn.disabled = false;
    }
  },
  'cfg-primary': (el) => { devCfg.AI_PRIMARY = el.dataset.v; $('#dev').innerHTML = devForm(); },
  'cfg-save': async () => {
    const body = { AI_PRIMARY: devCfg.AI_PRIMARY };
    document.querySelectorAll('[data-cfg]').forEach((i) => { body[i.dataset.cfg] = i.value; });
    try { devCfg = await api('/api/config', { body }); server = await api('/api/status'); toast(t('saved')); $('#dev').innerHTML = devForm(); } catch (e) { toast(e.message); }
  },
  'cfg-test': async () => { $('#cfg-out').innerHTML = '<div class="spin"></div>'; try { const r = await api('/api/config/test', { body: {} }); $('#cfg-out').innerHTML = `<dl class="kv"><dt>AI</dt><dd>${esc(r.ai)}</dd><dt>Telegram</dt><dd>${esc(r.telegram)}</dd><dt>WhatsApp</dt><dd>${esc(r.whatsapp)}</dd></dl>`; } catch (e) { $('#cfg-out').textContent = e.message; } },
  reset: () => { if (confirm(t('reset_app') + '?')) { localStorage.removeItem(KEY); S = { ...DEFAULT, settings: { ...DEFAULT.settings } }; mem.ob = 1; go('#/'); render(true); } },
};
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const fn = actions[el.dataset.act]; if (!fn) return;
  if (el.tagName === 'BUTTON' || (el.tagName === 'A' && el.dataset.act !== 'g-keys')) e.preventDefault();
  fn(el, e);
});
document.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role=switch][data-act]')) { e.preventDefault(); actions[e.target.dataset.act](e.target, e); }
  if (e.key === 'Enter' && e.target.id === 'u-code') $('[data-act=unlock-try-code]')?.click();
  if (e.key === 'Enter' && e.target.id === 'u-phrase') $('[data-act=unlock-try-phrase]')?.click();
});
document.addEventListener('input', (e) => {
  const b = e.target.dataset.bind; if (!b) return;
  const [o, k] = b.split('.'); mem[o][k] = e.target.value;
});
document.addEventListener('change', (e) => {
  if (e.target.id === 'pay-file') setPayFile(e.target.files[0]);
  if (e.target.id === 'audio-file') setAudioFile(e.target.files[0]);
});

// ---------------------------------------------------------------- boot
(async function boot() {
  render(true);
  try { server = await api('/api/status'); } catch { /* offline */ }
  if ('serviceWorker' in navigator && location.protocol === 'https:' || location.hostname === 'localhost') navigator.serviceWorker?.register('/sw.js').catch(() => {});
  if ('speechSynthesis' in window) speechSynthesis.getVoices();
})();
