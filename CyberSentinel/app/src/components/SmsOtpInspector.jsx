import React, { useState } from 'react';
import { 
  Smartphone, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  HelpCircle, 
  Volume2, 
  VolumeX, 
  RotateCcw,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { SAMPLE_SMS_MESSAGES } from '../data/mockData';
import { analyzeSmsMessage } from '../utils/aiAnalysis';
import { speakText, stopSpeaking } from '../utils/speech';
import { getTranslation } from '../translations/languages';

export default function SmsOtpInspector({ currentLang, apiKeys }) {
  const [selectedTemplate, setSelectedTemplate] = useState(SAMPLE_SMS_MESSAGES[0]);
  const [senderInput, setSenderInput] = useState(SAMPLE_SMS_MESSAGES[0].header);
  const [textInput, setTextInput] = useState(SAMPLE_SMS_MESSAGES[0].text);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const t = (key) => getTranslation(currentLang, key);

  // Pick template
  const handleSelectTemplate = (template) => {
    setSelectedTemplate(template);
    setSenderInput(template.header);
    setTextInput(template.text);
    setAnalysisResult(null);
  };

  // Inspect SMS
  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setAnalysisResult(null);

    setTimeout(async () => {
      const result = await analyzeSmsMessage({
        messageText: textInput,
        senderHeader: senderInput,
        groqApiKey: apiKeys.groqApiKey,
        geminiApiKey: apiKeys.geminiApiKey
      });

      setAnalysisResult(result);
      setIsAnalyzing(false);
    }, 800);
  };

  // Senior Speech readout
  const handleToggleVoice = () => {
    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
    } else {
      if (!analysisResult) return;
      const speechScript = `SMS Inspection Result. Scam risk score is ${analysisResult.scamScore} percent. ${
        analysisResult.scamScore > 50 ? 'Warning: High risk scam SMS detected.' : 'Message appears safe.'
      } ${analysisResult.seniorAdvice}`;
      speakText(speechScript, currentLang);
      setIsSpeaking(true);
    }
  };

  return (
    <div className="space-y-4">
      
      {/* Title */}
      <div className="bg-white p-3.5 rounded-2xl border-2 border-slate-200 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-sky-700" />
              {t('smsScanTitle')}
            </h2>
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
              {t('smsScanDesc')}
            </p>
          </div>
          <span className="text-[10px] font-bold bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full border border-sky-300 shrink-0">
            NLP Fraud Filter
          </span>
        </div>
      </div>

      {/* Preset Indian Scam SMS Templates */}
      <div className="bg-white p-3.5 rounded-2xl border-2 border-slate-200 shadow-sm">
        <label className="text-xs font-bold text-slate-700 block mb-2 uppercase tracking-wider">
          Pick Real Indian SMS Template:
        </label>
        
        <div className="grid grid-cols-1 gap-1.5 mb-3">
          {SAMPLE_SMS_MESSAGES.map((msg) => (
            <button
              key={msg.id}
              onClick={() => handleSelectTemplate(msg)}
              className={`p-2 rounded-xl text-left border-2 transition flex items-center justify-between ${
                selectedTemplate.id === msg.id && textInput === msg.text
                  ? 'border-sky-600 bg-sky-50 shadow-sm'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div className="truncate pr-2">
                <span className="font-bold text-xs text-slate-900 block truncate">{msg.title}</span>
                <span className="text-[10px] text-slate-500 font-mono">{msg.header}</span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${
                msg.expectedScore < 30 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}>
                {msg.expectedScore < 30 ? 'Safe Sample' : 'Scam Sample'}
              </span>
            </button>
          ))}
        </div>

        {/* Sender & Text Area Input */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-1">
              Sender Header / Phone Number:
            </label>
            <input
              type="text"
              value={senderInput}
              onChange={(e) => setSenderInput(e.target.value)}
              placeholder="e.g. +91 98450 12345 or AD-HDFCBK"
              className="w-full px-3 py-1.5 text-xs font-mono font-bold bg-slate-50 border-2 border-slate-300 rounded-lg focus:border-sky-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-1">
              SMS Message Text Content:
            </label>
            <textarea
              rows={3}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Paste suspicious SMS text here..."
              className="w-full p-2.5 text-xs bg-slate-50 border-2 border-slate-300 rounded-lg focus:border-sky-600 focus:outline-none font-medium text-slate-800 leading-relaxed"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                setTextInput('');
                setSenderInput('');
                setAnalysisResult(null);
              }}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-300"
            >
              {t('clearBtn')}
            </button>

            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !textInput.trim()}
              className="flex-1 py-2.5 px-4 rounded-xl bg-sky-700 hover:bg-sky-800 text-white font-extrabold text-xs shadow-md transition flex items-center justify-center gap-2 border-2 border-sky-900 active:scale-[0.98]"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>{isAnalyzing ? 'Analyzing Urgent Phrases & Links...' : t('analyzeBtn')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* DETAILED RESULTS & DUAL SCORE BREAKDOWN */}
      {analysisResult && (
        <div className="bg-white p-4 rounded-2xl border-2 border-slate-300 shadow-md space-y-4">
          
          {/* Header Verdict & Score */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded uppercase ${
                analysisResult.scamScore > 50 
                  ? 'bg-rose-100 text-rose-800 border border-rose-300' 
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
              }`}>
                {analysisResult.status}
              </span>
              <div className="text-xs font-bold text-slate-600 mt-1">
                Sender Classification: <strong>{analysisResult.senderType}</strong>
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs font-bold text-slate-500">{t('riskScore')}</div>
              <div className={`text-2xl font-black ${
                analysisResult.scamScore > 50 ? 'text-rose-700' : 'text-emerald-700'
              }`}>
                {analysisResult.scamScore}%
              </div>
            </div>
          </div>

          {/* Visual Meter */}
          <div>
            <div className="flex justify-between text-[11px] font-bold text-slate-500 mb-1">
              <span>0% (Safe)</span>
              <span>50% (Suspicious)</span>
              <span>100% (Confirmed Scam)</span>
            </div>
            <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden flex">
              <div
                className={`h-full transition-all duration-700 ${
                  analysisResult.scamScore > 50 ? 'bg-rose-600' : 'bg-emerald-600'
                }`}
                style={{ width: `${analysisResult.scamScore}%` }}
              ></div>
            </div>
          </div>

          {/* Voice button */}
          <button
            onClick={handleToggleVoice}
            className="w-full py-2.5 px-3 rounded-xl bg-sky-100 hover:bg-sky-200 text-sky-900 font-bold text-xs flex items-center justify-center gap-2 border border-sky-300 transition"
          >
            {isSpeaking ? <VolumeX className="w-4 h-4 text-sky-800" /> : <Volume2 className="w-4 h-4 text-sky-700" />}
            <span>{isSpeaking ? t('stopAudio') : t('listenAudio')}</span>
          </button>

          {/* SECTION A: WHY IT GAVE THIS SCAM SCORE */}
          <div className="bg-rose-50 border-2 border-rose-200 rounded-xl p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs font-black text-rose-900">
              <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
              <span>{t('whyScam')} ({analysisResult.scamScore}% Flagged):</span>
            </div>

            <ul className="space-y-1.5 pl-1">
              {analysisResult.whyScam?.map((reason, idx) => (
                <li key={idx} className="text-xs text-rose-900 font-medium leading-relaxed flex items-start gap-1.5">
                  <span className="text-rose-600 font-bold mt-0.5">•</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* SECTION B: WHY IT DID NOT GIVE THE REMAINING PERCENTAGE */}
          <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs font-black text-slate-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{t('whySafe')} ({100 - analysisResult.scamScore}% Remaining):</span>
            </div>

            <ul className="space-y-1.5 pl-1">
              {analysisResult.whySafe?.map((reason, idx) => (
                <li key={idx} className="text-xs text-slate-700 font-medium leading-relaxed flex items-start gap-1.5">
                  <span className="text-emerald-600 font-bold mt-0.5">✓</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* SECTION C: SENIOR CITIZEN ADVICE */}
          <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-3">
            <div className="text-xs font-black text-amber-950 mb-1 flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-amber-700" />
              <span>{t('recommendedAction')}</span>
            </div>
            <p className="text-xs text-amber-900 font-semibold leading-relaxed">
              {analysisResult.seniorAdvice}
            </p>
          </div>

        </div>
      )}

    </div>
  );
}
