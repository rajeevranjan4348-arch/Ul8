import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  MicOff, 
  Sparkles, 
  Code2, 
  Copy, 
  Check, 
  Play, 
  Square, 
  RefreshCw, 
  X, 
  FileCode, 
  ArrowRight, 
  CornerDownLeft, 
  FilePlus, 
  Sliders, 
  Zap,
  Volume2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getAiInstance, transcribeAudio } from '../services/gemini';
import { useTheme } from '../contexts/ThemeContext';

export type InsertionTargetMode = 'cursor' | 'replace-selection' | 'replace-file' | 'append' | 'new-file';

interface VoiceToCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeFileName: string;
  activeLanguage: string;
  currentCode: string;
  selectedCode?: string;
  cursorLine?: number;
  onInsertCode: (code: string, targetMode: InsertionTargetMode, newFileName?: string) => void;
}

const VOICE_TASK_PRESETS = [
  'Create an async API fetch utility with try-catch and retry logic',
  'Add a responsive navbar with mobile hamburger menu using Tailwind',
  'Write a TypeScript generic debounce hook with cancel method',
  'Generate an interactive modal component with backdrop blur and escape key handler',
  'Write a function to validate and format credit card input',
  'Implement quick sort algorithm with TypeScript type definitions'
];

export const VoiceToCodeModal: React.FC<VoiceToCodeModalProps> = ({
  isOpen,
  onClose,
  activeFileName,
  activeLanguage,
  currentCode,
  selectedCode = '',
  cursorLine,
  onInsertCode
}) => {
  const { isDarkMode, getAccentClass } = useTheme();
  
  const [dictation, setDictation] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestedCode, setSuggestedCode] = useState<string | null>(null);
  const [aiExplanation, setAiExplanation] = useState<string>('');
  const [targetMode, setTargetMode] = useState<InsertionTargetMode>(selectedCode ? 'replace-selection' : 'cursor');
  const [targetLang, setTargetLang] = useState<string>(activeLanguage || 'javascript');
  const [newFileName, setNewFileName] = useState<string>('snippet.' + (activeLanguage === 'typescript' ? 'ts' : activeLanguage === 'python' ? 'py' : 'js'));
  const [copied, setCopied] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [audioLevel, setAudioLevel] = useState<number>(0);

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Sync default target mode when selection changes
  useEffect(() => {
    if (selectedCode && selectedCode.trim().length > 0) {
      setTargetMode('replace-selection');
    } else {
      setTargetMode('cursor');
    }
    setTargetLang(activeLanguage || 'javascript');
  }, [selectedCode, activeLanguage, isOpen]);

  // Clean up on unmount or close
  useEffect(() => {
    if (!isOpen) {
      stopRecording();
    }
  }, [isOpen]);

  // Setup Web Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
    }
  }, []);

  const startRecording = async () => {
    setSuggestedCode(null);
    setAiExplanation('');
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          let fullTranscript = '';
          for (let i = 0; i < event.results.length; i++) {
            fullTranscript += event.results[i][0].transcript + ' ';
          }
          setDictation(fullTranscript.trim());
        };

        recognition.onerror = (event: any) => {
          console.warn('Speech recognition event warning:', event?.error);
        };

        recognition.onend = () => {
          if (isRecording) {
            try {
              recognition.start();
            } catch (e) {}
          }
        };

        recognition.start();
        recognitionRef.current = recognition;
      } catch (err) {
        console.warn('SpeechRecognition start failed, will fallback to MediaRecorder', err);
      }
    }

    // Audio Visualizer stream
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
        if (!dictation.trim() && audioChunksRef.current.length > 0) {
          // If WebSpeech didn't capture text, transcribe with Gemini
          const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64data = reader.result as string;
            const base64Audio = base64data.split(',')[1];
            try {
              const res = await transcribeAudio(base64Audio, audioBlob.type || 'audio/webm');
              if (res.text) {
                setDictation(res.text.trim());
              }
            } catch (err) {
              console.error('Gemini Audio fallback error:', err);
            }
          };
        }
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();

      // Audio visualizer analysis
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setAudioLevel(avg);
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();

      setIsRecording(true);
    } catch (err) {
      console.warn('Microphone permission or hardware issue:', err);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    setIsRecording(false);
    setAudioLevel(0);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      recognitionRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {}
      audioContextRef.current = null;
    }
  };

  const handleToggleRecord = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleGenerateCode = async () => {
    if (!dictation.trim()) return;
    if (isRecording) {
      stopRecording();
    }

    setIsGenerating(true);
    setSuggestedCode(null);
    setAiExplanation('');

    try {
      const ai = getAiInstance();
      
      const prompt = `You are a high-performance Voice-to-Code AI Assistant integrated into an IDE.
The user dictated a coding task with their voice. Your job is to generate clean, production-ready, correctly indented code that directly fulfills the dictated request.

CONTEXT:
- Active File Name: "${activeFileName}"
- Programming Language: "${targetLang}"
- Cursor Context: ${cursorLine ? `Line ${cursorLine}` : 'Active cursor position'}
- Target Action Mode: "${targetMode}"
${selectedCode ? `- User Currently Selected Code to Replace / Refactor:\n\`\`\`${targetLang}\n${selectedCode}\n\`\`\`` : ''}
${currentCode ? `- Surrounding / Current File Code Summary:\n\`\`\`${targetLang}\n${currentCode.slice(0, 1500)}${currentCode.length > 1500 ? '\n...[remaining lines truncated]' : ''}\n\`\`\`` : ''}

VOICE DICTATED CODING TASK:
"${dictation}"

INSTRUCTIONS:
1. Generate ONLY the code needed for the specified mode (if "cursor", generate the snippet/function to be placed at cursor; if "replace-selection", provide the replacement code; if "replace-file", provide the complete file; if "new-file", provide the whole new module).
2. Code must be idiomatic, complete, and free of placeholders or omitted logic.
3. Provide a brief 1-2 sentence explanation of what the snippet does.

Respond in strict JSON format:
{
  "code": "/* the raw code string without markdown formatting */",
  "explanation": "Brief 1-sentence summary of the generated code",
  "suggestedFileName": "optional filename if creating a new file (e.g. MyComponent.tsx)"
}
`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json'
        }
      });

      if (response.text) {
        const parsed = JSON.parse(response.text);
        setSuggestedCode(parsed.code || '');
        setAiExplanation(parsed.explanation || 'Code snippet generated based on your voice dictation.');
        if (parsed.suggestedFileName && targetMode === 'new-file') {
          setNewFileName(parsed.suggestedFileName);
        }
      }
    } catch (error) {
      console.error('Voice-to-Code AI generation error:', error);
      // Fallback manual code extraction if JSON format parse fails
      try {
        const ai = getAiInstance();
        const fallbackRes = await ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: `Generate ${targetLang} code for this voice task: "${dictation}". Return ONLY the code inside a markdown block.`
        });
        const match = fallbackRes.text.match(/```(?:\w+)?\n([\s\S]*?)```/);
        if (match) {
          setSuggestedCode(match[1]);
          setAiExplanation('Code snippet generated from voice command.');
        } else {
          setSuggestedCode(fallbackRes.text.replace(/```/g, '').trim());
          setAiExplanation('Code snippet generated from voice command.');
        }
      } catch (err) {
        setAiExplanation('Failed to generate code snippet. Please try again.');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplyToEditor = () => {
    if (!suggestedCode) return;
    onInsertCode(suggestedCode, targetMode, newFileName);
    onClose();
  };

  const handleCopyCode = () => {
    if (!suggestedCode) return;
    navigator.clipboard.writeText(suggestedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-md animate-fadeIn">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 15 }}
        transition={{ type: 'spring', duration: 0.3 }}
        className={`w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl overflow-hidden shadow-2xl border ${
          isDarkMode ? 'bg-slate-950/95 border-white/15 text-white' : 'bg-white/95 border-slate-200 text-slate-900'
        }`}
      >
        {/* Modal Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${isDarkMode ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-slate-50'}`}>
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 text-white shadow-lg shadow-cyan-500/20">
              <Mic size={20} className={isRecording ? 'animate-bounce' : ''} />
              {isRecording && (
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500"></span>
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold tracking-tight">Voice-to-Code Assistant</h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  AI Dictation
                </span>
              </div>
              <p className="text-xs opacity-60">
                Dictate code requirements or functions, and AI suggests code straight into your editor
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`p-2 rounded-xl transition-colors ${
              isDarkMode ? 'hover:bg-white/10 text-white/70 hover:text-white' : 'hover:bg-slate-200 text-slate-500 hover:text-slate-900'
            }`}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
          
          {/* Target Placement & Language Bar */}
          <div className={`p-3.5 rounded-2xl border flex flex-wrap items-center justify-between gap-3 ${
            isDarkMode ? 'bg-white/[0.02] border-white/10' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider opacity-60 flex items-center gap-1.5">
                <Sliders size={13} /> Action:
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'cursor', label: 'Insert at Cursor' },
                  ...(selectedCode ? [{ id: 'replace-selection', label: 'Replace Selection' }] : []),
                  { id: 'append', label: 'Append to File' },
                  { id: 'replace-file', label: 'Replace Entire File' },
                  { id: 'new-file', label: 'Create New File' },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setTargetMode(mode.id as InsertionTargetMode)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                      targetMode === mode.id
                        ? `${isDarkMode ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20' : 'bg-cyan-600 text-white font-bold shadow-md shadow-cyan-600/20'}`
                        : `${isDarkMode ? 'bg-white/5 hover:bg-white/10 text-white/70' : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'}`
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider opacity-60">Language:</span>
              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                className={`text-xs px-2.5 py-1.5 rounded-xl border outline-none font-medium capitalize ${
                  isDarkMode 
                    ? 'bg-slate-900 border-white/15 text-white' 
                    : 'bg-white border-slate-300 text-slate-800'
                }`}
              >
                {['javascript', 'typescript', 'python', 'html', 'css', 'json', 'sql', 'go', 'rust', 'java', 'cpp', 'shell'].map(lang => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            </div>
          </div>

          {targetMode === 'new-file' && (
            <div className={`p-3 rounded-2xl border flex items-center gap-3 ${
              isDarkMode ? 'bg-cyan-950/20 border-cyan-500/30' : 'bg-cyan-50 border-cyan-200'
            }`}>
              <FilePlus size={16} className="text-cyan-400 shrink-0" />
              <div className="flex-1 flex items-center gap-2">
                <span className="text-xs font-semibold">New File Name:</span>
                <input
                  type="text"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  placeholder="e.g. MyComponent.tsx"
                  className={`flex-1 px-3 py-1 text-xs rounded-lg border outline-none ${
                    isDarkMode ? 'bg-black/40 border-white/20 text-white' : 'bg-white border-slate-300 text-slate-800'
                  }`}
                />
              </div>
            </div>
          )}

          {/* Voice Dictation & Input Area */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider opacity-70 flex items-center gap-1.5">
                <Mic size={14} className="text-cyan-400" />
                Spoken Coding Task / Voice Dictation
              </label>
              
              {isRecording && (
                <div className="flex items-center gap-2 text-xs font-semibold text-red-400 animate-pulse">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  Listening live...
                </div>
              )}
            </div>

            <div className={`relative rounded-2xl border p-4 transition-all ${
              isRecording 
                ? 'border-red-500/60 ring-2 ring-red-500/20 shadow-lg shadow-red-500/10' 
                : (isDarkMode ? 'border-white/15 bg-white/[0.02]' : 'border-slate-200 bg-white')
            }`}>
              <textarea
                value={dictation}
                onChange={(e) => setDictation(e.target.value)}
                placeholder="Click the microphone and dictate what you want to code (e.g., 'Write a debounce hook with a cancel function in TypeScript' or 'Build a modal component with Tailwind CSS')..."
                rows={3}
                className={`w-full bg-transparent outline-none text-sm resize-none leading-relaxed ${
                  isDarkMode ? 'text-white placeholder-white/30' : 'text-slate-800 placeholder-slate-400'
                }`}
              />

              {/* Audio Waveform Indicator */}
              {isRecording && (
                <div className="flex items-center gap-1 py-2 my-1">
                  {[40, 70, 30, 90, 60, 100, 45, 80, 50, 95, 30, 85, 60, 40].map((h, i) => {
                    const scaledHeight = Math.max(6, Math.min(32, (audioLevel / 255) * h * 1.5));
                    return (
                      <div
                        key={i}
                        style={{ height: `${scaledHeight}px` }}
                        className="w-1.5 rounded-full bg-gradient-to-t from-red-500 to-amber-400 transition-all duration-75"
                      />
                    );
                  })}
                  <span className="text-[11px] font-mono opacity-60 ml-2">Speaking...</span>
                </div>
              )}

              {/* Action Bar inside Dictation box */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/5 mt-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleToggleRecord}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md ${
                      isRecording
                        ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                        : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white'
                    }`}
                  >
                    {isRecording ? (
                      <>
                        <Square size={14} fill="currentColor" /> Stop Recording
                      </>
                    ) : (
                      <>
                        <Mic size={14} /> Start Dictation
                      </>
                    )}
                  </button>

                  {dictation && (
                    <button
                      type="button"
                      onClick={() => setDictation('')}
                      className={`p-2 rounded-xl text-xs transition-colors ${
                        isDarkMode ? 'hover:bg-white/10 text-white/60 hover:text-white' : 'hover:bg-slate-100 text-slate-500'
                      }`}
                      title="Clear text"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleGenerateCode}
                  disabled={!dictation.trim() || isGenerating}
                  className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md ${
                    !dictation.trim() || isGenerating
                      ? 'opacity-40 cursor-not-allowed bg-slate-700 text-white'
                      : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-violet-500/20'
                  }`}
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" /> Generating Code...
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} /> Generate Code Snippet
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Quick Voice Task Prompts */}
          {!suggestedCode && !isGenerating && (
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider opacity-50 flex items-center gap-1">
                <Zap size={12} className="text-amber-400" /> Quick Voice Prompts
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {VOICE_TASK_PRESETS.map((preset, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setDictation(preset);
                    }}
                    className={`text-left p-2.5 rounded-xl text-xs border transition-all flex items-start gap-2 ${
                      isDarkMode
                        ? 'bg-white/[0.02] border-white/10 hover:bg-white/5 hover:border-cyan-500/40 text-white/80 hover:text-white'
                        : 'bg-slate-50 border-slate-200 hover:bg-cyan-50/50 hover:border-cyan-300 text-slate-700'
                    }`}
                  >
                    <ArrowRight size={13} className="text-cyan-400 shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{preset}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* AI Suggested Code Result */}
          {suggestedCode && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3 pt-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCode size={15} className="text-emerald-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    Suggested Code Snippet
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/10 opacity-70">
                    {targetLang}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                      isDarkMode 
                        ? 'border-white/15 bg-white/5 hover:bg-white/10 text-white' 
                        : 'border-slate-300 bg-white hover:bg-slate-100 text-slate-800'
                    }`}
                  >
                    {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {aiExplanation && (
                <div className={`p-3 rounded-xl text-xs border leading-relaxed ${
                  isDarkMode ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200' : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                }`}>
                  💡 <strong>Summary:</strong> {aiExplanation}
                </div>
              )}

              {/* Code Preview Box */}
              <div className={`rounded-2xl border overflow-hidden ${
                isDarkMode ? 'bg-[#12141a] border-white/15' : 'bg-slate-900 border-slate-800 text-slate-100'
              }`}>
                <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-black/40 text-[11px] font-mono opacity-70">
                  <span>{targetMode === 'new-file' ? newFileName : activeFileName}</span>
                  <span>{suggestedCode.split('\n').length} lines</span>
                </div>
                <div className="p-4 overflow-x-auto max-h-72 font-mono text-xs leading-relaxed custom-scrollbar">
                  <pre className="text-emerald-300">
                    <code>{suggestedCode}</code>
                  </pre>
                </div>
              </div>
            </motion.div>
          )}

        </div>

        {/* Modal Footer / Actions */}
        <div className={`flex items-center justify-between px-6 py-4 border-t ${
          isDarkMode ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-slate-50'
        }`}>
          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
              isDarkMode ? 'hover:bg-white/10 text-white/70' : 'hover:bg-slate-200 text-slate-600'
            }`}
          >
            Cancel
          </button>

          <div className="flex items-center gap-3">
            {suggestedCode && (
              <button
                type="button"
                onClick={handleGenerateCode}
                disabled={isGenerating}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                  isDarkMode ? 'border-white/15 hover:bg-white/10 text-white' : 'border-slate-300 hover:bg-slate-200 text-slate-800'
                }`}
              >
                <RefreshCw size={13} className={isGenerating ? 'animate-spin' : ''} />
                Regenerate
              </button>
            )}

            <button
              type="button"
              onClick={handleApplyToEditor}
              disabled={!suggestedCode}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg ${
                !suggestedCode
                  ? 'opacity-40 cursor-not-allowed bg-slate-700 text-white'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-emerald-500/20'
              }`}
            >
              <CornerDownLeft size={15} />
              {targetMode === 'new-file' 
                ? 'Create & Open File' 
                : targetMode === 'replace-selection' 
                ? 'Replace Selection in Editor' 
                : targetMode === 'replace-file'
                ? 'Replace Whole File'
                : 'Insert Code into Editor'}
            </button>
          </div>
        </div>

      </motion.div>
    </div>
  );
};
