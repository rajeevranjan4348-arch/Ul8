import { useState, useEffect, useRef, useCallback } from 'react';

export interface AutoSaveOptions<T> {
  intervalMs?: number;
  sanitize?: (data: T) => any;
  enabled?: boolean;
  onSave?: (savedData: any) => void;
  onError?: (error: any) => void;
}

/**
 * Custom hook that periodically auto-saves state to localStorage.
 * Automatically saves on an interval when changes occur and on window beforeunload/pagehide.
 */
export function usePeriodicAutoSave<T>(
  storageKey: string,
  data: T,
  options: AutoSaveOptions<T> = {}
) {
  const {
    intervalMs = 2000,
    sanitize,
    enabled = true,
    onSave,
    onError
  } = options;

  const [lastSaved, setLastSaved] = useState<number>(() => Date.now());
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('saved');
  
  const dataRef = useRef<T>(data);
  const isDirtyRef = useRef<boolean>(false);
  const lastSerializedRef = useRef<string>('');

  useEffect(() => {
    dataRef.current = data;
    isDirtyRef.current = true;
  }, [data]);

  const performSave = useCallback(() => {
    if (!enabled) return;

    try {
      setSaveStatus('saving');
      const currentData = dataRef.current;
      const dataToSave = sanitize ? sanitize(currentData) : currentData;
      const serialized = JSON.stringify(dataToSave);

      // Only write to localStorage if content actually changed
      if (serialized !== lastSerializedRef.current) {
        localStorage.setItem(storageKey, serialized);
        lastSerializedRef.current = serialized;
      }

      isDirtyRef.current = false;
      setLastSaved(Date.now());
      setSaveStatus('saved');
      onSave?.(dataToSave);
    } catch (err: any) {
      console.warn(`[AutoSave] Failed to save key "${storageKey}" to localStorage:`, err);
      setSaveStatus('error');
      onError?.(err);

      // Handle QuotaExceededError fallback if possible
      if (err?.name === 'QuotaExceededError' || err?.code === 22) {
        try {
          // Attempt basic fallback: if it's an array, keep only the latest items
          const fallbackData = Array.isArray(dataRef.current)
            ? dataRef.current.slice(-50)
            : dataRef.current;
          localStorage.setItem(storageKey, JSON.stringify(fallbackData));
          setSaveStatus('saved');
        } catch (innerErr) {
          console.error('[AutoSave] Quota fallback also failed:', innerErr);
        }
      }
    }
  }, [storageKey, enabled, sanitize, onSave, onError]);

  // Periodic interval timer
  useEffect(() => {
    if (!enabled) return;

    const intervalId = setInterval(() => {
      if (isDirtyRef.current) {
        performSave();
      }
    }, intervalMs);

    return () => clearInterval(intervalId);
  }, [enabled, intervalMs, performSave]);

  // Synchronous flush on page refresh / tab switch / close
  useEffect(() => {
    if (!enabled) return;

    const handleBeforeUnload = () => {
      if (isDirtyRef.current) {
        performSave();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && isDirtyRef.current) {
        performSave();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (isDirtyRef.current) {
        performSave();
      }
    };
  }, [enabled, performSave]);

  return {
    lastSaved,
    saveStatus,
    saveNow: performSave
  };
}
