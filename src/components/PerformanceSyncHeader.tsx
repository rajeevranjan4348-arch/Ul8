import React, { useState, useEffect } from 'react';
import { Activity, RefreshCw, Zap, ShieldCheck, Gauge, Check } from 'lucide-react';
import { PerfMetrics } from '../hooks/useGlobalPerfObserver';
import { instantSyncEngine, SyncPayload } from '../services/instantSync';

interface PerformanceSyncHeaderProps {
  metrics: PerfMetrics;
  targetFps: number;
  onTargetFpsChange: (fps: number) => void;
}

export const PerformanceSyncHeader: React.FC<PerformanceSyncHeaderProps> = ({
  metrics,
  targetFps,
  onTargetFpsChange,
}) => {
  const [syncPulse, setSyncPulse] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('Live');
  const [showFpsMenu, setShowFpsMenu] = useState(false);

  useEffect(() => {
    const unsubscribe = instantSyncEngine.subscribe((payload: SyncPayload) => {
      setSyncPulse(true);
      const timeStr = new Date(payload.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastSyncTime(timeStr);
      setTimeout(() => setSyncPulse(false), 1000);
    });

    return () => unsubscribe();
  }, []);

  const triggerInstantManualSync = () => {
    instantSyncEngine.publish('system', 'manual_sync_trigger', { time: Date.now() });
  };

  const getFpsColor = (fps: number, target: number) => {
    if (fps >= target - 5) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if (fps >= 50) return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30';
    return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
  };

  return (
    <div className="w-full bg-slate-900/80 border-b border-slate-800 px-3 sm:px-6 py-2 flex items-center justify-between gap-2 backdrop-blur-md text-xs z-30 select-none">
      {/* Left: 90 FPS Target & Meter */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <button
            onClick={() => setShowFpsMenu(!showFpsMenu)}
            className={`px-2.5 py-1 rounded-xl border flex items-center gap-1.5 font-mono font-bold transition-all cursor-pointer ${getFpsColor(metrics.fps, targetFps)} hover:scale-105`}
            title="Click to adjust Target FPS (60 / 90 / 120 FPS)"
          >
            <Gauge size={13} className="text-cyan-400" />
            <span>{metrics.fps} FPS</span>
            <span className="text-[10px] opacity-60 font-sans font-semibold">({targetFps} Target)</span>
          </button>

          {showFpsMenu && (
            <div className="absolute top-full left-0 mt-1.5 w-36 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1 z-50 flex flex-col gap-0.5">
              <div className="px-2 py-1 text-[10px] font-extrabold uppercase text-slate-400">Target Frame Rate</div>
              {[60, 90, 120].map((rate) => (
                <button
                  key={rate}
                  onClick={() => {
                    onTargetFpsChange(rate);
                    setShowFpsMenu(false);
                  }}
                  className={`px-2 py-1.5 rounded-lg text-left text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${
                    targetFps === rate ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span>{rate} FPS {rate === 90 ? '(Ultra)' : ''}</span>
                  {targetFps === rate && <Check size={12} className="text-cyan-400" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Boost Badge */}
        {metrics.isBoostActive && (
          <span className="hidden md:inline-flex px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-extrabold items-center gap-1 animate-pulse">
            <Zap size={10} />
            <span>GPU Boost Active</span>
          </span>
        )}
      </div>

      {/* Middle: Instant Sync Controller */}
      <div className="flex items-center gap-2">
        <button
          onClick={triggerInstantManualSync}
          className={`px-2.5 py-1 rounded-xl border transition-all flex items-center gap-1.5 font-bold cursor-pointer ${
            syncPulse
              ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-md shadow-emerald-500/20 scale-105'
              : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:border-slate-600 hover:text-white'
          }`}
          title="Instant cross-component & multi-tab synchronization"
        >
          <RefreshCw size={12} className={`text-emerald-400 ${syncPulse ? 'animate-spin' : ''}`} />
          <span className="text-[11px]">Instant Sync</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
        </button>
      </div>

      {/* Right: AI Auto-Fix Health Status */}
      <div className="flex items-center gap-2">
        <div className="px-2.5 py-1 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-extrabold flex items-center gap-1.5 text-[11px]">
          <ShieldCheck size={13} className="text-cyan-400" />
          <span className="hidden sm:inline">AI Auto-Fix:</span>
          <span className="text-emerald-400">100% Healthy</span>
        </div>
      </div>
    </div>
  );
};
