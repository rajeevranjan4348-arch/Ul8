import React, { useState, useEffect } from 'react';
import { Volume2, Play, Loader2, AlertCircle, Download, Plus, Trash2, MessageSquare } from 'lucide-react';
import { generateSpeech } from '../services/gemini';
import { useTheme } from '../contexts/ThemeContext';
import { motion, AnimatePresence } from 'motion/react';

interface SpeechSession {
  id: string;
  title: string;
  updatedAt: Date;
  text: string;
  voice: string;
  audioUrl: string | null;
}

export const TextToSpeechMode: React.FC = () => {
  const { isDarkMode, getAccentClass } = useTheme();

  const [sessions, setSessions] = useState<SpeechSession[]>(() => {
    const saved = localStorage.getItem('omnichat_tts_sessions');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((s: any) => ({
          ...s,
          updatedAt: new Date(s.updatedAt)
        }));
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(() => {
    return localStorage.getItem('omnichat_tts_current') || null;
  });

  const [showHistory, setShowHistory] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const voices = [
    { id: 'Fenrir', label: '🎙️ Fenrir (Deep Male Baritone)' },
    { id: 'Charon', label: '🎙️ Charon (Deep Male Low Pitch)' },
    { id: 'Orpheus', label: '🎙️ Orpheus (Deep Male Resonant)' },
    { id: 'Enceladus', label: '🎙️ Enceladus (Deep Male Bass)' },
    { id: 'Puck', label: '🎙️ Puck (Energetic Male)' },
    { id: 'Zephyr', label: '🎙️ Zephyr (Smooth Female)' },
    { id: 'Kore', label: '🎙️ Kore (Clear Female)' },
  ];

  useEffect(() => {
    if (sessions.length > 0 && !currentSessionId) {
      setCurrentSessionId(sessions[0].id);
    }
  }, [sessions, currentSessionId]);

  useEffect(() => {
    localStorage.setItem('omnichat_tts_sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    if (currentSessionId) {
      localStorage.setItem('omnichat_tts_current', currentSessionId);
    } else {
      localStorage.removeItem('omnichat_tts_current');
    }
  }, [currentSessionId]);

  useEffect(() => {
    if (sessions.length === 0) {
      createNewSession();
    }
  }, []);

  const currentSession = sessions.find(s => s.id === currentSessionId);

  const createNewSession = () => {
    if (currentSession && !currentSession.text && !currentSession.audioUrl) {
      // Already an empty session exists
      return;
    }
    const newSession: SpeechSession = {
      id: Date.now().toString(),
      title: 'New Speech Synthesis',
      updatedAt: new Date(),
      text: '',
      voice: 'Fenrir',
      audioUrl: null
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this speech synthesis?')) {
      setSessions(prev => prev.filter(s => s.id !== id));
      if (currentSessionId === id) {
        setCurrentSessionId(null);
      }
    }
  };

  const updateSessionField = (fields: Partial<SpeechSession>) => {
    setSessions(prev => prev.map(s => {
      if (s.id === currentSessionId) {
        const updated = {
          ...s,
          ...fields,
          updatedAt: new Date()
        };
        // Update title if text changed and was default
        if (fields.text !== undefined && (s.title === 'New Speech Synthesis' || s.title === '')) {
          const trimmed = fields.text.trim();
          if (trimmed) {
            updated.title = trimmed.substring(0, 30) + (trimmed.length > 30 ? '...' : '');
          }
        }
        return updated;
      }
      return s;
    }));
  };

  const handleGenerate = async () => {
    if (!currentSession || !currentSession.text.trim()) return;
    setIsGenerating(true);
    setError(null);

    // Clear old audio URL for this session first
    updateSessionField({ audioUrl: null });

    try {
      const response = await generateSpeech(currentSession.text, currentSession.voice);
      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      
      if (base64Audio) {
        const url = `data:audio/mp3;base64,${base64Audio}`;
        updateSessionField({ audioUrl: url });
      } else {
        setError('Failed to generate audio. The model did not return audio data.');
      }
    } catch (err: any) {
      console.error('TTS error:', err);
      setError(err?.message || 'An error occurred while generating speech. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!currentSession?.audioUrl) return;
    const a = document.createElement('a');
    a.href = currentSession.audioUrl;
    a.download = `speech-${currentSession.voice}-${Date.now()}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className={`flex h-full w-full relative overflow-hidden ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* History Collapsible Sidebar */}
      <AnimatePresence initial={false}>
        {showHistory && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 260, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            style={{ willChange: 'width, opacity' }}
            className={`flex flex-col h-full border-r shrink-0 relative z-10 overflow-hidden ${
              isDarkMode ? 'border-white/10 bg-black/30' : 'border-slate-200 bg-slate-50'
            }`}
          >
            <div style={{ width: 260 }} className="flex flex-col h-full p-4">
              <div className="flex items-center justify-between mb-4 shrink-0">
                <span className={`text-[10px] font-bold uppercase tracking-wider opacity-60 ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>Speech History</span>
                <button
                  type="button"
                  onClick={createNewSession}
                  title="New Speech"
                  className={`p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-xs flex items-center gap-1 ${getAccentClass()}`}
                >
                  <Plus size={14} /> <span className="text-[10px] font-semibold">New</span>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 hide-scrollbar">
                {sessions.map(s => (
                  <div
                    key={s.id}
                    onClick={() => setCurrentSessionId(s.id)}
                    className={`group flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all border ${
                      currentSessionId === s.id
                        ? (isDarkMode ? 'bg-white/10 border-white/20 text-white shadow-md' : 'bg-slate-200 border-slate-300 text-slate-900 shadow-sm')
                        : (isDarkMode ? 'hover:bg-white/5 border-transparent text-white/60 hover:text-white' : 'hover:bg-slate-100 border-transparent text-slate-600 hover:text-slate-900')
                    }`}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden flex-1 min-w-0">
                      <Volume2 size={14} className="shrink-0 opacity-50 text-fuchsia-500" />
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-xs truncate font-medium">{s.title}</span>
                        <span className="text-[9px] opacity-45">
                          Voice: {s.voice}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => deleteSession(s.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-red-500 transition-all ml-1 shrink-0"
                      title="Delete Speech"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Panel */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
        
        {/* Header Tabs with Toggle Button */}
        <div className={`p-4 border-b flex items-center justify-between shrink-0 ${
          isDarkMode ? 'bg-slate-900/50 border-white/10' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              title="Toggle History"
              className={`p-1.5 rounded-md transition-colors ${
                showHistory 
                  ? `bg-black/10 dark:bg-white/10 ${getAccentClass()}` 
                  : (isDarkMode ? 'text-white/60 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-200')
              }`}
            >
              <MessageSquare size={18} />
            </button>
            <span className="text-sm font-semibold">Text to Speech</span>
          </div>

          <button
            type="button"
            onClick={createNewSession}
            title="New Speech"
            className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? 'text-white/60 hover:bg-white/10 hover:text-white' : 'text-slate-500 hover:bg-slate-200 hover:text-slate-900'}`}
          >
            <Plus size={18} />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 flex items-center justify-center">
          <div className={`max-w-2xl w-full rounded-2xl shadow-sm border p-6 md:p-8 flex flex-col items-center ${
            isDarkMode ? 'bg-slate-900/40 border-white/10' : 'bg-white border-slate-200'
          }`}>
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-6 ${
              isDarkMode ? 'bg-fuchsia-950 text-fuchsia-400' : 'bg-fuchsia-100 text-fuchsia-500'
            }`}>
              <Volume2 size={32} />
            </div>
            <h2 className="text-2xl font-bold mb-2">Text to Speech</h2>
            <p className="opacity-60 text-sm text-center mb-8 max-w-md">
              Type text and the AI will generate speech using gemini-3.1-flash-tts-preview.
            </p>

            {currentSession && (
              <div className="w-full space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider opacity-60 mb-1.5">Voice</label>
                  <select
                    value={currentSession.voice}
                    onChange={(e) => updateSessionField({ voice: e.target.value })}
                    className={`w-full p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-fuchsia-500 ${
                      isDarkMode ? 'bg-slate-900 border-white/10 text-white' : 'bg-white border-slate-300 text-slate-800'
                    }`}
                  >
                    {voices.map((v) => (
                      <option key={v.id} value={v.id}>{v.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider opacity-60 mb-1.5">Text</label>
                  <textarea
                    value={currentSession.text}
                    onChange={(e) => updateSessionField({ text: e.target.value })}
                    placeholder="Enter text to synthesize..."
                    rows={4}
                    className={`w-full p-4 rounded-xl border focus:outline-none focus:ring-2 focus:ring-fuchsia-500 resize-none ${
                      isDarkMode ? 'bg-slate-900 border-white/10 text-white placeholder-white/30' : 'bg-white border-slate-300 text-slate-800 placeholder-slate-400'
                    }`}
                  />
                </div>

                {error && (
                  <div className="p-4 bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400 rounded-xl flex items-start gap-3 border border-red-100 dark:border-red-500/20">
                    <AlertCircle size={20} className="shrink-0 mt-0.5" />
                    <p className="text-sm">{error}</p>
                  </div>
                )}

                <button
                  onClick={handleGenerate}
                  disabled={!currentSession.text.trim() || isGenerating}
                  className="w-full py-3 rounded-xl text-white font-medium bg-fuchsia-500 hover:bg-fuchsia-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 shadow-lg shadow-fuchsia-500/20"
                >
                  {isGenerating ? <Loader2 size={20} className="animate-spin" /> : <Play size={20} />}
                  {isGenerating ? 'Generating...' : 'Generate Speech'}
                </button>
              </div>
            )}

            {currentSession?.audioUrl && (
              <div className={`mt-8 w-full rounded-xl p-6 border flex flex-col items-center ${
                isDarkMode ? 'bg-slate-900 border-white/10' : 'bg-slate-50 border-slate-200'
              }`}>
                <h3 className="text-xs font-semibold uppercase tracking-wider opacity-50 mb-4">Generated Audio</h3>
                <audio controls src={currentSession.audioUrl} className="w-full mb-4" autoPlay />
                <button
                  onClick={handleDownload}
                  className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                    isDarkMode ? 'bg-slate-800 hover:bg-slate-750 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                  }`}
                >
                  <Download size={16} />
                  Download Audio
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
