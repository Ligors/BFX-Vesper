const W = (s) => new RegExp(s, 'iu');

const RULES = [
  {
    code: 'OTP_REQUEST',
    weight: 45,
    re: W(String.raw`\b(share|tell|send|give|read|forward|say|reply|provide|enter|submit|confirm|verify|respond)\b\W+(\w+\W+){0,6}(otp|one.?time.?pass|pin|cvv|verification\s*code|code)|(otp|pin|cvv|code)\W+(\w+\W+){0,5}(share|tell|send|reply|provide|give|enter|submit|confirm|verify|batao|bataiye|sollunga|cheppandi|heli|parayoo|bolo)|reply\s*(?:with)?\s*(?:the)?\s*(?:\d+[\s-]*(?:digit|letter))?\s*otp|ओटीपी\s*(बताइए|बताओ|भेजो|बता|सांगा)|OTP\s*(बताइए|बताओ|सांगा|சொல்லுங்க|சொல்லுங்கள்|చెప్పండి|ಹೇಳಿ|പറയൂ|বলুন|કહો|ਦੱਸੋ|କୁହନ୍ତୁ)`)
  },
  {
    code: 'ACCOUNT_BLOCK',
    weight: 30,
    re: W(String.raw`(account|card|sim|kyc|pan|aadhaar|wallet|upi|electricity|connection|number|banking|services)\W+(\w+\W+){0,5}(block\w*|suspend\w*|suspension|deactivat\w*|expir\w*|disconnect\w*|band|close\w*|closure|frozen|freeze|flag\w*|compromis\w*|restrict\w*)|(block\w*|suspend\w*|suspension|deactivat\w*|disconnect\w*|flag\w*|restrict\w*)\W+(\w+\W+){0,4}(account|card|sim|connection|access)|(prevent|avoid)\W+(\w+\W+){0,3}(suspension|block|closure|deactivation)|kyc (update|pending|expired)|बंद हो जाएगा|ब्लॉक|मुடக்க|துண்டிக்க|బ్లాక్|ನಿರ್ಬಂಧ|ബ്ലോക്ക്|ব্লক|બ્લોક|ਬਲਾਕ|ବ୍ଲକ`)
  },
  {
    code: 'IMPERSONATE_BANK',
    weight: 18,
    re: W(String.raw`\b(sbi|hdfc|icici|axis|kotak|pnb|bank of baroda|canara|union bank|paytm|phonepe|google pay|gpay|bhim|npci|lic|epfo|bank\s*account|security\s*team|fraud\s*(department|team)|customer\s*care)\b`)
  },
  {
    code: 'URGENCY',
    weight: 20,
    re: W(String.raw`urgent|immediately|right now|within \d+ ?(hours|hrs|minutes|mins)|today itself|last (chance|warning|date)|act now|asap|turant|jaldi|to prevent|to avoid|suspicious\s*activity|तुरंत|जल्दी|உடனே|వెంటనే|ತಕ್ಷಣ|ഉടൻ`)
  }
];

const msg = "Dear Customer, your bank account has been flagged for suspicious activity. Our security team needs to verify your identity. Please reply with the 6-digit OTP received on your mobile to prevent account suspension.";

let score = 0;
const matched = [];
for (const r of RULES) {
  const m = msg.match(r.re);
  if (m) {
    matched.push({ code: r.code, weight: r.weight, match: m[0] });
    score += r.weight;
  }
}

// Saturating curve
const finalScore = Math.min(100, Math.round(100 * (1 - Math.exp(-score / 45))));
console.log("Matched rules:", matched);
console.log("Raw score:", score, "Final saturated score:", finalScore);
