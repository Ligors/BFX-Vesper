import { RULES, analyzeText } from './APP/bfx-vesper/public/js/engine.js';

const msg = "Dear Customer, your bank account has been flagged for suspicious activity. Our security team needs to verify your identity. Please reply with the 6-digit OTP received on your mobile to prevent account suspension.";

console.log("Analyzing msg:");
const res = analyzeText(msg);
console.log(JSON.stringify(res, null, 2));

console.log("\nTesting individual rules on msg:");
for (const r of RULES) {
  const m = msg.match(r.re);
  if (m) {
    console.log(`Matched ${r.code}: "${m[0]}"`);
  }
}
