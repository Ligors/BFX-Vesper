// Cloud AI layer: Gemini + Groq with automatic fallback between them.
import { cfg } from './store.js';

export const LANG_NAMES = { en: 'English', hi: 'Hindi', ta: 'Tamil', te: 'Telugu', kn: 'Kannada', ml: 'Malayalam', mr: 'Marathi', bn: 'Bengali', gu: 'Gujarati', pa: 'Punjabi', or: 'Odia' };

export function aiAvailable() {
  return { gemini: !!cfg('GEMINI_API_KEY'), groq: !!cfg('GROQ_API_KEY') };
}

function extractJson(s) {
  if (!s) throw new Error('empty AI response');
  s = s.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1];
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) s = s.slice(a, b + 1);
  return JSON.parse(s);
}

async function withTimeout(promise, ms = 45000) {
  let to;
  const timeout = new Promise((_, rej) => { to = setTimeout(() => rej(new Error('AI timeout')), ms); });
  try { return await Promise.race([promise, timeout]); } finally { clearTimeout(to); }
}

async function gemini({ system, user, image, json = true, temperature = 0.2, customKey }) {
  const key = customKey || cfg('GEMINI_API_KEY');
  if (!key) throw new Error('Gemini key not set');
  const parts = [{ text: user }];
  if (image) parts.push({ inline_data: { mime_type: image.mime, data: image.b64 } });
  const body = {
    contents: [{ role: 'user', parts }],
    systemInstruction: system ? { parts: [{ text: system }] } : undefined,
    generationConfig: { temperature, ...(json ? { responseMimeType: 'application/json' } : {}) },
  };
  const models = [cfg('GEMINI_MODEL'), 'gemini-2.0-flash', 'gemini-flash-latest'].filter((v, i, a) => v && a.indexOf(v) === i);
  let lastErr;
  for (const model of models) {
    const r = await withTimeout(fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body),
    }));
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { lastErr = new Error(`Gemini ${model}: ${j.error?.message || r.status}`); if (r.status === 404) continue; throw lastErr; }
    const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
    return { text, model };
  }
  throw lastErr;
}

async function groq({ system, user, image, json = true, temperature = 0.2, customKey }) {
  const key = customKey || cfg('GROQ_API_KEY');
  if (!key) throw new Error('Groq key not set');
  const model = image ? cfg('GROQ_VISION_MODEL') : cfg('GROQ_TEXT_MODEL');
  const content = image ? [{ type: 'text', text: user }, { type: 'image_url', image_url: { url: `data:${image.mime};base64,${image.b64}` } }] : user;
  const base = { model, temperature, messages: [...(system ? [{ role: 'system', content: system }] : []), { role: 'user', content }] };
  const attempts = [
    { ...base, ...(json ? { response_format: { type: 'json_object' } } : {}), ...(/qwen/i.test(model) ? { reasoning_format: 'hidden' } : {}) },
    base,
  ];
  let lastErr;
  for (const body of attempts) {
    const r = await withTimeout(fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` }, body: JSON.stringify(body),
    }));
    const j = await r.json().catch(() => ({}));
    if (r.ok) return { text: j.choices?.[0]?.message?.content || '', model };
    lastErr = new Error(`Groq ${model}: ${j.error?.message || r.status}`);
    if (r.status !== 400) break;
  }
  throw lastErr;
}

// Speech-to-text for uploaded call recordings / voice notes.
// Groq Whisper large-v3 first (dedicated speech model), then Gemini audio understanding.
const WHISPER_LANGS = new Set(['en', 'hi', 'ta', 'te', 'kn', 'ml', 'mr', 'bn', 'gu', 'pa']);
export async function transcribe({ buffer, mime, lang = 'en', filename = 'audio' }) {
  const avail = aiAvailable();
  const errors = [];
  if (avail.groq) {
    try {
      const fd = new FormData();
      fd.append('file', new Blob([buffer], { type: mime || 'audio/mpeg' }), filename);
      fd.append('model', cfg('GROQ_STT_MODEL') || 'whisper-large-v3');
      fd.append('response_format', 'json');
      fd.append('temperature', '0');
      if (WHISPER_LANGS.has(lang)) fd.append('language', lang);
      const r = await withTimeout(fetch('https://api.groq.com/openai/v1/audio/transcriptions', { method: 'POST', headers: { authorization: `Bearer ${cfg('GROQ_API_KEY')}` }, body: fd }), 90000);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(`Groq Whisper: ${j.error?.message || r.status}`);
      if (j.text?.trim()) return { text: j.text.trim(), provider: 'groq', model: cfg('GROQ_STT_MODEL') || 'whisper-large-v3' };
      throw new Error('Groq Whisper: empty transcript');
    } catch (e) { errors.push(e.message); }
  }
  if (avail.gemini) {
    try {
      const { text, model } = await gemini({
        system: 'You are a precise transcriber of Indian phone calls.',
        user: `Transcribe this audio recording word for word in the original language and script (it may be ${LANG_NAMES[lang] || 'English'}, English or a mix). Output ONLY the transcript text, no notes. If there is no speech, output: [no speech]`,
        image: { mime: mime || 'audio/mpeg', b64: buffer.toString('base64') }, json: false, temperature: 0,
      });
      if (text.trim()) return { text: text.trim(), provider: 'gemini', model };
      throw new Error('Gemini: empty transcript');
    } catch (e) { errors.push(e.message); }
  }
  const err = new Error(errors.length ? errors.join(' | ') : 'No AI key configured');
  err.noKeys = !errors.length;
  throw err;
}

// Try the primary provider, then the other one.
export async function ask(opts) {
  const avail = aiAvailable();
  if (opts.customKey && opts.customProvider) {
    avail[opts.customProvider] = true;
  }
  const order = opts.customProvider
    ? [opts.customProvider, opts.customProvider === 'groq' ? 'gemini' : 'groq']
    : (cfg('AI_PRIMARY') === 'groq' ? ['groq', 'gemini'] : ['gemini', 'groq']);
  const errors = [];
  for (const p of order) {
    if (!avail[p]) continue;
    try {
      const { text, model } = p === 'gemini' ? await gemini(opts) : await groq(opts);
      return { data: opts.json === false ? text : extractJson(text), provider: p, model };
    } catch (e) { errors.push(e.message); }
  }
  const err = new Error(errors.length ? errors.join(' | ') : 'No AI key configured');
  err.noKeys = !errors.length;
  throw err;
}

const RESULT_SHAPE = `Return ONLY JSON with this exact shape:
{
 "score": <integer 0-100, how likely this is a scam>,
 "verdict": "SCAM" | "SUSPICIOUS" | "LOOKS_SAFE",
 "scam_type": "<short name of the scam pattern, or 'none'>",
 "summary": "<one short, calm sentence for an elderly person>",
 "scam_reasons": [{"point": "<why it looks like a scam>", "weight": <integer points>}],
 "safe_reasons": [{"point": "<why it does NOT look fully like a scam / what looks genuine>", "weight": <integer points>}],
 "unknowns": ["<what you could not check or do not know, which keeps the score from being 0 or 100>"],
 "advice": ["<short action step>"]
}
Rules: the weights in scam_reasons must add up to roughly "score"; the weights in safe_reasons + unknowns must explain the remaining (100 - score).
Use very simple words, short sentences, no jargon. Never invent facts you cannot see.`;

export function systemPrompt(lang) {
  return `You are the scam-check engine of BFX VESPER, a safety app for senior citizens in India.
You know Indian fraud patterns well: fake KYC/account-block SMS, "digital arrest" calls by fake police/CBI/customs, FedEx/courier drug parcel calls, electricity disconnection SMS, UPI collect-request and "scan QR to receive money" tricks, fake payment screenshots from modded PhonePe/GPay/Paytm apps, part-time job / task scams, lottery/KBC scams, AnyDesk/screen-share scams, OTP theft, fake customer care numbers, sextortion, investment doubling.
India facts: DLT SMS headers look like "AD-HDFCBK-T"; since May 2025 TRAI requires suffix -P (promotional), -S (service), -T (transactional), -G (government). Banks and police never ask for OTP, PIN, or money over calls. You never need to enter UPI PIN or scan a QR to RECEIVE money. Cyber-crime helpline is 1930, website cybercrime.gov.in, report spam on Sanchar Saathi (Chakshu).
Write every human-readable string in ${LANG_NAMES[lang] || 'English'}.
${RESULT_SHAPE}`;
}

export function normaliseResult(d) {
  const n = (x) => Math.max(0, Math.min(100, Math.round(Number(x) || 0)));
  const list = (a) => (Array.isArray(a) ? a : []).map((r) => (typeof r === 'string' ? { point: r, weight: 0 } : { point: String(r.point || r.reason || ''), weight: n(r.weight) })).filter((r) => r.point);
  const score = n(d.score);
  return {
    score,
    verdict: ['SCAM', 'SUSPICIOUS', 'LOOKS_SAFE'].includes(d.verdict) ? d.verdict : score >= 70 ? 'SCAM' : score >= 40 ? 'SUSPICIOUS' : 'LOOKS_SAFE',
    scam_type: String(d.scam_type || ''),
    summary: String(d.summary || ''),
    scam_reasons: list(d.scam_reasons),
    safe_reasons: list(d.safe_reasons),
    unknowns: (Array.isArray(d.unknowns) ? d.unknowns : []).map(String).filter(Boolean),
    advice: (Array.isArray(d.advice) ? d.advice : []).map(String).filter(Boolean),
  };
}
