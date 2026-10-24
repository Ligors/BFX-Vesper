// Web Speech API wrapper for Indian Regional Accents & Elder Voice Assistance

export function speakText(text, langCode = 'en') {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    console.warn('Speech synthesis not supported in this browser.');
    return;
  }

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  if (!text) return;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9; // Slightly slower, clearer speech for seniors
  utterance.pitch = 1.0;

  // Language mapping
  const voiceLangMap = {
    en: 'en-IN',
    hi: 'hi-IN',
    ta: 'ta-IN',
    te: 'te-IN',
    kn: 'kn-IN',
    ml: 'ml-IN',
    mr: 'mr-IN',
    bn: 'bn-IN',
    gu: 'gu-IN',
    pa: 'pa-IN',
    or: 'hi-IN', // Fallback to Indian English/Hindi if Odia voice is unavailable
    as: 'bn-IN',
    ur: 'ur-IN'
  };

  utterance.lang = voiceLangMap[langCode] || 'en-IN';

  // Try to pick an Indian English or regional voice if available
  const voices = window.speechSynthesis.getVoices();
  const regionalVoice = voices.find(v => v.lang.includes(utterance.lang) || v.lang.includes('IN'));
  if (regionalVoice) {
    utterance.voice = regionalVoice;
  }

  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
