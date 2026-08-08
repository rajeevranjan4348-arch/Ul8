import { useEffect, useState, useRef, useCallback } from 'react';

const DEFAULT_WAKE_WORDS = [
  'hey ai', 'hey a.i.', 'hey eye', 'hey i', 'hi ai', 'ok ai', 'hey a i', 'hay ai',
  'hey omni', 'omni ai', 'omni',
  'hey jarvis', 'jarvis',
  'hey assistant', 'computer'
];

export const useWakeWord = (
  onWakeWordDetected: (transcript: string) => void,
  wakeWords: string[] = DEFAULT_WAKE_WORDS,
  sensitivity: number = 50
) => {
  const [isListeningForWakeWord, setIsListeningForWakeWord] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [wakeWordTriggerBanner, setWakeWordTriggerBanner] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const callbackRef = useRef(onWakeWordDetected);
  const wakeWordsRef = useRef(wakeWords);
  const sensitivityRef = useRef(sensitivity);
  const lastTriggerTimeRef = useRef<number>(0);
  const restartTimerRef = useRef<any>(null);
  const isMountedRef = useRef<boolean>(true);

  // Keep refs up to date without re-running effect
  useEffect(() => {
    callbackRef.current = onWakeWordDetected;
  }, [onWakeWordDetected]);

  useEffect(() => {
    wakeWordsRef.current = wakeWords.length > 0 ? wakeWords : DEFAULT_WAKE_WORDS;
  }, [wakeWords]);

  useEffect(() => {
    sensitivityRef.current = sensitivity;
  }, [sensitivity]);

  useEffect(() => {
    const handleInteraction = () => {
      setHasInteracted(true);
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
    };

    window.addEventListener('click', handleInteraction);
    window.addEventListener('keydown', handleInteraction);
    window.addEventListener('touchstart', handleInteraction);

    return () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
    };
  }, []);

  const speakYesBoss = useCallback(() => {
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance("Yes Boss.");
        utterance.rate = 1.05;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.error('TTS execution failed:', e);
      }
    }
  }, []);

  const startListening = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.warn('Web Speech API is not supported in this browser environment.');
      return;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch (e) {
        // Safe catch
      }
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      if (isMountedRef.current) {
        setIsListeningForWakeWord(true);
      }
    };

    recognition.onresult = (event: any) => {
      const now = Date.now();
      // Cooldown guard of 2.5s between wake word triggers
      if (now - lastTriggerTimeRef.current < 2500) return;

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const result = event.results[i][0];
        const rawTranscript = result.transcript || '';
        const cleanTranscript = rawTranscript
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .replace(/\s+/g, ' ')
          .trim();

        const confidence = result.confidence;
        const currentSensitivity = sensitivityRef.current || 50;
        const threshold = 1.0 - (currentSensitivity / 100);

        const currentWords = wakeWordsRef.current.length > 0 ? wakeWordsRef.current : DEFAULT_WAKE_WORDS;
        
        const detected = currentWords.some(word => {
          const cleanWord = word
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          return cleanTranscript.includes(cleanWord);
        });

        const confidencePassed = !confidence || confidence === 0 || confidence >= threshold;

        if (detected && confidencePassed) {
          lastTriggerTimeRef.current = now;

          // Audio response "Yes Boss."
          speakYesBoss();

          if (isMountedRef.current) {
            setWakeWordTriggerBanner(rawTranscript);
            setTimeout(() => {
              if (isMountedRef.current) setWakeWordTriggerBanner(null);
            }, 3000);
          }

          callbackRef.current(rawTranscript);

          // Restart recognition to clear buffer
          try {
            recognition.stop();
          } catch (e) {
            // Safe catch
          }
          break;
        }
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        if (event.error === 'not-allowed') {
          recognition.onend = null;
          if (isMountedRef.current) {
            setIsListeningForWakeWord(false);
          }
          console.warn('Wake word microphone permission blocked.');
        } else {
          console.error('Wake word recognition error:', event.error);
        }
      }
    };

    recognition.onend = () => {
      if (isMountedRef.current) {
        setIsListeningForWakeWord(false);
        // Delay auto-restart slightly to avoid tight error loops
        restartTimerRef.current = setTimeout(() => {
          if (isMountedRef.current && hasInteracted) {
            try {
              recognition.start();
            } catch (e) {
              // Safe catch if already started
            }
          }
        }, 400);
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch (e) {
      console.error('Failed to start wake word engine:', e);
    }
  }, [hasInteracted, speakYesBoss]);

  useEffect(() => {
    isMountedRef.current = true;
    if (hasInteracted) {
      startListening();
    }

    return () => {
      isMountedRef.current = false;
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Safe catch
        }
      }
    };
  }, [hasInteracted, startListening]);

  return { 
    isListeningForWakeWord, 
    wakeWordTriggerBanner,
    startListening
  };
};

