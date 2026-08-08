import { useEffect, useState, useRef } from 'react';

export interface PerfMetrics {
  fps: number;
  targetFps: number;
  isBoostActive: boolean;
  frameDropCount: number;
  avgFrameTimeMs: number;
}

export function useGlobalPerfObserver(initialTargetFps: number = 90) {
  const [metrics, setMetrics] = useState<PerfMetrics>({
    fps: 90,
    targetFps: initialTargetFps,
    isBoostActive: false,
    frameDropCount: 0,
    avgFrameTimeMs: 11.1, // 1000/90 = ~11.1ms per frame for 90 FPS
  });

  const [targetFps, setTargetFps] = useState<number>(initialTargetFps);
  const targetFpsRef = useRef<number>(initialTargetFps);

  useEffect(() => {
    targetFpsRef.current = targetFps;
  }, [targetFps]);

  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let lowFpsCount = 0;
    let highFpsCount = 0;
    let totalFrameTime = 0;
    let animationFrameId: number;

    const checkPerformance = (now: number) => {
      frameCount++;
      const frameDelta = now - (lastTime || now);
      totalFrameTime += frameDelta;

      // Sample metrics every 400ms for fast feedback
      if (now - lastTime >= 400) {
        const elapsed = now - lastTime;
        const currentFps = Math.min(120, Math.round((frameCount * 1000) / elapsed));
        const avgFrameTime = totalFrameTime / frameCount;

        frameCount = 0;
        totalFrameTime = 0;
        lastTime = now;

        const lowFpsThreshold = Math.min(45, targetFpsRef.current * 0.55);
        const highFpsThreshold = Math.min(115, targetFpsRef.current * 0.85);

        let boostActive = document.body.classList.contains('perf-boost');

        if (currentFps < lowFpsThreshold) {
          lowFpsCount++;
          highFpsCount = 0;
          if (lowFpsCount >= 2 && !boostActive) {
            document.body.classList.add('perf-boost');
            boostActive = true;
            console.warn(`[90 FPS Engine] Frame drops detected (${currentFps} FPS). 'perf-boost' CSS active.`);
          }
        } else if (currentFps >= highFpsThreshold) {
          highFpsCount++;
          lowFpsCount = 0;
          if (highFpsCount >= 5 && boostActive) {
            document.body.classList.remove('perf-boost');
            boostActive = false;
            console.info(`[90 FPS Engine] Frame rate smooth (${currentFps} FPS). 'perf-boost' deactivated.`);
          }
        }

        setMetrics({
          fps: currentFps,
          targetFps: targetFpsRef.current,
          isBoostActive: boostActive,
          frameDropCount: lowFpsCount,
          avgFrameTimeMs: Math.round(avgFrameTime * 10) / 10,
        });
      }

      animationFrameId = requestAnimationFrame(checkPerformance);
    };

    animationFrameId = requestAnimationFrame(checkPerformance);

    // LongTask PerformanceObserver
    let observer: PerformanceObserver | null = null;
    if (typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
      try {
        observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 45) {
              if (!document.body.classList.contains('perf-boost')) {
                document.body.classList.add('perf-boost');
                console.warn(`[90 FPS Engine] CPU spike (${Math.round(entry.duration)}ms). 'perf-boost' triggered.`);
              }
            }
          }
        });
        observer.observe({ entryTypes: ['longtask'] });
      } catch (e) {
        // Safe catch
      }
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (observer) observer.disconnect();
    };
  }, []);

  return {
    metrics,
    targetFps,
    setTargetFps,
  };
}

