import { useEffect, useState } from 'react';
import { analyzeAndAutoFixError } from '../services/gemini';

export interface GlobalAiErrorLog {
  id: string;
  timestamp: number;
  message: string;
  source?: string;
  aiDiagnostic?: {
    rootCause?: string;
    suggestedFix?: string;
    autoRecoveryCode?: string;
  };
  recovered: boolean;
}

export function useGlobalAiErrorListener() {
  const [activeError, setActiveError] = useState<GlobalAiErrorLog | null>(null);

  useEffect(() => {
    const isBenignError = (msg: any) => {
      let text = '';
      if (typeof msg === 'string') {
        text = msg;
      } else if (msg && typeof msg === 'object') {
        text = (msg.message || msg.msg || msg.type || msg.name || '') + ' ' + JSON.stringify(msg);
      } else {
        text = String(msg || '');
      }
      const lower = text.toLowerCase();
      return (
        lower.includes('permission denied') ||
        lower.includes('notallowederror') ||
        lower.includes('permission dismissed') ||
        lower.includes('not-allowed') ||
        lower.includes('microphone') ||
        lower.includes('audiocapture') ||
        lower.includes('getusermedia') ||
        lower.includes('aborterror') ||
        lower.includes('abort') ||
        lower.includes('cancel') ||
        lower.includes('cancelation') ||
        lower.includes('cancellation') ||
        lower.includes('manually canceled') ||
        lower.includes('manually cancelled') ||
        lower.includes('operation is manually canceled') ||
        lower.includes('operation is manually cancelled') ||
        lower.includes('the request is not allowed by the user agent') ||
        lower.includes('resizeobserver') ||
        lower.includes('websocket') ||
        lower.includes('no-speech') ||
        lower.includes('audio-capture') ||
        lower.includes('networkerror') ||
        lower.includes('user aborted')
      );
    };

    const handleGlobalError = async (event: ErrorEvent) => {
      if (isBenignError(event.message) || isBenignError(event.error)) {
        event.preventDefault?.();
        return;
      }
      console.warn('[Global AI Listener] Intercepted runtime error:', event.message);

      const errorLog: GlobalAiErrorLog = {
        id: 'err-' + Date.now(),
        timestamp: Date.now(),
        message: event.message || 'Script execution error',
        source: event.filename ? `${event.filename}:${event.lineno}` : 'Global Context',
        recovered: false,
      };

      setActiveError(errorLog);

      try {
        const diagnostic = await analyzeAndAutoFixError(event.message, event.error?.stack || '', 'Global Runtime');
        setActiveError(prev => prev ? {
          ...prev,
          aiDiagnostic: diagnostic,
          recovered: true
        } : null);

        // Auto-dismiss recovery badge after 5s
        setTimeout(() => {
          setActiveError(null);
        }, 5000);
      } catch (err) {
        console.error('Failed to run AI global error analysis:', err);
      }
    };

    const handleUnhandledRejection = async (event: PromiseRejectionEvent) => {
      if (isBenignError(event.reason)) {
        event.preventDefault?.();
        return;
      }
      const reasonMsg = event.reason?.message || (typeof event.reason === 'object' ? JSON.stringify(event.reason) : String(event.reason || 'Unhandled Promise Rejection'));
      if (isBenignError(reasonMsg)) {
        event.preventDefault?.();
        return;
      }
      event.preventDefault?.();
      console.warn('[Global AI Listener] Intercepted unhandled promise rejection:', reasonMsg);

      const errorLog: GlobalAiErrorLog = {
        id: 'reject-' + Date.now(),
        timestamp: Date.now(),
        message: reasonMsg,
        source: 'Async Promise Engine',
        recovered: false,
      };

      setActiveError(errorLog);

      try {
        const diagnostic = await analyzeAndAutoFixError(reasonMsg, event.reason?.stack || '', 'Async Engine');
        setActiveError(prev => prev ? {
          ...prev,
          aiDiagnostic: diagnostic,
          recovered: true
        } : null);

        // Auto-dismiss recovery badge after 5s
        setTimeout(() => {
          setActiveError(null);
        }, 5000);
      } catch (err) {
        console.error('Failed to run AI promise rejection analysis:', err);
      }
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return { activeError, dismissError: () => setActiveError(null) };
}
