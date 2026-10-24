import React, { useState } from 'react';
import { 
  GraduationCap, 
  HelpCircle, 
  Award, 
  CheckCircle2, 
  XCircle, 
  Shield, 
  AlertTriangle, 
  Search, 
  Volume2, 
  VolumeX, 
  Sparkles,
  ArrowRight
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { SCAM_TRICKS_QUIZZES } from '../data/mockData';
import { speakText, stopSpeaking } from '../utils/speech';
import { getTranslation } from '../translations/languages';

const TRAI_HEADER_EXAMPLES = [
  { header: 'AD-SBIINB', entity: 'State Bank of India (Airtel Delhi)', isSafe: true, type: 'Official Banking' },
  { header: 'VM-HDFCBK', entity: 'HDFC Bank (Vodafone Mumbai)', isSafe: true, type: 'Official Banking' },
  { header: 'SG-GOVTIN', entity: 'Government of India Alert (S-prefix, G-Government)', isSafe: true, type: 'Government Official' },
  { header: 'JK-UIDAI', entity: 'Aadhaar / UIDAI (Jio Karnataka)', isSafe: true, type: 'Government Official' },
  { header: '+91 98765 43210', entity: 'Personal SIM Card (Impersonating Bank)', isSafe: false, type: 'FRAUD ALERT: Scammer Mobile' },
  { header: 'AD-ZOMATO', entity: 'Zomato Food Delivery (Promotional)', isSafe: true, type: 'Verified Merchant' }
];

export default function ScamTricks({ currentLang }) {
  const [activeTabSection, setActiveTabSection] = useState('quiz'); // 'quiz' or 'headers'
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(null);
  const [quizScore, setQuizScore] = useState(0);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Header decoder tester state
  const [searchHeader, setSearchHeader] = useState('SG-GOVTIN');

  const t = (key) => getTranslation(currentLang, key);
  const currentQuiz = SCAM_TRICKS_QUIZZES[currentQuizIndex];

  // Handle option selection in trial
  const handleSelectOption = (idx) => {
    if (hasAnswered) return;
    setSelectedOptionIndex(idx);
    setHasAnswered(true);

    const chosen = currentQuiz.options[idx];
    if (chosen.isCorrect) {
      setQuizScore(prev => prev + 1);
      // Trigger festive confetti for elder encouragement
      try {
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (e) {
        // fallback
      }
    }
  };

  const handleNextQuiz = () => {
    setSelectedOptionIndex(null);
    setHasAnswered(false);
    stopSpeaking();
    setIsSpeaking(false);
    setCurrentQuizIndex((prev) => (prev + 1) % SCAM_TRICKS_QUIZZES.length);
  };

  // Decode TRAI Header logic
  const decodeHeader = (inputHeader) => {
    const clean = inputHeader.trim().toUpperCase();
    if (/^(\+91|91)?[6-9]\d{9}$/.test(clean.replace(/[\s-]/g, ''))) {
      return {
        isSafe: false,
        summary: 'CRITICAL WARNING: Personal 10-Digit Mobile Number',
        explanation: 'Banks and government departments NEVER send official alerts from a private 10-digit phone number. Any message claiming to be SBI, HDFC, Electricity board, or Police from a personal phone is 100% FRAUD!'
      };
    }

    if (clean.includes('-')) {
      const parts = clean.split('-');
      const prefix = parts[0];
      const name = parts[1] || '';

      const operatorMap = { A: 'Airtel', V: 'Vodafone Idea', J: 'Reliance Jio', B: 'BSNL', M: 'MTNL', S: 'SMS Gateway / Smart' };
      const circleMap = { D: 'Delhi', M: 'Mumbai', K: 'Karnataka', T: 'Tamil Nadu', A: 'Andhra Pradesh', W: 'West Bengal', G: 'Gujarat', P: 'Punjab' };

      const op = operatorMap[prefix[0]] || 'Telecom Operator';
      const circle = circleMap[prefix[1]] || 'Indian Telecom Circle';

      const isGovt = name.endsWith('G') || prefix.endsWith('G') || name.includes('GOV');
      const isPromo = prefix.endsWith('S');

      return {
        isSafe: true,
        summary: `Authorized TRAI Sender Header (${op} in ${circle})`,
        explanation: `Registered telecom routing: ${op} (${prefix[0]}) operating in ${circle} (${prefix[1]}). ${
          isGovt ? 'Ends with "G" indicating an authorized Government department.' : 'Standard 6-character registered entity format.'
        }`
      };
    }

    return {
      isSafe: false,
      summary: 'Unverified Non-Standard Header',
      explanation: 'This sender ID does not adhere to the standard TRAI 6-character format. Exercise extreme caution.'
    };
  };

  const headerAnalysis = decodeHeader(searchHeader);

  return (
    <div className="space-y-4">
      
      {/* Header Banner */}
      <div className="bg-white p-3.5 rounded-2xl border-2 border-slate-200 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-amber-600" />
              {t('scamTricksTitle')}
            </h2>
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
              {t('scamTricksDesc')}
            </p>
          </div>

          <div className="text-xs font-black bg-amber-100 text-amber-900 px-2.5 py-1 rounded-full border border-amber-300">
            Score: {quizScore} / {SCAM_TRICKS_QUIZZES.length}
          </div>
        </div>

        {/* Tab switchers */}
        <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-slate-100">
          <button
            onClick={() => setActiveTabSection('quiz')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              activeTabSection === 'quiz'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Interactive Safety Trials</span>
          </button>

          <button
            onClick={() => setActiveTabSection('headers')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              activeTabSection === 'headers'
                ? 'bg-sky-700 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>TRAI SMS Header Decoder</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: INTERACTIVE SAFETY TRIALS (PRACTICE QUIZZES) */}
      {activeTabSection === 'quiz' && (
        <div className="bg-white p-4 rounded-2xl border-2 border-slate-300 shadow-md space-y-4">
          
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Trial Scenario {currentQuizIndex + 1} of {SCAM_TRICKS_QUIZZES.length}
            </span>
            <span className="text-[11px] font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
              Sender: {currentQuiz.senderHeader}
            </span>
          </div>

          {/* Scenario Text Card */}
          <div className="bg-slate-50 p-3.5 rounded-xl border-2 border-slate-200 text-xs text-slate-800 leading-relaxed font-semibold whitespace-pre-line">
            {currentQuiz.scenario}
          </div>

          {/* Action Question */}
          <div className="text-xs font-black text-slate-900 uppercase tracking-wide">
            Elder Decision: What will you do?
          </div>

          {/* Options */}
          <div className="space-y-2">
            {currentQuiz.options.map((opt, idx) => {
              const isSelected = selectedOptionIndex === idx;
              let btnClass = "border-slate-200 bg-white text-slate-800 hover:bg-slate-50";

              if (hasAnswered) {
                if (opt.isCorrect) {
                  btnClass = "border-emerald-600 bg-emerald-50 text-emerald-950 font-bold shadow-sm";
                } else if (isSelected && !opt.isCorrect) {
                  btnClass = "border-rose-600 bg-rose-50 text-rose-950 font-bold";
                }
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleSelectOption(idx)}
                  disabled={hasAnswered}
                  className={`w-full p-3 rounded-xl border-2 text-left transition flex items-start gap-2.5 text-xs ${btnClass}`}
                >
                  <span className="w-5 h-5 rounded-full border border-slate-400 flex items-center justify-center shrink-0 font-bold text-[10px] mt-0.5">
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className="leading-snug">{opt.text}</span>
                </button>
              );
            })}
          </div>

          {/* FEEDBACK AFTER ANSWER */}
          {hasAnswered && (
            <div className={`p-3.5 rounded-xl border-2 space-y-2.5 ${
              currentQuiz.options[selectedOptionIndex]?.isCorrect
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                : 'bg-rose-50 border-rose-300 text-rose-950'
            }`}>
              <div className="flex items-center gap-2 font-black text-xs">
                {currentQuiz.options[selectedOptionIndex]?.isCorrect ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                    <span>CORRECT DEFENSE! Excellent judgment!</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-rose-700" />
                    <span>SCAM TRAP! Be very careful!</span>
                  </>
                )}
              </div>

              <p className="text-xs font-medium leading-relaxed">
                {currentQuiz.options[selectedOptionIndex]?.feedback}
              </p>

              {/* Next Trial Button */}
              <button
                onClick={handleNextQuiz}
                className="w-full mt-2 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition"
              >
                <span>Next Safety Scenario</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

        </div>
      )}

      {/* SECTION 2: INDIAN TRAI TELECOM HEADER DECODER */}
      {activeTabSection === 'headers' && (
        <div className="bg-white p-4 rounded-2xl border-2 border-slate-300 shadow-md space-y-4">
          
          <div className="space-y-1">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide">
              How Indian SMS Headers Work (TRAI Standard):
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Every genuine SMS in India starts with a 2-letter prefix followed by a registered 6-letter name:
            </p>
          </div>

          {/* Interactive Guide Visual */}
          <div className="bg-sky-50 border-2 border-sky-200 rounded-xl p-3 text-xs space-y-2">
            <div className="flex items-center justify-center gap-1 font-mono font-black text-base text-sky-950">
              <span className="bg-white px-2 py-1 rounded border border-sky-300 text-sky-700">A</span>
              <span className="bg-white px-2 py-1 rounded border border-sky-300 text-sky-700">D</span>
              <span className="text-slate-400">-</span>
              <span className="bg-white px-2 py-1 rounded border border-sky-300 text-emerald-700">HDFCBK</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-[10px] text-slate-600 font-semibold">
              <div className="bg-white p-1 rounded border border-sky-100">
                <strong>1st Letter:</strong> Telecom (A = Airtel)
              </div>
              <div className="bg-white p-1 rounded border border-sky-100">
                <strong>2nd Letter:</strong> Circle (D = Delhi)
              </div>
              <div className="bg-white p-1 rounded border border-sky-100">
                <strong>Header:</strong> Registered Bank Name
              </div>
            </div>

            <div className="text-[11px] text-slate-700 bg-white p-2 rounded-lg border border-sky-200 leading-tight">
              💡 <strong>Government Messages (Ending in G):</strong> e.g., <code>SG-GOVTIN</code> (S = Smart/Promotional, G = Government).
            </div>
          </div>

          {/* Test Any Header Tool */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 block uppercase tracking-wide">
              Inspect Any SMS Header / Phone Number:
            </label>

            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={searchHeader}
                onChange={(e) => setSearchHeader(e.target.value)}
                placeholder="e.g. AD-SBIINB or +91 98450 12345"
                className="flex-1 px-3 py-2 text-xs font-mono font-bold bg-slate-50 border-2 border-slate-300 rounded-xl focus:border-sky-600 focus:outline-none"
              />
            </div>

            {/* Quick preset pills */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {TRAI_HEADER_EXAMPLES.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => setSearchHeader(item.header)}
                  className={`px-2 py-1 rounded text-[10px] font-bold border transition ${
                    searchHeader === item.header
                      ? 'bg-sky-100 border-sky-600 text-sky-950 font-black'
                      : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {item.header}
                </button>
              ))}
            </div>
          </div>

          {/* Analysis Card */}
          <div className={`p-3.5 rounded-xl border-2 space-y-1.5 ${
            headerAnalysis.isSafe
              ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
              : 'bg-rose-50 border-rose-300 text-rose-950'
          }`}>
            <div className="flex items-center gap-2 font-black text-xs">
              {headerAnalysis.isSafe ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-700" />
              )}
              <span>{headerAnalysis.summary}</span>
            </div>

            <p className="text-xs font-medium leading-relaxed">
              {headerAnalysis.explanation}
            </p>
          </div>

        </div>
      )}

    </div>
  );
}
