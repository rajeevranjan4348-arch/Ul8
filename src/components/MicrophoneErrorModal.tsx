import React, { useState } from 'react';
import { X, MicOff, Mic, CheckCircle2, Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';

export const MicrophoneErrorModal: React.FC = () => {
  const { micPermissionError, setMicPermissionError } = useSettings();
  const [testingMic, setTestingMic] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'failed' | null>(null);

  if (!micPermissionError) return null;

  const handleRequestMicPermission = async () => {
    setTestingMic(true);
    setTestResult(null);
    try {
      if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        setTestResult('success');
        setTimeout(() => {
          setMicPermissionError(false);
          setTestResult(null);
        }, 1200);
      } else {
        setTestResult('failed');
      }
    } catch (e: any) {
      console.warn('Microphone permission request was denied or unavailable in this iframe context:', e);
      setTestResult('failed');
    } finally {
      setTestingMic(false);
    }
  };

  const handleSimulateVoice = () => {
    setMicPermissionError(false);
    // Dispatch a simulated voice command to the app
    const simulatedQueries = [
      "What are the best places to visit in Japan?",
      "Explain the theory of relativity simply.",
      "Write a short python function for binary search.",
      "Summarize the latest AI breakthrough."
    ];
    const chosen = simulatedQueries[Math.floor(Math.random() * simulatedQueries.length)];
    localStorage.setItem('omnichat_pending_query', chosen);
    window.dispatchEvent(new CustomEvent('workspace-insert-text', { detail: chosen }));
  };

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      id="mic-error-backdrop"
      onClick={() => setMicPermissionError(false)}
    >
      <div 
        className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-violet-500/30 bg-slate-950/95 p-6 shadow-2xl shadow-violet-500/10 md:p-8 animate-scale-in"
        onClick={e => e.stopPropagation()}
        id="mic-error-container"
      >
        {/* Background Decorative Blur */}
        <div className="absolute -top-12 -left-12 w-32 h-32 bg-red-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-violet-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button 
          onClick={() => setMicPermissionError(false)}
          className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
          title="Dismiss"
          id="mic-error-close-btn"
        >
          <X size={18} />
        </button>

        {/* Header Icon */}
        <div className="flex items-center gap-4 mb-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500/20 to-violet-500/20 text-red-400 border border-red-500/30 shadow-inner">
            <MicOff size={24} className="animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Microphone Access Notice</h2>
            <p className="text-xs text-slate-400 mt-0.5">Browser microphone permissions or iframe sandboxing</p>
          </div>
        </div>

        {/* Status Message */}
        <div className="bg-slate-900/80 rounded-2xl p-4 border border-slate-800 mb-5 text-xs sm:text-sm text-slate-300 leading-relaxed space-y-2">
          <p>
            <strong className="text-white font-semibold">Why does this happen?</strong> Modern browsers restrict microphone hardware access inside embedded preview frames for security.
          </p>
          <p className="text-slate-400 text-xs">
            You can grant microphone access directly, open the app in a new tab, or use simulated voice input below.
          </p>
        </div>

        {/* Action feedback */}
        {testResult === 'success' && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 animate-fade-in">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span>Microphone access granted successfully! Resuming...</span>
          </div>
        )}

        {testResult === 'failed' && (
          <div className="mb-4 p-3 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs flex items-center gap-2 animate-fade-in">
            <AlertCircle size={16} className="text-amber-400 shrink-0" />
            <span>Still blocked in this frame. Open in New Tab or use Simulate Voice Input.</span>
          </div>
        )}

        {/* Solution Steps */}
        <div className="space-y-3 mb-6 text-xs text-slate-300">
          <div className="flex gap-3 items-start p-2.5 rounded-xl bg-slate-900/40 border border-white/5">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-violet-500/20 text-violet-400 font-bold text-[10px]">
              1
            </div>
            <div>
              <span className="font-semibold text-white">Click "Request Mic Access" below</span>
              <p className="text-[11px] text-slate-400 mt-0.5">Triggers your browser's native permission prompt directly.</p>
            </div>
          </div>

          <div className="flex gap-3 items-start p-2.5 rounded-xl bg-slate-900/40 border border-white/5">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-indigo-500/20 text-indigo-400 font-bold text-[10px]">
              2
            </div>
            <div>
              <span className="font-semibold text-white">Open in New Tab</span>
              <p className="text-[11px] text-slate-400 mt-0.5">Click the "Open App in New Tab" icon in top-right for direct hardware access.</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <button
            onClick={handleRequestMicPermission}
            disabled={testingMic}
            className="flex-1 justify-center py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-md shadow-violet-900/20 active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            id="mic-error-request-btn"
          >
            {testingMic ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Checking...</span>
              </>
            ) : (
              <>
                <Mic size={14} />
                <span>Request Mic Access</span>
              </>
            )}
          </button>

          <button
            onClick={handleSimulateVoice}
            className="flex-1 justify-center py-2.5 px-4 rounded-xl text-xs font-semibold text-cyan-300 bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
            id="mic-error-simulate-btn"
          >
            <Sparkles size={14} className="text-cyan-400" />
            <span>Simulate Voice Input</span>
          </button>

          <button
            onClick={() => setMicPermissionError(false)}
            className="px-4 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-all cursor-pointer"
            id="mic-error-dismiss-btn"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
