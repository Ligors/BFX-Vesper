// Tiny JSON-file store + config loader (.env -> process.env -> data/config)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.join(ROOT, 'data');
const FILE = path.join(DATA_DIR, 'store.json');

// minimal .env loader (no dependency)
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}

export const CONFIG_KEYS = {
  GROQ_API_KEY: { secret: true, def: '' },
  GEMINI_API_KEY: { secret: true },
  AI_PRIMARY: { def: 'groq' },
  GEMINI_MODEL: { def: 'gemini-2.0-flash' },
  GROQ_TEXT_MODEL: { def: 'openai/gpt-oss-120b' },
  GROQ_VISION_MODEL: { def: 'qwen/qwen3.8-27b' },
  TELEGRAM_BOT_TOKEN: { secret: true },
  WA_TOKEN: { secret: true },
  WA_PHONE_NUMBER_ID: {},
  WA_VERIFY_TOKEN: { def: 'vesper-verify' },
  WA_GRAPH_VERSION: { def: 'v23.0' },
  DEBATEBOT_DELAY_MIN: { def: '4' },
  DEBATEBOT_DELAY_MAX: { def: '12' },
};

let db = { config: {}, chats: {}, links: {}, alerts: [] };
try { if (fs.existsSync(FILE)) db = { ...db, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) }; } catch (e) { console.warn('store reset', e.message); }

let t = null;
export function save() {
  clearTimeout(t);
  t = setTimeout(() => {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
  }, 150);
}
export const store = db;

export function cfg(key) {
  return db.config[key] || process.env[key] || CONFIG_KEYS[key]?.def || '';
}
export function setConfig(obj) {
  for (const [k, v] of Object.entries(obj || {})) {
    if (!(k in CONFIG_KEYS)) continue;
    if (v === null || v === '') delete db.config[k];
    else if (typeof v === 'string' && !/^•+$/.test(v)) db.config[k] = v.trim();
  }
  save();
}
export function publicConfig() {
  const out = {};
  for (const [k, meta] of Object.entries(CONFIG_KEYS)) {
    const v = cfg(k);
    out[k] = meta.secret ? (v ? '••••' + v.slice(-4) : '') : v;
  }
  return out;
}
