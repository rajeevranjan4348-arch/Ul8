import React, { createContext, useContext, useState, useEffect, useRef, MouseEvent } from 'react';
import { motion, AnimatePresence, HTMLMotionProps } from 'motion/react';

// Sound Engine using Web Audio API (Synthesized live for robust, offline, zero-asset chimes)
class SoundEngine {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;

  constructor() {
    // Lazy initialized on first user interaction to comply with browser autoplay policies
  }

  private init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
  }

  setEnabled(val: boolean) {
    this.enabled = val;
  }

  playClick() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.1);

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    } catch (e) {
      console.warn('Audio click failed:', e);
    }
  }

  playHover() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.setValueAtTime(900, now + 0.02);

      gain.gain.setValueAtTime(0.015, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.06);
    } catch (e) {
      // Ignore audio errors
    }
  }

  playSuccess() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        
        gain.gain.setValueAtTime(0.0, now);
        gain.gain.linearRampToValueAtTime(0.05, now + idx * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.3);
        
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.35);
      });
    } catch (e) {
      // Ignore
    }
  }

  playError() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'sine';
      
      osc1.frequency.setValueAtTime(150, now);
      osc1.frequency.linearRampToValueAtTime(100, now + 0.25);
      
      osc2.frequency.setValueAtTime(147, now);
      osc2.frequency.linearRampToValueAtTime(97, now + 0.25);

      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      // Low pass filter for a deeper, softer thud
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(300, now);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.3);
      osc2.stop(now + 0.3);
    } catch (e) {
      // Ignore
    }
  }
}

export const sounds = new SoundEngine();

// Vibrations (Simulated/real haptics wrapper)
export const triggerHaptic = (type: 'light' | 'medium' | 'heavy' | 'success' | 'error') => {
  if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
    try {
      switch (type) {
        case 'light':
          window.navigator.vibrate(10);
          break;
        case 'medium':
          window.navigator.vibrate(25);
          break;
        case 'heavy':
          window.navigator.vibrate(55);
          break;
        case 'success':
          window.navigator.vibrate([15, 30, 20]);
          break;
        case 'error':
          window.navigator.vibrate([40, 50, 40]);
          break;
      }
    } catch (e) {
      // Ignore security errors
    }
  }
  // Also dispatch a lightweight custom event for visual haptic cues if debugging/requested
  window.dispatchEvent(new CustomEvent('premium-haptic-trigger', { detail: { type } }));
};

// Types & Interface for Context
interface PremiumEffectsContextProps {
  performanceMode: 'ultra' | 'low-end';
  setPerformanceMode: (mode: 'ultra' | 'low-end') => void;
  soundEnabled: boolean;
  setSoundEnabled: (val: boolean) => void;
  spawnParticles: (x: number, y: number, color?: string) => void;
}

const PremiumEffectsContext = createContext<PremiumEffectsContextProps | undefined>(undefined);

export const usePremiumEffects = () => {
  const context = useContext(PremiumEffectsContext);
  if (!context) {
    throw new Error('usePremiumEffects must be used within a PremiumEffectsProvider');
  }
  return context;
};

// Canvas-based hardware-accelerated 60-120 FPS Particle effect
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  color: string;
  decay: number;
}

export const PremiumEffectsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [performanceMode, setPerformanceMode] = useState<'ultra' | 'low-end'>('ultra');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const requestRef = useRef<number | null>(null);

  useEffect(() => {
    sounds.setEnabled(soundEnabled);
  }, [soundEnabled]);

  // Handle high-end vs low-end devices automatically (Media queries, memory indicator if available)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isLowMem = (navigator as any).deviceMemory && (navigator as any).deviceMemory < 4;
      const isLowCpu = (navigator as any).hardwareConcurrency && (navigator as any).hardwareConcurrency < 4;
      if (isLowMem || isLowCpu) {
        setPerformanceMode('low-end');
        console.info('[PremiumEffects] Automatic adaptation: Low-end device detected, optimizing blurs and particles.');
      }
    }
  }, []);

  const spawnParticles = (x: number, y: number, color?: string) => {
    if (performanceMode === 'low-end') return; // Skip heavy canvas drawing on low end devices
    const colors = color ? [color] : ['#22d3ee', '#818cf8', '#a78bfa', '#ec4899', '#38bdf8'];
    const maxParticles = 12;
    for (let i = 0; i < maxParticles; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 3.5;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 4,
        alpha: 1,
        color: colors[Math.floor(Math.random() * colors.length)],
        decay: 0.015 + Math.random() * 0.02
      });
    }
    // Limit total particles for high frame rates
    if (particlesRef.current.length > 150) {
      particlesRef.current = particlesRef.current.slice(-150);
    }
  };

  // Click tracker for global canvas particle emission
  const handleGlobalClick = (e: MouseEvent) => {
    // Add sound on global tapping
    sounds.playClick();
    // Light type haptic rumble trigger on tap
    triggerHaptic('light');
  };

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const particles = particlesRef.current;

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.04; // Add slight gravity
        p.vx *= 0.98; // Friction
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      requestRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [performanceMode]);

  return (
    <PremiumEffectsContext.Provider
      value={{
        performanceMode,
        setPerformanceMode,
        soundEnabled,
        setSoundEnabled,
        spawnParticles
      }}
    >
      <div 
        onClick={(e: any) => handleGlobalClick(e)}
        className="w-full h-full relative"
      >
        {/* Particle Canvas layer (Global backdrop, click-through, hardware-accelerated) */}
        {performanceMode === 'ultra' && (
          <canvas
            ref={canvasRef}
            className="fixed inset-0 pointer-events-none z-50 mix-blend-screen"
            style={{ willChange: 'transform' }}
          />
        )}
        {children}
      </div>
    </PremiumEffectsContext.Provider>
  );
};

// ─── PREMIUM INTERACTIVE BUTTON ───
// Built with spring dynamics, sound play, ripple integration, and scale bounce
interface PremiumButtonProps extends HTMLMotionProps<'button'> {
  children: React.ReactNode;
  accentColor?: string;
  hapticType?: 'light' | 'medium' | 'heavy' | 'success';
}

export const PremiumButton: React.FC<PremiumButtonProps> = ({
  children,
  accentColor,
  hapticType = 'light',
  onClick,
  onMouseEnter,
  className = '',
  ...props
}) => {
  const { performanceMode } = usePremiumEffects();
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    triggerHaptic(hapticType);
    sounds.playClick();

    // Calculate ripple coordinates inside the button
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setRipples(prev => [...prev, { id: Date.now(), x, y }]);
  };

  const cleanRipple = (id: number) => {
    setRipples(prev => prev.filter(r => r.id !== id));
  };

  const triggerHoverSound = () => {
    sounds.playHover();
  };

  // Adaptation: simplified springs for low-end devices
  const springTransition = performanceMode === 'ultra'
    ? { type: 'spring' as const, stiffness: 500, damping: 15, mass: 0.5 }
    : { type: 'tween' as const, ease: 'easeInOut' as const, duration: 0.15 };

  return (
    <motion.button
      whileHover={{ scale: 1.03, y: -1 }}
      whileTap={{ scale: 0.96 }}
      transition={springTransition}
      onPointerDown={handlePointerDown}
      onMouseEnter={(e) => {
        triggerHoverSound();
        if (onMouseEnter) onMouseEnter(e as any);
      }}
      onClick={onClick}
      className={`relative overflow-hidden cursor-pointer select-none ${className}`}
      {...props}
    >
      {/* Ripple Animation Layer */}
      <AnimatePresence>
        {ripples.map(ripple => (
          <motion.span
            key={ripple.id}
            initial={{ scale: 0, opacity: 0.4 }}
            animate={{ scale: 3.5, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            onAnimationComplete={() => cleanRipple(ripple.id)}
            style={{
              position: 'absolute',
              top: ripple.y - 12,
              left: ripple.x - 12,
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              backgroundColor: accentColor || 'rgba(255, 255, 255, 0.25)',
              pointerEvents: 'none',
              zIndex: 0
            }}
          />
        ))}
      </AnimatePresence>
      <span className="relative z-10 flex items-center justify-center gap-1.5">{children}</span>
    </motion.button>
  );
};

// ─── PREMIUM DECORATIVE/CONTAINER CARD ───
// Features high-end glassmorphism, hardware acceleration, layout animations, and card lifts
interface PremiumCardProps {
  children: React.ReactNode;
  glowColor?: string;
  interactive?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  id?: string;
}

export const PremiumCard: React.FC<PremiumCardProps> = ({
  children,
  glowColor = 'rgba(6, 182, 212, 0.08)',
  interactive = false,
  className = '',
  style,
  onClick,
  id
}) => {
  const { performanceMode } = usePremiumEffects();

  // Glassmorphic adaptation based on device capabilities
  const glassStyle = performanceMode === 'ultra'
    ? 'backdrop-blur-xl bg-slate-900/40 border-white/5 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]'
    : 'bg-slate-900/85 border-slate-800 shadow-md';

  const motionProps = interactive ? {
    whileHover: { scale: 1.015, y: -2, boxShadow: `0px 10px 30px ${glowColor}` },
    whileTap: { scale: 0.99 },
    transition: { type: 'spring' as const, stiffness: 300, damping: 20 }
  } : {};

  return (
    <motion.div
      {...motionProps}
      className={`rounded-2xl border transition-all duration-300 ${glassStyle} ${className}`}
      style={{
        position: 'relative',
        overflow: 'hidden',
        willChange: 'transform',
        ...style
      }}
      onClick={onClick}
      id={id}
    >
      {/* Subtle Internal Gradient Glow */}
      {performanceMode === 'ultra' && (
        <div 
          className="absolute -inset-px rounded-2xl pointer-events-none transition-opacity opacity-40"
          style={{
            background: `radial-gradient(120px circle at 50% 0px, ${glowColor}, transparent)`
          }}
        />
      )}
      {children}
    </motion.div>
  );
};

// ─── SHIMMER SKELETON / LOADING LOADER ───
// Ultra-premium layout transitions with animated gradient swipes
export const ShimmerLoading: React.FC<{ className?: string }> = ({ className = 'h-4 w-full' }) => {
  return (
    <div className={`relative overflow-hidden rounded-xl bg-slate-800/40 border border-slate-700/30 ${className}`}>
      <motion.div
        animate={{ x: ['-100%', '100%'] }}
        transition={{ repeat: Infinity, duration: 1.3, ease: 'linear' }}
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
        style={{ willChange: 'transform' }}
      />
    </div>
  );
};

export const SkeletonScreen: React.FC = () => {
  return (
    <div className="space-y-3.5 p-4 w-full">
      <div className="flex items-center gap-3">
        <ShimmerLoading className="w-10 h-10 rounded-full" />
        <div className="space-y-1.5 flex-1">
          <ShimmerLoading className="h-3 w-1/4" />
          <ShimmerLoading className="h-2 w-1/2" />
        </div>
      </div>
      <ShimmerLoading className="h-16 w-full rounded-2xl" />
      <ShimmerLoading className="h-4 w-5/6" />
      <ShimmerLoading className="h-4 w-4/6" />
    </div>
  );
};
