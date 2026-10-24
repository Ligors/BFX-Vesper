import React, { useState } from 'react';
import { 
  FileCheck, 
  Upload, 
  AlertTriangle, 
  CheckCircle, 
  ShieldAlert, 
  Volume2, 
  VolumeX, 
  HelpCircle, 
  Cpu, 
  Sparkles,
  Camera,
  Layers,
  ArrowRight
} from 'lucide-react';
import { SAMPLE_SCREENSHOTS } from '../data/mockData';
import { analyzePaymentScreenshot } from '../utils/aiAnalysis';
import { speakText, stopSpeaking } from '../utils/speech';
import { getTranslation } from '../translations/languages';

export default function PaymentScreenshotAnalyzer({ 
  currentLang, 
  apiKeys 
}) {
  const [selectedSample, setSelectedSample] = useState(SAMPLE_SCREENSHOTS[0]);
  const [customImage, setCustomImage] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const t = (key) => getTranslation(currentLang, key);

  // Active image to inspect
  const activeImage = customImage || selectedSample.image;
  const activeName = customImage ? 'Uploaded Custom Screenshot' : selectedSample.name;

  // Run AI Inspection
  const handleInspect = async () => {
    setIsScanning(true);
    setAnalysisResult(null);

    // Short realistic scanning delay
    setTimeout(async () => {
      const result = await analyzePaymentScreenshot({
        imageSrc: activeImage,
        imageName: activeName,
        groqApiKey: apiKeys.groqApiKey,
        geminiApiKey: apiKeys.geminiApiKey,
        customNotes: selectedSample.subtitle
      });

      setAnalysisResult(result);
      setIsScanning(false);
    }, 1200);
  };

  // Handle custom file upload
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCustomImage(event.target.result);
        setAnalysisResult(null);
      };
      reader.readAsDataURL(file);
    }
  };

  // Senior Speech readout
  const handleToggleVoice = () => {
    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
    } else {
      if (!analysisResult) return;
      const speechScript = `Payment Analysis Result. Scam risk score is ${analysisResult.scamScore} percent. ${
        analysisResult.scamScore > 50 ? 'Warning: High risk fake payment detected.' : 'Transaction verified safe.'
      } ${analysisResult.seniorAdvice}`;
      speakText(speechScript, currentLang);
      setIsSpeaking(true);
    }
  };

  return (
    <div className="space-y-4">
      
      {/* Title Card */}
      <div className="bg-white p-3.5 rounded-2xl border-2 border-slate-200 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-sky-700" />
              {t('fakePaymentTitle')}
            </h2>
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
              {t('fakePaymentDesc')}
            </p>
          </div>
          
          <div className="text-[10px] font-bold bg-sky-50 text-sky-800 px-2 py-0.5 rounded-full border border-sky-300 shrink-0">
            {apiKeys.geminiApiKey ? 'Gemini 1.5' : (apiKeys.groqApiKey ? 'Groq Vision' : 'Local Gemma OCR')}
          </div>
        </div>
      </div>

      {/* Sample Selector Grid */}
      <div className="bg-white p-3.5 rounded-2xl border-2 border-slate-200 shadow-sm">
        <label className="text-xs font-bold text-slate-700 block mb-2 uppercase tracking-wider">
          {t('useSample')}
        </label>
        
        <div className="grid grid-cols-2 gap-2 mb-3">
          {SAMPLE_SCREENSHOTS.map((sample) => (
            <button
              key={sample.id}
              onClick={() => {
                setSelectedSample(sample);
                setCustomImage(null);
                setAnalysisResult(null);
              }}
              className={`p-2 rounded-xl text-left border-2 transition ${
                !customImage && selectedSample.id === sample.id
                  ? 'border-sky-600 bg-sky-50 shadow-sm'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-900 truncate">{sample.name}</span>
                <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                  sample.type === 'SAFE' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {sample.type}
                </span>
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">{sample.amount}</div>
            </button>
          ))}
        </div>

        {/* Upload Custom Screenshot option */}
        <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
          <label className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs border border-slate-300 cursor-pointer flex items-center justify-center gap-2 transition">
            <Upload className="w-3.5 h-3.5 text-slate-600" />
            <span>Upload Your Own Screenshot</span>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          {customImage && (
            <button
              onClick={() => {
                setCustomImage(null);
                setAnalysisResult(null);
              }}
              className="text-xs text-rose-700 font-bold px-2 py-1 underline"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Image Preview & OCR Scanning Visualizer */}
      <div className="bg-white p-3.5 rounded-2xl border-2 border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Camera className="w-3.5 h-3.5 text-sky-600" />
            <span>Receipt Preview Under Inspection</span>
          </span>
          <span className="text-[11px] font-mono text-slate-500">{activeName}</span>
        </div>

        {/* Display Container with Scanning Laser Animation */}
        <div className="relative rounded-xl overflow-hidden border-2 border-slate-300 bg-slate-100 max-h-72 flex items-center justify-center">
          <img
            src={activeImage}
            alt="Payment receipt to inspect"
            className="w-full object-contain max-h-72"
          />

          {/* Scanning Laser Line */}
          {isScanning && (
            <div className="absolute inset-0 bg-sky-500/10 flex flex-col justify-between">
              <div className="w-full h-1 bg-sky-500 shadow-[0_0_12px_#0284c7] animate-pulse"></div>
              <div className="bg-slate-900/80 text-white text-xs font-bold py-1.5 px-3 rounded-lg mx-auto mb-4 border border-sky-400 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-sky-300 animate-spin" />
                <span>AI OCR analyzing 12-digit UTR & Typography...</span>
              </div>
            </div>
          )}
        </div>

        {/* Action Button: Inspect Now */}
        <button
          onClick={handleInspect}
          disabled={isScanning}
          className="w-full py-3 px-4 rounded-xl bg-sky-700 hover:bg-sky-800 text-white font-extrabold text-sm shadow-md transition flex items-center justify-center gap-2 border-2 border-sky-800 active:scale-[0.98]"
        >
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>{isScanning ? 'Running OCR & Fraud Heuristics...' : t('analyzeBtn')}</span>
        </button>
      </div>

      {/* DETAILED RESULTS & TRANSPARENT DUAL SCORE EXPLANATION */}
      {analysisResult && (
        <div className="bg-white p-4 rounded-2xl border-2 border-slate-300 shadow-md space-y-4">
          
          {/* Header Verdict & Score Gauge */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded uppercase ${
                analysisResult.scamScore > 50 
                  ? 'bg-rose-100 text-rose-800 border border-rose-300' 
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
              }`}>
                {analysisResult.status === 'SAFE' ? t('safeVerdict') : t('dangerVerdict')}
              </span>
              <div className="text-sm font-black text-slate-900 mt-1">
                {analysisResult.appDetected || 'Payment Receipt'}
              </div>
            </div>

            {/* Score Pill */}
            <div className="text-right">
              <div className="text-xs font-bold text-slate-500">{t('riskScore')}</div>
              <div className={`text-2xl font-black ${
                analysisResult.scamScore > 50 ? 'text-rose-700' : 'text-emerald-700'
              }`}>
                {analysisResult.scamScore}%
              </div>
            </div>
          </div>

          {/* Visual Gauge Bar */}
          <div>
            <div className="flex justify-between text-[11px] font-bold text-slate-500 mb-1">
              <span>0% (Safe)</span>
              <span>50% (Caution)</span>
              <span>100% (Confirmed Mod APK)</span>
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

          {/* UTR & Transaction Data badge */}
          {analysisResult.utrFound && (
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700">Extracted UTR / Ref:</span>
              <span className="font-mono font-bold text-slate-900">{analysisResult.utrFound}</span>
            </div>
          )}

          {/* Spoken Voice Button for Seniors */}
          <button
            onClick={handleToggleVoice}
            className="w-full py-2.5 px-3 rounded-xl bg-sky-100 hover:bg-sky-200 text-sky-900 font-bold text-xs flex items-center justify-center gap-2 border border-sky-300 transition"
          >
            {isSpeaking ? <VolumeX className="w-4 h-4 text-sky-800" /> : <Volume2 className="w-4 h-4 text-sky-700" />}
            <span>{isSpeaking ? t('stopAudio') : t('listenAudio')}</span>
          </button>

          {/* SECTION A: WHY IT GAVE THIS SCAM PERCENTAGE */}
          <div className="bg-rose-50 border-2 border-rose-200 rounded-xl p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs font-black text-rose-900">
              <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
              <span>{t('whyScam')} ({analysisResult.scamScore}% Score Breakdown):</span>
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
              <CheckCircle className="w-4 h-4 text-emerald-700 shrink-0" />
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
