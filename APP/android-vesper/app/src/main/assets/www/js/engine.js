// BFX VESPER — On-device scam engine
// Runs fully offline in the browser (and is reused by the server as a fallback).
// Each rule adds weight; weights are converted to a 0-100 risk score with a
// saturating curve so many weak signals never look like one certain signal.

const W = (s) => new RegExp(s, 'iu');

// Keyword groups cover English, Romanised Hindi/Tamil ("Hinglish"/"Tanglish")
// and native-script words for the 10 Indian languages the app supports.
export const RULES = [
  { code: 'OTP_REQUEST', weight: 48, re: W(String.raw`\b(share|tell|send|give|read|forward|say|reply|provide|enter|submit|confirm|verify|respond|type)\b\W+(\w+\W+){0,6}(otp|one.?time.?pass|pin|cvv|verification\s*code|auth\s*code|code)|(otp|pin|cvv|code)\W+(\w+\W+){0,5}(share|tell|send|reply|provide|give|enter|submit|confirm|verify|batao|bataiye|sollunga|cheppandi|heli|parayoo|bolo)|reply\s*(?:with)?\s*(?:the)?\s*(?:\d+[\s-]*(?:digit|letter))?\s*otp|verify\s*(?:your)?\s*identity.{0,30}otp|ओटीपी\s*(बताइए|बताओ|भेजो|बता|सांगा)|OTP\s*(बताइए|बताओ|सांगा|சொல்லுங்க|சொல்லுங்கள்|చెప్పండి|ಹೇಳಿ|പറയൂ|বলুন|કહો|ਦੱਸੋ|କୁହନ୍ତୁ)`) },
  { code: 'REMOTE_APP', weight: 42, re: W(String.raw`any\s?desk|team\s?viewer|quick\s?support|rust\s?desk|airdroid|screen\s?shar|share (your )?screen|install (this|the) app|download (this|the) app`) },
  { code: 'DIGITAL_ARREST', weight: 48, re: W(String.raw`digital\s?arrest|video call (with|from) (police|cbi|officer)|arrest warrant|under arrest|डिजिटल अरेस्ट|டிஜிட்டல் அரெஸ்ட்|డిజిటల్ అరెస్ట్`) },
  { code: 'AUTHORITY', weight: 26, re: W(String.raw`\b(police|cbi|ed officer|enforcement directorate|customs|narcotics|ncb|rbi|trai|income.?tax|cyber.?(cell|crime)|court|judge|crime branch|mumbai police|delhi police|security team|fraud (prevention|department))\b|पुलिस|सीबीआई|कस्टम|காவல்|போலீஸ்|సీబీఐ|పోలీస్|ಪೊಲೀಸ್|പോലീസ്|পুলিশ|પોલીસ|ਪੁਲਿਸ|ପୋଲିସ`) },
  { code: 'ARREST_THREAT', weight: 28, re: W(String.raw`\barrest|\bjail\b|legal action|case (is |has been )?(filed|registered)|fir\b|money laundering|गिरफ्तार|जेल|கைது|అరెస్ట్|ಬಂಧನ|അറസ്റ്റ്|গ্রেফতার|ધરપકડ|ਗ੍ਰਿਫਤਾਰ|ଗିରଫ`) },
  { code: 'ACCOUNT_BLOCK', weight: 32, re: W(String.raw`(account|card|sim|kyc|pan|aadhaar|wallet|upi|electricity|connection|number|banking|services|funds)\W+(\w+\W+){0,5}(block\w*|suspend\w*|suspension|deactivat\w*|expir\w*|disconnect\w*|band|close\w*|closure|frozen|freeze|flag\w*|compromis\w*|restrict\w*)|(block\w*|suspend\w*|suspension|deactivat\w*|disconnect\w*|flag\w*|restrict\w*|freez\w*)\W+(\w+\W+){0,4}(account|card|sim|connection|access|funds)|(prevent|avoid)\W+(\w+\W+){0,4}(suspension|block|closure|deactivation|freez\w*)|kyc (update|pending|expired)|flagged for suspicious|suspicious activity|बंद हो जाएगा|ब्लॉक|முடக்க|துண்டிக்க|బ్లాక్|ನಿರ್ಬಂಧ|ബ്ലോക്ക്|ব্লক|બ્લોક|ਬਲਾਕ|ବ୍ଲକ`) },
  { code: 'URGENCY', weight: 20, re: W(String.raw`urgent|immediately|right now|within \d+ ?(hours|hrs|minutes|mins)|today itself|last (chance|warning|date)|act now|asap|turant|jaldi|abhi ke abhi|to prevent|to avoid|suspicious\s*activity|तुरंत|जल्दी|ताबडतोब|உடனே|உடனடியாக|వెంటనే|ತಕ್ಷಣ|ഉടൻ|অবিলম্বে|এখনই|તાત્કાલિક|ਤੁਰੰਤ|ତୁରନ୍ତ`) },
  { code: 'MONEY_REQUEST', weight: 24, re: W(String.raw`(send|transfer|pay|deposit|credit)\W+(\w+\W+){0,4}(money|amount|rs\.?|₹|inr|rupees|fee|charges|fine|penalty)|processing fee|security deposit|refundable|pay (the )?(fine|penalty)|paise (bhejo|transfer)|पैसे (भेजो|भेजिए|ट्रांसफर)|பணம் (அனுப்ப|கட்ட)|డబ్బు (పంపండి|கட்டండి)|ಹಣ (ಕಳುಹಿಸಿ|ಪಾವತಿ)|പണം (അയക്കൂ|അടയ്ക്കൂ)|টাকা (পাঠান|দিন)|પૈસા (મોકલો|ભરો)|ਪੈਸੇ (ਭੇਜੋ|ਭਰੋ)|ଟଙ୍କା (ପଠାନ୍ତୁ|ଦିଅନ୍ତୁ)`) },
  { code: 'COLLECT_TRICK', weight: 42, re: W(String.raw`(scan|enter (your )?(upi )?pin)\W+(\w+\W+){0,5}(receive|get|credit|refund|cashback)|to receive (the )?(money|payment|amount)|approve (the )?(collect|request) to (get|receive)`) },
  { code: 'PRIZE', weight: 24, re: W(String.raw`you (have )?won|lottery|lucky draw|jackpot|prize money|kbc|kaun banega|cash ?back of|reward points? (expir|redeem)|congratulations.{0,40}(won|selected|winner)|इनाम|लॉटरी|லாட்டரி|பரிசு|లాటరీ|ಲಾಟರಿ|ലോട്ടറി|লটারি|લોટરી|ਲਾਟਰੀ|ଲଟେରୀ`) },
  { code: 'JOB_TASK', weight: 28, re: W(String.raw`part.?time (job|work)|work from home.{0,30}(earn|daily)|earn (rs\.?|₹)?\s?\d+[\d,]*\s?(per|a|\/) ?(day|hour)|like (youtube|insta).{0,20}(videos|posts)|prepaid task|telegram task|investment (plan|tips).{0,30}(guaranteed|double)|double your money`) },
  { code: 'PARCEL', weight: 26, re: W(String.raw`(fedex|dhl|courier|parcel|package|consignment).{0,60}(seized|held|drugs|illegal|customs|return|failed|pending|address)|(drugs|mdma|passports?).{0,30}(parcel|package)`) },
  { code: 'SECRECY', weight: 22, re: W(String.raw`(don'?t|do not|never) (tell|inform|share with) (anyone|family|your (son|daughter|bank))|keep (it|this) (secret|confidential)|(don'?t|do not) (disconnect|cut|hang up)|kisi ko mat batana|किसी को मत|யாரிடமும் சொல்ல வேண்டாம்|ఎవరికీ చెప్పకండి`) },
  { code: 'PERSONAL_DATA', weight: 16, re: W(String.raw`(aadhaar|aadhar|pan) (number|card|details)|card number|expiry date|account number|net ?banking (password|login)|mpin|date of birth|verify (your )?identity|आधार|ஆதார்|ఆధார்|ಆಧಾರ್|ആധാർ|আধার|આધાર|ਆਧਾਰ|ଆଧାର`) },
  { code: 'IMPERSONATE_BANK', weight: 18, re: W(String.raw`\b(sbi|hdfc|icici|axis|kotak|pnb|bank of baroda|canara|union bank|paytm|phonepe|google pay|gpay|bhim|npci|lic|epfo|bescom|tneb|tangedco|msedcl|electricity board|jio|airtel|vi\b|bsnl|bank\s*account|security\s*team|fraud\s*(department|team))\b`) },
];

const URL_RE = /\b((?:https?:\/\/|www\.|upi:\/\/)[^\s<>"']+|[a-z0-9-]+\.(?:com|in|co\.in|net|org|xyz|top|info|live|link|click|online|site|shop|app|apk|ly|gl|io|me|cc|tk|ml|ga|cf|gq|ws|buzz|icu|vip|club)(?:\/[^\s<>"']*)?)/giu;
const SHORTENERS = /(bit\.ly|tinyurl|t\.co|goo\.gl|rb\.gy|cutt\.ly|is\.gd|shorturl|tiny\.cc|ow\.ly|s\.id|v\.gd|t\.ly|bl\.ink|rebrand\.ly|wa\.me|surl\.li|shorturl\.at)/i;
const BAD_TLD = /\.(xyz|top|info|live|click|online|site|shop|buzz|icu|vip|club|tk|ml|ga|cf|gq|ws|cc|apk)(\/|$)/i;
const OFFICIAL = /(^|\.)(sbi\.co\.in|onlinesbi\.sbi|hdfcbank\.com|icicibank\.com|axisbank\.com|kotak\.com|pnbindia\.in|bankofbaroda\.in|canarabank\.com|unionbankofindia\.co\.in|paytm\.com|phonepe\.com|pay\.google\.com|npci\.org\.in|incometax\.gov\.in|uidai\.gov\.in|india\.gov\.in|gov\.in|nic\.in|rbi\.org\.in|indiapost\.gov\.in|amazon\.in|flipkart\.com|jio\.com|airtel\.in|myvi\.in|bsnl\.co\.in|irctc\.co\.in|epfindia\.gov\.in|licindia\.in)$/i;
const BRAND_WORDS = /(sbi|hdfc|icici|axis|kotak|paytm|phonepe|gpay|npci|kyc|rbi|uidai|aadhaar|incometax|indiapost|irctc|epfo|lic|bank|refund|reward)/i;

// TRAI DLT sender header: XX-NAMEXX-S|T|P|G  (suffix mandatory since 6 May 2025)
const HEADER_RE = /^([A-Z]{2})-([A-Z0-9]{3,9})(?:-([PSTG]))?$/i;
const SUFFIX_MEANING = { P: 'PROMOTIONAL', S: 'SERVICE', T: 'TRANSACTIONAL', G: 'GOVERNMENT' };

export function decodeSender(sender = '') {
  const s = String(sender).trim().replace(/\s+/g, '');
  if (!s) return { kind: 'NONE' };
  const digits = s.replace(/[^\d]/g, '');
  if (/^\+?\d[\d-]{6,}$/.test(s)) {
    return { kind: 'MOBILE', raw: s, isIndian: /^(\+?91)?[6-9]\d{9}$/.test(digits), isIntl: s.startsWith('+') && !s.startsWith('+91') };
  }
  const m = s.toUpperCase().match(HEADER_RE);
  if (m) return { kind: 'HEADER', raw: s.toUpperCase(), operator: m[1], entity: m[2], suffix: m[3] || null, type: m[3] ? SUFFIX_MEANING[m[3]] : null };
  return { kind: 'UNKNOWN', raw: s };
}

function findUrls(text) {
  const out = [];
  for (const m of text.matchAll(URL_RE)) {
    let u = m[0].replace(/[).,;!]+$/, '');
    let host = u.replace(/^(?:https?|upi):\/\//i, '').replace(/^www\./i, '').split(/[/?#]/)[0].toLowerCase();
    out.push({ url: u, host });
  }
  return out;
}

export function analyzeText(text = '', opts = {}) {
  const mode = opts.mode || 'sms';
  const t = String(text).replace(/\s+/g, ' ').trim();
  const signals = []; // {code, weight, match}
  const safe = [];    // {code, weight}
  const add = (code, weight, match) => { if (!signals.find((s) => s.code === code)) signals.push({ code, weight, match: (match || '').slice(0, 60) }); };

  for (const r of RULES) {
    const m = t.match(r.re);
    if (m) add(r.code, r.weight, m[0]);
  }

  // Genuine OTP-delivery messages say "do not share" — that is a SAFE pattern.
  const isOtpDelivery = /(is your|is the|your) (otp|one.?time.?password|verification code)|otp (is|for)|\d{4,8} is your/i.test(t);
  const warnsNotToShare = /(do not|don'?t|never) share|किसी के साथ साझा न|பகிர வேண்டாம்|షేర్ చేయవద్దు|ಹಂಚಿಕೊಳ್ಳಬೇಡಿ|പങ്കിടരുത്/i.test(t);
  if (isOtpDelivery && warnsNotToShare) {
    const i = signals.findIndex((s) => s.code === 'OTP_REQUEST');
    if (i >= 0) signals.splice(i, 1);
    safe.push({ code: 'SAFE_OTP_DELIVERY', weight: 18 });
  }

  // Links
  const urls = findUrls(t);
  if (urls.length) {
    let official = urls.every((u) => OFFICIAL.test(u.host));
    if (official) safe.push({ code: 'SAFE_OFFICIAL_LINK', weight: 10 });
    else add('LINK', 10, urls[0].url);
    for (const u of urls) {
      if (SHORTENERS.test(u.host)) add('SHORT_LINK', 16, u.url);
      if (/\.apk(\b|$)/i.test(u.url)) add('APK_LINK', 38, u.url);
      if (/^\d{1,3}(\.\d{1,3}){3}/.test(u.host)) add('IP_LINK', 22, u.url);
      if (BAD_TLD.test(u.host + '/')) add('BAD_TLD', 14, u.host);
      if (BRAND_WORDS.test(u.host) && !OFFICIAL.test(u.host)) add('LOOKALIKE', 28, u.host);
      if (/(^|\.)xn--/i.test(u.host)) add('PUNYCODE', 26, u.host);
      if (/^(?:https?:\/\/)?[^/?#]*@/i.test(u.url)) add('URL_AT', 24, u.url);
      if (/^upi:\/\/(pay|collect)/i.test(u.url)) add('UPI_PAY_LINK', 30, u.url);
      if (u.host.split('.').length >= 5) add('MANY_SUBDOMAINS', 12, u.host);
    }
  }

  // Sender analysis (SMS only)
  const sender = decodeSender(opts.sender);
  const claimsInstitution = signals.some((s) => ['IMPERSONATE_BANK', 'AUTHORITY', 'ACCOUNT_BLOCK'].includes(s.code));
  if (mode === 'sms') {
    if (sender.kind === 'MOBILE') {
      if (claimsInstitution) add('SENDER_MOBILE_AS_BANK', 24, sender.raw);
      else add('SENDER_MOBILE', 6, sender.raw);
      if (sender.isIntl) add('SENDER_INTL', 14, sender.raw);
    } else if (sender.kind === 'HEADER') {
      if (sender.suffix === 'T' || sender.suffix === 'G' || sender.suffix === 'S') safe.push({ code: 'SAFE_DLT_' + sender.suffix, weight: sender.suffix === 'G' ? 14 : 10 });
      else if (sender.suffix === 'P') {
        if (signals.some((s) => ['OTP_REQUEST', 'ACCOUNT_BLOCK'].includes(s.code))) add('PROMO_HEADER_MISMATCH', 18, sender.raw);
      } else add('HEADER_NO_SUFFIX', 8, sender.raw);
    }
  }

  // Combinations that are typical of real Indian scams
  const has = (c) => signals.some((s) => s.code === c);
  if (has('URGENCY') && (has('MONEY_REQUEST') || has('OTP_REQUEST'))) add('COMBO_PRESSURE', 14, '');
  if (has('AUTHORITY') && has('ARREST_THREAT')) add('COMBO_FEAR', 16, '');
  if (mode === 'call' && has('OTP_REQUEST')) add('CALL_OTP', 12, '');

  // IMPERSONATE_BANK alone (just a bank name) is neutral — only count it with other signals
  if (signals.length === 1 && has('IMPERSONATE_BANK')) signals.length = 0;

  const raw = signals.reduce((a, s) => a + s.weight, 0) - safe.reduce((a, s) => a + s.weight, 0);
  const score = Math.max(0, Math.min(99, Math.round(100 * (1 - Math.exp(-Math.max(0, raw) / 48)))));

  // What we could NOT check — explains the remaining part of the score.
  const unknowns = [];
  if (mode === 'sms' && sender.kind === 'NONE') unknowns.push('NO_SENDER');
  if (urls.length && !urls.every((u) => OFFICIAL.test(u.host))) unknowns.push('LINK_NOT_OPENED');
  unknowns.push(mode === 'call' ? 'CALLER_UNVERIFIED' : 'SENDER_UNVERIFIED');
  if (t.length < 40) unknowns.push('TOO_SHORT');
  if (!has('OTP_REQUEST') && !has('MONEY_REQUEST') && !has('COLLECT_TRICK')) unknowns.push('NO_DIRECT_ASK');
  unknowns.push('NO_REPUTATION_DB');

  signals.sort((a, b) => b.weight - a.weight);
  return {
    score,
    verdict: score >= 70 ? 'SCAM' : score >= 40 ? 'SUSPICIOUS' : 'LOOKS_SAFE',
    signals,
    safe,
    unknowns,
    sender,
    urls: urls.map((u) => u.url),
    engine: 'on-device',
  };
}

// Extra checks for UPI payment screenshots, given fields extracted by OCR / vision.
export const UPI_HANDLES = ['okaxis','okhdfcbank','okicici','oksbi','ybl','ibl','axl','paytm','ptyes','ptaxis','pthdfc','ptsbi','upi','apl','yapl','rapl','axisbank','icici','sbi','hdfcbank','kotak','kbl','fbl','federal','jupiteraxis','slc','naviaxis','superyes','waicici','waaxis','wahdfcbank','wasbi','freecharge','ikwik','abfspay','axisb','idfcbank','idfcfirst','barodampay','aubank','indus','pnb','unionbank','unionbankofindia','cnrb','kvb','tmb','equitas','dbs','rbl','yesbank','yesbankltd','airtel','jio','postbank','timecosmos','pingpay','mbk','okbizaxis','axisbiz','hsbc','citi','sib','csbpay','dlb','iob','indianbank','boi','cbin','centralbank','uco','psb','mahb','bandhan','ujjivan','tapicici','yesg','pockets','eazypay','ezeepay','postbank','nsdl','kmbl','icicipay','gpay'];

export function checkPaymentFields(f = {}, opts = {}) {
  const signals = [], safe = [], unknowns = [];
  const add = (code, weight, match) => signals.push({ code, weight, match: String(match || '').slice(0, 60) });
  const now = opts.now ? new Date(opts.now) : new Date();
  const utr = String(f.utr || '').replace(/\s/g, '');
  if (!utr) add('UTR_MISSING', 26, '');
  else if (!/^\d{12}$/.test(utr)) add('UTR_FORMAT', 30, utr);
  else {
    if (/^(\d)\1{6,}/.test(utr) || /(0123456789|1234567890|9876543210)/.test(utr)) add('UTR_PATTERN', 30, utr);
    else safe.push({ code: 'SAFE_UTR_FORMAT', weight: 8 });
  }
  let when = null;
  if (f.datetime) {
    const d = new Date(f.datetime);
    if (!isNaN(d)) when = d;
  }
  if (when) {
    const diffH = (now - when) / 36e5;
    if (diffH < -0.25) add('DATE_FUTURE', 34, f.datetime);
    else if (diffH > 72) add('DATE_OLD', 14, f.datetime);
    // Older-style RRN: Y DDD ... — compare with screenshot date (soft check, since NPCI allowed random RRNs from 2024)
    if (/^\d{12}$/.test(utr)) {
      const y = String(when.getFullYear()).slice(-1);
      const start = new Date(when.getFullYear(), 0, 0);
      const doy = String(Math.floor((when - start) / 864e5)).padStart(3, '0');
      if (utr[0] === y && utr.slice(1, 4) === doy) safe.push({ code: 'SAFE_RRN_DATE', weight: 10 });
      else unknowns.push('RRN_RANDOM');
    }
    // PhonePe transaction IDs start with T + yyMMddHHmm
    const tx = String(f.txnId || '');
    const pm = tx.match(/^T(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
    if (pm) {
      const td = new Date(2000 + +pm[1], +pm[2] - 1, +pm[3], +pm[4], +pm[5]);
      if (Math.abs(td - when) > 36e5 * 2) add('TXN_DATE_MISMATCH', 24, tx);
      else safe.push({ code: 'SAFE_TXN_DATE', weight: 10 });
    }
  } else unknowns.push('NO_DATE');
  if (opts.expectedAmount && f.amount) {
    const a = parseFloat(String(f.amount).replace(/[^\d.]/g, ''));
    const e = parseFloat(String(opts.expectedAmount).replace(/[^\d.]/g, ''));
    if (a && e && Math.abs(a - e) > 0.5) add('AMOUNT_MISMATCH', 26, `${a} ≠ ${e}`);
    else if (a && e) safe.push({ code: 'SAFE_AMOUNT', weight: 4 });
  }
  for (const rawId of [f.payeeUpi, f.payerUpi]) {
    if (!rawId) continue;
    const match = String(rawId).match(/([a-zA-Z0-9.\-_]+)@([a-zA-Z0-9]+)/);
    if (!match) continue;
    const h = match[2].toLowerCase();
    if (!UPI_HANDLES.includes(h)) add('UPI_HANDLE_UNKNOWN', 12, match[0]);
    else safe.push({ code: 'SAFE_UPI_HANDLE', weight: 8 });
  }
  if (f.status && !/success|completed|paid|sent|successful|debited|credited/i.test(f.status)) add('STATUS_ODD', 12, f.status);
  unknowns.push('SCREENSHOT_NOT_PROOF');
  return { signals, safe, unknowns };
}

export function scoreFrom(signals, safe) {
  const raw = signals.reduce((a, s) => a + s.weight, 0) - safe.reduce((a, s) => a + s.weight, 0);
  return Math.max(0, Math.min(99, Math.round(100 * (1 - Math.exp(-Math.max(0, raw) / 48)))));
}
