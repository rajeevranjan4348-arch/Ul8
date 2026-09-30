import { useState, useEffect, useRef } from 'react';

/**
 * Custom hook to auto-save unsent chat drafts in localStorage.
 * Restores draft on mount, periodically syncs, and clears draft on message submission.
 */
export function useAutoSaveDraft(storageKey: string, initialDefault: string = '') {
  const [value, setValue] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved !== null) {
        return saved;
      }
    } catch (e) {
      console.warn('Failed to read draft from localStorage:', e);
    }
    return initialDefault;
  });

  const valueRef = useRef<string>(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    try {
      if (value) {
        localStorage.setItem(storageKey, value);
      } else {
        localStorage.removeItem(storageKey);
      }
    } catch (e) {
      console.warn('Failed to auto-save draft to localStorage:', e);
    }
  }, [storageKey, value]);

  // Synchronous flush on page refresh or tab close
  useEffect(() => {
    const handleBeforeUnload = () => {
      try {
        if (valueRef.current) {
          localStorage.setItem(storageKey, valueRef.current);
        } else {
          localStorage.removeItem(storageKey);
        }
      } catch (e) {
        console.warn('Failed to flush draft on unload:', e);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleBeforeUnload);
      handleBeforeUnload();
    };
  }, [storageKey]);

  const clearDraft = () => {
    setValue('');
    valueRef.current = '';
    try {
      localStorage.removeItem(storageKey);
    } catch (e) {
      console.warn('Failed to clear draft from localStorage:', e);
    }
  };

  return [value, setValue, clearDraft] as const;
}

