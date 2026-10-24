// Telegram (guardian alerts) + WhatsApp Cloud API (Vesper Bait Bot) + reverse geocoding
import { cfg } from './store.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function tg(method, payload) {
  let token = (cfg('TELEGRAM_BOT_TOKEN') || '').trim();
  if (token.includes('\n') || token.includes(' ')) {
    token = token.replace(/[\r\n\s]+/g, ':');
  }
  if (!token) throw new Error('Telegram bot token not set');
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload || {}),
  });
  const j = await r.json();
  if (!j.ok) throw new Error('Telegram: ' + (j.description || r.status));
  return j.result;
}

export async function reverseGeocode(lat, lon) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16&lat=${lat}&lon=${lon}`, {
      headers: { 'user-agent': 'BFX-Vesper-Prototype/1.0 (scam-safety demo)' }, signal: AbortSignal.timeout(6000),
    });
    const j = await r.json();
    return j.display_name || '';
  } catch { return ''; }
}

export function formatAlert(a) {
  const when = new Date(a.time || Date.now()).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
  const titles = {
    call: '🚨 <b>BFX VESPER · Vesper Call Guard stopped a scam call</b>',
    nokia: '🚨 <b>BFX VESPER · Nokia Feature Phone Scam Alert</b>',
    unlock_fail: '⚠️ <b>BFX VESPER: Wrong unlock attempts</b>',
    unlocked: '✅ <b>BFX VESPER: Phone unlocked by guardian</b>',
    test: '🔔 <b>BFX VESPER: Test alert</b>',
    sms: '🚨 <b>BFX VESPER: Dangerous message found</b>',
    payment: '🚨 <b>BFX VESPER: Fake payment screenshot</b>',
    sos: '🆘 <b>BFX VESPER: Help requested</b>',
  };
  const L = [...(a.demo ? ['🧪 <b>DEMO / SIMULATION — not a real incident</b>'] : []), titles[a.type] || titles.call, ''];
  if (a.user?.name) L.push(`👤 <b>Protected User:</b> ${esc(a.user.name)}${a.user.phone ? ' (' + esc(a.user.phone) + ')' : ''}`);
  L.push(`🕒 <b>Time:</b> ${esc(when)} IST`);
  if (a.location?.lat) {
    L.push(`📍 <b>Location:</b> ${a.address ? esc(a.address) + ' ' : ''}<a href="https://maps.google.com/?q=${a.location.lat},${a.location.lon}">open map</a> (±${Math.round(a.location.acc || 0)} m)`);
  } else L.push('📍 <b>Location:</b> not shared / not available');
  if (a.score != null) L.push(`📊 <b>Scam risk:</b> ${a.score}/100${a.scamType ? ' · ' + esc(a.scamType) : ''}`);
  if (a.reasons?.length) L.push('', '<b>Why it was flagged:</b>', ...a.reasons.slice(0, 6).map((r) => '• ' + esc(r)));
  if (a.transcript) L.push('', '<b>Spoken Transcript:</b>', `<i>“${esc(a.transcript.slice(-700))}”</i>`);
  if (a.blocked?.length) L.push('', `🔒 <b>Locked apps:</b> ${esc(a.blocked.join(', '))}`);
  if (a.device) L.push(`📱 <b>Device:</b> ${esc(a.device)}`);
  L.push('', '🚨 <b>GUARDIAN ACTION REQUIRED:</b>');
  L.push('👉 <b>Please call them immediately and confirm NOT to share any OTP or transfer money!</b>');
  if (a.note) L.push('', esc(a.note));
  return L.join('\n');
}

export async function sendAlert(a) {
  const chatId = a.chatId || cfg('TELEGRAM_CHAT_ID') || process.env.TELEGRAM_CHAT_ID;
  if (!chatId) throw new Error('Guardian Telegram is not linked');
  a.chatId = chatId;
  if (a.location?.lat && !a.address) a.address = await reverseGeocode(a.location.lat, a.location.lon);
  const msg = await tg('sendMessage', { chat_id: a.chatId, text: formatAlert(a), parse_mode: 'HTML', disable_web_page_preview: true });
  if (a.location?.lat && a.type === 'call') {
    await tg('sendLocation', { chat_id: a.chatId, latitude: a.location.lat, longitude: a.location.lon, horizontal_accuracy: Math.min(1500, a.location.acc || 50) }).catch(() => {});
  }
  return { messageId: msg.message_id, address: a.address || '' };
}

// ---------- WhatsApp Cloud API ----------
export async function waSend(to, text) {
  const token = cfg('WA_TOKEN'), pid = cfg('WA_PHONE_NUMBER_ID');
  if (!token || !pid) throw new Error('WhatsApp not configured');
  const r = await fetch(`https://graph.facebook.com/${cfg('WA_GRAPH_VERSION')}/${pid}/messages`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'text', text: { body: text } }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error('WhatsApp: ' + (j.error?.message || r.status));
  return j;
}

export function parseWaWebhook(body) {
  const out = [];
  for (const e of body?.entry || []) for (const c of e.changes || []) {
    const v = c.value || {};
    const names = Object.fromEntries((v.contacts || []).map((x) => [x.wa_id, x.profile?.name]));
    for (const m of v.messages || []) {
      const text = m.text?.body || m.button?.text || m.interactive?.button_reply?.title || (m.type !== 'text' ? `[${m.type}]` : '');
      out.push({ from: m.from, name: names[m.from] || '', text, id: m.id });
    }
  }
  return out;
}
