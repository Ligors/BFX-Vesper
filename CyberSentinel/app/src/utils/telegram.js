// Telegram Bot API Integration for CyberSentinel Guardian Alerts

export async function sendTelegramGuardianAlert({
  botToken,
  chatId,
  victimName = 'Elder Parent (Appa)',
  incidentType = 'Urgent Call Phishing & Coercion Detected',
  scamScore = 98,
  callerNumber = '+91 98765 43210',
  transcript = 'Share the 6-digit OTP immediately or electricity will be cut in 10 minutes!',
  location = 'Indiranagar 100ft Road, Bengaluru, Karnataka (12.9716° N, 77.5946° E)',
  lockedApps = ['Google Pay', 'PhonePe', 'Paytm', 'SBI YONO', 'SMS Messages', 'Google Chrome']
}) {
  const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  const messageText = `🚨 *CYBERSENTINEL EMERGENCY GUARDIAN ALERT* 🚨
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ *HIGH-RISK SCAM INTERCEPTED*
👤 *Protected Elder:* ${victimName}
🕒 *Time:* ${timestamp} IST
🎯 *Incident:* ${incidentType}
📊 *Risk Score:* ${scamScore}% (CRITICAL)

📞 *Scammer Number:* \`${callerNumber}\`
🎙️ *Intercepted Speech:* 
"${transcript}"

📍 *Device Location:* 
${location}

🔒 *AUTOMATIC LOCKDOWN ACTIVATED:*
The following vulnerable apps have been blocked on the elder's phone to prevent financial loss:
${lockedApps.map(app => ` • ${app}`).join('\n')}

🔑 *Guardian Action Required:*
👉 *PLEASE CALL ${victimName} IMMEDIATELY!*
👉 *Confirm and firmly instruct them: DO NOT SHARE ANY OTP OR TRANSFER MONEY!*
1. Visit the elder or guide them via phone.
2. Enter the Guardian Passcode & Passphrase on the lock screen.
3. Review the post-incident threat log.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_CyberSentinel Senior Raksha Kavach • Automated Defense_`;

  // If real bot token and chat ID provided, send via official Telegram API
  if (botToken && chatId) {
    try {
      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: messageText,
          parse_mode: 'Markdown'
        })
      });
      const data = await response.json();
      return {
        success: data.ok,
        realDispatch: true,
        message: messageText,
        apiResponse: data
      };
    } catch (err) {
      console.error('Failed to send real Telegram alert:', err);
      return {
        success: false,
        realDispatch: true,
        error: err.message,
        message: messageText
      };
    }
  }

  // Simulated mode (for demo without requiring real bot token)
  return {
    success: true,
    realDispatch: false,
    message: messageText,
    simulated: true
  };
}
