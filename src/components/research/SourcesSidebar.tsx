import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Layers, X, ExternalLink } from 'lucide-react';

interface Source {
  url: string;
  title: string;
  index: number;
}

interface SourcesSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sources: Source[];
}

export const SourcesSidebar: React.FC<SourcesSidebarProps> = ({ open, onOpenChange, sources }) => {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 cursor-pointer"
          />

          {/* Drawer Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 220 }}
            className="fixed right-0 top-0 bottom-0 w-full sm:max-w-md bg-slate-900 border-l border-slate-800 z-50 shadow-2xl overflow-y-auto flex flex-col font-sans"
          >
            {/* Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/95 sticky top-0 backdrop-blur-md z-10">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-400" />
                <h2 className="text-base font-bold text-slate-100">
                  {sources.length} Research Sources
                </h2>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {/* List */}
            <div className="p-4 space-y-3 flex-1 overflow-y-auto">
              {sources.map((source, i) => {
                let hostname = source.url;
                try { hostname = new URL(source.url).hostname.replace('www.', ''); } catch {}
                
                return (
                  <a 
                    key={i} 
                    href={source.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="group block p-4 bg-slate-850 hover:bg-slate-800 border border-slate-800/60 hover:border-slate-700 rounded-xl transition-all duration-200 shadow-sm"
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-5 h-5 rounded bg-slate-900 flex items-center justify-center overflow-hidden border border-slate-850">
                          <img 
                            src={`https://www.google.com/s2/favicons?domain=${hostname}&sz=64`} 
                            alt="" 
                            className="w-3 h-3 opacity-85 group-hover:opacity-100"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </div>
                        <span className="text-[11px] text-slate-400 truncate font-semibold max-w-[200px]">
                          {hostname}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 ml-auto font-mono bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800/80">
                          {i + 1}
                        </span>
                      </div>
                      
                      <h3 className="text-sm font-semibold text-slate-200 leading-snug group-hover:text-emerald-400 transition-colors line-clamp-2">
                        {source.title}
                      </h3>
                      
                      <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-slate-500 group-hover:text-slate-400 transition-colors">
                        <span className="truncate max-w-[300px] font-mono">{source.url}</span>
                        <ExternalLink size={10} className="shrink-0 opacity-50" />
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
