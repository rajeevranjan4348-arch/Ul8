import React, { useState, useMemo, useEffect } from 'react';
import { Search, Globe, ChevronDown, Check, Loader2, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface WorkingTimelineProps {
  parts: any[];
  userQuery: string;
  isComplete?: boolean;
  mode?: 'search' | 'research';
  hasContent?: boolean;
}

export const WorkingTimeline: React.FC<WorkingTimelineProps> = ({
  parts,
  userQuery,
  isComplete = false,
  mode = 'search',
  hasContent = true,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [hasAutoCollapsed, setHasAutoCollapsed] = useState(false);

  useEffect(() => {
    if (isComplete && hasContent && !hasAutoCollapsed) {
      const t = setTimeout(() => {
        setIsOpen(false);
        setHasAutoCollapsed(true);
      }, 2200);
      return () => clearTimeout(t);
    }
  }, [isComplete, hasContent, hasAutoCollapsed]);

  const toolCalls = useMemo(() => parts.filter(p => p.type === 'tool-invocation'), [parts]);

  const searchQueries = useMemo(() =>
    Array.from(new Set(
      toolCalls
        .filter(t => ['webSearch', 'web_search', 'google_search'].includes(t.toolName))
        .map(t => (t.args || t.input || {}).query || (t.args || t.input || {}).prompt)
        .filter(Boolean)
    )), [toolCalls]);

  const sources = useMemo(() =>
    toolCalls
      .filter(t => ['webSearch', 'web_search', 'google_search'].includes(t.toolName) && t.state === 'result')
      .flatMap(t => {
        const out = t.result || t.output;
        if (!out) return [];
        if (Array.isArray(out)) return out;
        if (out.results) return out.results;
        return [];
      })
      .slice(0, 8),
    [toolCalls]);

  if (!userQuery && parts.length === 0) return null;

  const isLive = !isComplete && searchQueries.length > 0;

  const statusLabel = isComplete
    ? (mode === 'research' ? 'Research complete' : 'Search complete')
    : (searchQueries.length > 0 ? 'Searching the web…' : 'Thinking…');

  return (
    <div className="mb-2 w-full font-sans">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="group flex items-center gap-2 mb-3 cursor-pointer outline-none select-none text-left"
      >
        <div className="flex items-center gap-2">
          {isComplete ? (
            <div className="w-4 h-4 rounded-full bg-emerald-500/15 flex items-center justify-center border border-emerald-500/30">
              <Check size={9} className="text-emerald-400" strokeWidth={3} />
            </div>
          ) : (
            <Loader2 size={13} className="animate-spin text-emerald-400/80" />
          )}
          <span className={`text-[13px] font-semibold transition-colors ${
            isComplete ? "text-slate-400 group-hover:text-slate-200" : "text-slate-200"
          }`}>
            {statusLabel}
          </span>

          {/* Live indicator */}
          {isLive && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-1"
            >
              <Zap size={10} className="text-emerald-400 animate-pulse" />
              <span className="text-[10px] text-emerald-400 font-bold tracking-wide">
                LIVE
              </span>
            </motion.div>
          )}

          {isComplete && (
            <span className="text-[11px] text-slate-500 font-medium">
              · {sources.length > 0 ? `${sources.length} sources reviewed` : 'completed'}
            </span>
          )}

          {/* Real-time source count while streaming */}
          {!isComplete && sources.length > 0 && (
            <motion.span
              key={sources.length}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[10px] text-emerald-400/70 font-semibold"
            >
              · {sources.length} sources found
            </motion.span>
          )}
        </div>
        <ChevronDown
          size={12}
          className={`text-slate-500 transition-transform duration-300 group-hover:text-slate-300 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="relative pl-4 border-l border-slate-800 space-y-4 ml-2 pb-2">
              {/* Plan step */}
              <motion.div
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
                className="relative"
              >
                <div className="absolute -left-[17px] top-1.5 w-2 h-2 rounded-full border border-slate-700 bg-slate-950" />
                <p className="text-[12.5px] text-slate-400 leading-relaxed">
                  {mode === 'research'
                    ? <>Initiating in-depth research on <span className="text-slate-200 font-semibold">"{userQuery}"</span></>
                    : <>Searching the web for <span className="text-slate-200 font-semibold">"{userQuery}"</span></>
                  }
                </p>
              </motion.div>

              {/* Search queries */}
              {searchQueries.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                  className="relative"
                >
                  <div className="absolute -left-[17px] top-1.5 w-2 h-2 rounded-full border border-slate-700 bg-slate-950" />
                  <div className="flex flex-wrap gap-1.5">
                    {searchQueries.map((q, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.06 }}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-full text-[11px] text-slate-300"
                      >
                        <Search size={10} className="text-slate-500" />
                        <span className="max-w-[180px] truncate">{q}</span>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Enhanced Sources */}
              {sources.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                  className="relative"
                >
                  <div className="absolute -left-[17px] top-1.5 w-2 h-2 rounded-full border border-slate-700 bg-slate-950" />

                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-[11.5px] text-slate-400">
                      {isComplete ? 'Reviewed' : 'Reviewing'}{' '}
                      <motion.span
                        key={sources.length}
                        initial={{ opacity: 0.4, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="tabular-nums text-slate-200 font-bold"
                      >
                        {sources.length}
                      </motion.span>{' '}
                      source{sources.length !== 1 ? 's' : ''}
                    </p>
                    {/* Live pulse while reading */}
                    {!isComplete && (
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/60 animate-pulse" />
                        <Globe size={9} className="text-slate-500" />
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    {sources.slice(0, 5).map((s: any, i: number) => {
                      let hostname = s.url;
                      try { hostname = new URL(s.url).hostname.replace('www.', ''); } catch {}
                      return (
                        <motion.a
                          key={i}
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          initial={{ opacity: 0, y: 6, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{
                            delay: i * 0.08,
                            duration: 0.25,
                          }}
                          className="flex items-center gap-2.5 p-2 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-850 hover:border-slate-700 transition-colors group relative overflow-hidden"
                        >
                          <div className="w-4 h-4 rounded bg-slate-950 flex items-center justify-center overflow-hidden shrink-0 border border-slate-800">
                            <img
                              src={`https://www.google.com/s2/favicons?domain=${hostname}&sz=32`}
                              alt=""
                              className="w-full h-full object-cover opacity-75 group-hover:opacity-100 transition-opacity"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          </div>

                          <span className="text-[11.5px] text-slate-300 truncate group-hover:text-white transition-colors">
                            {s.title || hostname}
                          </span>

                          <div className="flex items-center gap-1.5 ml-auto shrink-0">
                            {!isComplete && (
                              <span className="text-[9px] text-emerald-400 animate-pulse font-bold">
                                Analyzing…
                              </span>
                            )}
                            <span className="text-[10px] text-slate-500 font-mono">{hostname}</span>
                          </div>
                        </motion.a>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* Active pulse */}
              {!isComplete && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="relative"
                >
                  <div className="absolute -left-[17px] top-1.5 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[12px] text-slate-400 animate-pulse">
                    {sources.length > 0
                      ? 'Composing comprehensive response…'
                      : searchQueries.length > 0
                      ? 'Reading articles and extracting insights…'
                      : 'Connecting to search engine…'}
                  </span>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
