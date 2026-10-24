import React, { useState } from 'react';
import { 
  ShieldAlert, 
  Settings, 
  Volume2, 
  VolumeX, 
  Smartphone, 
  Maximize2, 
  Minimize2, 
  Globe, 
  Type, 
  Cpu, 
  Users,
  AlertOctagon
} from 'lucide-react';
import { SUPPORTED_LANGUAGES, getTranslation } from '../translations/languages';
import { stopSpeaking } from '../utils/speech';

export default function AndroidFrame({
  children,
  activeTab,
  setActiveTab,
  currentLang,
  setCurrentLang,
  textSize,
  setTextSize,
  onOpenSettings,
  isLocked,
  guardianConfig
}) {
  const [isDeviceFrame, setIsDeviceFrame] = useState(true);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);

  const t = (key) => getTranslation(currentLang, key);

  // Text size classes
  const textSizeClass = {
    standard: 'text-base',
    large: 'text-lg',
    jumbo: 'text-xl'
  }[textSize] || 'text-base';

  const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="min-h-screen bg-slate-900 text-slate-800 flex flex-col items-center justify-center p-2 sm:p-4 select-none">
      
      {/* Top Meta Bar (Desktop control bar) */}
      <div className="w-full max-w-4xl flex items-center justify-between py-2 px-3 text-slate-300 text-xs sm:text-sm font-medium border-b border-slate-800 mb-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="font-semibold text-white tracking-wide">CyberSentinel</span>
          <span className="text-slate-400 hidden sm:inline">• Elder Scam Shield Prototype</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Frame Mode Toggle */}
          <button
            onClick={() => setIsDeviceFrame(!isDeviceFrame)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            title="Toggle Android Device Frame / Full Width"
          >
            {isDeviceFrame ? <Maximize2 className="w-3.5 h-3.5 text-sky-400" /> : <Smartphone className="w-3.5 h-3.5 text-sky-400" />}
            <span className="hidden md:inline">{isDeviceFrame ? 'Full Width' : 'Phone Frame'}</span>
          </button>

          {/* Quick Settings */}
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            <Settings className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">Settings</span>
          </button>
        </div>
      </div>

      {/* Main Container: Android Phone Shell or Expanded */}
      <div 
        className={`w-full transition-all duration-300 flex flex-col bg-slate-50 overflow-hidden ${
          isDeviceFrame 
            ? 'max-w-[430px] h-[910px] rounded-[44px] shadow-2xl border-[9px] border-slate-800 ring-4 ring-slate-950 relative' 
            : 'max-w-5xl min-h-[850px] rounded-2xl shadow-2xl border border-slate-300 relative'
        }`}
      >
        
        {/* Android Punch Hole & Status Bar */}
        <div className="bg-slate-900 text-slate-100 px-5 pt-3 pb-2 flex items-center justify-between text-xs font-semibold z-20">
          <div className="flex items-center gap-2">
            <span>{currentTime}</span>
            <span className="text-[10px] bg-slate-800 text-emerald-400 px-1.5 py-0.5 rounded border border-slate-700">5G</span>
          </div>

          {/* Dynamic Notch / Camera Hole */}
          {isDeviceFrame && (
            <div className="w-20 h-4 bg-slate-950 rounded-full flex items-center justify-center gap-1.5 px-2">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-700"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-[10px]">94%</span>
            <div className="w-5 h-2.5 border border-slate-300 rounded-sm p-0.5 flex items-center">
              <div className="w-3.5 h-full bg-emerald-400 rounded-2xs"></div>
            </div>
          </div>
        </div>

        {/* Elder Senior Accessibility Header Bar */}
        <div className="bg-sky-900 text-white px-4 py-3 shadow-md flex items-center justify-between z-10 border-b border-sky-950">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <ShieldAlert className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight leading-tight">{t('appName')}</h1>
              <p className="text-[11px] text-sky-200 font-medium leading-none">{t('appSubtitle')}</p>
            </div>
          </div>

          {/* Controls: Language Picker & Font Resizer */}
          <div className="flex items-center gap-2">
            
            {/* Language Dropdown Selector */}
            <div className="relative">
              <button
                onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-800 hover:bg-sky-700 text-white text-xs font-semibold border border-sky-600 transition"
                title="Change Language"
              >
                <Globe className="w-3.5 h-3.5 text-sky-200" />
                <span>{SUPPORTED_LANGUAGES.find(l => l.code === currentLang)?.native || 'English'}</span>
              </button>

              {isLangMenuOpen && (
                <div className="absolute right-0 mt-1 w-48 max-h-72 overflow-y-auto bg-white rounded-xl shadow-2xl border-2 border-slate-200 py-1.5 z-50">
                  <div className="px-3 py-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                    Select Language ({SUPPORTED_LANGUAGES.length})
                  </div>
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        setCurrentLang(lang.code);
                        setIsLangMenuOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-sky-50 transition ${
                        currentLang === lang.code ? 'bg-sky-100 font-bold text-sky-900' : 'text-slate-800'
                      }`}
                    >
                      <span>{lang.native}</span>
                      <span className="text-[10px] text-slate-500">{lang.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Font Size Adjuster (Senior Readable) */}
            <button
              onClick={() => {
                const nextSize = textSize === 'standard' ? 'large' : (textSize === 'large' ? 'jumbo' : 'standard');
                setTextSize(nextSize);
              }}
              className="px-2 py-1.5 rounded-lg bg-sky-800 hover:bg-sky-700 text-sky-100 text-xs font-bold border border-sky-600 flex items-center gap-1"
              title="Adjust Text Size for Seniors"
            >
              <Type className="w-3.5 h-3.5" />
              <span className="text-[11px] uppercase">{textSize === 'standard' ? 'A' : (textSize === 'large' ? 'A+' : 'A++')}</span>
            </button>
          </div>
        </div>

        {/* System Safeguard Status Banner */}
        <div className="bg-slate-100 border-b border-slate-300 px-3 py-1.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
            <Cpu className="w-3.5 h-3.5 text-sky-600" />
            <span className="text-[11px] text-slate-800">{t('deviceActive')}: <strong className="text-sky-800">Gemma 2B Mini</strong></span>
          </div>

          <div className="flex items-center gap-1.5 text-emerald-700 text-[11px] font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
            <Users className="w-3 h-3 text-emerald-600" />
            <span>Guardian: {guardianConfig.guardianName || 'Linked'}</span>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className={`flex-1 overflow-y-auto p-3.5 sm:p-5 bg-slate-50 text-slate-900 ${textSizeClass}`}>
          {children}
        </div>

        {/* Android Bottom Navigation Bar */}
        <nav className="bg-white border-t-2 border-slate-200 px-1 py-1.5 flex items-center justify-around z-20 shadow-lg">
          
          <button
            onClick={() => setActiveTab('call')}
            className={`flex flex-col items-center py-1 px-2 rounded-xl transition ${
              activeTab === 'call' 
                ? 'bg-sky-100 text-sky-900 font-bold border-2 border-sky-600' 
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Smartphone className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] leading-none">{t('navCall')}</span>
          </button>

          <button
            onClick={() => setActiveTab('ocr')}
            className={`flex flex-col items-center py-1 px-2 rounded-xl transition ${
              activeTab === 'ocr' 
                ? 'bg-sky-100 text-sky-900 font-bold border-2 border-sky-600' 
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ShieldAlert className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] leading-none">{t('navOcr')}</span>
          </button>

          <button
            onClick={() => setActiveTab('debate')}
            className={`flex flex-col items-center py-1 px-2 rounded-xl transition ${
              activeTab === 'debate' 
                ? 'bg-sky-100 text-sky-900 font-bold border-2 border-sky-600' 
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Users className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] leading-none">{t('navDebate')}</span>
          </button>

          <button
            onClick={() => setActiveTab('tricks')}
            className={`flex flex-col items-center py-1 px-2 rounded-xl transition ${
              activeTab === 'tricks' 
                ? 'bg-sky-100 text-sky-900 font-bold border-2 border-sky-600' 
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <AlertOctagon className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] leading-none">{t('navTricks')}</span>
          </button>

          <button
            onClick={() => setActiveTab('sms')}
            className={`flex flex-col items-center py-1 px-2 rounded-xl transition ${
              activeTab === 'sms' 
                ? 'bg-sky-100 text-sky-900 font-bold border-2 border-sky-600' 
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Smartphone className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] leading-none">{t('navSms')}</span>
          </button>
        </nav>

        {/* Android Virtual Pill / Home Bar */}
        {isDeviceFrame && (
          <div className="bg-white py-1 flex items-center justify-center">
            <div className="w-32 h-1 bg-slate-400 rounded-full"></div>
          </div>
        )}

      </div>
    </div>
  );
}
