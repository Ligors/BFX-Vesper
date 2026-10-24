import React, { useState, useEffect } from 'react';
import { 
  PhoneCall, 
  PhoneOff, 
  ShieldAlert, 
  Lock, 
  Unlock, 
  Send, 
  MapPin, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Cpu, 
  Mic, 
  Volume2, 
  VolumeX, 
  Smartphone,
  ExternalLink,
  Info
} from 'lucide-react';
import { CALL_SCENARIOS } from '../data/mockData';
import { sendTelegramGuardianAlert } from '../utils/telegram';
import { speakText, stopSpeaking } from '../utils/speech';
import { getTranslation } from '../translations/languages';

export default function CallGuardian({ 
  currentLang, 
  guardianConfig, 
  isAppLocked, 
  setIsAppLocked,
  lastIncidentReport,
  setLastIncidentReport
}) {
  const [selectedScenarioId, setSelectedScenarioId] = useState(CALL_SCENARIOS[0].id);
  const [callState, setCallState] = useState('idle'); // idle, ringing, active, auto_hungup
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [threatScore, setThreatScore] = useState(0);
  const [detectedTriggers, setDetectedTriggers] = useState([]);
  const [isSpeakingAudio, setIsSpeakingAudio] = useState(false);

  // Guardian unlock form states
  const [unlockPasscode, setUnlockPasscode] = useState('');
  const [unlockPassphrase, setUnlockPassphrase] = useState('');
  const [unlockError, setUnlockError] = useState('');

  const activeScenario = CALL_SCENARIOS.find(s => s.id === selectedScenarioId) || CALL_SCENARIOS[0];
  const t = (key) => getTranslation(currentLang, key);

  // Handle incoming call simulation
  const handleStartCall = () => {
    setCallState('ringing');
    setCurrentLineIndex(0);
    setThreatScore(10);
    setDetectedTriggers([]);
  };

  const handleAcceptCall = () => {
    setCallState('active');
    setCurrentLineIndex(0);
  };

  const handleManualReject = () => {
    setCallState('idle');
    stopSpeaking();
    setIsSpeakingAudio(false);
  };

  // Conversation progression simulation
  useEffect(() => {
    let timer;
    if (callState === 'active') {
      if (currentLineIndex < activeScenario.phrases.length) {
        timer = setTimeout(() => {
          const phrase = activeScenario.phrases[currentLineIndex];
          
          // Check for trigger words
          const triggers = activeScenario.triggerWords.filter(tw => 
            phrase.toLowerCase().includes(tw.toLowerCase())
          );

          if (triggers.length > 0) {
            setDetectedTriggers(prev => [...new Set([...prev, ...triggers])]);
            // Escalate threat score
            const newScore = Math.min(10 + (currentLineIndex + 1) * 22, 98);
            setThreatScore(newScore);

            // Auto-Hangup Threshold reached (e.g. >= 75%)
            if (newScore >= 75) {
              triggerAutoHangup(phrase, newScore);
              return;
            }
          }

          setCurrentLineIndex(prev => prev + 1);
        }, 3200);
      } else {
        // Safe call ends normally
        if (activeScenario.riskLevel === 'SAFE') {
          setTimeout(() => {
            setCallState('idle');
          }, 2000);
        }
      }
    }
    return () => clearTimeout(timer);
  }, [callState, currentLineIndex, activeScenario]);

  // AI Auto-Hangup & Emergency Lockdown Execution
  const triggerAutoHangup = async (triggeringPhrase, finalScore) => {
    setCallState('auto_hungup');
    setIsAppLocked(true);

    const incidentData = {
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      callerName: activeScenario.callerName,
      callerNumber: activeScenario.callerNumber,
      category: activeScenario.threatCategory,
      scamScore: finalScore,
      triggerTranscript: triggeringPhrase,
      allTriggers: [...detectedTriggers, 'urgent OTP demanded', 'immediate payment coercion'],
      location: 'Indiranagar 100ft Road, Bengaluru, Karnataka (12.9716° N, 77.5946° E)',
      lockedApps: ['Google Pay', 'PhonePe', 'Paytm', 'SBI YONO', 'SMS Messages', 'Google Chrome']
    };

    setLastIncidentReport(incidentData);

    // Dispatch Guardian Telegram Alert
    await sendTelegramGuardianAlert({
      botToken: guardianConfig.telegramBotToken,
      chatId: guardianConfig.telegramChatId,
      victimName: guardianConfig.guardianName ? `Senior User (Guardian: ${guardianConfig.guardianName})` : 'Senior User (Dad)',
      incidentType: activeScenario.threatCategory,
      scamScore: finalScore,
      callerNumber: activeScenario.callerNumber,
      transcript: triggeringPhrase,
      location: incidentData.location,
      lockedApps: incidentData.lockedApps
    });

    // Speak audio warning for elder
    speakText(
      `Warning! CyberSentinel on-device AI intercepted a scam call and hung up automatically. Your payment apps are safely locked. Your guardian has been alerted. Do not worry.`,
      currentLang
    );
  };

  // Guardian Unlock Handler
  const handleGuardianUnlock = (e) => {
    e.preventDefault();
    setUnlockError('');

    const expectedPasscode = guardianConfig.passcode || '9442';
    const expectedPassphrase = (guardianConfig.passphrase || 'KAVACH-SHIELD-2026').trim().toLowerCase();

    if (unlockPasscode.trim() !== expectedPasscode) {
      setUnlockError('Invalid Guardian Passcode. Please check and re-enter.');
      return;
    }

    if (unlockPassphrase.trim().toLowerCase() !== expectedPassphrase) {
      setUnlockError('Invalid Guardian Passphrase. Case-insensitive phrase does not match.');
      return;
    }

    // Success unlock!
    setIsAppLocked(false);
    setUnlockPasscode('');
    setUnlockPassphrase('');
    setCallState('idle');
  };

  return (
    <div className="space-y-4">

      {/* Screen Title & Header */}
      <div className="bg-white p-3.5 rounded-2xl border-2 border-slate-200 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-sky-700" />
              {t('callInterceptorTitle')}
            </h2>
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
              {t('callInterceptorDesc')}
            </p>
          </div>
          <span className="text-[10px] font-bold bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full border border-sky-300 shrink-0">
            Gemma 2B On-Device
          </span>
        </div>
      </div>

      {/* Scenario Picker for Demo */}
      <div className="bg-white p-3.5 rounded-2xl border-2 border-slate-200 shadow-sm">
        <label className="text-xs font-bold text-slate-700 block mb-2 uppercase tracking-wider">
          Select Live Simulation Scenario:
        </label>
        <div className="grid grid-cols-1 gap-2">
          {CALL_SCENARIOS.map((scen) => (
            <button
              key={scen.id}
              onClick={() => {
                setSelectedScenarioId(scen.id);
                setCallState('idle');
              }}
              disabled={callState === 'active' || isAppLocked}
              className={`p-2.5 rounded-xl text-left border-2 transition flex items-center justify-between ${
                selectedScenarioId === scen.id 
                  ? 'border-sky-600 bg-sky-50 shadow-sm' 
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div>
                <div className="font-bold text-xs text-slate-900">{scen.callerName}</div>
                <div className="text-[11px] text-slate-500 font-mono">{scen.callerNumber} • {scen.threatCategory}</div>
              </div>
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded ${
                scen.riskLevel === 'SAFE' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}>
                {scen.riskLevel}
              </span>
            </button>
          ))}
        </div>

        {/* Start Simulation Button */}
        {callState === 'idle' && !isAppLocked && (
          <button
            onClick={handleStartCall}
            className="w-full mt-3 py-3 px-4 rounded-xl bg-sky-700 hover:bg-sky-800 text-white font-bold text-sm shadow-md transition flex items-center justify-center gap-2 border-2 border-sky-800 active:scale-[0.98]"
          >
            <PhoneCall className="w-4 h-4 text-emerald-300" />
            <span>Simulate Incoming Call Now</span>
          </button>
        )}
      </div>

      {/* STATE 1: RINGING INCOMING CALL SCREEN */}
      {callState === 'ringing' && (
        <div className="bg-slate-900 text-white p-5 rounded-2xl border-4 border-amber-500 shadow-2xl animate-pulse">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center animate-bounce">
              <PhoneCall className="w-8 h-8 text-amber-300" />
            </div>
            <div className="text-xs uppercase tracking-widest text-amber-300 font-bold">Incoming Call</div>
            <div className="text-lg font-black text-white">{activeScenario.callerName}</div>
            <div className="text-sm font-mono text-slate-300">{activeScenario.callerNumber}</div>
            <div className="text-[11px] bg-slate-800 text-sky-300 py-1 px-3 rounded-full inline-block border border-slate-700">
              ⚡ Local On-Device Gemma 2B AI Model Ready
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-5">
            <button
              onClick={handleManualReject}
              className="py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm flex items-center justify-center gap-2 border-2 border-rose-800"
            >
              <PhoneOff className="w-5 h-5" />
              <span>Decline</span>
            </button>
            <button
              onClick={handleAcceptCall}
              className="py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 border-2 border-emerald-800 shadow-lg"
            >
              <PhoneCall className="w-5 h-5" />
              <span>Answer Call</span>
            </button>
          </div>
        </div>
      )}

      {/* STATE 2: ACTIVE CALL WITH REAL-TIME LOCAL AI TRANSCRIPTION */}
      {callState === 'active' && (
        <div className="bg-slate-900 text-white p-4 rounded-2xl border-2 border-sky-600 shadow-xl space-y-3">
          
          {/* Caller info header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div>
              <div className="text-xs text-sky-400 font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>Call Active • On-Device AI Listening</span>
              </div>
              <div className="font-extrabold text-sm text-white">{activeScenario.callerName}</div>
            </div>
            
            <button
              onClick={handleManualReject}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center gap-1"
            >
              <PhoneOff className="w-3.5 h-3.5" />
              <span>End</span>
            </button>
          </div>

          {/* Neural NPU Status */}
          <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <Cpu className="w-4 h-4 text-sky-400" />
              <span>Gemma 2B Quantized (RAM: 380MB)</span>
            </div>
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
              0% Cloud Leak
            </span>
          </div>

          {/* Audio Waveform Animation */}
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-center gap-1.5 h-14">
            <div className="w-1.5 bg-sky-400 rounded-full animate-voice-1"></div>
            <div className="w-1.5 bg-sky-500 rounded-full animate-voice-2"></div>
            <div className="w-1.5 bg-emerald-400 rounded-full animate-voice-3"></div>
            <div className="w-1.5 bg-amber-400 rounded-full animate-voice-4"></div>
            <div className="w-1.5 bg-rose-400 rounded-full animate-voice-5"></div>
            <div className="w-1.5 bg-sky-400 rounded-full animate-voice-2"></div>
            <div className="w-1.5 bg-sky-500 rounded-full animate-voice-1"></div>
          </div>

          {/* Live Transcript Stream */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Mic className="w-3.5 h-3.5 text-sky-400" />
              <span>Live Speech Transcription (On-Device ASR):</span>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs font-mono text-slate-200 min-h-[60px] leading-relaxed">
              {activeScenario.phrases.slice(0, currentLineIndex + 1).map((line, idx) => (
                <p key={idx} className={idx === currentLineIndex ? 'text-amber-300 font-bold' : 'text-slate-400'}>
                  {line}
                </p>
              ))}
            </div>
          </div>

          {/* Threat Meter */}
          <div>
            <div className="flex items-center justify-between text-xs font-bold mb-1">
              <span className="text-slate-300">Coercion Threat Meter:</span>
              <span className={threatScore >= 75 ? 'text-rose-400' : (threatScore >= 40 ? 'text-amber-400' : 'text-emerald-400')}>
                {threatScore}% RISK
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
              <div 
                className={`h-full transition-all duration-500 ${
                  threatScore >= 75 ? 'bg-rose-500' : (threatScore >= 40 ? 'bg-amber-500' : 'bg-emerald-500')
                }`}
                style={{ width: `${threatScore}%` }}
              ></div>
            </div>
          </div>

          {/* Detected red-flag badges */}
          {detectedTriggers.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {detectedTriggers.map((trig, idx) => (
                <span key={idx} className="bg-rose-950 text-rose-300 text-[10px] font-bold px-2 py-0.5 rounded border border-rose-800 flex items-center gap-1">
                  <AlertTriangle className="w-2.5 h-2.5" />
                  {trig}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* STATE 3: EMERGENCY LOCKDOWN ACTIVE SCREEN */}
      {isAppLocked && (
        <div className="bg-rose-50 border-4 border-rose-600 rounded-2xl p-4 shadow-xl space-y-4">
          
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-md">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold bg-rose-200 text-rose-900 px-2 py-0.5 rounded uppercase">
                Emergency Lockdown Triggered
              </span>
              <h3 className="text-base font-extrabold text-rose-900 mt-1 leading-snug">
                {t('hangupAlert')}
              </h3>
              <p className="text-xs text-rose-800 mt-1 font-medium">
                {t('guardianLockedAlert')}
              </p>
            </div>
          </div>

          {/* Spoken Audio Readout Button */}
          <button
            onClick={() => {
              if (isSpeakingAudio) {
                stopSpeaking();
                setIsSpeakingAudio(false);
              } else {
                speakText(
                  `Attention: CyberSentinel has blocked your phone apps to protect your bank balance. A scammer attempted to steal your OTP. We have sent a complete alert to your guardian with your location. Please hand this phone to your guardian to unlock.`,
                  currentLang
                );
                setIsSpeakingAudio(true);
              }
            }}
            className="w-full py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition"
          >
            {isSpeakingAudio ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-rose-200" />}
            <span>{isSpeakingAudio ? t('stopAudio') : t('listenAudio')}</span>
          </button>

          {/* Blocked Apps Grid */}
          <div className="bg-white p-3 rounded-xl border-2 border-rose-200">
            <div className="text-xs font-bold text-rose-950 mb-2 uppercase tracking-wide">
              Isolated Sensitive Applications:
            </div>
            <div className="grid grid-cols-3 gap-2">
              {['PhonePe', 'Google Pay', 'Paytm UPI', 'SBI YONO', 'Messages (SMS)', 'Chrome Browser'].map((app, idx) => (
                <div key={idx} className="bg-rose-100/60 border border-rose-300 rounded-lg p-2 text-center">
                  <Lock className="w-4 h-4 text-rose-700 mx-auto mb-1" />
                  <span className="text-[11px] font-bold text-rose-900 block truncate">{app}</span>
                  <span className="text-[9px] text-rose-700 font-semibold uppercase">LOCKED</span>
                </div>
              ))}
            </div>
          </div>

          {/* Telegram Dispatch Confirmation Pill */}
          <div className="bg-sky-50 border-2 border-sky-300 p-3 rounded-xl flex items-start gap-2.5">
            <Send className="w-5 h-5 text-sky-700 shrink-0 mt-0.5" />
            <div className="text-xs">
              <div className="font-extrabold text-sky-950">{t('telegramSentBadge')}</div>
              <div className="text-sky-800 text-[11px] mt-0.5">
                Sent to: <strong>{guardianConfig.guardianName || 'Guardian'}</strong> ({guardianConfig.guardianPhone || '+91 94440 12345'})
              </div>
              <div className="text-sky-700 text-[10px] mt-0.5 font-mono">
                📍 Location: Indiranagar, Bengaluru • Time: {new Date().toLocaleTimeString()}
              </div>
            </div>
          </div>

          {/* Guardian Unlock Form */}
          <div className="bg-white p-3.5 rounded-xl border-2 border-slate-300 shadow-sm">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900 mb-2">
              <Unlock className="w-4 h-4 text-emerald-700" />
              <span>{t('guardianUnlockBtn')}</span>
            </div>

            <form onSubmit={handleGuardianUnlock} className="space-y-2.5">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  1. {t('passcodeLabel')} (Default: 9442)
                </label>
                <input
                  type="password"
                  maxLength={6}
                  placeholder="Enter 4 or 6-digit passcode"
                  value={unlockPasscode}
                  onChange={(e) => setUnlockPasscode(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg text-sm font-mono font-bold focus:border-sky-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  2. {t('passphraseLabel')} (Default: KAVACH-SHIELD-2026)
                </label>
                <input
                  type="text"
                  placeholder="Enter guardian passphrase"
                  value={unlockPassphrase}
                  onChange={(e) => setUnlockPassphrase(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg text-xs font-bold focus:border-sky-600 focus:outline-none"
                />
              </div>

              {unlockError && (
                <div className="text-xs font-bold text-rose-700 bg-rose-50 p-2 rounded-lg border border-rose-200">
                  {unlockError}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-sm shadow-md transition flex items-center justify-center gap-2 border-2 border-emerald-900"
              >
                <Unlock className="w-4 h-4" />
                <span>Verify & Restore Device Access</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* STATE 4: POST-INCIDENT FORENSIC AUDIT REPORT (When Unlocked) */}
      {!isAppLocked && lastIncidentReport && (
        <div className="bg-white border-2 border-slate-300 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{t('unlockSuccess')}</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">{lastIncidentReport.timestamp}</span>
          </div>

          <div className="text-xs space-y-2">
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <div className="font-bold text-slate-900">Why did CyberSentinel block the phone?</div>
              <p className="text-slate-700 mt-1 leading-relaxed">
                The caller (<strong>{lastIncidentReport.callerNumber}</strong>) attempted to coerce an immediate money transfer and requested a 6-digit OTP under threat of <em>"{lastIncidentReport.category}"</em>.
              </p>
            </div>

            <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200">
              <div className="font-bold text-amber-900">Coercion Triggers Detected:</div>
              <div className="flex flex-wrap gap-1 mt-1">
                {lastIncidentReport.allTriggers.map((trig, idx) => (
                  <span key={idx} className="bg-amber-200/80 text-amber-950 text-[10px] font-bold px-2 py-0.5 rounded">
                    {trig}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <a
                href="tel:1930"
                className="text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg border border-rose-300 flex items-center gap-1.5 transition"
              >
                <PhoneCall className="w-3.5 h-3.5 text-rose-600" />
                <span>Call Cyber Helpline (1930)</span>
              </a>

              <a
                href="https://cybercrime.gov.in"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 px-3 py-1.5 rounded-lg border border-sky-300 flex items-center gap-1.5 transition"
              >
                <span>Report Incident</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
