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
  const [wakeWordTriggerBanner, setWakeWordTriggerBanner] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const callbackRef = useRef(onWakeWordDetected);
  const wakeWordsRef = useRef(wakeWords);
  const sensitivityRef = useRef(sensitivity);
  const lastTriggerTimeRef = useRef<number>(0);
  const restartTimerRef = useRef<any>(null);
  const isMountedRef = useRef<boolean>(true);
  const shouldListenRef = useRef<boolean>(false);
  const isPermissionBlockedRef = useRef<boolean>(false);

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

  const speakYesBoss = useCallback(() => {
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance("Yes Boss.");
        utterance.rate = 1.05;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn('TTS execution skipped:', e);
      }
    }
  }, []);

  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.stop();
      } catch (e) {}
      recognitionRef.current = null;
    }
    setIsListeningForWakeWord(false);
  }, []);

  const startListening = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.info('Web Speech API is not supported in this browser.');
      return;
    }

    if (isPermissionBlockedRef.current) {
      console.info('Wake-word listener paused: Microphone permission was denied.');
      setIsListeningForWakeWord(false);
      return;
    }

    shouldListenRef.current = true;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.stop();
      } catch (e) {}
    }

    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        if (isMountedRef.current && shouldListenRef.current) {
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

            try {
              recognition.stop();
            } catch (e) {}
            break;
          }
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          isPermissionBlockedRef.current = true;
          shouldListenRef.current = false;
          if (recognitionRef.current) {
            recognitionRef.current.onend = null;
          }
          if (isMountedRef.current) {
            setIsListeningForWakeWord(false);
          }
          console.info('Wake-word listener: Microphone permission not granted. Waiting for user toggle.');
          return;
        }

        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          console.warn('Wake word recognition:', event.error);
        }
      };

      recognition.onend = () => {
        if (isMountedRef.current) {
          setIsListeningForWakeWord(false);
          // Only auto-restart if user explicitly enabled wake-word listening
          if (shouldListenRef.current && !isPermissionBlockedRef.current) {
            restartTimerRef.current = setTimeout(() => {
              if (isMountedRef.current && shouldListenRef.current) {
                try {
                  recognition.start();
                } catch (e) {}
              }
            }, 500);
          }
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (e) {
      console.warn('Could not initialize wake word recognition:', e);
      setIsListeningForWakeWord(false);
    }
  }, [speakYesBoss]);

  const toggleListening = useCallback(() => {
    isPermissionBlockedRef.current = false; // Reset block on explicit user action
    if (isListeningForWakeWord) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListeningForWakeWord, startListening, stopListening]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopListening();
    };
  }, [stopListening]);

  return { 
    isListeningForWakeWord, 
    wakeWordTriggerBanner,
    startListening,
    stopListening,
    toggleListening
  };
};
