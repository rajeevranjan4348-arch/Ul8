import React, { useRef, useEffect } from 'react';
import { useAutoSaveDraft } from '../../hooks/useAutoSaveDraft';
import { 
  ArrowUp, 
  Plus, 
  Mic, 
  Search, 
  Globe, 
  MousePointer2, 
  FileCode, 
  Check, 
  ChevronUp,
  ChevronDown,
  RotateCcw,
  Workflow,
  Sparkles,
  Settings2,
  Download,
  Share2,
  ArrowLeft
} from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ChartResult } from './ChartResult';
import { FileAttachments } from './FileAttachments';
import { Step } from '../../hooks/useManusAgent';

interface ChatViewProps {
  prompt: string;
  messages: any[];
  steps: Step[];
  result: any;
  chartData?: any;
  status: 'idle' | 'running' | 'completed' | 'error';
  onReset: () => void;
  onExport?: () => void;
  onSubmit: (prompt: string) => void;
  isLoading: boolean;
}

export function ChatView({ 
  prompt, 
  messages = [], 
  steps = [], 
  result, 
  chartData,
  status, 
  onReset, 
  onExport, 
  onSubmit,
  isLoading 
}: ChatViewProps) {
  const [input, setInput, clearInputDraft] = useAutoSaveDraft('omnichat_draft_manus');
  const [expandedSteps, setExpandedSteps] = React.useState<Record<string, boolean>>({});
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, steps, result]);

  const toggleStep = (id: string) => {
    setExpandedSteps(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim()) {
        onSubmit(input);
        clearInputDraft();
      }
    }
  };

  const renderStep = (step: Step) => {
    const isCompleted = step.status === 'completed';
    const isRunning = step.status === 'running';
    const isExpanded = expandedSteps[step.id] || isRunning;

    return (
      <div key={step.id} className="border border-gray-100 dark:border-gray-800 rounded-xl bg-white dark:bg-zinc-900 overflow-hidden my-2">
        <button 
          onClick={() => toggleStep(step.id)}
          className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-5 h-5 rounded-full border ${
              isCompleted ? "bg-green-500 border-green-500 text-white" : 
              isRunning ? "border-blue-600 border-t-transparent animate-spin" : "border-gray-300 text-gray-300"
            }`}>
              {isCompleted && <Check size={12} />}
            </div>
            <span className={`text-sm font-medium ${
              isCompleted || isRunning ? "text-gray-900 dark:text-gray-100" : "text-gray-400"
            }`}>
              {step.label}
            </span>
          </div>
          {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </button>

        {isExpanded && step.trace && step.trace.length > 0 && (
          <div className="bg-gray-50 dark:bg-zinc-900/50 p-3 pt-0 space-y-2 border-t border-gray-100 dark:border-gray-800">
            <div className="h-2" />
            {step.trace.map((line, idx) => {
              let icon = <Check size={12} />;
              let text = line;
              let type = 'default';

              if (line.startsWith('Searching for:')) {
                icon = <Search size={12} />;
                text = line.replace('Searching for:', '').trim();
                type = 'search';
              } else if (line.startsWith('Fetching:')) {
                icon = <Globe size={12} />;
                text = line.replace('Fetching:', '').trim();
                type = 'web';
              } else if (line.startsWith('Reading:')) {
                icon = <FileCode size={12} />;
                text = line.replace('Reading:', '').trim();
                type = 'file';
              } else if (line.includes('Clicking')) {
                icon = <MousePointer2 size={12} />;
                type = 'action';
              }

              return (
                <div key={idx} className="flex items-center gap-2">
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border max-w-full truncate ${
                    type === 'search' ? "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900" :
                    type === 'web' ? "bg-green-50 text-green-700 border-green-100 dark:bg-green-950/40 dark:text-green-300 dark:border-green-900" :
                    type === 'file' ? "bg-orange-50 text-orange-700 border-orange-100 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900" :
                    type === 'action' ? "bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900" :
                    "bg-white border-gray-200 text-gray-500 dark:bg-zinc-900 dark:border-gray-800"
                  }`}>
                    {icon}
                    <span className="truncate">{text}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-stone-50 dark:bg-zinc-950 relative overflow-hidden">
      {/* Task view header */}
      <div className="h-16 border-b border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md px-8 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-6">
          <button 
            onClick={onReset}
            className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex flex-col">
            <span className="text-sm font-medium truncate max-w-md text-gray-900 dark:text-gray-100">{prompt}</span>
            {status === 'running' && (
              <div className="flex items-center gap-2 mt-0.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-600 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-600"></span>
                </span>
                <span className="text-[9px] uppercase tracking-wider font-bold text-blue-600">Running Task</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {status === 'completed' && (
            <button 
              onClick={onExport}
              className="flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 text-xs font-medium hover:bg-gray-50 dark:hover:bg-zinc-850 transition-all text-gray-800 dark:text-gray-200"
            >
              <Download size={14} />
              Export
            </button>
          )}
          <button onClick={onReset} className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-gray-500 hover:text-gray-900 dark:hover:text-gray-100">
            <RotateCcw size={18} />
          </button>
        </div>
      </div>

      {/* Main Results Scroll area */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-20 py-8 space-y-8 scroll-smooth pb-32">
        {/* Step progression displays */}
        {steps.length > 0 && (
          <div className="max-w-3xl mx-auto space-y-2">
            <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest px-1">Task Progression</h3>
            {steps.map(renderStep)}
          </div>
        )}

        {/* Dynamic loading banner */}
        {status === 'running' && steps.length === 0 && (
          <div className="flex gap-4 max-w-3xl mx-auto items-center py-4 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 p-4 rounded-xl">
            <Sparkles size={16} className="text-blue-600 animate-spin" />
            <div className="text-sm text-gray-600 dark:text-gray-400 font-medium">Analyzing inputs and starting task executor...</div>
          </div>
        )}

        {/* Ultimate outputs */}
        {result && (
          <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Chart module */}
            {(result.type === 'graph' || result.chartData) && (
              <div className="border border-gray-200 dark:border-gray-800 rounded-2xl bg-white dark:bg-zinc-900 overflow-hidden shadow-md">
                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-zinc-900/50">
                  <span className="font-serif font-medium text-gray-900 dark:text-gray-100">
                    📈 Dynamic {(result.detectedChartType || 'Bar').toUpperCase()} Analysis Visualization
                  </span>
                </div>
                <div className="p-6 h-[350px] bg-white dark:bg-zinc-900">
                  <ChartResult 
                    type={result.detectedChartType || 'bar'} 
                    data={result.chartData || chartData} 
                  />
                </div>
              </div>
            )}

            {/* Analysis summary document */}
            <div className="space-y-4">
              <h3 className="font-serif text-xl font-bold text-gray-900 dark:text-gray-100">Detailed Report Summary</h3>
              <div className="p-8 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 shadow-sm rounded-3xl">
                <MarkdownRenderer content={result.content || 'Generating findings...'} />
              </div>
            </div>

            {/* Attachment outputs */}
            {result.files && result.files.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest px-1">Exportable Artifacts</h3>
                <FileAttachments files={result.files} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Continuation Floating message area */}
      <div className="absolute bottom-6 left-0 right-0 px-4 flex justify-center z-10">
        <div className="w-full max-w-3xl bg-white dark:bg-zinc-900 rounded-[2rem] shadow-xl border border-gray-200 dark:border-gray-800 p-2 pl-4 flex items-center gap-2">
          <button className="p-2 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded-full transition-colors text-gray-400">
            <Plus size={20} />
          </button>
          <input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Instruct Manus to refine or extend..."
            className="flex-1 bg-transparent border-none outline-none text-base placeholder:text-gray-400 h-10 dark:text-zinc-100"
            disabled={isLoading}
          />
          <div className="flex items-center gap-1 pr-1">
             <button 
               onClick={() => { if(input.trim()) { onSubmit(input); clearInputDraft(); } }}
               disabled={!input.trim() || isLoading}
               className={`p-2 rounded-full transition-all flex items-center justify-center w-10 h-10 ${
                 input.trim() ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-400 dark:bg-zinc-800 dark:text-zinc-600"
               }`}
             >
               <ArrowUp size={20} />
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}
export default ChatView;
