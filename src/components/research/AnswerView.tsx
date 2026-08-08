import React, { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from 'motion/react';
import { Share2, Copy, RefreshCw, Layers, Globe, Check } from 'lucide-react';
import { SourcesSidebar } from './SourcesSidebar';

interface Source {
  url: string;
  title: string;
  index: number;
}

interface AnswerViewProps {
  content: string;
  isLinksTab?: boolean;
  isStreaming?: boolean;
  onRewrite?: () => void;
}

const Citation = ({ index, source }: { index: number; source?: Source }) => {
  const [isHovered, setIsHovered] = useState(false);

  if (!source) return <span className="text-[10px] align-super text-slate-400">[{index}]</span>;

  return (
    <span 
      className="relative inline-block"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center w-4 h-4 ml-0.5 -mt-2 align-super text-[9px] font-bold text-slate-400 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-full transition-colors cursor-pointer no-underline border border-slate-700/50"
      >
        {index}
      </a>
      
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 bg-slate-900/95 border border-slate-700/80 rounded-xl shadow-2xl backdrop-blur-md z-50 text-left pointer-events-auto"
            style={{ originX: 0.5, originY: 1 }}
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0">
                <img 
                  src={`https://www.google.com/s2/favicons?domain=${new URL(source.url).hostname}&sz=128`} 
                  alt="" 
                  className="w-4 h-4 opacity-80"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                  }}
                />
                <Globe size={14} className="text-slate-400 hidden" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-semibold text-slate-100 leading-snug line-clamp-2">
                  {source.title}
                </h4>
                <p className="text-[10px] text-slate-400 mt-1 truncate">
                  {new URL(source.url).hostname}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
};

export const AnswerView: React.FC<AnswerViewProps> = ({ content, isLinksTab, isStreaming, onRewrite }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Extract sources
  const { cleanContent, sources } = useMemo(() => {
    const lines = content.split('\n');
    const sourcesHeadingIndex = lines.findIndex(l => {
      const lower = l.toLowerCase().trim();
      return /^(#+\s*)?[\*_]*(sources?|references?|citations?)[\*_]*:?$/i.test(lower);
    });
    
    let cleanContent = content;
    let extractedSources: Source[] = [];

    if (sourcesHeadingIndex !== -1) {
      cleanContent = lines.slice(0, sourcesHeadingIndex).join('\n');
      const sourcesLines = lines.slice(sourcesHeadingIndex + 1);
      
      extractedSources = sourcesLines
        .filter(line => line.trim() !== '')
        .map((line) => {
          const cleanLine = line.replace(/^\s*(?:\[\d+\]|\d+\.|-|\*)\s*/, '').trim();
          
          // 1. Markdown link: [Title](URL)
          const markdownMatch = cleanLine.match(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/);
          if (markdownMatch) {
            return {
              title: markdownMatch[1].trim(),
              url: markdownMatch[2].trim(),
              index: 0
            };
          }

          // 2. Raw URL: "Title: URL"
          const urlMatch = cleanLine.match(/(?:(.+?)(?::|–|-)\s*)?(https?:\/\/[^\s\)]+)/);
          if (urlMatch) {
            return {
              title: (urlMatch[1] || new URL(urlMatch[2]).hostname).trim(),
              url: urlMatch[2].trim(),
              index: 0
            };
          }
          
          return null;
        })
        .filter((s): s is Source => s !== null)
        .map((s, i) => ({ ...s, index: i + 1 }));
    } else {
        // Fallback: If no heading found, look for a block of links at the end
        const lastLines = lines.slice(-10);
        const linkLines = lastLines.filter(l => /https?:\/\//.test(l));
        
        if (linkLines.length > 0 && linkLines.length >= lastLines.filter(l => l.trim()).length * 0.5) {
             const potentialSources = linkLines.map((line, idx) => {
                const urlMatch = line.match(/https?:\/\/[^\s\)]+/);
                if (urlMatch) {
                    return {
                        url: urlMatch[0],
                        title: new URL(urlMatch[0]).hostname,
                        index: idx + 1
                    };
                }
                return null;
             }).filter((s): s is Source => s !== null);

             if (potentialSources.length > 0) {
                 extractedSources = potentialSources.map((s, i) => ({...s, index: i + 1}));
                 const firstSourceLine = lastLines.find(l => l.includes(potentialSources[0].url));
                 if (firstSourceLine) {
                     const idx = lines.lastIndexOf(firstSourceLine);
                     if (idx !== -1) {
                         cleanContent = lines.slice(0, idx).join('\n');
                     }
                 }
             }
        }
    }
    
    return { cleanContent, sources: extractedSources };
  }, [content]);

  const handleCopy = () => {
    navigator.clipboard.writeText(cleanContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLinksTab) {
    return (
      <div className="space-y-6 animate-fade-in text-slate-200">
        <h2 className="text-lg font-semibold flex items-center gap-2 text-white/90">
          <Layers className="w-5 h-5 text-emerald-400" />
          {sources.length} Sources
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {sources.map((source, i) => (
            <a 
              key={i} 
              href={source.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="group p-4 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 hover:border-slate-700 transition-all duration-200 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-850 flex items-center justify-center flex-shrink-0 border border-slate-800">
                  <img 
                    src={`https://www.google.com/s2/favicons?domain=${new URL(source.url).hostname}&sz=128`} 
                    alt="" 
                    className="w-4 h-4 opacity-80"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xs font-semibold line-clamp-2 mb-1 text-slate-200 group-hover:text-emerald-400 transition-colors">
                    {source.title}
                  </h3>
                  <div className="flex items-center gap-2 text-[10px] text-slate-450">
                    <span className="truncate">{new URL(source.url).hostname}</span>
                    <span className="w-1 h-1 rounded-full bg-slate-700" />
                    <span>{i + 1}</span>
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    );
  }

  if (!content.trim()) return null;

  return (
    <div className="space-y-5 animate-fade-in text-slate-200">
      {isStreaming && !cleanContent.trim() && (
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <motion.span
            className="inline-block w-0.5 h-4 bg-emerald-500 rounded-full"
            animate={{ opacity: [1, 0] }}
            transition={{ duration: 0.55, repeat: Infinity, repeatType: 'reverse' }}
          />
          <span>Synthesizing deep answer...</span>
        </div>
      )}
      
      <div className="prose prose-invert prose-sm max-w-none text-slate-200 leading-relaxed font-sans">
        <ReactMarkdown 
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ children }) => {
               const processText = (text: string) => {
                 const parts = text.split(/(\[\d+\])/g);
                 return parts.map((part, i) => {
                    const match = part.match(/\[(\d+)\]/);
                    if (match) {
                      const index = parseInt(match[1]);
                      const source = sources.find(s => s.index === index);
                      return <Citation key={`${index}-${i}`} index={index} source={source} />;
                    }
                    return part;
                 });
               };

               return (
                 <p className="mb-4 last:mb-0 leading-7 text-[15px] text-slate-200">
                   {React.Children.map(children, child => {
                      if (typeof child === 'string') return processText(child);
                      return child;
                   })}
                 </p>
               );
            },
            a: ({ href, children }) => (
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-emerald-450 hover:underline underline-offset-4 decoration-emerald-500/30 font-medium">
                {children}
              </a>
            ),
            h2: ({ children }) => <h2 className="text-base font-bold mt-8 mb-4 tracking-tight text-white border-b border-slate-800 pb-1">{children}</h2>,
            h3: ({ children }) => <h3 className="text-sm font-bold mt-6 mb-3 tracking-tight text-slate-100">{children}</h3>,
            ul: ({ children }) => <ul className="list-disc pl-5 space-y-2 mb-4 marker:text-emerald-500/50">{children}</ul>,
            li: ({ children }) => <li className="pl-1 text-sm text-slate-300">{children}</li>,
            strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
            code: ({ children }) => <code className="px-1.5 py-0.5 bg-slate-850 border border-slate-800 rounded font-mono text-xs text-slate-200">{children}</code>,
            pre: ({ children }) => <pre className="p-4 bg-slate-900 border border-slate-800 rounded-xl font-mono text-xs overflow-x-auto text-slate-200 mb-4">{children}</pre>,
          }}
        >
          {cleanContent}
        </ReactMarkdown>
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-slate-800/50">
        <div className="flex items-center gap-2">
           {sources.length > 0 && (
             <button 
               onClick={() => setIsSidebarOpen(true)}
               className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-950/10 text-emerald-400 text-xs font-semibold hover:bg-emerald-950/30 hover:border-emerald-500/40 transition-all cursor-pointer group shadow-sm"
             >
               <div className="flex items-center -space-x-1.5 mr-1">
                 {sources.slice(0, 3).map((source, i) => (
                   <div key={i} className="relative w-4 h-4 rounded-full border border-slate-900 bg-slate-900 flex items-center justify-center overflow-hidden shadow-sm" style={{ zIndex: 10 - i }}>
                     <img 
                       src={`https://www.google.com/s2/favicons?domain=${new URL(source.url).hostname}&sz=32`}
                       alt=""
                       className="w-2.5 h-2.5 object-cover"
                       onError={(e) => {
                         (e.target as HTMLImageElement).style.display = 'none';
                       }}
                     />
                   </div>
                 ))}
               </div>
               <span>{sources.length} Sources</span>
             </button>
           )}
        </div>
        
        <div className="flex items-center gap-1.5 ml-auto">
          {onRewrite && (
            <button 
              onClick={onRewrite}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-all text-xs font-semibold cursor-pointer"
            >
              <RefreshCw size={12} />
              <span>Retry</span>
            </button>
          )}
          <button 
            onClick={handleCopy}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-all text-xs font-semibold cursor-pointer"
          >
            {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>
      
      <SourcesSidebar 
        open={isSidebarOpen} 
        onOpenChange={setIsSidebarOpen} 
        sources={sources} 
      />
    </div>
  );
};
