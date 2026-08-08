import React, { useState, useRef, useEffect } from 'react';
import { Monitor, Play, Square, Volume2, VolumeX, RefreshCw, Send, X, Eye, Sparkles, MessageSquare, Layers, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeScreenFrame } from '../services/gemini';
import { useTheme } from '../contexts/ThemeContext';

interface ScreenStreamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendToChat?: (text: string, imageBase64?: string) => void;
}

export const ScreenStreamModal: React.FC<ScreenStreamModalProps> = ({
  isOpen,
  onClose,
  onSendToChat
}) => {
  const { isDarkMode } = useTheme();

  const [isStreaming, setIsStreaming] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [fps, setFps] = useState(10);
  const [prompt, setPrompt] = useState('Describe everything visible on the screen. Help the user interact with apps in real time.');
  const [aiResponse, setAiResponse] = useState<string>('');
  const [historyLogs, setHistoryLogs] = useState<Array<{ id: string; time: string; text: string; imageBase64?: string }>>([]);
  const [lastFrameBase64, setLastFrameBase64] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const streamIntervalRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleScreenshotUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const dataUrl = evt.target?.result as string;
      if (!dataUrl) return;

      setLastFrameBase64(dataUrl);
      const base64Image = dataUrl.split(',')[1];
      const mimeType = file.type || 'image/jpeg';

      setIsAnalyzing(true);
      try {
        const response = await analyzeScreenFrame(base64Image, mimeType, prompt);
        const outputText = response.text || 'Screen analyzed successfully.';

        setAiResponse(outputText);
        speakText(outputText);

        const logItem = {
          id: 'file-' + Date.now(),
          time: new Date().toLocaleTimeString(),
          text: outputText,
          imageBase64: dataUrl
        };

        setHistoryLogs(prev => [logItem, ...prev.slice(0, 19)]);
      } catch (err: any) {
        console.error('Screenshot analysis failed:', err);
        setAiResponse('Analysis failed: ' + (err.message || 'Error communicating with AI API'));
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Stop stream & TTS when modal closes
  useEffect(() => {
    if (!isOpen) {
      stopScreenStream();
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    }
  }, [isOpen]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopScreenStream();
    };
  }, []);

  const speakText = (text: string) => {
    if (!ttsEnabled || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  const captureFrameAndAnalyze = async () => {
    if (!videoRef.current || !canvasRef.current || isAnalyzing) return;

    const video = videoRef.current;
    if (video.readyState < 2) return; // Wait for HAVE_CURRENT_DATA

    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Compress to JPEG 70% quality
    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
    const base64Image = dataUrl.split(',')[1];
    setLastFrameBase64(dataUrl);

    setIsAnalyzing(true);

    try {
      const response = await analyzeScreenFrame(base64Image, 'image/jpeg', prompt);
      const outputText = response.text || 'Screen analyzed successfully.';

      setAiResponse(outputText);
      speakText(outputText);

      const logItem = {
        id: 'frame-' + Date.now(),
        time: new Date().toLocaleTimeString(),
        text: outputText,
        imageBase64: dataUrl
      };

      setHistoryLogs(prev => [logItem, ...prev.slice(0, 19)]);
    } catch (err: any) {
      console.error('Screen AI frame analysis failed:', err);
      setAiResponse('Analysis failed: ' + (err.message || 'Error communicating with AI API'));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const startScreenStream = async () => {
    try {
      let stream: MediaStream;

      if (navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function') {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            displaySurface: 'monitor',
            frameRate: { ideal: fps, max: 15 }
          },
          audio: false
        });
      } else if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
        // Fallback to camera capture if display media is restricted in iframe/mobile
        alert('Screen sharing (getDisplayMedia) is restricted in this frame/browser environment. Falling back to Camera Video Stream.');
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false
        });
      } else {
        throw new Error('Media capture APIs are not supported or blocked in this browser environment.');
      }

      mediaStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsStreaming(true);

      // Handle user stopping stream from browser UI
      if (stream.getVideoTracks().length > 0) {
        stream.getVideoTracks()[0].onended = () => {
          stopScreenStream();
        };
      }

      // Initial frame capture after short delay
      setTimeout(() => {
        captureFrameAndAnalyze();
      }, 1000);

    } catch (err: any) {
      console.error('Failed to get screen/media capture:', err);
      alert(err.message || 'Screen capture access denied or not supported in this browser context.');
      stopScreenStream();
    }
  };

  const stopScreenStream = () => {
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
      streamIntervalRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsStreaming(false);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className={`relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/10 bg-gradient-to-r from-violet-600/20 via-cyan-600/20 to-emerald-600/20">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                <Monitor size={22} className="animate-pulse" />
              </div>
              <div>
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <span>AI Screen Capture & Vision Stream</span>
                  <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] uppercase font-mono tracking-wider border border-cyan-500/30">
                    MediaProjection / DisplayMedia
                  </span>
                </h3>
                <p className="text-xs text-slate-400">Capture 10–15 FPS screen frames, analyze with Gemini AI Vision & Speak with TTS</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          {/* Main Content Layout */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Left Column: Screen Viewfinder & Frame Controls */}
            <div className="flex flex-col gap-4">
              <div className="relative aspect-video rounded-2xl overflow-hidden bg-black border border-white/10 flex items-center justify-center group shadow-xl">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-contain ${isStreaming ? 'block' : 'hidden'}`}
                />
                <canvas ref={canvasRef} className="hidden" />

                {!isStreaming && (
                  <div className="flex flex-col items-center justify-center p-6 text-center text-slate-400">
                    <Monitor size={48} className="text-cyan-400 mb-3 opacity-60 animate-bounce" />
                    <p className="font-bold text-sm text-slate-200">No Active Screen Stream</p>
                    <p className="text-xs text-slate-400 max-w-xs mt-1">
                      Click 'Start Capture' to share your screen or app window for real-time AI visual analysis.
                    </p>
                  </div>
                )}

                {/* Live Streaming Badge */}
                {isStreaming && (
                  <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-red-500/80 backdrop-blur-md text-white text-xs font-bold flex items-center gap-2 shadow-lg animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                    <span>LIVE SCREEN CAPTURE ({fps} FPS)</span>
                  </div>
                )}

                {/* AI Analyzing Indicator */}
                {isAnalyzing && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-2 text-cyan-300">
                    <RefreshCw size={28} className="animate-spin text-cyan-400" />
                    <span className="text-xs font-bold tracking-wide">Gemini Vision Analyzing Frame...</span>
                  </div>
                )}
              </div>

              {/* Stream Controls Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                {!isStreaming ? (
                  <button
                    onClick={startScreenStream}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-all hover:scale-[1.01]"
                  >
                    <Play size={16} className="fill-current" />
                    <span>Start Screen Capture</span>
                  </button>
                ) : (
                  <button
                    onClick={stopScreenStream}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    <Square size={16} className="fill-current" />
                    <span>Stop Screen Stream</span>
                  </button>
                )}

                <button
                  onClick={captureFrameAndAnalyze}
                  disabled={!isStreaming || isAnalyzing}
                  className="py-2.5 px-4 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-bold text-sm hover:bg-cyan-500/25 disabled:opacity-40 flex items-center gap-2 cursor-pointer transition-all"
                >
                  <Eye size={16} />
                  <span>Analyze Frame Now</span>
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="py-2.5 px-3 rounded-xl bg-violet-500/15 border border-violet-500/30 text-violet-300 font-bold text-xs hover:bg-violet-500/25 flex items-center gap-1.5 cursor-pointer transition-all"
                  title="Upload a screenshot photo for frame analysis"
                >
                  <Eye size={14} />
                  <span>Upload Screenshot</span>
                </button>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleScreenshotUpload}
                  accept="image/*"
                  className="hidden"
                />

                <button
                  onClick={() => setTtsEnabled(!ttsEnabled)}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                    ttsEnabled ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'bg-slate-700 border-slate-600 text-slate-400'
                  }`}
                  title={ttsEnabled ? 'Voice TTS Enabled' : 'Voice TTS Muted'}
                >
                  {ttsEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                </button>
              </div>

              {/* Custom AI Prompt Box */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                  <Sparkles size={13} className="text-amber-400" />
                  <span>Vision Analysis Prompt</span>
                </label>
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Ask Gemini vision what to check on your screen..."
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm border bg-slate-800/80 border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>

            {/* Right Column: AI Live Speech Output & History */}
            <div className="flex flex-col gap-4">
              
              {/* Latest AI Output Box */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-950/40 via-slate-900 to-slate-950 border border-cyan-500/30 shadow-lg flex flex-col gap-3 min-h-[160px]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles size={14} /> AI Vision Analysis & Voice Response
                  </span>
                  {aiResponse && ttsEnabled && (
                    <button
                      onClick={() => speakText(aiResponse)}
                      className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer font-semibold"
                    >
                      <Volume2 size={12} /> Speak
                    </button>
                  )}
                </div>

                <div className="text-sm text-slate-200 leading-relaxed font-sans min-h-[80px] bg-slate-950/60 p-3 rounded-xl border border-white/5">
                  {aiResponse || (
                    <span className="text-slate-500 italic">
                      AI response will appear here in real time and read back using Text-to-Speech...
                    </span>
                  )}
                </div>

                {onSendToChat && aiResponse && (
                  <button
                    onClick={() => {
                      onSendToChat(`[Screen Capture Analysis]\n${aiResponse}`, lastFrameBase64 || undefined);
                      onClose();
                    }}
                    className="self-end py-1.5 px-3 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-xs font-bold flex items-center gap-1.5 hover:bg-cyan-500/30 cursor-pointer transition-all"
                  >
                    <Send size={12} />
                    <span>Send Analysis to Chat</span>
                  </button>
                )}
              </div>

              {/* History Frame Log */}
              <div className="flex-1 flex flex-col gap-2 max-h-[280px] overflow-y-auto pr-1">
                <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                  <Layers size={13} /> Frame History Logs ({historyLogs.length})
                </span>

                {historyLogs.length === 0 ? (
                  <p className="text-xs text-slate-500 italic p-3 rounded-xl bg-slate-800/30 border border-slate-700/30">
                    No captured frames yet.
                  </p>
                ) : (
                  historyLogs.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 flex items-start gap-3 text-xs"
                    >
                      {item.imageBase64 && (
                        <img
                          src={item.imageBase64}
                          alt="frame"
                          className="w-14 h-10 rounded-lg object-cover bg-black/40 border border-white/10 shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between text-[10px] text-cyan-400 font-mono mb-1">
                          <span>{item.time}</span>
                          <button
                            onClick={() => speakText(item.text)}
                            className="text-emerald-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                          >
                            <Volume2 size={10} /> TTS
                          </button>
                        </div>
                        <p className="text-slate-300 line-clamp-2 leading-relaxed">{item.text}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

            </div>

          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
