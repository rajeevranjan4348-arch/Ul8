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
    const handleGlobalError = async (event: ErrorEvent) => {
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
      const reasonMsg = event.reason?.message || String(event.reason || 'Unhandled Promise Rejection');
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
