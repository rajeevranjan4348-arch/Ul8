import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, ArrowRight, Globe, Paperclip, Telescope, 
  Plus, Camera, Image, FileText, ToyBrick, Cast, X, Tv, Check, Sparkles, Briefcase
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { useAutoSaveDraft } from '../../hooks/useAutoSaveDraft';

const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');

interface SearchBarProps {
  onSearch: (query: string, mode: 'search' | 'research') => void;
  isLoading?: boolean;
  compact?: boolean;
  showWorkspace?: boolean;
  onToggleWorkspace?: () => void;
}

interface Attachment {
  id: string;
  type: 'camera' | 'photo' | 'file' | 'screen' | 'plugin';
  name: string;
  url?: string;
  stream?: MediaStream;
  pluginId?: string;
}

const PLUGINS = [
  { id: 'code', name: 'Gemini Code Sandbox', desc: 'Execute live Python & JS blocks' },
  { id: 'math', name: 'Wolfram Alpha Solver', desc: 'Compute intricate calculus & data' },
  { id: 'maps', name: 'Google Maps platform', desc: 'Live physical routing & places lookup' },
  { id: 'wiki', name: 'Wikipedia Explorer', desc: 'Factual references & history digest' },
];

export const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  isLoading,
  compact,
  showWorkspace,
  onToggleWorkspace
}) => {
  const [query, setQuery, clearQueryDraft] = useAutoSaveDraft('omnichat_draft_prochat');
  const [mode, setMode] = useState<'search' | 'research'>('search');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Attachment states
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [isPluginSubmenuOpen, setIsPluginSubmenuOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!query.trim()) {
        setSuggestions([]);
        return;
      }
      try {
        const response = await fetch(`https://en.wikipedia.org/w/api.php?action=opensearch&format=json&origin=*&search=${encodeURIComponent(query)}`);
        if (response.ok) {
          const data = await response.json();
          setSuggestions(data[1] || []);
        }
      } catch {
        // silently ignore suggestion errors
      }
    };
    const t = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(t);
  }, [query]);

  // Listen to global workspace assistant text insertion events
  useEffect(() => {
    const handleWorkspaceInsert = (e: Event) => {
      const text = (e as CustomEvent).detail;
      setQuery(prev => prev + (prev ? '\n' : '') + text);
    };
    window.addEventListener('workspace-insert-text', handleWorkspaceInsert);
    return () => window.removeEventListener('workspace-insert-text', handleWorkspaceInsert);
  }, []);

  // Capture pending queries from voice command history re-trigger
  useEffect(() => {
    const pending = localStorage.getItem('omnichat_pending_query');
    if (pending) {
      setQuery(pending);
      localStorage.removeItem('omnichat_pending_query');
    }
  }, []);

  // Clean up media streams on unmount
  useEffect(() => {
    return () => {
      attachments.forEach(att => {
        if (att.stream) {
          att.stream.getTracks().forEach(track => track.stop());
        }
      });
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [attachments, cameraStream]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((query.trim() || attachments.length > 0) && !isLoading) {
      let finalQuery = query.trim();
      
      if (attachments.length > 0) {
        const attNames = attachments.map(a => `[${a.type}: ${a.name}]`).join(', ');
        if (!finalQuery) {
          finalQuery = `Analyzing attached: ${attNames}`;
        } else {
          finalQuery = `${finalQuery}\n\n(Attached: ${attNames})`;
        }
      }

      onSearch(finalQuery, mode);
      clearQueryDraft();
      
      // Stop stream tracks on submit
      attachments.forEach(att => {
        if (att.stream) {
          att.stream.getTracks().forEach(track => track.stop());
        }
      });
      setAttachments([]);
      
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [query]);

  // File Attachment Actions
  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newAttachments: Attachment[] = Array.from(files).map(file => ({
      id: `att_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type: 'file',
      name: file.name
    }));
    setAttachments(prev => [...prev, ...newAttachments]);
    toast.success(`Attached ${files.length} document(s)`);
    setIsMenuOpen(false);
  };

  const handlePhotosSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newAttachments: Attachment[] = Array.from(files).map(file => ({
      id: `att_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type: 'photo',
      name: file.name,
      url: URL.createObjectURL(file)
    }));
    setAttachments(prev => [...prev, ...newAttachments]);
    toast.success(`Attached ${files.length} image(s)`);
    setIsMenuOpen(false);
  };

  // Camera Actions
  const handleStartCamera = async () => {
    setIsMenuOpen(false);
    setIsCameraActive(true);
    // Give a short delay to let the modal mount
    setTimeout(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
        setCameraStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err: any) {
        console.error('Camera access error:', err);
        toast.error('Could not access camera: ' + err.message);
        setIsCameraActive(false);
      }
    }, 100);
  };

  const handleCapturePhoto = () => {
    if (!videoRef.current) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        
        const newAttachment: Attachment = {
          id: `att_${Date.now()}`,
          type: 'camera',
          name: `Camera Snap ${new Date().toLocaleTimeString()}`,
          url: dataUrl
        };
        setAttachments(prev => [...prev, newAttachment]);
        toast.success('Captured snap attached!');
        handleCloseCamera();
      }
    } catch (err: any) {
      toast.error('Failed to capture photo: ' + err.message);
    }
  };

  const handleCloseCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
    }
    setCameraStream(null);
    setIsCameraActive(false);
  };

  // Screen Share actions
  const startScreenShare = async () => {
    setIsMenuOpen(false);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const newAttachment: Attachment = {
        id: `att_${Date.now()}`,
        type: 'screen',
        name: 'Live Screen Share',
        stream: stream
      };
      setAttachments(prev => [...prev, newAttachment]);
      toast.success('Live Screen Sharing Attached!');
    } catch (err: any) {
      console.error('Screen sharing error:', err);
      toast.error('Could not capture screen: ' + err.message);
    }
  };

  // Toggle plugins
  const handleTogglePlugin = (pluginId: string, pluginName: string) => {
    setAttachments(prev => {
      const exists = prev.some(a => a.type === 'plugin' && a.pluginId === pluginId);
      if (exists) {
        toast.success(`Removed Plugin: ${pluginName}`);
        return prev.filter(a => !(a.type === 'plugin' && a.pluginId === pluginId));
      } else {
        toast.success(`Activated Plugin: ${pluginName}`);
        return [...prev, {
          id: `att_pl_${pluginId}`,
          type: 'plugin',
          name: pluginName,
          pluginId: pluginId
        }];
      }
    });
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments(prev => {
      const target = prev.find(a => a.id === id);
      if (target?.stream) {
        target.stream.getTracks().forEach(track => track.stop());
      }
      return prev.filter(a => a.id !== id);
    });
    toast.success('Attachment removed');
  };

  const canSubmit = (query.trim() || attachments.length > 0) && !isLoading;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full transition-all duration-300",
        compact ? "max-w-3xl" : "max-w-2xl mx-auto",
        showSuggestions && suggestions.length > 0 ? "z-50" : "z-auto"
      )}
    >
      {/* Hidden native input pickers */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFilesSelected}
        multiple
        className="hidden"
      />
      <input
        type="file"
        ref={photoInputRef}
        onChange={handlePhotosSelected}
        accept="image/*"
        multiple
        className="hidden"
      />

      <form
        onSubmit={handleSubmit}
        className={cn(
          "glass-input relative flex flex-col transition-all duration-300",
          compact ? "rounded-[24px] p-3" : "rounded-[28px] p-4 shadow-2xl"
        )}
      >
        {/* Subtle top highlight line */}
        <div className="absolute inset-x-0 top-0 h-px rounded-t-[28px] bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />

        {/* Dynamic Attachment list renderer above text area */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-2 pb-3 mb-2 border-b border-white/5">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="relative group bg-white/5 hover:bg-white/10 rounded-xl p-1.5 pr-8 flex items-center gap-2 border border-white/5 transition-all animate-fade-in"
              >
                {att.type === 'photo' || att.type === 'camera' ? (
                  <div className="w-8 h-8 rounded-lg overflow-hidden relative bg-black/40">
                    <img src={att.url} alt={att.name} className="w-full h-full object-cover" />
                  </div>
                ) : att.type === 'screen' ? (
                  <div className="w-8 h-8 rounded-lg overflow-hidden relative bg-black/40 flex items-center justify-center">
                    <Tv size={14} className="text-emerald-400 animate-pulse" />
                    {att.stream && (
                      <video
                        autoPlay
                        playsInline
                        muted
                        ref={(el) => {
                          if (el && att.stream) {
                            el.srcObject = att.stream;
                          }
                        }}
                        className="absolute inset-0 w-full h-full object-cover opacity-80"
                      />
                    )}
                  </div>
                ) : att.type === 'plugin' ? (
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-400">
                    <ToyBrick size={14} />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 border border-white/5">
                    <FileText size={14} />
                  </div>
                )}

                <div className="min-w-0 max-w-[120px]">
                  <p className="text-[10px] font-bold text-slate-200 truncate">{att.name}</p>
                  <p className="text-[8px] text-slate-500 capitalize">{att.type}</p>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveAttachment(att.id)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Text Area and the IconButton */}
        <div className="flex items-start gap-1 w-full">
          <textarea
            ref={textareaRef}
            rows={1}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything..."
            className={cn(
              "w-full bg-transparent border-none outline-none focus:outline-none focus:ring-0 resize-none px-2 py-2 text-[15px] leading-relaxed placeholder:text-white/25 text-white/90",
              compact ? "min-h-[22px]" : "min-h-[40px] max-h-[200px]"
            )}
            style={{
              height: 'auto',
              overflowY: query.split('\n').length > 8 ? 'auto' : 'hidden',
            }}
          />
        </div>

        <div className="flex items-center justify-between mt-3 px-1">
          {/* Mode toggle — pill style */}
          <div className="flex items-center gap-1 p-1 rounded-full bg-white/5 border border-white/10">
            <button
              type="button"
              onClick={() => setMode('search')}
              title="Quick Search"
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold transition-all duration-200 cursor-pointer",
                mode === 'search'
                  ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold"
                  : "text-white/40 hover:text-white/70"
              )}
            >
              <Search size={13} strokeWidth={2.5} />
              <span>Search</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('research')}
              title="Deep Research"
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold transition-all duration-200 cursor-pointer",
                mode === 'research'
                  ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold"
                  : "text-white/40 hover:text-white/70"
              )}
            >
              <Telescope size={13} strokeWidth={2.5} />
              <span>Research</span>
            </button>
          </div>

          {/* Right side tools */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="p-2 text-white/30 hover:text-white/70 hover:bg-white/5 rounded-full transition-all cursor-pointer"
              title="Web"
            >
              <Globe size={17} strokeWidth={1.8} />
            </button>

            <button
              type="button"
              onClick={() => setIsMenuOpen(true)}
              className="p-2 text-white/30 hover:text-white/70 hover:bg-white/5 rounded-full transition-all cursor-pointer"
              title="Attach"
            >
              <Plus size={17} strokeWidth={2.5} />
            </button>

            {onToggleWorkspace && (
              <button
                type="button"
                onClick={onToggleWorkspace}
                className={`p-2 rounded-full transition-all cursor-pointer ${showWorkspace ? 'text-cyan-400 bg-cyan-500/10' : 'text-white/30 hover:text-white/70 hover:bg-white/5'}`}
                title="Google Workspace Assistant"
              >
                <Briefcase size={17} strokeWidth={1.8} />
              </button>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className={cn(
                "p-2 ml-1 rounded-full transition-all duration-200 flex items-center justify-center cursor-pointer",
                canSubmit
                  ? "bg-emerald-500 hover:bg-emerald-400 text-black hover:scale-105 shadow-lg shadow-emerald-500/10"
                  : "bg-white/5 text-white/20"
              )}
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <ArrowRight size={17} strokeWidth={2.5} />
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-slate-950/95 border border-slate-800 rounded-2xl overflow-hidden z-50 shadow-2xl animate-fade-in-up backdrop-blur-md">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              type="button"
              className="w-full text-left px-4 py-3 hover:bg-slate-900/80 flex items-center gap-3 transition-colors group border-b border-slate-900 last:border-0 cursor-pointer"
              onClick={() => {
                setQuery(suggestion);
                onSearch(suggestion, mode);
                setShowSuggestions(false);
              }}
            >
              <Search size={14} className="text-slate-500 group-hover:text-emerald-450 transition-colors mt-0.5 shrink-0" />
              <span className="text-sm text-slate-300 group-hover:text-slate-100 transition-colors font-medium">{suggestion}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── FLUTTER-INSPIRED ATTACHMENT MENU BOTTOM SHEET ── */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsMenuOpen(false);
                setIsPluginSubmenuOpen(false);
              }}
              className="fixed inset-0 bg-black z-50"
            />

            {/* Bottom Sheet Modal */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              style={{ backgroundColor: "#1F1F1F" }}
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-[28px] shadow-2xl p-6 border-t border-white/5 max-w-lg mx-auto"
            >
              {/* Drag Indicator Handle */}
              <div className="w-12 h-1 bg-white/10 rounded-full mx-auto mb-6" />

              {!isPluginSubmenuOpen ? (
                /* Primary Attachment Tiles Column */
                <div className="flex flex-col gap-4">
                  {/* Google Workspace Tile */}
                  {onToggleWorkspace && (
                    <button
                      type="button"
                      onClick={() => {
                        onToggleWorkspace();
                        setIsMenuOpen(false);
                      }}
                      className="w-full text-left flex items-center gap-4 p-3 rounded-2xl hover:bg-white/5 active:bg-white/10 transition-colors group cursor-pointer"
                    >
                      <div className="w-14 h-14 bg-cyan-950/40 border border-cyan-500/20 rounded-full flex items-center justify-center shrink-0 shadow-lg group-hover:scale-105 transition-transform duration-200">
                        <Briefcase size={28} className="text-cyan-400" />
                      </div>
                      <span className="text-white text-[22px] font-medium leading-none flex items-center justify-between w-full pr-2">
                        Google Workspace
                        <span className="text-[10px] bg-cyan-500/10 border border-cyan-500/25 text-cyan-400 font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                          Active
                        </span>
                      </span>
                    </button>
                  )}

                  {/* Camera Tile */}
                  <button
                    type="button"
                    onClick={handleStartCamera}
                    className="w-full text-left flex items-center gap-4 p-3 rounded-2xl hover:bg-white/5 active:bg-white/10 transition-colors group cursor-pointer"
                  >
                    <div className="w-14 h-14 bg-zinc-800 rounded-full flex items-center justify-center shrink-0 shadow-lg group-hover:scale-105 transition-transform duration-200">
                      <Camera size={28} className="text-white" />
                    </div>
                    <span className="text-white text-[22px] font-medium leading-none">
                      Camera
                    </span>
                  </button>

                  {/* Photos Tile */}
                  <button
                    type="button"
                    onClick={() => {
                      photoInputRef.current?.click();
                    }}
                    className="w-full text-left flex items-center gap-4 p-3 rounded-2xl hover:bg-white/5 active:bg-white/10 transition-colors group cursor-pointer"
                  >
                    <div className="w-14 h-14 bg-zinc-800 rounded-full flex items-center justify-center shrink-0 shadow-lg group-hover:scale-105 transition-transform duration-200">
                      <Image size={28} className="text-white" />
                    </div>
                    <span className="text-white text-[22px] font-medium leading-none">
                      Photos
                    </span>
                  </button>

                  {/* Files Tile */}
                  <button
                    type="button"
                    onClick={() => {
                      fileInputRef.current?.click();
                    }}
                    className="w-full text-left flex items-center gap-4 p-3 rounded-2xl hover:bg-white/5 active:bg-white/10 transition-colors group cursor-pointer"
                  >
                    <div className="w-14 h-14 bg-zinc-800 rounded-full flex items-center justify-center shrink-0 shadow-lg group-hover:scale-105 transition-transform duration-200">
                      <FileText size={28} className="text-white" />
                    </div>
                    <span className="text-white text-[22px] font-medium leading-none">
                      Files
                    </span>
                  </button>

                  {/* Plugins Tile */}
                  <button
                    type="button"
                    onClick={() => setIsPluginSubmenuOpen(true)}
                    className="w-full text-left flex items-center gap-4 p-3 rounded-2xl hover:bg-white/5 active:bg-white/10 transition-colors group cursor-pointer"
                  >
                    <div className="w-14 h-14 bg-zinc-800 rounded-full flex items-center justify-center shrink-0 shadow-lg group-hover:scale-105 transition-transform duration-200">
                      <ToyBrick size={28} className="text-white" />
                    </div>
                    <span className="text-white text-[22px] font-medium leading-none flex items-center justify-between w-full pr-2">
                      Plugins
                      <span className="text-xs bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                        Power tools
                      </span>
                    </span>
                  </button>

                  {/* Share Screen Tile */}
                  <button
                    type="button"
                    onClick={startScreenShare}
                    className="w-full text-left flex items-center gap-4 p-3 rounded-2xl hover:bg-white/5 active:bg-white/10 transition-colors group cursor-pointer"
                  >
                    <div className="w-14 h-14 bg-zinc-800 rounded-full flex items-center justify-center shrink-0 shadow-lg group-hover:scale-105 transition-transform duration-200">
                      <Cast size={28} className="text-white" />
                    </div>
                    <span className="text-white text-[22px] font-medium leading-none">
                      Share screen
                    </span>
                  </button>
                </div>
              ) : (
                /* Plugins Selection Submenu */
                <div className="flex flex-col gap-4 animate-fade-in">
                  <div className="flex items-center justify-between pb-2 border-b border-white/5">
                    <button
                      type="button"
                      onClick={() => setIsPluginSubmenuOpen(false)}
                      className="text-xs text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      ← Back to menu
                    </button>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Attach AI Plugins
                    </span>
                  </div>

                  <div className="space-y-2 mt-2">
                    {PLUGINS.map(pl => {
                      const isActive = attachments.some(a => a.type === 'plugin' && a.pluginId === pl.id);
                      return (
                        <button
                          key={pl.id}
                          type="button"
                          onClick={() => handleTogglePlugin(pl.id, pl.name)}
                          className={cn(
                            "w-full text-left p-3.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer",
                            isActive 
                              ? "bg-emerald-500/10 border-emerald-500/35 text-emerald-300"
                              : "bg-white/5 hover:bg-white/10 border-transparent text-slate-300"
                          )}
                        >
                          <div>
                            <p className="text-sm font-bold">{pl.name}</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">{pl.desc}</p>
                          </div>
                          <div className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center border transition-all",
                            isActive 
                              ? "bg-emerald-500 border-emerald-500 text-black"
                              : "border-slate-700 bg-transparent"
                          )}>
                            {isActive && <Check size={14} strokeWidth={3} />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── HIGH-FIDELITY LIVE CAMERA CAPTURE OVERLAY ── */}
      <AnimatePresence>
        {isCameraActive && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
            <div className="w-full max-w-md bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-2xl relative overflow-hidden flex flex-col gap-4">
              <div className="flex items-center justify-between pb-2 border-b border-white/5">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Camera size={14} className="text-emerald-400" />
                  Live Camera Capture
                </span>
                <button
                  type="button"
                  onClick={handleCloseCamera}
                  className="p-1 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Live stream viewport */}
              <div className="aspect-video w-full rounded-xl bg-black border border-white/5 relative overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
                {!cameraStream && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500">
                    <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    <p className="text-[11px] font-medium">Starting stream viewport...</p>
                  </div>
                )}
              </div>

              {/* Capture triggers */}
              <div className="flex gap-2.5 mt-2">
                <button
                  type="button"
                  onClick={handleCloseCamera}
                  className="flex-1 py-2.5 text-xs font-semibold text-slate-300 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/5 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCapturePhoto}
                  disabled={!cameraStream}
                  className="flex-1 py-2.5 text-xs font-semibold text-black bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 active:scale-[0.98] rounded-xl transition-all shadow-lg shadow-emerald-500/10 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Sparkles size={14} />
                  Capture & Attach
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
