import React from 'react';
import { 
  ArrowLeft,
  Globe,
  ExternalLink,
  RefreshCw,
  Monitor,
  Smartphone,
  Check,
  Loader2
} from 'lucide-react';
import { Timeline } from './Timeline';

// local cn replacement
function localCn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}

interface WebsiteBuilderViewProps {
  websiteName: string;
  steps: any[];
  status: 'running' | 'completed' | 'error';
  onReset: () => void;
  previewUrl: string;
  isLoading: boolean;
  srcDoc?: string; // Optional raw HTML/CSS/JS content to display directly in frame
}

export function WebsiteBuilderView({ 
  websiteName, 
  steps, 
  status, 
  onReset, 
  previewUrl,
  isLoading,
  srcDoc
}: WebsiteBuilderViewProps) {
  const [viewMode, setViewMode] = React.useState<'desktop' | 'mobile'>('desktop');
  const [trustDelayPassed, setTrustDelayPassed] = React.useState(false);

  // Trust delay for preview - only set when status is completed AND previewUrl/srcDoc is ready
  React.useEffect(() => {
    if (status === 'completed' && (previewUrl || srcDoc)) {
      // Wait 1.5s after completion before showing preview
      const timer = setTimeout(() => setTrustDelayPassed(true), 1500);
      return () => clearTimeout(timer);
    } else {
      setTrustDelayPassed(false);
    }
  }, [status, previewUrl, srcDoc]);

  const showPreview = trustDelayPassed && (previewUrl || srcDoc) && status === 'completed';

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-stone-50 dark:bg-zinc-950 overflow-hidden">
      {/* Header */}
      <div className="h-14 border-b border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-zinc-900/50 backdrop-blur px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={onReset}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-700 dark:text-gray-300"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="h-4 w-px bg-gray-200 dark:bg-gray-800" />
          <div className="flex items-center gap-2">
            <Globe size={18} className="text-blue-600" />
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{websiteName}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {status === 'completed' && (previewUrl || srcDoc) && (
            <>
              <div className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 rounded-full">
                <button
                  onClick={() => setViewMode('desktop')}
                  className={localCn(
                    "p-1.5 rounded-full transition-colors",
                    viewMode === 'desktop' ? "bg-blue-600 text-white" : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
                  )}
                >
                  <Monitor size={14} />
                </button>
                <button
                  onClick={() => setViewMode('mobile')}
                  className={localCn(
                    "p-1.5 rounded-full transition-colors",
                    viewMode === 'mobile' ? "bg-blue-600 text-white" : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
                  )}
                >
                  <Smartphone size={14} />
                </button>
              </div>
              {previewUrl && (
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-all text-gray-800 dark:text-gray-200"
                >
                  <ExternalLink size={14} />
                  Open in New Tab
                </a>
              )}
            </>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col md:flex-row">
        {/* Sidebar - Timeline */}
        <div className="w-full md:w-80 max-h-56 md:max-h-none border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-800 bg-white/30 dark:bg-zinc-900/30 backdrop-blur overflow-y-auto shrink-0">
          <div className="p-4 md:p-6 space-y-6 md:space-y-8">
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Build Progress</h3>
              <p className="text-xs text-gray-500">Step-by-step website creation</p>
            </div>
            
            <Timeline steps={steps} />
            
            {status === 'running' && (
              <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30">
                <div className="flex items-center gap-2">
                  <Loader2 size={14} className="text-blue-600 animate-spin" />
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-medium animate-pulse">Building your website...</p>
                </div>
              </div>
            )}

            {status === 'completed' && !(previewUrl || srcDoc) && (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30">
                <div className="flex items-center gap-2">
                  <Loader2 size={14} className="text-amber-600 animate-spin" />
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Preparing preview...</p>
                </div>
              </div>
            )}

            {status === 'completed' && (previewUrl || srcDoc) && !trustDelayPassed && (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30">
                <div className="flex items-center gap-2">
                  <Loader2 size={14} className="text-amber-600 animate-spin" />
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Starting server...</p>
                </div>
              </div>
            )}

            {status === 'completed' && (previewUrl || srcDoc) && trustDelayPassed && (
              <div className="p-4 rounded-2xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/30 animate-fade-in">
                <div className="flex items-center gap-2">
                  <Check size={14} className="text-green-600" />
                  <p className="text-xs text-green-600 dark:text-green-400 font-medium">Website is live!</p>
                </div>
              </div>
            )}

            {status === 'error' && (
              <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30">
                <div className="flex items-center gap-2">
                  <RefreshCw size={14} className="text-red-600 animate-spin" />
                  <p className="text-xs text-red-600 dark:text-red-400 font-medium">Build failed. Please try again.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Preview Area */}
        <div className="flex-1 min-h-0 bg-stone-100 dark:bg-zinc-900 p-4 md:p-8 overflow-y-auto">
          <div className="h-full flex items-center justify-center">
            {!showPreview ? (
              <div className="text-center space-y-4">
                {status === 'completed' && (previewUrl || srcDoc) && !trustDelayPassed ? (
                  <>
                    <Loader2 size={48} className="mx-auto text-blue-600 animate-spin" />
                    <p className="text-gray-600 dark:text-gray-400 font-medium">Starting preview server...</p>
                    <p className="text-xs text-gray-400">Loading modules and assets</p>
                  </>
                ) : status === 'running' || isLoading ? (
                  <>
                    <Globe size={48} className="mx-auto text-gray-300 dark:text-gray-700 animate-bounce" />
                    <p className="text-gray-600 dark:text-gray-400 font-medium">Building website...</p>
                    <p className="text-xs text-gray-400">Preview will appear when compilation completes</p>
                  </>
                ) : status === 'error' ? (
                  <>
                    <Globe size={48} className="mx-auto text-red-400" />
                    <p className="text-red-500 font-medium">Build failed</p>
                    <p className="text-xs text-gray-400">Review log timeline for errors</p>
                  </>
                ) : (
                  <>
                    <Globe size={48} className="mx-auto text-gray-300 dark:text-gray-700" />
                    <p className="text-gray-600 dark:text-gray-400">Preview will appear here</p>
                  </>
                )}
              </div>
            ) : (
              <div 
                className={localCn(
                  "h-full bg-white dark:bg-zinc-950 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden transition-all duration-500 animate-fade-in-simple",
                  viewMode === 'desktop' ? "w-full" : "w-96 max-w-full"
                )}
              >
                <div className="h-10 bg-gray-50 dark:bg-zinc-900 border-b border-gray-200 dark:border-gray-800 flex items-center px-4 gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                  </div>
                  <div className="flex-1 mx-4 bg-white dark:bg-zinc-950 rounded px-3 py-1 text-xs text-gray-400 truncate text-center">
                    {previewUrl || `localhost:3000/${websiteName.toLowerCase().replace(/\s+/g, '-')}`}
                  </div>
                </div>
                {srcDoc ? (
                  <iframe
                    srcDoc={srcDoc}
                    className="w-full h-[calc(100%-2.5rem)] border-0"
                    title="Website Preview"
                    sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
                  />
                ) : (
                  <iframe
                    src={previewUrl}
                    className="w-full h-[calc(100%-2.5rem)] border-0"
                    title="Website Preview"
                    sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
