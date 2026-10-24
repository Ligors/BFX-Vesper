import React, { useState } from 'react';
import AndroidFrame from './components/AndroidFrame';
import CallGuardian from './components/CallGuardian';
import PaymentScreenshotAnalyzer from './components/PaymentScreenshotAnalyzer';
import DebateBot from './components/DebateBot';
import ScamTricks from './components/ScamTricks';
import SmsOtpInspector from './components/SmsOtpInspector';
import SettingsModal from './components/SettingsModal';

export default function App() {
  const [activeTab, setActiveTab] = useState('call');
  const [currentLang, setCurrentLang] = useState('en');
  const [textSize, setTextSize] = useState('standard');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAppLocked, setIsAppLocked] = useState(false);
  const [lastIncidentReport, setLastIncidentReport] = useState(null);

  // Guardian Configuration
  const [guardianConfig, setGuardianConfig] = useState({
    guardianName: 'Family Guardian',
    guardianPhone: '+91 94440 12345',
    telegramBotToken: '',
    telegramChatId: '',
    passcode: '9442',
    passphrase: 'KAVACH-SHIELD-2026'
  });

  // Cloud AI APIs (Optional)
  const [apiKeys, setApiKeys] = useState({
    groqApiKey: '',
    geminiApiKey: ''
  });

  return (
    <div className="w-full min-h-screen">
      <AndroidFrame
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentLang={currentLang}
        setCurrentLang={setCurrentLang}
        textSize={textSize}
        setTextSize={setTextSize}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isLocked={isAppLocked}
        guardianConfig={guardianConfig}
      >
        {/* Render Tab Contents */}
        {activeTab === 'call' && (
          <CallGuardian
            currentLang={currentLang}
            guardianConfig={guardianConfig}
            isAppLocked={isAppLocked}
            setIsAppLocked={setIsAppLocked}
            lastIncidentReport={lastIncidentReport}
            setLastIncidentReport={setLastIncidentReport}
          />
        )}

        {activeTab === 'ocr' && (
          <PaymentScreenshotAnalyzer
            currentLang={currentLang}
            apiKeys={apiKeys}
          />
        )}

        {activeTab === 'debate' && (
          <DebateBot
            currentLang={currentLang}
          />
        )}

        {activeTab === 'tricks' && (
          <ScamTricks
            currentLang={currentLang}
          />
        )}

        {activeTab === 'sms' && (
          <SmsOtpInspector
            currentLang={currentLang}
            apiKeys={apiKeys}
          />
        )}
      </AndroidFrame>

      {/* Global Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        guardianConfig={guardianConfig}
        setGuardianConfig={setGuardianConfig}
        apiKeys={apiKeys}
        setApiKeys={setApiKeys}
      />
    </div>
  );
}
