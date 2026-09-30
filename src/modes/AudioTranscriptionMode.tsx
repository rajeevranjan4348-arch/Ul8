import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2, FileAudio, Plus, Trash2, MessageSquare, Copy, Check } from 'lucide-react';
import { transcribeAudio } from '../services/gemini';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import { useSettings } from '../contexts/SettingsContext';
import { useTheme } from '../contexts/ThemeContext';
import { motion, AnimatePresence } from 'motion/react';
import { usePeriodicAutoSave } from '../hooks/usePeriodicAutoSave';

interface TranscriptionSession {
  id: string;
  title: string;
  updatedAt: Date;
  text: string;
}

export const AudioTranscriptionMode: React.FC = () => {
  const { isDarkMode, getAccentClass } = useTheme();
  const { setMicPermissionError } = useSettings();
  
  const [sessions, setSessions] = useState<TranscriptionSession[]>(() => {
    const saved = localStorage.getItem('omnichat_transcription_sessions');
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
    return localStorage.getItem('omnichat_transcription_current') || null;
  });

  const [showHistory, setShowHistory] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (sessions.length > 0 && !currentSessionId) {
      setCurrentSessionId(sessions[0].id);
    }
  }, [sessions, currentSessionId]);

  // Periodic and unload auto-save for transcription sessions
  usePeriodicAutoSave('omnichat_transcription_sessions', sessions, {
    intervalMs: 1500
  });

  usePeriodicAutoSave('omnichat_transcription_current', currentSessionId, {
    intervalMs: 1500
  });

  useEffect(() => {
    if (sessions.length === 0) {
      createNewSession();
    }
  }, []);

  const currentSession = sessions.find(s => s.id === currentSessionId);

  const createNewSession = () => {
    if (currentSession && !currentSession.text) {
      // Already an empty session exists
      return;
    }
    const newSession: TranscriptionSession = {
      id: Date.now().toString(),
      title: 'New Transcription',
      updatedAt: new Date(),
      text: ''
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this transcription session?')) {
      setSessions(prev => prev.filter(s => s.id !== id));
      if (currentSessionId === id) {
        setCurrentSessionId(null);
      }
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await handleTranscription(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setMicPermissionError(true);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };

  const handleTranscription = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        try {
          const base64data = reader.result as string;
          const base64Audio = base64data.split(',')[1];
          
          const response = await transcribeAudio(base64Audio, 'audio/webm');
          const textResult = response.text || 'Could not transcribe audio.';
          
          updateSessionText(textResult);
        } catch (innerError: any) {
          console.error('Transcription error:', innerError);
          updateSessionText(`**Error:** ${innerError?.message || 'An error occurred during transcription. Please try again.'}`);
        } finally {
          setIsTranscribing(false);
        }
      };
    } catch (error: any) {
      console.error('File reading error:', error);
      updateSessionText(`**Error:** ${error?.message || 'An error occurred while reading the audio file.'}`);
      setIsTranscribing(false);
    }
  };

  const updateSessionText = (text: string) => {
    setSessions(prev => prev.map(s => {
      if (s.id === currentSessionId) {
        let title = s.title;
        if (title === 'New Transcription' && text) {
          title = text.substring(0, 30);
          if (text.length > 30) title += '...';
        }
        return {
          ...s,
          title,
          text,
          updatedAt: new Date()
        };
      }
      return s;
    }));
  };

  const handleCopy = () => {
    if (!currentSession?.text) return;
    navigator.clipboard.writeText(currentSession.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
                <span className={`text-[10px] font-bold uppercase tracking-wider opacity-60 ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>Transcription History</span>
                <button
                  type="button"
                  onClick={createNewSession}
                  title="New Session"
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
                      <FileAudio size={14} className="shrink-0 opacity-50 text-indigo-500" />
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-xs truncate font-medium">{s.title}</span>
                        <span className="text-[9px] opacity-45">
                          {s.updatedAt.toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => deleteSession(s.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-red-500 transition-all ml-1 shrink-0"
                      title="Delete Session"
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
            <span className="text-sm font-semibold">Audio Transcription</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={createNewSession}
              title="New Transcription"
              className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? 'text-white/60 hover:bg-white/10 hover:text-white' : 'text-slate-500 hover:bg-slate-200 hover:text-slate-900'}`}
            >
              <Plus size={18} />
            </button>
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
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 flex items-center justify-center">
          <div className={`max-w-2xl w-full rounded-2xl shadow-sm border p-6 md:p-8 flex flex-col items-center ${
            isDarkMode ? 'bg-slate-900/40 border-white/10' : 'bg-white border-slate-200'
          }`}>
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-6 ${
              isDarkMode ? 'bg-indigo-950 text-indigo-400' : 'bg-indigo-100 text-indigo-500'
            }`}>
              <FileAudio size={32} />
            </div>
            <h2 className="text-2xl font-bold mb-2">Audio Transcription</h2>
            <p className="opacity-60 text-sm text-center mb-8 max-w-md">
              Record your voice and the AI will transcribe it accurately using gemini-3.5-flash.
            </p>

            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isTranscribing}
              className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
                isRecording 
                  ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/30 animate-pulse' 
                  : 'bg-indigo-500 hover:bg-indigo-600 shadow-lg shadow-indigo-500/30'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isRecording ? <Square size={32} className="text-white fill-current" /> : <Mic size={32} className="text-white" />}
            </button>

            <div className="mt-4 h-8 flex items-center justify-center">
              {isRecording && <span className="text-red-500 font-medium">Recording...</span>}
              {isTranscribing && (
                <div className="flex items-center text-indigo-500 font-medium">
                  <Loader2 size={16} className="animate-spin mr-2" />
                  Transcribing...
                </div>
              )}
            </div>

            {currentSession?.text && (
              <div className={`mt-8 w-full rounded-xl p-6 border ${
                isDarkMode ? 'bg-slate-900 border-white/10' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider opacity-50">Transcription Result</h3>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 text-xs opacity-60 hover:opacity-100 transition-opacity"
                    title="Copy to Clipboard"
                  >
                    {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <MarkdownRenderer content={currentSession.text} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
