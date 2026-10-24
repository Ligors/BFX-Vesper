import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Bot, 
  Send, 
  ShieldCheck, 
  Clock, 
  AlertCircle, 
  Play, 
  RotateCcw, 
  UserCheck, 
  Volume2, 
  VolumeX, 
  Sparkles,
  Zap
} from 'lucide-react';
import { speakText, stopSpeaking } from '../utils/speech';
import { getTranslation } from '../translations/languages';

const INITIAL_SCAMMER_MESSAGE = "Namaste Sir! 🎉 Your mobile number was selected by YouTube India Promotion Team. Earn ₹3,500 to ₹8,000 daily just by liking 5 videos. First, send ₹500 refundable security deposit to UPI ID: quickearn99@oksbi. Send screenshot immediately to start!";

const DEBATE_PERSONAS = [
  { id: 'confused_elder', name: 'Confused Grandparent (Appa)', tone: 'Slow, asking about pension and spectacles' },
  { id: 'suspicious_uncle', name: 'Inquisitive Uncle', tone: 'Demands government registration certificate and office address' },
  { id: 'tech_novice', name: 'Technologically Challenged', tone: 'Claims the phone screen is upside down or battery is at 2%' }
];

export default function DebateBot({ currentLang }) {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'scammer',
      senderName: '+91 98450 77123 (Scammer)',
      text: INITIAL_SCAMMER_MESSAGE,
      timestamp: '12:40 PM'
    }
  ]);
  const [scammerReplyInput, setScammerReplyInput] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [timeWastedSeconds, setTimeWastedSeconds] = useState(140);
  const [extractedIntel, setExtractedIntel] = useState(['UPI: quickearn99@oksbi', 'Phone: +91 98450 77123']);
  const [selectedPersona, setSelectedPersona] = useState('confused_elder');

  const t = (key) => getTranslation(currentLang, key);

  // Time wasted ticker when authorized
  useEffect(() => {
    let interval;
    if (isAuthorized) {
      interval = setInterval(() => {
        setTimeWastedSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isAuthorized]);

  // Handle Authorizing DebateBot
  const handleAuthorize = () => {
    setIsAuthorized(true);
    setIsAiThinking(true);

    setTimeout(() => {
      const firstBotReply = "Aiyyo beta... my reading spectacles are missing. Is this the money sent by the postal department for my pension? My phone screen is very small, which button should I press?";
      setMessages(prev => [
        ...prev,
        {
          id: Date.now(),
          sender: 'debate_bot',
          senderName: 'DebateBot (Pretending as Elder)',
          text: firstBotReply,
          timestamp: '12:41 PM'
        }
      ]);
      setIsAiThinking(false);
    }, 1500);
  };

  // Generate automated next scammer demand
  const handleSimulateScammer = (customText) => {
    const textToSend = customText || getNextScammerPhrase();
    if (!textToSend) return;

    const newScammerMsg = {
      id: Date.now(),
      sender: 'scammer',
      senderName: '+91 98450 77123',
      text: textToSend,
      timestamp: '12:42 PM'
    };

    setMessages(prev => [...prev, newScammerMsg]);
    setScammerReplyInput('');

    // Trigger AI Counter-Scam Loop
    triggerBotReply(textToSend);
  };

  const getNextScammerPhrase = () => {
    const scammerPool = [
      "No uncle! This is not pension. Open your PhonePe or Google Pay and transfer ₹500 to quickearn99@oksbi immediately! Offer closing in 5 minutes!",
      "Sir, why are you delaying? If you don't pay ₹500 now, we will cancel your job slot and report your number to police!",
      "Uncle, please pay on alternate UPI: fraudmule88@paytm if previous ID is not working. Do it right now!",
      "Are you sending the money or not? Don't waste my time!"
    ];
    return scammerPool[Math.floor(Math.random() * scammerPool.length)];
  };

  // AI Counter-Baiting Loop Logic
  const triggerBotReply = (lastScammerText) => {
    setIsAiThinking(true);

    setTimeout(() => {
      let counterReply = "";
      if (lastScammerText.includes('police')) {
        counterReply = "Aiyyo son, please don't call police! My son-in-law is an assistant commissioner of police in Chennai. Let me give him your number so he can help you with the deposit?";
      } else if (lastScammerText.includes('fraudmule88') || lastScammerText.includes('alternate UPI')) {
        counterReply = "Beta, I typed that name in my passbook, but the bank clerk at State Bank says the ink is smudged. Can you send me your photograph and Aadhaar card so I can verify?";
        setExtractedIntel(prev => [...new Set([...prev, 'Mule UPI: fraudmule88@paytm'])]);
      } else if (lastScammerText.includes('PhonePe') || lastScammerText.includes('Google Pay')) {
        counterReply = "Son, which one is PhonePe? The blue icon or the yellow icon? Yesterday my neighbor boy told me it is an envelope with a stamp. Should I put a 5 rupee coin in the charging slot?";
      } else {
        counterReply = "Wait beta, the bell is ringing, the milkman is here. Stay on line, don't cut the chat, I am coming back in 15 minutes...";
      }

      setMessages(prev => [
        ...prev,
        {
          id: Date.now(),
          sender: 'debate_bot',
          senderName: 'DebateBot (Counter-Bait)',
          text: counterReply,
          timestamp: '12:43 PM'
        }
      ]);
      setIsAiThinking(false);
    }, 2000);
  };

  const formatSeconds = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  };

  return (
    <div className="space-y-4">
      
      {/* Header */}
      <div className="bg-white p-3.5 rounded-2xl border-2 border-slate-200 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-emerald-600" />
              {t('debateTitle')}
            </h2>
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
              {t('debateDesc')}
            </p>
          </div>
          <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300 shrink-0">
            Endless Loop Active
          </span>
        </div>
      </div>

      {/* STATS BAR: Scammer Time Wasted & Intel Collected */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-2.5 text-center">
          <Clock className="w-4 h-4 text-emerald-700 mx-auto mb-0.5" />
          <div className="text-[10px] font-bold text-emerald-800">Scammer Wasted</div>
          <div className="text-sm font-black text-emerald-950">{formatSeconds(timeWastedSeconds)}</div>
        </div>

        <div className="bg-sky-50 border-2 border-sky-200 rounded-xl p-2.5 text-center">
          <Bot className="w-4 h-4 text-sky-700 mx-auto mb-0.5" />
          <div className="text-[10px] font-bold text-sky-800">Messages Exchanged</div>
          <div className="text-sm font-black text-sky-950">{messages.length}</div>
        </div>

        <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-2.5 text-center">
          <ShieldCheck className="w-4 h-4 text-amber-700 mx-auto mb-0.5" />
          <div className="text-[10px] font-bold text-amber-800">Elder Funds Lost</div>
          <div className="text-sm font-black text-emerald-700">₹0.00 (Safe)</div>
        </div>
      </div>

      {/* AUTHORIZATION PROMPT (If not yet authorized) */}
      {!isAuthorized && (
        <div className="bg-amber-50 border-3 border-amber-500 rounded-2xl p-4 shadow-md space-y-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-black text-amber-950 uppercase tracking-wide">
                ⚠️ Suspected WhatsApp Scam Inbound
              </div>
              <p className="text-xs text-amber-900 mt-1 font-semibold leading-relaxed">
                An unknown contact (<strong>+91 98450 77123</strong>) is offering fake YouTube part-time tasks and demanding upfront money.
              </p>
            </div>
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-amber-200 text-xs text-slate-700 italic">
            "{INITIAL_SCAMMER_MESSAGE}"
          </div>

          <button
            onClick={handleAuthorize}
            className="w-full py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs shadow-md transition flex items-center justify-center gap-2 border-2 border-emerald-900"
          >
            <Bot className="w-4 h-4 text-emerald-200" />
            <span>{t('debateAuthorize')}</span>
          </button>
        </div>
      )}

      {/* WHATSAPP CHAT VIEWPORT */}
      <div className="bg-[#EFEAE2] rounded-2xl border-2 border-slate-300 shadow-md overflow-hidden flex flex-col h-[420px]">
        
        {/* WhatsApp Header Bar */}
        <div className="bg-[#075E54] text-white px-3 py-2 flex items-center justify-between shadow">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs">
              +91
            </div>
            <div>
              <div className="text-xs font-bold leading-tight">+91 98450 77123</div>
              <div className="text-[10px] text-emerald-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-ping"></span>
                <span>{isAuthorized ? 'DebateBot Counter-Loop Active' : 'Suspicious Message'}</span>
              </div>
            </div>
          </div>

          <span className="text-[10px] bg-emerald-800 text-emerald-100 px-2 py-0.5 rounded font-bold">
            WhatsApp
          </span>
        </div>

        {/* Chat Messages Body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {messages.map((msg) => {
            const isScammer = msg.sender === 'scammer';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isScammer ? 'items-start' : 'items-end'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs shadow-sm relative ${
                    isScammer
                      ? 'bg-white text-slate-900 rounded-tl-none border border-slate-200'
                      : 'bg-[#DCF8C6] text-slate-900 rounded-tr-none border border-emerald-200'
                  }`}
                >
                  <div className="text-[9px] font-bold mb-0.5 text-slate-500 flex items-center gap-1">
                    {isScammer ? (
                      <span className="text-rose-700">⚠️ Scammer</span>
                    ) : (
                      <span className="text-emerald-800 font-bold flex items-center gap-1">
                        <Bot className="w-3 h-3 text-emerald-700" />
                        DebateBot (Bait)
                      </span>
                    )}
                  </div>
                  <p className="leading-relaxed font-medium">{msg.text}</p>
                  <div className="text-[9px] text-slate-400 text-right mt-1 font-mono">
                    {msg.timestamp}
                  </div>
                </div>
              </div>
            );
          })}

          {/* AI Thinking Animation */}
          {isAiThinking && (
            <div className="flex items-center gap-2 text-slate-600 text-xs italic bg-white/70 py-1 px-3 rounded-full w-max shadow-sm border border-slate-200">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
              <span>DebateBot formulating confusing elder reply...</span>
            </div>
          )}
        </div>

        {/* Scammer Interactive Input / Trigger bar */}
        {isAuthorized && (
          <div className="bg-slate-100 p-2 border-t border-slate-300 space-y-2">
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                placeholder="Type pushy demand as scammer..."
                value={scammerReplyInput}
                onChange={(e) => setScammerReplyInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && scammerReplyInput.trim()) {
                    handleSimulateScammer(scammerReplyInput.trim());
                  }
                }}
                className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600"
              />
              <button
                onClick={() => handleSimulateScammer(scammerReplyInput.trim())}
                disabled={!scammerReplyInput.trim() || isAiThinking}
                className="p-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg transition disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Demo Simulator Buttons */}
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 font-semibold">Demo Actions:</span>
              <button
                onClick={() => handleSimulateScammer()}
                disabled={isAiThinking}
                className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded font-bold border border-amber-300 flex items-center gap-1 transition"
              >
                <Zap className="w-3 h-3 text-amber-700" />
                <span>Simulate Pushy Scammer Reply</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* EXTRACTED SCAMMER INTEL LOG */}
      <div className="bg-white p-3.5 rounded-2xl border-2 border-slate-200 shadow-sm space-y-2">
        <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between">
          <span>Captured Scammer Intelligence (Ready for 1930 / Portal):</span>
          <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            Auto-Logged
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {extractedIntel.map((intel, idx) => (
            <span key={idx} className="bg-slate-100 text-slate-800 text-xs font-mono font-bold px-2.5 py-1 rounded-lg border border-slate-300">
              {intel}
            </span>
          ))}
        </div>
      </div>

    </div>
  );
}
