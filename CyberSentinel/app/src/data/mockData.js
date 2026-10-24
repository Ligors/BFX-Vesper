// Realistic Indian Payment Screenshots (SVG Data URIs), SMS Templates, and Call Scenarios

// Helper to generate realistic Indian UPI payment receipt SVGs
export function generateReceiptSvg({
  appName = 'PhonePe',
  amount = '₹5,000.00',
  recipient = 'Ramesh Kumar Store',
  upiId = 'ramesh@oksbi',
  utr = '38291028',
  date = '22 Oct 2026, 12:35 PM',
  isScam = true,
  reason = 'SpoofPay Mod APK font mismatch'
}) {
  const isPhonePe = appName.toLowerCase().includes('phonepe');
  const isGPay = appName.toLowerCase().includes('gpay');
  const isPaytm = appName.toLowerCase().includes('paytm');

  const primaryColor = isPhonePe ? '#5f259f' : (isGPay ? '#1a73e8' : '#00b9f5');
  const headerText = isPhonePe ? 'Transaction Successful' : (isGPay ? 'Payment to' : 'Paid Successfully');

  const svgContent = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 680" width="100%" height="100%">
    <defs>
      <filter id="cardShadow" x="-10%" y="-5%" width="120%" height="120%">
        <feDropShadow dx="0" dy="4" stdDeviation="6" flood-opacity="0.1"/>
      </filter>
    </defs>
    
    <!-- Phone / Screen Background -->
    <rect width="400" height="680" fill="#f8fafc"/>
    
    <!-- Android Status Bar -->
    <rect width="400" height="32" fill="${primaryColor}"/>
    <text x="24" y="21" font-family="sans-serif" font-size="12" font-weight="bold" fill="#ffffff">12:35</text>
    <circle cx="330" cy="16" r="3" fill="#ffffff"/>
    <text x="345" y="21" font-family="sans-serif" font-size="11" fill="#ffffff">5G 📶 92%</text>

    <!-- Header App Bar -->
    <rect y="32" width="400" height="60" fill="${primaryColor}"/>
    <text x="24" y="68" font-family="sans-serif" font-size="18" font-weight="bold" fill="#ffffff">${appName}</text>
    <circle cx="360" cy="62" r="14" fill="#ffffff" fill-opacity="0.2"/>
    <text x="355" y="67" font-family="sans-serif" font-size="14" fill="#ffffff">?</text>

    <!-- Main Payment Card -->
    <g transform="translate(20, 110)" filter="url(#cardShadow)">
      <rect width="360" height="520" rx="16" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>

      <!-- Checkmark Circle -->
      <circle cx="180" cy="60" r="34" fill="#15803d"/>
      <path d="M168 60 L176 68 L194 50" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>

      <!-- Success Text -->
      <text x="180" y="125" font-family="sans-serif" font-size="18" font-weight="bold" fill="#0f172a" text-anchor="middle">${headerText}</text>
      <text x="180" y="146" font-family="sans-serif" font-size="13" fill="#64748b" text-anchor="middle">${date}</text>

      <!-- Amount -->
      <text x="180" y="215" font-family="${isScam ? 'Arial, sans-serif' : 'system-ui, sans-serif'}" font-size="38" font-weight="900" fill="#0f172a" text-anchor="middle">${amount}</text>

      <!-- Divider -->
      <line x1="30" y1="245" x2="330" y2="245" stroke="#f1f5f9" stroke-width="2"/>

      <!-- Details List -->
      <text x="30" y="280" font-family="sans-serif" font-size="12" fill="#64748b">Paid to</text>
      <text x="30" y="302" font-family="sans-serif" font-size="15" font-weight="bold" fill="#0f172a">${recipient}</text>
      <text x="30" y="322" font-family="sans-serif" font-size="12" fill="#475569">${upiId}</text>

      <!-- Banking Details Box -->
      <rect x="25" y="345" width="310" height="100" rx="10" fill="#f8fafc" stroke="#e2e8f0"/>
      <text x="40" y="375" font-family="sans-serif" font-size="12" fill="#64748b">UPI Transaction ID / UTR</text>
      <text x="40" y="398" font-family="monospace" font-size="14" font-weight="bold" fill="${isScam ? '#b91c1c' : '#15803d'}">${utr} ${isScam ? '⚠️ (FLAGGED)' : '✓ (VALID)'}</text>
      <text x="40" y="425" font-family="sans-serif" font-size="11" fill="#64748b">Debited from Bank A/c ending in **9412</text>

      <!-- NPCI Watermark -->
      <rect x="130" y="465" width="100" height="30" rx="6" fill="#f1f5f9"/>
      <text x="180" y="485" font-family="sans-serif" font-size="11" font-weight="bold" fill="#475569" text-anchor="middle">UPI • NPCI</text>
    </g>
  </svg>
  `;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svgContent)}`;
}

export const SAMPLE_SCREENSHOTS = [
  {
    id: 'phonepe_fake_1',
    name: 'Fake PhonePe (₹5,000)',
    type: 'SCAM',
    subtitle: 'Mod APK (SpoofPay) with 8-digit fake UTR',
    amount: '₹5,000.00',
    utr: '38291028',
    image: generateReceiptSvg({
      appName: 'PhonePe',
      amount: '₹5,000.00',
      recipient: 'Sri Lakshmi Store (Thatha)',
      upiId: 'srilakshmi@okhdfcbank',
      utr: '38291028',
      isScam: true,
      reason: 'Missing standard 12-digit UTR; font mismatch on ₹5,000'
    })
  },
  {
    id: 'gpay_fake_1',
    name: 'Fake Google Pay (₹12,500)',
    type: 'SCAM',
    subtitle: 'Altered template with invalid reference format',
    amount: '₹12,500.00',
    utr: 'UPI-984210',
    image: generateReceiptSvg({
      appName: 'Google Pay',
      amount: '₹12,500.00',
      recipient: 'Pooja Medicals & Clinic',
      upiId: 'poojamed@oksbi',
      utr: 'UPI-984210',
      isScam: true,
      reason: 'Invalid alphanumeric prefix instead of 12 digits'
    })
  },
  {
    id: 'paytm_fake_1',
    name: 'Fake Paytm Spoof (₹2,500)',
    type: 'SCAM',
    subtitle: 'Spoofed Paytm soundbox template with wrong alignment',
    amount: '₹2,500.00',
    utr: 'PYTM-00192',
    image: generateReceiptSvg({
      appName: 'Paytm UPI',
      amount: '₹2,500.00',
      recipient: 'Ganapathy Electricals',
      upiId: 'ganapathy@paytm',
      utr: 'PYTM-00192',
      isScam: true,
      reason: 'Counterfeit Paytm audio-box screenshot'
    })
  },
  {
    id: 'genuine_sample_1',
    name: 'Genuine PhonePe (₹350)',
    type: 'SAFE',
    subtitle: 'Authentic 12-digit NPCI Bank Reference UTR',
    amount: '₹350.00',
    utr: '429618291034',
    image: generateReceiptSvg({
      appName: 'PhonePe',
      amount: '₹350.00',
      recipient: 'Fresh Veggies Mart',
      upiId: 'freshveg@axl',
      utr: '429618291034',
      isScam: false,
      reason: 'Valid 12-digit NPCI banking sequence'
    })
  }
];

export const SAMPLE_SMS_MESSAGES = [
  {
    id: 'sms_elec',
    header: '+91 98450 12345',
    title: 'Electricity Disconnection Threat',
    text: 'Dear Consumer, your electricity power will be disconnected tonight at 9:30 PM from BESCOM/TNEB office because your previous month bill was not updated. Please immediately contact our power officer at 9876543210.',
    expectedScore: 94
  },
  {
    id: 'sms_sbi_apk',
    header: '+91 88776 54321',
    title: 'SBI YONO Blocked - Fake APK Link',
    text: 'Dear Customer, Your SBI YONO Account has been blocked due to pending PAN KYC. Download SBI-KYC.apk to unblock: http://bit.ly/sbi-unblock-kyc immediately or account deactivated.',
    expectedScore: 98
  },
  {
    id: 'sms_itr',
    header: 'AD-ITRDEP',
    title: 'Income Tax Refund Phishing',
    text: 'Your Income Tax Refund of Rs 24,850 has been approved. Please verify your bank account details by clicking: http://refund-pan-incometax.xyz within 2 hours.',
    expectedScore: 82
  },
  {
    id: 'sms_job',
    header: '+91 99112 33445',
    title: 'Part-Time Work From Home Task Scam',
    text: 'Earn Rs 3000 to Rs 8000 daily by liking YouTube videos and rating Google maps. Work from home 1 hour. Contact HR on WhatsApp: wa.me/919911233445',
    expectedScore: 88
  },
  {
    id: 'sms_genuine',
    header: 'VM-HDFCBK',
    title: 'Genuine Bank Debit Alert',
    text: 'Rs 350.00 debited from A/C XX4921 on 22-OCT-26 to SWIGGY. UPI Ref: 429618291034. If not done by you, call 18002586161 immediately.',
    expectedScore: 10
  }
];

export const CALL_SCENARIOS = [
  {
    id: 'call_cbi',
    callerName: 'CBI Cyber Cell Mumbai (Spoofed)',
    callerNumber: '+91 98765 43210',
    riskLevel: 'CRITICAL DANGER',
    threatCategory: 'Digital Arrest & Supreme Court Extortion',
    phrases: [
      'Hello, this is Senior Inspector Rathore from Mumbai Cyber Crime Branch.',
      'A FedEx courier under your Aadhaar number containing illegal narcotics and 16 passports was seized at Mumbai airport!',
      'The Supreme Court has issued an immediate Digital Arrest warrant against you.',
      'Your bank accounts will be seized within 15 minutes unless you transfer your fixed deposit of ₹50,000 for verification.',
      'Tell me the 6-digit OTP received right now on your mobile or the police team will break your door in 10 minutes!'
    ],
    triggerWords: ['narcotics', 'Digital Arrest', 'bank accounts will be seized', '₹50,000', '6-digit OTP received right now']
  },
  {
    id: 'call_electricity',
    callerName: 'Electricity Board Officer (Fake)',
    callerNumber: '+91 91234 56789',
    riskLevel: 'HIGH DANGER',
    threatCategory: 'Immediate Power Cut Off & Remote App Trap',
    phrases: [
      'Hello sir, I am speaking from State Electricity Board sub-station.',
      'Your previous month electricity bill of ₹1,420 is showing pending in our computer.',
      'Our line technician is standing right near your home power pole. Power will be disconnected in 10 minutes.',
      'To prevent darkness tonight, open your phone immediately and install QuickSupport app.',
      'Share the 6-digit screen sharing code or OTP urgently so our system updates your payment!'
    ],
    triggerWords: ['power will be disconnected', 'pending', 'QuickSupport app', 'Share the 6-digit', 'OTP urgently']
  },
  {
    id: 'call_safe_family',
    callerName: 'Arun (Son)',
    callerNumber: '+91 94432 10987',
    riskLevel: 'SAFE',
    threatCategory: 'Normal Family Call',
    phrases: [
      'Hi Appa, how are you feeling today? Did you take your afternoon diabetes medicine?',
      'Amma told me you were going to the temple in the evening.',
      'I wanted to check if you need any groceries or medicines delivered via Blinkit.',
      'I have booked your train tickets for Coimbatore next week, no need to worry about anything.',
      'Take rest Appa, I will call you back tonight after reaching home.'
    ],
    triggerWords: []
  }
];

export const SCAM_TRICKS_QUIZZES = [
  {
    id: 'q1',
    scenario: 'You receive an SMS from "+91 98765 11223" saying:\n"Urgent: Your electricity power will be cut off tonight at 9:30 PM due to unpaid bill. Call officer immediately at 9876511223."',
    senderHeader: '+91 98765 11223 (Personal 10-digit number)',
    options: [
      { text: 'Call the number immediately and pay ₹100 via PhonePe', isCorrect: false, feedback: 'Dangerous! Real electricity boards NEVER send disconnection notices from personal 10-digit mobile numbers.' },
      { text: 'Tap "Block & Report" and check your physical electricity bill', isCorrect: true, feedback: 'Excellent! Official electricity boards use registered headers like SG-BESCOM or VM-TNEB, never a personal mobile number.' }
    ]
  },
  {
    id: 'q2',
    scenario: 'A buyer at your shop shows a PhonePe screenshot on their phone showing "₹3,500 Paid Successfully". But your phone has NOT received any bank SMS yet. The buyer says: "Uncle, the server is slow, money will come in 10 minutes, let me take the clothes now."',
    senderHeader: 'Buyer\'s phone screen',
    options: [
      { text: 'Believe the green checkmark and let the buyer take the clothes', isCorrect: false, feedback: 'Trap! Fraudsters use Fake PhonePe Mod APKs (like SpoofPay) that generate fake green checkmarks with altered amounts and fake UTR numbers.' },
      { text: 'Tell the buyer: "I will only release goods after my own bank SMS arrives"', isCorrect: true, feedback: 'Golden Rule for Elders: Never trust a screen shown to you by a stranger. Always wait for your own bank notification or soundbox confirmation!' }
    ]
  },
  {
    id: 'q3',
    scenario: 'You get an SMS: "Dear Customer, your SBI account is locked. Download SBI-KYC.apk to unblock your account within 24 hours."',
    senderHeader: 'AD-SBISUPPORT',
    options: [
      { text: 'Download and install the APK file to prevent account lock', isCorrect: false, feedback: 'Critical Risk! Banks in India NEVER send APK files via SMS. APKs are Android programs that can steal your OTPs and bank credentials in the background.' },
      { text: 'Do NOT download. Visit your local SBI bank branch in person', isCorrect: true, feedback: 'Perfect! Official banking apps are only downloaded from the official Google Play Store, never from SMS web links.' }
    ]
  }
];
