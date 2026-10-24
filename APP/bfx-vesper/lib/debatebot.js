// Vesper Bait Bot — wastes scammers' time on WhatsApp by pretending to be a confused elder.
import { store, save, cfg } from './store.js';
import { ask } from './ai.js';
import { waSend } from './channels.js';
import { analyzeText } from '../public/js/engine.js';

const PERSONA = `You are "Kamala Paati", a sweet, slow, 74-year-old retired school teacher in India who is chatting on WhatsApp.
SECRET GOAL: you are actually an anti-scam bot. The other person is very likely a scammer. Waste as much of their time as possible while sounding real.
Tactics: misunderstand instructions, ask them to repeat, mention your spectacles / slow phone / grandson who "knows these things", go off-topic about your garden, temple, BP tablets, ask for their full name and "employee ID", say the app is "loading", send wrong things like "is it this 6 digit number on my TV remote?", promise to do it "after my tea", ask which button is green.
HARD RULES: never share any real OTP, PIN, CVV, card, bank, Aadhaar or address details; if pushed, give obviously useless answers (e.g. "the code says ABCD... wait it disappeared"). Never send money, never click links, never install apps, never threaten or abuse, never use sexual content, never reveal you are a bot or AI.
Reply in the SAME language and script the other person uses (English, Hinglish, Hindi, Tamil, Tanglish, etc). Keep each reply short: 1–2 sentences, like a real WhatsApp message, occasional typos are fine. Output ONLY the message text.`;

const STALLS = [
  'Sorry beta, who is this? My grandson changed my phone settings, I cannot see the name.',
  'One minute, I am searching my spectacles… they were here only.',
  'Which app you said? The blue one or the green one? I have both.',
  'It is showing some loading circle. Should I wait or press the round button?',
  'My BP tablet time now. I will check after 10 minutes ok?',
  'Beta, what is your full name and employee ID? My son told me to always ask.',
  'I pressed something and now the screen is showing my photos from Tirupati trip 😅',
  'Message is very small, can you send again slowly?',
  'Is it the same as the number on my gas cylinder book?',
  'Wait, someone is at the door, milk man came. Don\'t go anywhere.',
  'I wrote the number on paper but the paper fell behind the TV. Tell once more?',
  'My phone says battery 3%. Let me find the charger… it is in the kitchen.',
  'You are speaking like my nephew in Chennai. Are you also from Chennai?',
  'Ok ok I am doing. Which button means "yes"? There are three.',
];

// SAFETY: the bot must never share personal information. Every reply passes this filter
// before it is stored or sent — numbers (OTP, PIN, phone, account, Aadhaar, card), e-mails,
// UPI IDs and links are removed, whatever the AI wrote.
const PII = [
  [/\b[\w.+-]+@[\w-]+(\.[\w-]+)+\b/g, '[email removed]'],
  [/\b[\w.-]{2,}@[a-z]{2,}\b/gi, '[UPI ID removed]'],
  [/\b(?:https?:\/\/|www\.)\S+/gi, '[link removed]'],
  [/\+?\d(?:[\s-]?\d){3,}/g, '[number removed]'],
];
export function sanitizeReply(text) {
  let out = String(text || ''), filtered = false;
  for (const [re, rep] of PII) out = out.replace(re, () => { filtered = true; return rep; });
  return { text: out, filtered };
}

const SAMPLE_SCRIPT = [
  'Hello madam, I am calling from SBI head office. Your KYC is expired and account will be blocked today.',
  'Madam please cooperate, it is urgent. I am sending you a 6 digit OTP now. Tell me the OTP quickly.',
  'Why so slow madam? Just read the number on your screen. Your pension will stop otherwise.',
  'OK forget OTP. Download AnyDesk app from Play Store and tell me the code, I will fix it myself.',
  'Madam I am losing patience. Send Rs 10 to this UPI ID to verify your account: verify.sbi@ybl',
  'Hello?? Are you there madam? Reply fast!',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => Date.now();

export function listChats() {
  return Object.values(store.chats).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

async function classify(chat) {
  const text = chat.messages.filter((m) => m.from === 'them').map((m) => m.text).join('\n');
  const local = analyzeText(text, { mode: 'sms' });
  let score = local.score, why = local.signals.slice(0, 4).map((s) => s.code);
  try {
    const r = await ask({
      system: 'You classify WhatsApp messages received by an elderly person in India. Return ONLY JSON {"score":0-100,"why":"<max 15 words, English>"}',
      user: `Messages from unknown number:\n${text.slice(-1500)}`,
    });
    score = Math.round(Number(r.data.score) * 0.65 + local.score * 0.35);
    why = [r.data.why, ...why];
  } catch { /* offline: local only */ }
  return { score, why };
}

async function generateReply(chat) {
  const history = chat.messages.slice(-16).map((m) => `${m.from === 'them' ? 'THEM' : 'YOU'}: ${m.text}`).join('\n');
  try {
    const r = await ask({ system: PERSONA, user: `Conversation so far:\n${history}\n\nWrite YOUR next reply only.`, json: false, temperature: 0.9 });
    const text = String(r.data).replace(/<think>[\s\S]*?<\/think>/g, '').replace(/^(YOU|Kamala Paati)\s*:\s*/i, '').trim().slice(0, 500);
    if (text) return { text, by: r.provider };
  } catch { /* fall through */ }
  const used = new Set(chat.messages.filter((m) => m.from === 'bot').map((m) => m.text));
  const pick = STALLS.find((s) => !used.has(s)) || STALLS[Math.floor(Math.random() * STALLS.length)];
  return { text: pick, by: 'offline' };
}

async function scheduleReply(chat) {
  if (chat.replying) return;
  chat.replying = true;
  try {
    const min = +cfg('DEBATEBOT_DELAY_MIN') || 4, max = Math.max(min, +cfg('DEBATEBOT_DELAY_MAX') || 12);
    chat.typing = true; save();
    await sleep((min + Math.random() * (max - min)) * 1000);
    const gen = await generateReply(chat);
    const { text, filtered } = sanitizeReply(gen.text);
    const by = gen.by;
    let sendError = null;
    if (chat.source === 'whatsapp') { try { await waSend(chat.id, text); } catch (e) { sendError = e.message; } }
    chat.messages.push({ from: 'bot', text, ts: now(), by, sendError, ...(filtered ? { filtered: true } : {}) });
    chat.typing = false;
    chat.updatedAt = now();
    save();
  } finally { chat.replying = false; }
}

export async function handleIncoming({ from, name, text, source = 'whatsapp' }) {
  const id = String(from);
  const chat = (store.chats[id] ||= { id, name: name || '', number: id, source, status: 'new', score: 0, messages: [], startedAt: now() });
  if (name) chat.name = name;
  chat.messages.push({ from: 'them', text, ts: now() });
  chat.updatedAt = now();
  save();
  if (chat.status === 'allowed') { scheduleReply(chat); return chat; }
  if (chat.status === 'declined') return chat;
  const c = await classify(chat);
  chat.score = c.score; chat.why = c.why;
  chat.status = c.score >= 55 ? 'flagged' : 'clean';
  save();
  return chat;
}

export function decide(id, allow) {
  const chat = store.chats[id];
  if (!chat) throw new Error('chat not found');
  chat.status = allow ? 'allowed' : 'declined';
  chat.decidedAt = now();
  save();
  if (allow && chat.messages.at(-1)?.from === 'them') scheduleReply(chat);
  return chat;
}

// Scripted demo: a pretend scammer talks to the bot. Source 'sample' — nothing goes to WhatsApp.
export async function startSample() {
  const id = 'test:Sample scammer';
  delete store.chats[id];
  const chat = await handleIncoming({ from: id, name: 'Sample scammer (simulation)', text: SAMPLE_SCRIPT[0], source: 'sample' });
  if (chat.status !== 'allowed') decide(id, true);
  (async () => {
    for (const line of SAMPLE_SCRIPT.slice(1)) {
      const t0 = now();
      while (now() - t0 < 60000) {            // wait for the bot's reply
        await sleep(1000);
        const c = store.chats[id];
        if (!c || c.status !== 'allowed') return;
        if (c.messages.at(-1)?.from === 'bot') break;
      }
      await sleep(3500 + Math.random() * 3000);
      if (!store.chats[id]) return;
      await handleIncoming({ from: id, text: line, source: 'sample' });
    }
  })();
  return store.chats[id];
}

export function removeChat(id) { delete store.chats[id]; save(); }

// Time the scammer has been kept busy: from Bait Bot's first reply until their last
// message — still counting live while they were active in the last 5 minutes.
const LIVE_WINDOW = 5 * 60 * 1000;
export function wasteInfo(chat, now = Date.now()) {
  const firstBot = chat.messages.find((m) => m.from === 'bot');
  if (chat.status !== 'allowed' || !firstBot) return { ms: 0, live: false };
  const lastThem = chat.messages.filter((m) => m.from === 'them').at(-1);
  const lastActivity = Math.max(lastThem?.ts || 0, chat.messages.at(-1).ts);
  const live = now - lastActivity < LIVE_WINDOW;
  const end = live ? now : lastActivity;
  return { ms: Math.max(0, end - firstBot.ts), live };
}
export function timeWasted(chat) { return wasteInfo(chat).ms; }
