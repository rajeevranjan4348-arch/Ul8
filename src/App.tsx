import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppMode } from './types';
import { ManusMode } from './modes/ManusMode';
import { ProChatMode } from './modes/ProChatMode';
import { VoiceMode } from './modes/VoiceMode';
import { SearchMapsMode } from './modes/SearchMapsMode';
import { AudioTranscriptionMode } from './modes/AudioTranscriptionMode';
import { TextToSpeechMode } from './modes/TextToSpeechMode';
import { JarvisMode } from './modes/JarvisMode';
import { CoderMode } from './modes/CoderMode';
import { SettingsMode } from './modes/SettingsMode';
import { LogsMode } from './modes/LogsMode';
import { LiquidChatMode } from './modes/LiquidChatMode';
import { OmniChatMode } from './modes/OmniChatMode';
import { DashboardMode } from './modes/DashboardMode';
import { HistoryMode } from './modes/HistoryMode';
import { ImageGenerationMode } from './modes/ImageGenerationMode';
import { WorkspaceMode } from './modes/WorkspaceMode';
import { CommandPalette } from './components/CommandPalette';
import { Menu, X, Mic, Volume2, Sparkles, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from './contexts/ThemeContext';
import { useSettings } from './contexts/SettingsContext';
import { useWakeWord } from './hooks/useWakeWord';
import { MicrophoneErrorModal } from './components/MicrophoneErrorModal';
import { auth, saveVoiceCommandToCloud } from './lib/firebase';
import { useGlobalPerfObserver } from './hooks/useGlobalPerfObserver';
import { useGlobalAiErrorListener } from './hooks/useGlobalAiErrorListener';

const MODE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  history: 'Chat History',
  jarvis: 'J.A.R.V.I.S. HUD',
  'chat-pro': 'Pro Chat',
  'chat-fast': 'Manus Agent',
  'liquid-chat': 'Liquid Chat',
  'omni-chat': 'Omni Chat',
  'voice-live': 'Voice',
  'search-maps': 'Search & Maps',
  transcription: 'Transcription',
  tts: 'Text to Speech',
  'image-gen': 'Image Generation',
  coder: 'AI Coder',
  workspace: 'Workspace Central',
  settings: 'Settings',
  logs: 'Logs',
};

export default function App() {
  const { metrics, targetFps, setTargetFps } = useGlobalPerfObserver(90);
  const { activeError, dismissError } = useGlobalAiErrorListener();
  const [currentMode, setCurrentMode] = useState<AppMode | 'liquid-chat'>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [wakeWordTriggered, setWakeWordTriggered] = useState(false);
  const [voiceSearchTrigger, setVoiceSearchTrigger] = useState<number>(0);
  const { getBgClass, getTextClass } = useTheme();
  const { wakeWordSensitivity } = useSettings();


  const wakeWords = React.useMemo(() => [
    'hey ai', 'hey a.i.', 'hey eye', 'hey i', 'hi ai', 'ok ai', 'hey a i', 'hay ai',
    'hey omni', 'omni ai', 'omni', 'hey jarvis', 'jarvis', 'hey assistant', 'computer'
  ], []);

  const { isListeningForWakeWord, wakeWordTriggerBanner, startListening } = useWakeWord((transcript) => {
    setCurrentMode('jarvis');
    setWakeWordTriggered(true);
    setTimeout(() => setWakeWordTriggered(false), 1200);

    // Persist wake-word trigger transcript
    try {
      const raw = localStorage.getItem('omnichat_voice_commands');
      const list = raw ? JSON.parse(raw) : [];
      const newItem = {
        id: 'vc-ww-' + Date.now(),
        timestamp: Date.now(),
        source: 'wake-word',
        text: transcript,
        title: 'Wake-word Triggered',
        activeModeContext: currentMode,
        targetMode: 'jarvis',
        sensitivity: wakeWordSensitivity,
        context: {
          activeMode: currentMode,
          targetMode: 'jarvis',
          sensitivity: wakeWordSensitivity,
          listener: 'Web Speech API Wake-word Engine',
          triggeredAt: new Date().toISOString()
        },
        messages: [
          { role: 'user', text: transcript },
          { role: 'model', text: `Wake-word listener captured prompt from ${currentMode} mode. Switched to J.A.R.V.I.S. HUD.` }
        ]
      };
      list.unshift(newItem);
      localStorage.setItem('omnichat_voice_commands', JSON.stringify(list.slice(0, 100)));

      if (auth.currentUser) {
        saveVoiceCommandToCloud(newItem).catch(err => {
          console.error('Failed to save wake-word to cloud:', err);
        });
      }
    } catch (e) {
      console.error('Failed to log wake-word transcript:', e);
    }
  }, wakeWords, wakeWordSensitivity);

  React.useEffect(() => {
    const sweepVoiceCommands = () => {
      try {
        const raw = localStorage.getItem('omnichat_voice_commands');
        if (!raw) return;

        const list = JSON.parse(raw);
        if (Array.isArray(list) && list.length > 100) {
          const originalLength = list.length;
          // Sort descending by timestamp/updatedAt
          const sortedList = [...list].sort((a, b) => {
            const timeA = a.timestamp || a.updatedAt || 0;
            const timeB = b.timestamp || b.updatedAt || 0;
            return timeB - timeA;
          });

          const truncated = sortedList.slice(0, 100);
          localStorage.setItem('omnichat_voice_commands', JSON.stringify(truncated));
          console.info(`[Voice Log Sweeper] Truncated voice commands log from ${originalLength} to 100 entries to prevent local storage bloat.`);
        }
      } catch (e) {
        console.error('Failed during periodic voice commands sweep:', e);
      }
    };

    // Run sweep immediately on mount
    sweepVoiceCommands();

    // Set up an interval to scan every 15 seconds
    const interval = setInterval(sweepVoiceCommands, 15000);
    return () => clearInterval(interval);
  }, []);

  const renderMode = () => {
    switch (currentMode) {
      case 'dashboard':
        return <DashboardMode onModeChange={handleModeChange} />;
      case 'history':
        return <HistoryMode onModeChange={handleModeChange} />;
      case 'jarvis':
        return <JarvisMode wakeWordTriggered={wakeWordTriggered} />;
      case 'chat-pro':
        return <ProChatMode key={currentMode} />;
      case 'chat-fast':
        return <ManusMode />;
      case 'liquid-chat':
        return <LiquidChatMode />;
      case 'omni-chat':
        return <OmniChatMode />;
      case 'voice-live':
        return <VoiceMode />;
      case 'search-maps':
        return <SearchMapsMode voiceSearchTrigger={voiceSearchTrigger} />;
      case 'transcription':
        return <AudioTranscriptionMode />;
      case 'tts':
        return <TextToSpeechMode />;
      case 'image-gen':
        return <ImageGenerationMode />;
      case 'coder':
        return <CoderMode />;
      case 'workspace':
        return <WorkspaceMode />;
      case 'settings':
        return <SettingsMode />;
      case 'logs':
        return <LogsMode />;
      default:
        return <div>Select a mode</div>;
    }
  };

  const handleModeChange = (mode: AppMode | 'liquid-chat') => {
    setCurrentMode(mode);
    setIsSidebarOpen(false);
  };

  const handleVoiceSearchTrigger = () => {
    setCurrentMode('search-maps');
    setVoiceSearchTrigger(Date.now());
    setIsSidebarOpen(false);
  };

  return (
    <div className={`flex h-screen w-full overflow-hidden relative ${getBgClass()} ${getTextClass()}`}>
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition-transform duration-300 ease-in-out h-full transform-gpu will-change-transform`}>
        <Sidebar 
          currentMode={currentMode} 
          onModeChange={handleModeChange} 
          onVoiceSearchTrigger={handleVoiceSearchTrigger}
        />
      </div>


      <main className={`flex-1 h-full overflow-hidden relative flex flex-col ${getBgClass()}`}>
        {/* Wake Word Trigger Toast Banner */}

        <AnimatePresence>
          {wakeWordTriggerBanner && (
            <motion.div
              initial={{ opacity: 0, y: -40, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-2xl bg-slate-900/90 border border-cyan-500/40 shadow-2xl backdrop-blur-xl flex items-center gap-3 text-cyan-300 pointer-events-none"
            >
              <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 animate-bounce">
                <Sparkles size={20} />
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-wider text-cyan-400">
                  Wake Word Detected: "{wakeWordTriggerBanner}"
                </div>
                <div className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
                  <Volume2 size={14} className="text-emerald-400 animate-pulse" />
                  <span>AI: "Yes Boss."</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Listening / Hands-Free Wake Word Pill Badge */}
        <div className="hidden sm:flex absolute top-3 right-4 z-40 items-center gap-2">
          <button
            onClick={() => startListening()}
            className={`px-3 py-1.5 rounded-full border text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              isListeningForWakeWord
                ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300 shadow-sm shadow-cyan-500/20 hover:bg-cyan-500/25'
                : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'
            }`}
            title="Click to toggle or restart 'Hey AI' voice trigger detection"
          >
            <Mic size={13} className={isListeningForWakeWord ? 'text-cyan-400 animate-pulse' : 'text-slate-500'} />
            <span>{isListeningForWakeWord ? 'Hey AI: Listening' : 'Hey AI: Tap to Listen'}</span>
          </button>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden absolute top-3 left-3 z-50 p-2 bg-black/50 text-white rounded-lg backdrop-blur-md border border-white/10 shadow-lg"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        >
          {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        <div className="flex-1 min-h-0 relative w-full h-full overflow-hidden">
          <ErrorBoundary key={currentMode} modeName={MODE_LABELS[currentMode]}>
            <motion.div
              key={currentMode}
              initial={{ opacity: 0, scale: 0.99, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              style={{ willChange: 'opacity, transform' }}
              className="w-full h-full flex flex-col min-h-0 overflow-hidden transform-gpu"
            >
              {renderMode()}
            </motion.div>
          </ErrorBoundary>
        </div>


        {/* Floating Global AI Auto-Fix Toast Badge */}
        <AnimatePresence>
          {activeError && (
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="fixed bottom-6 right-6 z-[120] max-w-sm w-full p-4 rounded-2xl bg-slate-900/95 border border-cyan-500/40 shadow-2xl backdrop-blur-xl text-white flex items-start gap-3"
            >
              <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 shrink-0 mt-0.5">
                <ShieldCheck size={18} className="animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-cyan-400 tracking-wider">
                    AI Auto-Fix Active
                  </span>
                  <button
                    onClick={dismissError}
                    className="text-slate-500 hover:text-slate-300 text-xs font-bold px-1"
                  >
                    ×
                  </button>
                </div>
                <div className="text-xs font-bold text-slate-100 truncate mt-0.5">
                  {activeError.message}
                </div>
                {activeError.aiDiagnostic ? (
                  <div className="text-[11px] text-emerald-300 mt-1 font-sans flex items-center gap-1">
                    <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                    <span>Auto-repaired: {activeError.aiDiagnostic.suggestedFix}</span>
                  </div>
                ) : (
                  <div className="text-[11px] text-cyan-300 mt-1 flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                    <span>Analyzing & applying fallback patch...</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      
      <CommandPalette currentMode={currentMode} onModeChange={handleModeChange} />
      <MicrophoneErrorModal />
    </div>
  );
}
