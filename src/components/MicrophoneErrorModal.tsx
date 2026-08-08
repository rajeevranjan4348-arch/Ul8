import React from 'react';
import { X, AlertTriangle, MicOff, ExternalLink, Lock, Settings } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';

export const MicrophoneErrorModal: React.FC = () => {
  const { micPermissionError, setMicPermissionError } = useSettings();

  if (!micPermissionError) return null;

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in"
      id="mic-error-backdrop"
      onClick={() => setMicPermissionError(false)}
    >
      <div 
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-red-500/20 bg-slate-950/90 p-6 shadow-2xl shadow-red-500/10 md:p-8 animate-scale-in"
        onClick={e => e.stopPropagation()}
        id="mic-error-container"
      >
        {/* Background Decorative Blur */}
        <div className="absolute -top-12 -left-12 w-32 h-32 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button 
          onClick={() => setMicPermissionError(false)}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all"
          title="Dismiss"
          id="mic-error-close-btn"
        >
          <X size={18} />
        </button>

        {/* Header Icon */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
            <MicOff size={24} className="animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white tracking-tight">Microphone Access Denied</h2>
            <p className="text-xs text-slate-400 mt-0.5">Permission blocked by browser settings</p>
          </div>
        </div>

        {/* Context / Cause */}
        <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-800/80 mb-6 text-sm text-slate-300 leading-relaxed">
          <span className="font-semibold text-slate-200">Why did this happen?</span> Modern web browsers block microphone and camera access inside sandboxed <span className="text-violet-400 font-medium">iframes</span> (like this preview pane) for security.
        </div>

        {/* Fix Steps */}
        <div className="space-y-4 mb-8">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Recommended Solutions</h3>

          {/* Step 1: Open in New Tab */}
          <div className="flex gap-3 items-start">
            <div className="flex h-6 w-6 mt-0.5 shrink-0 items-center justify-center rounded-md bg-violet-500/15 text-violet-400 border border-violet-500/10 text-xs font-bold">
              1
            </div>
            <div>
              <p className="text-sm font-medium text-slate-200 flex items-center gap-1.5">
                Open App in a New Tab
                <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-emerald-500/10 text-emerald-400 rounded">Recommended</span>
              </p>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                Click the <strong className="text-slate-300">"Open App in New Tab"</strong> button in the very top-right of the AI Studio preview to bypass iframe sandboxing and trigger the browser's native microphone request.
              </p>
            </div>
          </div>

          {/* Step 2: Address Bar Permission */}
          <div className="flex gap-3 items-start">
            <div className="flex h-6 w-6 mt-0.5 shrink-0 items-center justify-center rounded-md bg-violet-500/15 text-violet-400 border border-violet-500/10 text-xs font-bold">
              2
            </div>
            <div>
              <p className="text-sm font-medium text-slate-200">Allow in Browser Address Bar</p>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                Look for a <strong className="text-slate-300">microphone icon with a red slash</strong> or a <strong className="text-slate-300">lock icon</strong> in the left of the address bar. Click it, then change the permission settings to <strong className="text-emerald-400 font-semibold">Allow</strong>.
              </p>
            </div>
          </div>

          {/* Step 3: Device Preferences */}
          <div className="flex gap-3 items-start">
            <div className="flex h-6 w-6 mt-0.5 shrink-0 items-center justify-center rounded-md bg-violet-500/15 text-violet-400 border border-violet-500/10 text-xs font-bold">
              3
            </div>
            <div>
              <p className="text-sm font-medium text-slate-200">Select Input Device</p>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                Ensure your preferred microphone is connected, active, and selected as the input source under <strong className="text-slate-300">Settings &gt; Audio Settings</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <button
            onClick={() => setMicPermissionError(false)}
            className="flex-1 justify-center py-2.5 px-4 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-md shadow-violet-900/20 active:scale-[0.98] transition-all flex items-center gap-2"
            id="mic-error-tab-btn"
          >
            <span>Got it, thank you</span>
          </button>
          <button
            onClick={() => setMicPermissionError(false)}
            className="sm:px-6 py-2.5 rounded-xl text-sm font-medium text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-all active:scale-[0.98]"
            id="mic-error-dismiss-btn"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
