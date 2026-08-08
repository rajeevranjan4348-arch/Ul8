import { useState, useEffect } from 'react';

/**
 * Custom hook to auto-save unsent chat drafts in localStorage.
 * Restores draft on mount and clears draft on message submission.
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

  const clearDraft = () => {
    setValue('');
    try {
      localStorage.removeItem(storageKey);
    } catch (e) {
      console.warn('Failed to clear draft from localStorage:', e);
    }
  };

  return [value, setValue, clearDraft] as const;
}
