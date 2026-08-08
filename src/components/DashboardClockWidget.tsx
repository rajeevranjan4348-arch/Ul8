import React, { useState, useEffect } from 'react';
import { Clock, Globe, Mic, Volume2, Sparkles, ShieldCheck } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface DashboardClockWidgetProps {
  onOpenVault: () => void;
  onOpenOfflineMap?: () => void;
}

export const DashboardClockWidget: React.FC<DashboardClockWidgetProps> = ({
  onOpenVault,
}) => {
  const { isDarkMode } = useTheme();
  const [time, setTime] = useState(new Date());
  const [clockStyle, setClockStyle] = useState<'digital' | 'analog'>('digital');

  // Voice Activation State
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [voiceFeedback, setVoiceFeedback] = useState<string | null>(null);

  // Hidden Tap Trigger for Secret Vault (No visible key icon or tap badge)
  const [tapCount, setTapCount] = useState(0);
  const [lastTapTime, setLastTapTime] = useState(0);
  const [showSecretHint, setShowSecretHint] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleClockTap = () => {
    const now = Date.now();
    if (now - lastTapTime < 800) {
      const newCount = tapCount + 1;
      setTapCount(newCount);
      if (newCount >= 3) {
        setTapCount(0);
        setShowSecretHint(true);
        setTimeout(() => setShowSecretHint(false), 2000);
        onOpenVault(); // Open Secret Vault!
      }
    } else {
      setTapCount(1);
    }
    setLastTapTime(now);
  };

  const handleVoiceActivation = (e: React.MouseEvent) => {
    e.stopPropagation();

    // Web Speech API Voice Recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        setIsVoiceListening(true);
        setVoiceFeedback('Listening for voice command...');

        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript.toLowerCase();
          setIsVoiceListening(false);
          setVoiceFeedback(`Recognized: "${transcript}"`);

          setTimeout(() => setVoiceFeedback(null), 3000);

          // Check if transcript triggers vault unlock
          if (
            transcript.includes('vault') || 
            transcript.includes('unlock') || 
            transcript.includes('open secret') ||
            transcript.includes('secret') ||
            transcript.includes('hey omni')
          ) {
            onOpenVault();
          }
        };

        recognition.onerror = () => {
          setIsVoiceListening(false);
          setVoiceFeedback('Voice trigger ready');
          setTimeout(() => setVoiceFeedback(null), 2000);
        };

        recognition.onend = () => {
          setIsVoiceListening(false);
        };

        recognition.start();
      } catch (err) {
        setIsVoiceListening(false);
        // Fallback directly
        onOpenVault();
      }
    } else {
      // Direct activation fallback
      onOpenVault();
    }
  };

  const hoursStr = time.toLocaleTimeString('en-US', { hour: '2-digit', hour12: true }).split(' ')[0];
  const minutesStr = time.getMinutes().toString().padStart(2, '0');
  const secondsStr = time.getSeconds().toString().padStart(2, '0');
  const ampmStr = time.getHours() >= 12 ? 'PM' : 'AM';
  const tzStr = Intl.DateTimeFormat().resolvedOptions().timeZone.replace('_', ' ');

  // Calculate analog hand angles
  const secAngle = (time.getSeconds() / 60) * 360;
  const minAngle = ((time.getMinutes() + time.getSeconds() / 60) / 60) * 360;
  const hourAngle = (((time.getHours() % 12) + time.getMinutes() / 60) / 12) * 360;

  return (
    <div className="relative group flex items-center gap-3">
      
      {/* Clock Widget with Voice Activation & Hidden Vault Tap Trigger */}
      <div
        onClick={handleClockTap}
        className="relative px-4 py-2.5 rounded-2xl bg-slate-900/80 hover:bg-slate-900 border border-violet-500/30 hover:border-violet-400/60 shadow-xl backdrop-blur-md text-right select-none transition-all hover:scale-[1.02] cursor-pointer flex items-center gap-3"
      >
        {/* Toggle Digital/Analog */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setClockStyle(prev => prev === 'digital' ? 'analog' : 'digital');
          }}
          className="p-1 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          title="Toggle Digital/Analog Clock"
        >
          <Clock size={16} className="text-violet-400" />
        </button>

        {clockStyle === 'digital' ? (
          <div>
            <div className="flex items-baseline gap-1 font-mono text-xl font-extrabold text-white tracking-wider">
              <span>{hoursStr}:{minutesStr}</span>
              <span className="text-xs text-violet-400 font-bold">{secondsStr}</span>
              <span className="text-[10px] text-amber-400 font-bold ml-0.5">{ampmStr}</span>
            </div>
            <div className="text-[10px] text-slate-400 font-medium flex items-center justify-end gap-1">
              <Globe size={10} className="text-violet-400" />
              <span>{tzStr}</span>
            </div>
          </div>
        ) : (
          /* Analog Clock View */
          <div className="flex items-center gap-3">
            <div className="relative w-9 h-9 rounded-full border-2 border-violet-500/50 bg-black/60 flex items-center justify-center">
              {/* Hour Hand */}
              <div
                className="absolute w-0.5 h-2.5 bg-white rounded-full origin-bottom"
                style={{ transform: `rotate(${hourAngle}deg)`, bottom: '50%' }}
              />
              {/* Minute Hand */}
              <div
                className="absolute w-0.5 h-3.5 bg-cyan-400 rounded-full origin-bottom"
                style={{ transform: `rotate(${minAngle}deg)`, bottom: '50%' }}
              />
              {/* Second Hand */}
              <div
                className="absolute w-0.5 h-4 bg-rose-400 rounded-full origin-bottom"
                style={{ transform: `rotate(${secAngle}deg)`, bottom: '50%' }}
              />
              <div className="w-1.5 h-1.5 bg-white rounded-full z-10" />
            </div>
            <div className="text-left font-mono text-xs">
              <div className="font-bold text-white">{hoursStr}:{minutesStr} {ampmStr}</div>
              <div className="text-[10px] text-slate-400">{tzStr}</div>
            </div>
          </div>
        )}

        {/* Voice Feedback Tooltip / Popup */}
        {voiceFeedback && (
          <div className="absolute -top-8 right-0 px-2.5 py-1 rounded-lg bg-emerald-500 text-slate-950 font-extrabold text-[10px] shadow-lg animate-pulse whitespace-nowrap">
            {voiceFeedback}
          </div>
        )}

        {/* Secret Hint Feedback (Only shows briefly when secret vault is unlocked) */}
        {showSecretHint && (
          <div className="absolute -top-8 left-0 px-2.5 py-1 rounded-lg bg-emerald-500 text-slate-950 font-extrabold text-[10px] shadow-lg animate-pulse whitespace-nowrap">
            Opening Vault 🔓
          </div>
        )}
      </div>

    </div>
  );
};
