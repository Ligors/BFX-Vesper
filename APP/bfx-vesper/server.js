// BFX VESPER — prototype server
import express from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { store, save, cfg, setConfig, publicConfig } from './lib/store.js';
import { ask, aiAvailable, systemPrompt, normaliseResult, LANG_NAMES, transcribe } from './lib/ai.js';
import { tg, sendAlert, parseWaWebhook } from './lib/channels.js';
import { analyzePayment } from './lib/payment.js';
import * as bot from './lib/debatebot.js';
import { analyzeText } from './public/js/engine.js';

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });
const ROOT = path.dirname(fileURLToPath(import.meta.url));
app.use(express.json({ limit: '15mb' }));
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-custom-key, x-custom-provider, x-setup-pin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});
app.use(express.static(path.join(ROOT, 'public'), { extensions: ['html'], setHeaders: (res, p) => { if (p.endsWith('sw.js')) res.setHeader('Cache-Control', 'no-cache'); } }));

const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => { console.error(req.path, e.message); res.status(500).json({ error: e.message }); });

// ---------- status & setup ----------
app.get('/api/status', (req, res) => {
  res.json({
    ai: aiAvailable(), primary: cfg('AI_PRIMARY'),
    telegram: !!cfg('TELEGRAM_BOT_TOKEN'),
    whatsapp: !!(cfg('WA_TOKEN') && cfg('WA_PHONE_NUMBER_ID')),
    webhook: '/webhook/whatsapp',
  });
});
const setupGuard = (req, res, next) => {
  const pin = process.env.SETUP_PIN;
  if (pin && req.get('x-setup-pin') !== pin) return res.status(401).json({ error: 'Setup PIN required' });
  next();
};
app.get('/api/config', setupGuard, (req, res) => res.json(publicConfig()));
app.post('/api/config', setupGuard, (req, res) => { setConfig(req.body); res.json(publicConfig()); });
app.post('/api/config/test', setupGuard, wrap(async (req, res) => {
  const out = {};
  try { const r = await ask({ system: 'Return ONLY JSON {"ok":true}', user: 'ping' }); out.ai = `OK via ${r.provider} (${r.model})`; } catch (e) { out.ai = 'Error: ' + e.message; }
  try { const me = await tg('getMe'); out.telegram = `OK: @${me.username}`; } catch (e) { out.telegram = 'Error: ' + e.message; }
  out.whatsapp = cfg('WA_TOKEN') && cfg('WA_PHONE_NUMBER_ID') ? 'Configured (send a WhatsApp message to your business number to test)' : 'Not configured';
  res.json(out);
}));

// ---------- text analysis (SMS / call transcript / chat) ----------
function mergeText(local, ai) {
  if (!ai) return { score: local.score, verdict: local.verdict };
  const score = Math.round(ai.score * 0.65 + local.score * 0.35);
  return { score, verdict: score >= 70 ? 'SCAM' : score >= 40 ? 'SUSPICIOUS' : 'LOOKS_SAFE' };
}
async function analyzeFull({ text = '', sender = '', lang = 'en', mode = 'sms', customKey = '', customProvider = '' }) {
  const local = analyzeText(text, { sender, mode });
  let ai = null, aiError = null;
  try {
    const what = mode === 'call' ? 'live phone-call transcript (speech-to-text, may have errors) of what the CALLER said to an elderly person' : mode === 'chat' ? 'WhatsApp/chat message' : 'SMS';
    const r = await ask({
      system: systemPrompt(lang),
      user: `Check this ${what}.${sender ? `\nSender / header: ${sender}` : ''}\nOn-device rule engine already found: ${local.signals.map((s) => s.code).join(', ') || 'nothing'} (score ${local.score}).\n---\n${text.slice(0, 4000)}\n---`,
      customKey, customProvider,
    });
    ai = { ...normaliseResult(r.data), provider: r.provider, model: r.model };
  } catch (e) { aiError = e.noKeys ? 'NO_KEYS' : e.message; }
  return { ...mergeText(local, ai), local, ai, aiError };
}
app.post('/api/analyze/text', wrap(async (req, res) => {
  const { text = '' } = req.body || {};
  if (!text.trim()) return res.status(400).json({ error: 'text required' });
  const customKey = req.get('x-custom-key') || req.body.customKey || '';
  const customProvider = req.get('x-custom-provider') || req.body.customProvider || '';
  res.json(await analyzeFull({ ...req.body, customKey, customProvider }));
}));

// ---------- call recording / voice note ----------
const audioUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 24 * 1024 * 1024 } });
app.post('/api/analyze/recording', audioUpload.single('audio'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'audio required' });
  const lang = req.body.lang || 'en';
  let tr;
  try { tr = await transcribe({ buffer: req.file.buffer, mime: req.file.mimetype, lang, filename: req.file.originalname || 'audio' }); }
  catch (e) { return res.status(e.noKeys ? 400 : 502).json({ error: e.noKeys ? 'NO_KEYS' : e.message }); }
  if (/^\[no speech\]$/i.test(tr.text)) return res.status(422).json({ error: 'NO_SPEECH' });
  const out = await analyzeFull({ text: tr.text, lang, mode: 'call' });
  res.json({ ...out, transcript: tr.text, transcriber: { provider: tr.provider, model: tr.model } });
}));

// ---------- payment screenshot ----------
app.post('/api/analyze/payment', upload.single('image'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'image required' });
  const customKey = req.get('x-custom-key') || req.body.customKey || '';
  const customProvider = req.get('x-custom-provider') || req.body.customProvider || '';
  const out = await analyzePayment({
    buffer: req.file.buffer, mime: req.file.mimetype || 'image/png', lang: req.body.lang || 'en',
    expectedAmount: req.body.expected || '', customKey, customProvider,
  });
  res.json(out);
}));

// Android share-target (screenshot shared from Gallery / WhatsApp straight into Vesper)
const shared = new Map();
app.post('/share-image', upload.any(), (req, res) => {
  const f = (req.files || [])[0];
  if (!f) {
    const text = [req.body?.title, req.body?.text, req.body?.url].filter(Boolean).join(' ').trim();
    return res.redirect(303, text ? `/#/sms?text=${encodeURIComponent(text)}` : '/#/');
  }
  const id = crypto.randomBytes(6).toString('hex');
  shared.set(id, { buf: f.buffer, mime: f.mimetype, at: Date.now() });
  setTimeout(() => shared.delete(id), 10 * 60 * 1000);
  res.redirect(303, `/#/payment?shared=${id}`);
});
app.get('/api/shared/:id', (req, res) => {
  const s = shared.get(req.params.id);
  if (!s) return res.status(404).end();
  res.type(s.mime).send(s.buf);
});

// ---------- guardian: Telegram link + alerts ----------
app.post('/api/telegram/link/start', wrap(async (req, res) => {
  const me = await tg('getMe');
  const code = 'V' + crypto.randomInt(100000, 999999);
  store.links[code] = { created: Date.now() };
  save();
  res.json({ code, bot: me.username, url: `https://t.me/${me.username}?start=${code}` });
}));
app.get('/api/telegram/link/check', wrap(async (req, res) => {
  const code = String(req.query.code || '');
  const link = store.links[code];
  if (!link) return res.status(404).json({ error: 'unknown code' });
  if (link.chatId) return res.json({ linked: true, ...link });
  const updates = await tg('getUpdates', { timeout: 0, allowed_updates: ['message'] });
  for (const u of updates) {
    const m = u.message;
    if (m?.text && m.text.includes(code)) {
      Object.assign(link, { chatId: m.chat.id, name: [m.from?.first_name, m.from?.last_name].filter(Boolean).join(' '), username: m.from?.username || '' });
      save();
      await tg('sendMessage', { chat_id: m.chat.id, text: `✅ You are now the guardian on BFX VESPER. You will get an alert here if a scam is stopped on their phone.` }).catch(() => {});
      await tg('getUpdates', { offset: u.update_id + 1, timeout: 0 }).catch(() => {});
      return res.json({ linked: true, ...link });
    }
  }
  res.json({ linked: false });
}));
app.post('/api/alert', wrap(async (req, res) => {
  const a = req.body || {};
  const entry = { ...a, at: Date.now() };
  try {
    const r = await sendAlert(a);
    entry.sent = true; entry.address = r.address;
    store.alerts.unshift(entry); store.alerts.length = Math.min(store.alerts.length, 100); save();
    res.json({ ok: true, address: r.address });
  } catch (e) {
    entry.sent = false; entry.error = e.message;
    store.alerts.unshift(entry); save();
    res.status(502).json({ ok: false, error: e.message });
  }
}));

// ---------- Vesper Bait Bot (WhatsApp) ----------
app.get('/webhook/whatsapp', (req, res) => {
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === cfg('WA_VERIFY_TOKEN')) return res.send(req.query['hub.challenge']);
  res.sendStatus(403);
});
app.post('/webhook/whatsapp', (req, res) => {
  res.sendStatus(200);
  for (const m of parseWaWebhook(req.body)) bot.handleIncoming({ ...m, source: 'whatsapp' }).catch((e) => console.error('wa', e.message));
});
const chatView = (c) => { const w = bot.wasteInfo(c); return { ...c, wastedMs: w.ms, wastedLive: w.live, replying: undefined }; };
app.get('/api/debatebot/chats', (req, res) => res.json(bot.listChats().map(chatView)));
app.post('/api/debatebot/chats/:id/decision', (req, res) => { try { res.json(chatView(bot.decide(req.params.id, !!req.body.allow))); } catch (e) { res.status(404).json({ error: e.message }); } });
app.delete('/api/debatebot/chats/:id', (req, res) => { bot.removeChat(req.params.id); res.json({ ok: true }); });
app.post('/api/debatebot/test-message', wrap(async (req, res) => {
  const { from = '+91 90000 00000', name = 'Test number', text = '' } = req.body || {};
  if (!text.trim()) return res.status(400).json({ error: 'text required' });
  res.json(chatView(await bot.handleIncoming({ from: 'test:' + from, name, text, source: 'test' })));
}));
// Safe sample conversation for demos: a scripted "scammer" talks to the bot. Nothing is sent to WhatsApp.
app.post('/api/debatebot/sample', wrap(async (req, res) => {
  res.json(chatView(await bot.startSample()));
}));

// ---------- ScamTricks (training) ----------
app.post('/api/scamtricks/generate', wrap(async (req, res) => {
  const lang = req.body?.lang || 'en';
  const r = await ask({
    system: `You create short training quizzes that teach Indian senior citizens to spot scams. Write all human-readable text in ${LANG_NAMES[lang] || 'English'} (sender headers and links stay in English letters).`,
    user: `Create 6 realistic practice messages (mix: 4 scams, 2 genuine) as seen on an Indian phone in 2026: SMS with DLT headers (e.g. "VM-HDFCBK-T", "JD-TRAIND-G", or a +91 mobile number for fakes), WhatsApp messages, payment requests, call scripts. Include ideas like: -P/-S/-T/-G header suffixes, OTP never to be shared, UPI PIN never needed to receive money, fake KYC links, digital arrest, courier drugs, electricity cut, job tasks.
For each item also ask "What would you do?" with exactly 3 short action choices (max 10 words each) — one correct, safe action and two risky ones (for genuine messages, the correct choice is the sensible normal action). Vary the position of the correct choice.
Return ONLY JSON: {"items":[{"channel":"SMS"|"WhatsApp"|"Call","sender":"","text":"","isScam":true,"choices":["","",""],"ok":<index 0-2 of the correct choice>,"explanation":"<2 short sentences why>","clue":"<the single biggest clue, max 8 words>"}]}`,
    temperature: 0.8,
  });
  const items = (r.data.items || []).filter((i) => i.text && Array.isArray(i.choices) && i.choices.length === 3 && [0, 1, 2].includes(+i.ok)).map((i) => ({ ...i, ok: +i.ok })).slice(0, 8);
  res.json({ items, provider: r.provider });
}));

// ---------- Local AI Model direct fetch & proxy ----------
app.get('/api/model/fetch', async (req, res) => {
  const modelUrl = req.query.url || 'https://huggingface.co/ggml-org/gemma-3-1b-it-GGUF/resolve/main/gemma-3-1b-it-Q4_K_M.gguf?download=true';
  try {
    const upstream = await fetch(modelUrl, {
      headers: { 'User-Agent': 'BFX-Vesper-Local-Model/1.0' },
      redirect: 'follow'
    });
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `Upstream error ${upstream.status}` });
    }
    const totalBytes = upstream.headers.get('content-length') || 806058240;
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/octet-stream');
    res.setHeader('Content-Length', totalBytes);
    res.setHeader('Content-Disposition', 'attachment; filename="gemma-3-1b-it-Q4_K_M.gguf"');

    const reader = upstream.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();
  } catch (err) {
    console.error('Model fetch streaming error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

const PORT = +process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`BFX VESPER running on http://0.0.0.0:${PORT}`));
