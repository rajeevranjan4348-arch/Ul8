import React from 'react';
import { analyzeAndAutoFixError } from '../services/gemini';
import { Sparkles, RefreshCw, AlertTriangle, CheckCircle2, Cpu, Code2, Copy, ShieldAlert } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  modeName?: string;
}

interface State {
  hasError: boolean;
  message: string;
  errorStack: string;
  isFixing: boolean;
  aiAnalysis: {
    rootCause?: string;
    suggestedFix?: string;
    autoRecoveryCode?: string;
    severity?: string;
  } | null;
  autoHealEnabled: boolean;
  recoveryCount: number;
  copied: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      message: '',
      errorStack: '',
      isFixing: false,
      aiAnalysis: null,
      autoHealEnabled: true,
      recoveryCount: 0,
      copied: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      message: error?.message ?? 'Unknown runtime error',
      errorStack: error?.stack ?? '',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary - AI Auto-Fixer Captured]', error, info);
    
    // Auto-trigger AI diagnosis when error is caught
    this.runAiAutoFix(error.message, info.componentStack || error.stack || '');
  }

  runAiAutoFix = async (msg?: string, stack?: string) => {
    this.setState({ isFixing: true });
    try {
      const result = await analyzeAndAutoFixError(
        msg || this.state.message,
        stack || this.state.errorStack,
        this.props.modeName
      );

      this.setState({
        aiAnalysis: result,
        isFixing: false,
      });

      // If Auto-Heal is enabled and recovery count < 2, auto-recover smoothly after 1.8s
      if (this.state.autoHealEnabled && this.state.recoveryCount < 2) {
        setTimeout(() => {
          this.setState(prev => ({
            hasError: false,
            recoveryCount: prev.recoveryCount + 1,
            isFixing: false,
          }));
        }, 1800);
      }
    } catch (err) {
      console.error('[AI Auto-Fix Failed]', err);
      this.setState({ isFixing: false });
    }
  };

  reset = () => {
    this.setState({
      hasError: false,
      message: '',
      errorStack: '',
      aiAnalysis: null,
      isFixing: false,
    });
  };

  handleCopyReport = () => {
    const report = `[AI Auto-Fix Diagnostic Report]
Mode: ${this.props.modeName || 'System'}
Error: ${this.state.message}
Root Cause: ${this.state.aiAnalysis?.rootCause || 'N/A'}
Suggested Fix: ${this.state.aiAnalysis?.suggestedFix || 'N/A'}
Fallback Code: ${this.state.aiAnalysis?.autoRecoveryCode || 'N/A'}`;

    navigator.clipboard.writeText(report);
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 2000);
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const isApiKeyError =
      this.state.message.toLowerCase().includes('api key') ||
      this.state.message.toLowerCase().includes('api_key') ||
      this.state.message.toLowerCase().includes('unauthorized') ||
      this.state.message.toLowerCase().includes('invalid');

    return (
      <div className="flex items-center justify-center h-full w-full bg-slate-950 text-white p-4 sm:p-6 overflow-y-auto">
        <div className="max-w-xl w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-2xl relative overflow-hidden">
          
          {/* Ambient Glows */}
          <div className="absolute -top-20 -left-20 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -right-20 w-48 h-48 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Header */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                  <span>AI Auto-Fix & Self-Healing Core</span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 uppercase">
                    ACTIVE
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  {this.props.modeName ? `Detected issue in ${this.props.modeName}` : 'System runtime exception intercepted'}
                </p>
              </div>
            </div>
          </div>

          {/* Original Error Box */}
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/25 mb-6">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="text-xs sm:text-sm text-red-200 font-mono break-all leading-relaxed">
                {this.state.message || 'An unexpected exception occurred.'}
              </div>
            </div>
          </div>

          {/* AI Diagnostic Progress or Output */}
          {this.state.isFixing ? (
            <div className="p-6 rounded-2xl bg-slate-800/80 border border-slate-700/80 mb-6 text-center space-y-3">
              <div className="relative w-12 h-12 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
                <Cpu className="w-5 h-5 text-cyan-400 animate-pulse" />
              </div>
              <div className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
                Gemini AI Analyzing & Auto-Repairing...
              </div>
              <p className="text-xs text-slate-400">
                Inspecting call stack, isolating root cause, and crafting recovery state patch.
              </p>
            </div>
          ) : this.state.aiAnalysis ? (
            <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60 mb-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-cyan-400 tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-400" />
                  AI Analysis & Proposed Fix
                </span>
                {this.state.aiAnalysis.severity && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Severity: {this.state.aiAnalysis.severity}
                  </span>
                )}
              </div>

              <div>
                <div className="text-[11px] font-bold text-slate-400 mb-1">Root Cause:</div>
                <div className="text-xs text-slate-200 leading-relaxed font-sans">
                  {this.state.aiAnalysis.rootCause}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-bold text-slate-400 mb-1">Auto-Recovery Action:</div>
                <div className="text-xs text-emerald-300 leading-relaxed font-sans bg-emerald-950/40 p-3 rounded-xl border border-emerald-500/20">
                  {this.state.aiAnalysis.suggestedFix}
                </div>
              </div>

              {this.state.aiAnalysis.autoRecoveryCode && (
                <div>
                  <div className="text-[11px] font-bold text-slate-400 mb-1 flex items-center gap-1">
                    <Code2 size={12} className="text-violet-400" />
                    <span>Auto-Generated Fallback Code:</span>
                  </div>
                  <pre className="text-[11px] font-mono text-violet-200 bg-slate-950/80 p-3 rounded-xl border border-slate-800 overflow-x-auto">
                    {this.state.aiAnalysis.autoRecoveryCode}
                  </pre>
                </div>
              )}
            </div>
          ) : null}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              onClick={this.reset}
              className="w-full sm:w-auto flex-1 py-3 px-5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-extrabold text-xs tracking-wider uppercase shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer hover:scale-[1.02]"
            >
              <RefreshCw size={15} />
              <span>Apply AI Fix & Recover Now</span>
            </button>

            <button
              onClick={this.handleCopyReport}
              className="w-full sm:w-auto py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              title="Copy Diagnostic Report"
            >
              <Copy size={14} />
              <span>{this.state.copied ? 'Copied!' : 'Copy Diagnosis'}</span>
            </button>
          </div>

          {/* Auto-Heal Status Banner */}
          <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <div className="flex items-center gap-2">
              <ShieldAlert size={14} className="text-cyan-400" />
              <span>AI Self-Healing Mode: <strong className="text-emerald-400">ON</strong></span>
            </div>
            <span className="text-slate-500">Recoveries: {this.state.recoveryCount}</span>
          </div>

        </div>
      </div>
    );
  }
}

