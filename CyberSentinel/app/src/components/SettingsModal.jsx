import React, { useState } from 'react';
import { 
  X, 
  Settings, 
  Send, 
  CheckCircle2, 
  Key, 
  Shield, 
  Smartphone, 
  Cpu, 
  Lock,
  ExternalLink,
  Volume2
} from 'lucide-react';
import { sendTelegramGuardianAlert } from '../utils/telegram';

export default function SettingsModal({
  isOpen,
  onClose,
  guardianConfig,
  setGuardianConfig,
  apiKeys,
  setApiKeys
}) {
  const [localGuardian, setLocalGuardian] = useState({ ...guardianConfig });
  const [localKeys, setLocalKeys] = useState({ ...apiKeys });
  const [testTelegramStatus, setTestTelegramStatus] = useState(null);

  if (!isOpen) return null;

  const handleSave = () => {
    setGuardianConfig(localGuardian);
    setApiKeys(localKeys);
    onClose();
  };

  const handleTestTelegram = async () => {
    setTestTelegramStatus('sending');
    const result = await sendTelegramGuardianAlert({
      botToken: localGuardian.telegramBotToken,
      chatId: localGuardian.telegramChatId,
      victimName: `${localGuardian.guardianName || 'Elder Dad'} (Test Alert)`,
      incidentType: 'Test Alert Verification from CyberSentinel Prototype',
      scamScore: 99,
      callerNumber: '+91 98765 43210 (Scammer Simulation)',
      transcript: 'Test alert from CyberSentinel: Your guardian setup is verified.',
      location: 'Indiranagar 100ft Road, Bengaluru, Karnataka (Lat: 12.9716, Lng: 77.5946)',
      lockedApps: ['Google Pay', 'PhonePe', 'Paytm', 'SMS']
    });

    if (result.success) {
      setTestTelegramStatus(result.realDispatch ? 'real_sent' : 'simulated_ok');
    } else {
      setTestTelegramStatus('failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto border-2 border-slate-300 shadow-2xl p-4 sm:p-5 space-y-4 text-slate-900">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-sky-700" />
            <h2 className="text-base font-black text-slate-900">CyberSentinel Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* SECTION 1: GUARDIAN TELEGRAM SETUP */}
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
          <div className="flex items-center gap-2 text-xs font-black text-slate-900 uppercase tracking-wide">
            <Shield className="w-4 h-4 text-sky-700" />
            <span>1. Guardian Contact & Telegram Bot</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-0.5">Guardian Name</label>
              <input
                type="text"
                value={localGuardian.guardianName}
                onChange={(e) => setLocalGuardian({ ...localGuardian, guardianName: e.target.value })}
                placeholder="e.g. Arun (Son)"
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:border-sky-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-0.5">Guardian Phone</label>
              <input
                type="text"
                value={localGuardian.guardianPhone}
                onChange={(e) => setLocalGuardian({ ...localGuardian, guardianPhone: e.target.value })}
                placeholder="+91 94440 12345"
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:border-sky-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-0.5">
              Telegram Bot Token (Optional for live Telegram)
            </label>
            <input
              type="text"
              value={localGuardian.telegramBotToken}
              onChange={(e) => setLocalGuardian({ ...localGuardian, telegramBotToken: e.target.value })}
              placeholder="e.g. 712345678:AAHxy..."
              className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:border-sky-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-0.5">
              Telegram Chat ID (Optional)
            </label>
            <input
              type="text"
              value={localGuardian.telegramChatId}
              onChange={(e) => setLocalGuardian({ ...localGuardian, telegramChatId: e.target.value })}
              placeholder="e.g. 198273645"
              className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:border-sky-600 focus:outline-none"
            />
          </div>

          {/* Test Telegram Dispatch Button */}
          <button
            type="button"
            onClick={handleTestTelegram}
            className="w-full py-2 px-3 bg-sky-100 hover:bg-sky-200 text-sky-900 text-xs font-bold rounded-lg border border-sky-300 flex items-center justify-center gap-1.5 transition"
          >
            <Send className="w-3.5 h-3.5 text-sky-700" />
            <span>Test Guardian Alert Dispatch</span>
          </button>

          {testTelegramStatus === 'real_sent' && (
            <div className="text-[11px] font-bold text-emerald-800 bg-emerald-100 p-2 rounded-lg border border-emerald-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Real Telegram Alert Delivered to Chat ID! Check your Telegram app.</span>
            </div>
          )}

          {testTelegramStatus === 'simulated_ok' && (
            <div className="text-[11px] font-bold text-sky-800 bg-sky-100 p-2 rounded-lg border border-sky-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-sky-600" />
              <span>Simulated Telegram Alert logged successfully! (Enter Token for real dispatch)</span>
            </div>
          )}

          {testTelegramStatus === 'failed' && (
            <div className="text-[11px] font-bold text-rose-800 bg-rose-100 p-2 rounded-lg border border-rose-300">
              Failed to connect to Telegram API. Please check your Bot Token and Chat ID.
            </div>
          )}
        </div>

        {/* SECTION 2: 2-FACTOR GUARDIAN UNLOCK CREDENTIALS */}
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-black text-slate-900 uppercase tracking-wide">
            <Lock className="w-4 h-4 text-emerald-700" />
            <span>2. Guardian Unlock Passcode & Passphrase</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-0.5">Passcode</label>
              <input
                type="text"
                value={localGuardian.passcode}
                onChange={(e) => setLocalGuardian({ ...localGuardian, passcode: e.target.value })}
                placeholder="Default: 9442"
                className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg focus:border-sky-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-0.5">Passphrase</label>
              <input
                type="text"
                value={localGuardian.passphrase}
                onChange={(e) => setLocalGuardian({ ...localGuardian, passphrase: e.target.value })}
                placeholder="KAVACH-SHIELD-2026"
                className="w-full px-2.5 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-lg focus:border-sky-600 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: OPTIONAL AI APIS (GROQ & GEMINI) */}
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-black text-slate-900 uppercase tracking-wide">
            <Key className="w-4 h-4 text-amber-600" />
            <span>3. Cloud AI APIs (Optional)</span>
          </div>

          <p className="text-[11px] text-slate-600">
            CyberSentinel includes an on-device OCR and fraud rule engine out of the box. You can optionally attach live API keys:
          </p>

          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-0.5">Google Gemini API Key</label>
            <input
              type="password"
              value={localKeys.geminiApiKey}
              onChange={(e) => setLocalKeys({ ...localKeys, geminiApiKey: e.target.value })}
              placeholder="AIzaSy..."
              className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:border-sky-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-0.5">Groq API Key</label>
            <input
              type="password"
              value={localKeys.groqApiKey}
              onChange={(e) => setLocalKeys({ ...localKeys, groqApiKey: e.target.value })}
              placeholder="gsk_..."
              className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:border-sky-600 focus:outline-none"
            />
          </div>
        </div>

        {/* SECTION 4: LOCAL MODEL SPECIFICATION */}
        <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 text-xs text-sky-950 space-y-1">
          <div className="flex items-center gap-1.5 font-bold">
            <Cpu className="w-4 h-4 text-sky-700" />
            <span>Local On-Device Engine Specification:</span>
          </div>
          <p className="text-[11px] text-sky-800 leading-relaxed">
            Running <strong>Gemma 2B Quantized (Q4_K_M)</strong> with on-device Whisper Tiny for speech-to-text. Designed to run comfortably on low-cost Android phones with 2GB-4GB RAM without overheating.
          </p>
        </div>

        {/* Modal Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 rounded-xl text-xs font-extrabold bg-sky-700 hover:bg-sky-800 text-white shadow transition"
          >
            Save Settings
          </button>
        </div>

      </div>
    </div>
  );
}
