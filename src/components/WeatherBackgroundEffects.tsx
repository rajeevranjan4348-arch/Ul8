import React, { useMemo, useEffect, useState } from 'react';

interface WeatherBackgroundEffectsProps {
  code: number;
  isWidget?: boolean;
  isBoostEnabled?: boolean;
}

export const WeatherBackgroundEffects: React.FC<WeatherBackgroundEffectsProps> = ({ code, isWidget = false, isBoostEnabled = false }) => {
  // Get current hour to update visual color schemes
  const [currentHour, setCurrentHour] = useState(() => new Date().getHours());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentHour(new Date().getHours());
    }, 60000); // sync every minute
    return () => clearInterval(interval);
  }, []);

  // Determine effect type based on weather code
  const effectType = useMemo(() => {
    if (code === 0 || code === 1) return 'sunny';
    if (code === 2 || code === 3) return 'cloudy';
    if (code === 45 || code === 48) return 'foggy';
    if (code >= 51 && code <= 55) return 'drizzle';
    if (code >= 61 && code <= 65) return 'rainy';
    if (code >= 71 && code <= 75) return 'snowy';
    if (code >= 95 && code <= 99) return 'thunderstorm';
    return 'sunny';
  }, [code]);

  // Determine ambient time cycle: 'morning', 'day', 'sunset', or 'night'
  const timeCycle = useMemo(() => {
    if (currentHour >= 5 && currentHour < 8) return 'morning';
    if (currentHour >= 8 && currentHour < 17) return 'day';
    if (currentHour >= 17 && currentHour < 20) return 'sunset';
    return 'night';
  }, [currentHour]);

  // Generate randomized particles for rain, snow, etc.
  const particles = useMemo(() => {
    const items = [];
    
    if (effectType === 'rainy' || effectType === 'thunderstorm') {
      let count = isWidget ? 25 : 75;
      if (isBoostEnabled) count = Math.ceil(count * 0.35); // 65% reduction for smoother rendering
      for (let i = 0; i < count; i++) {
        items.push({
          id: `rain-${i}`,
          left: `${Math.random() * 115 - 7.5}%`,
          delay: `${Math.random() * 2}s`,
          duration: `${0.5 + Math.random() * 0.5}s`,
          opacity: 0.15 + Math.random() * 0.45,
          length: `${18 + Math.random() * 22}px`,
        });
      }
    } else if (effectType === 'drizzle') {
      let count = isWidget ? 15 : 45;
      if (isBoostEnabled) count = Math.ceil(count * 0.35); // 65% reduction
      for (let i = 0; i < count; i++) {
        items.push({
          id: `drizzle-${i}`,
          left: `${Math.random() * 105 - 2.5}%`,
          delay: `${Math.random() * 3}s`,
          duration: `${1.1 + Math.random() * 0.7}s`,
          opacity: 0.12 + Math.random() * 0.3,
          length: `${9 + Math.random() * 11}px`,
        });
      }
    } else if (effectType === 'snowy') {
      let count = isWidget ? 20 : 60;
      if (isBoostEnabled) count = Math.ceil(count * 0.35); // 65% reduction
      for (let i = 0; i < count; i++) {
        items.push({
          id: `snow-${i}`,
          left: `${Math.random() * 100}%`,
          delay: `${Math.random() * 5}s`,
          duration: `${3.0 + Math.random() * 3.5}s`,
          size: `${2 + Math.random() * 4.5}px`,
          opacity: 0.25 + Math.random() * 0.65,
          sway: `${25 + Math.random() * 45}px`,
        });
      }
    } else if (effectType === 'cloudy') {
      let count = isWidget ? 3 : 8;
      if (isBoostEnabled) count = Math.ceil(count * 0.4); // 60% reduction
      for (let i = 0; i < count; i++) {
        items.push({
          id: `cloud-${i}`,
          top: `${8 + Math.random() * 45}%`,
          delay: `${-Math.random() * 80}s`,
          duration: `${50 + Math.random() * 50}s`,
          size: `${120 + Math.random() * 180}px`,
          opacity: 0.05 + Math.random() * 0.1,
        });
      }
    } else if (effectType === 'foggy') {
      let count = isWidget ? 3 : 6;
      if (isBoostEnabled) count = Math.ceil(count * 0.5); // 50% reduction
      for (let i = 0; i < count; i++) {
        items.push({
          id: `fog-${i}`,
          top: `${25 + Math.random() * 55}%`,
          delay: `${-Math.random() * 25}s`,
          duration: `${18 + Math.random() * 18}s`,
          opacity: 0.09 + Math.random() * 0.14,
          scale: 1 + Math.random() * 0.6,
        });
      }
    }
    
    return items;
  }, [effectType, isWidget, isBoostEnabled]);

  // Premium colors/gradients mapped to dynamic Sky Atmosphere & Parallax layers
  const themeStyles = useMemo(() => {
    // 1. SKY GRADIENT
    let skyGradient = 'bg-gradient-to-b from-sky-400 via-sky-300 to-blue-200';
    let sunMoonColor = 'text-amber-400';
    let mountainFar = 'fill-slate-400/50';
    let mountainMid = 'fill-slate-500/70';
    let waterColor = 'fill-blue-400/60';
    let wavePulseColor = 'rgba(191, 219, 254, 0.4)';

    // Adjust based on Weather Condition and Time Cycle
    if (effectType === 'thunderstorm' || effectType === 'rainy') {
      skyGradient = 'bg-gradient-to-b from-slate-800 via-slate-900 to-indigo-950';
      mountainFar = 'fill-slate-700/40';
      mountainMid = 'fill-slate-850/60';
      waterColor = 'fill-indigo-950/70';
      wavePulseColor = 'rgba(99, 102, 241, 0.15)';
    } else if (effectType === 'drizzle' || effectType === 'foggy') {
      skyGradient = 'bg-gradient-to-b from-zinc-700 via-slate-600 to-slate-800';
      mountainFar = 'fill-zinc-600/40';
      mountainMid = 'fill-zinc-700/60';
      waterColor = 'fill-zinc-800/70';
      wavePulseColor = 'rgba(212, 212, 216, 0.2)';
    } else if (effectType === 'snowy') {
      skyGradient = 'bg-gradient-to-b from-sky-100 via-slate-200 to-indigo-100';
      mountainFar = 'fill-slate-300/60';
      mountainMid = 'fill-slate-400/70';
      waterColor = 'fill-sky-200/50';
      wavePulseColor = 'rgba(255, 255, 255, 0.4)';
    } else {
      // Sunny / Cloudy clear skies depending on Time Cycle
      if (timeCycle === 'morning') {
        skyGradient = 'bg-gradient-to-b from-orange-400 via-pink-400 to-indigo-500';
        sunMoonColor = 'text-amber-300';
        mountainFar = 'fill-pink-600/30';
        mountainMid = 'fill-indigo-800/40';
        waterColor = 'fill-indigo-900/50';
        wavePulseColor = 'rgba(244, 63, 94, 0.25)';
      } else if (timeCycle === 'sunset') {
        skyGradient = 'bg-gradient-to-b from-red-500 via-orange-400 to-purple-800';
        sunMoonColor = 'text-orange-300';
        mountainFar = 'fill-purple-900/40';
        mountainMid = 'fill-fuchsia-950/50';
        waterColor = 'fill-fuchsia-900/40';
        wavePulseColor = 'rgba(239, 68, 68, 0.25)';
      } else if (timeCycle === 'night') {
        skyGradient = 'bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950';
        sunMoonColor = 'text-slate-200';
        mountainFar = 'fill-slate-900/60';
        mountainMid = 'fill-indigo-950/80';
        waterColor = 'fill-slate-950/70';
        wavePulseColor = 'rgba(59, 130, 246, 0.1)';
      }
    }

    return { skyGradient, sunMoonColor, mountainFar, mountainMid, waterColor, wavePulseColor };
  }, [effectType, timeCycle]);

  // CSS rules embedded in style tag for portability and high frame-rate rendering
  const styles = `
    @keyframes rain-fall-effect {
      0% {
        transform: translateY(-20px) rotate(10deg);
        opacity: 0;
      }
      10% {
        opacity: var(--rain-opacity, 0.4);
      }
      90% {
        opacity: var(--rain-opacity, 0.4);
      }
      100% {
        transform: translateY(105%) rotate(10deg);
        opacity: 0;
      }
    }

    @keyframes snow-fall-effect {
      0% {
        transform: translateY(-10px) translateX(0) rotate(0deg);
        opacity: 0;
      }
      10% {
        opacity: var(--snow-opacity, 0.6);
      }
      90% {
        opacity: var(--snow-opacity, 0.6);
      }
      100% {
        transform: translateY(105%) translateX(var(--snow-sway, 40px)) rotate(360deg);
        opacity: 0;
      }
    }

    @keyframes cloud-drift-effect {
      0% {
        transform: translateX(-150%);
      }
      100% {
        transform: translateX(150%);
      }
    }

    @keyframes sun-glare-pulse-effect {
      0%, 100% {
        transform: scale(1) rotate(0deg);
        opacity: 0.15;
      }
      50% {
        transform: scale(1.15) rotate(180deg);
        opacity: 0.35;
      }
    }

    @keyframes sun-glare-outer-effect {
      0%, 100% {
        transform: scale(1);
        opacity: 0.2;
      }
      50% {
        transform: scale(1.08);
        opacity: 0.35;
      }
    }

    @keyframes sheet-lightning-flash {
      0%, 93%, 95%, 98%, 100% {
        opacity: 0;
      }
      94%, 97% {
        opacity: 0.32;
      }
    }

    @keyframes fog-drift-effect {
      0% {
        transform: translateX(-20%) scale(1);
      }
      50% {
        transform: translateX(20%) scale(1.15);
      }
      100% {
        transform: translateX(-20%) scale(1);
      }
    }

    @keyframes wave-ripple-left-right {
      0%, 100% {
        transform: translateX(-3%) scaleY(1);
      }
      50% {
        transform: translateX(3%) scaleY(1.03);
      }
    }

    @keyframes stars-twinkle-pulse {
      0%, 100% {
        opacity: 0.3;
      }
      50% {
        opacity: 1.0;
      }
    }

    .weather-rain-drop {
      position: absolute;
      width: 1px;
      background: linear-gradient(to bottom, rgba(255, 255, 255, 0), rgba(255, 255, 255, 0.85));
      animation: rain-fall-effect linear infinite;
      pointer-events: none;
    }

    .weather-drizzle-drop {
      position: absolute;
      width: 0.75px;
      background: linear-gradient(to bottom, rgba(255, 255, 255, 0), rgba(186, 230, 253, 0.65));
      animation: rain-fall-effect linear infinite;
      pointer-events: none;
    }

    .weather-snowflake {
      position: absolute;
      border-radius: 50%;
      background: white;
      animation: snow-fall-effect linear infinite;
      pointer-events: none;
      filter: blur(0.5px);
    }

    .weather-cloud-blob {
      position: absolute;
      border-radius: 50%;
      background: white;
      filter: blur(40px);
      animation: cloud-drift-effect linear infinite;
      pointer-events: none;
    }

    .weather-fog-blob {
      position: absolute;
      width: 280px;
      height: 130px;
      border-radius: 50%;
      background: rgba(220, 220, 230, 0.35);
      filter: blur(40px);
      animation: fog-drift-effect ease-in-out infinite;
      pointer-events: none;
    }

    .weather-star {
      position: absolute;
      background: white;
      border-radius: 50%;
      animation: stars-twinkle-pulse ease-in-out infinite;
    }

    .parallax-layer {
      transition: all 1.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
  `;

  return (
    <div className={`absolute inset-0 pointer-events-none overflow-hidden z-0 select-none ${themeStyles.skyGradient}`}>
      <style>{styles}</style>

      {/* 1. SPARKLING NIGHT STARS (If night clear/cloudy) */}
      {timeCycle === 'night' && (effectType === 'sunny' || effectType === 'cloudy') && (
        <div className="absolute inset-0">
          {Array.from({ length: isWidget ? 15 : 45 }).map((_, idx) => (
            <div 
              key={`star-${idx}`}
              className="weather-star"
              style={{
                top: `${Math.random() * 60}%`,
                left: `${Math.random() * 100}%`,
                width: `${1 + Math.random() * 2}px`,
                height: `${1 + Math.random() * 2}px`,
                animationDelay: `${Math.random() * 4}s`,
                animationDuration: `${1.5 + Math.random() * 2}s`
              }}
            />
          ))}
        </div>
      )}

      {/* 2. ATMOSPHERIC SUN / MOON DISPLAY */}
      <div className="absolute top-10 right-10 md:top-16 md:right-16 w-32 h-32 md:w-56 md:h-56 pointer-events-none">
        {timeCycle === 'night' ? (
          // Radiant glowing Crescent Moon
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-14 h-14 md:w-24 md:h-24 rounded-full bg-slate-200 shadow-[0_0_40px_rgba(255,255,255,0.4)] opacity-85">
              <div className="absolute -top-2 -right-2 w-14 h-14 md:w-24 md:h-24 rounded-full bg-slate-950 scale-95" />
            </div>
          </div>
        ) : (
          // Rotating radiating sun (Golden clear or glowing sunset)
          (effectType === 'sunny' || effectType === 'cloudy') && (
            <div className="relative w-full h-full">
              <div 
                className={`absolute inset-0 rounded-full bg-amber-400/10 blur-[80px] pointer-events-none animate-pulse`}
                style={{ animationDuration: '6s' }}
              />
              <div 
                className="absolute inset-0 rounded-full bg-gradient-to-tr from-amber-300/15 to-orange-500/5 animate-spin"
                style={{ 
                  animationDuration: '75s',
                  animationName: 'sun-glare-pulse-effect',
                  animationIterationCount: 'infinite',
                  animationTimingFunction: 'ease-in-out'
                }}
              />
              <div 
                className="absolute top-1/4 left-1/4 w-16 h-16 md:w-28 md:h-28 rounded-full bg-amber-300/25 blur-[15px]"
                style={{ 
                  animationName: 'sun-glare-outer-effect',
                  animationDuration: '5s',
                  animationIterationCount: 'infinite',
                  animationTimingFunction: 'ease-in-out'
                }}
              />
            </div>
          )
        )}
      </div>

      {/* 3. PARALLAX LANDSCAPE LAYERS (Distant Mountains, Midground Hills with Pine trees, Lake Water with Ripples) */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 w-full flex flex-col justify-end z-0">
        <svg 
          viewBox="0 0 1440 600" 
          className="w-full h-full object-cover translate-y-1" 
          preserveAspectRatio="none"
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Layer A: Far Distant Mountain Bezier Silhouettes */}
          <path 
            className={`parallax-layer ${themeStyles.mountainFar}`}
            d="M0,450 C240,320 480,380 720,410 C960,440 1200,310 1440,380 L1440,600 L0,600 Z" 
          />

          {/* Layer B: Midground Ridges with integrated pine tree accents */}
          <path 
            className={`parallax-layer ${themeStyles.mountainMid}`}
            d="M0,500 C150,440 300,490 500,470 C700,450 900,510 1100,460 C1250,420 1350,470 1440,490 L1440,600 L0,600 Z" 
          />
          
          {/* Layer C: Lakeside water with dynamic path ripples */}
          <path 
            className={`parallax-layer ${themeStyles.waterColor}`}
            d="M0,530 C300,535 600,515 900,525 C1200,535 1350,515 1440,520 L1440,600 L0,600 Z" 
          />

          {/* Dynamic Horizontal Water Ripples */}
          <g 
            className="parallax-layer" 
            style={{ 
              animation: 'wave-ripple-left-right 10s ease-in-out infinite',
              opacity: 0.65 
            }}
          >
            <path d="M120,545 C240,548 380,542 500,545 C620,548 760,542 880,545 C1000,548 1120,542 1250,545" stroke={themeStyles.wavePulseColor} strokeWidth="2" strokeLinecap="round" />
            <path d="M50,565 C180,568 320,562 460,565 C600,568 740,562 880,565 C1020,568 1160,562 1300,565" stroke={themeStyles.wavePulseColor} strokeWidth="1.5" strokeLinecap="round" />
            <path d="M180,580 C300,583 450,578 580,580 C710,583 850,578 980,580 C1110,583 1250,578 1380,580" stroke={themeStyles.wavePulseColor} strokeWidth="2.5" strokeLinecap="round" />
          </g>
        </svg>
      </div>

      {/* 4. DRIP-DOWN PARTICLES (Rain, Snow, Clouds, Fog, Thunderstorm Lightning Overlay) */}
      {/* CLOUDY */}
      {effectType === 'cloudy' && (
        <div className="absolute inset-0">
          {particles.map((p) => (
            <div
              key={p.id}
              className="weather-cloud-blob"
              style={{
                top: p.top,
                width: p.size,
                height: `calc(${p.size} * 0.6)`,
                opacity: p.opacity,
                animationDelay: p.delay,
                animationDuration: p.duration,
                left: '-15%',
              }}
            />
          ))}
        </div>
      )}

      {/* FOGGY */}
      {effectType === 'foggy' && (
        <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-[0.5px]">
          {particles.map((p) => (
            <div
              key={p.id}
              className="weather-fog-blob"
              style={{
                top: p.top,
                opacity: p.opacity,
                animationDelay: p.delay,
                animationDuration: p.duration,
                left: `${5 + Math.random() * 45}%`,
                transform: `scale(${p.scale})`,
              }}
            />
          ))}
        </div>
      )}

      {/* DRIZZLE */}
      {effectType === 'drizzle' && (
        <div className="absolute inset-0">
          {particles.map((p) => (
            <div
              key={p.id}
              className="weather-drizzle-drop"
              style={{
                left: p.left,
                height: p.length,
                animationDelay: p.delay,
                animationDuration: p.duration,
                '--rain-opacity': p.opacity,
              } as React.CSSProperties}
            />
          ))}
        </div>
      )}

      {/* RAINY */}
      {effectType === 'rainy' && (
        <div className="absolute inset-0">
          {particles.map((p) => (
            <div
              key={p.id}
              className="weather-rain-drop"
              style={{
                left: p.left,
                height: p.length,
                animationDelay: p.delay,
                animationDuration: p.duration,
                '--rain-opacity': p.opacity,
              } as React.CSSProperties}
            />
          ))}
        </div>
      )}

      {/* SNOWY */}
      {effectType === 'snowy' && (
        <div className="absolute inset-0">
          {particles.map((p) => (
            <div
              key={p.id}
              className="weather-snowflake"
              style={{
                left: p.left,
                width: p.size,
                height: p.size,
                animationDelay: p.delay,
                animationDuration: p.duration,
                '--snow-opacity': p.opacity,
                '--snow-sway': p.sway,
              } as React.CSSProperties}
            />
          ))}
        </div>
      )}

      {/* THUNDERSTORM WITH HEAVY PARTICLE DROPS & INTERACTIVE FLASHING SCREEN */}
      {effectType === 'thunderstorm' && (
        <div className="absolute inset-0">
          {/* Lightning Flash Overlay */}
          <div 
            className="absolute inset-0 bg-cyan-100/30 z-10 pointer-events-none"
            style={{
              animation: 'sheet-lightning-flash 6.5s infinite ease-out'
            }}
          />
          {particles.map((p) => (
            <div
              key={p.id}
              className="weather-rain-drop"
              style={{
                left: p.left,
                height: p.length,
                animationDelay: p.delay,
                animationDuration: p.duration,
                '--rain-opacity': p.opacity,
              } as React.CSSProperties}
            />
          ))}
        </div>
      )}
    </div>
  );
};
