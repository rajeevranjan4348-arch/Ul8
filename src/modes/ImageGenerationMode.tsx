import React, { useState, useEffect, useRef } from 'react';
import { 
  Image as ImageIcon, Sparkles, Loader2, Download, Trash2, Plus, 
  MessageSquare, Copy, Check, Sliders, Minimize2, ZoomIn, Square, RefreshCw
} from 'lucide-react';
import { getAiInstance } from '../services/gemini';
import { useTheme } from '../contexts/ThemeContext';
import { motion, AnimatePresence } from 'motion/react';
import { usePeriodicAutoSave } from '../hooks/usePeriodicAutoSave';

interface GeneratedImageItem {
  id: string;
  prompt: string;
  style: string;
  aspectRatio: string;
  url: string;
  createdAt: number;
}

interface ImageSession {
  id: string;
  title: string;
  updatedAt: number;
  items: GeneratedImageItem[];
}

const STYLE_PRESETS = [
  { id: 'cinematic', label: 'Cinematic', desc: 'Dramatic lighting, photorealistic detail', stylePrompt: 'cinematic lighting, photorealistic, 8k resolution, highly detailed, dramatic shadows' },
  { id: 'anime', label: 'Anime/Manga', desc: 'Vibrant colors, hand-drawn anime aesthetic', stylePrompt: 'vibrant anime style, detailed manga artwork, colorful, studio ghibli aesthetic, clean lines' },
  { id: 'watercolor', label: 'Watercolor', desc: 'Soft pastel tones, bleeding paint', stylePrompt: 'soft watercolor painting, artistic bleeding paint edges, pastel color palette, canvas texture, elegant' },
  { id: 'cyberpunk', label: 'Cyberpunk', desc: 'Neon lights, futuristic tech atmosphere', stylePrompt: 'cyberpunk neon style, futuristic tech details, glowing holographic elements, synthwave aesthetics, dark high-contrast' },
  { id: '3d-render', label: '3D Render', desc: 'Smooth clay, vibrant octane renders', stylePrompt: 'isometric 3d render, blender octane render, smooth clay shader, cute, vibrant studio lighting, raytraced' },
  { id: 'pixel-art', label: 'Pixel Art', desc: '16-bit retro arcade game style', stylePrompt: 'retro 16-bit pixel art style, arcade game design, isometric, limited color palette, clean grid' },
];

const ASPECT_RATIOS = [
  { id: '1:1', label: 'Square (1:1)', class: 'w-7 h-7' },
  { id: '16:9', label: 'Landscape (16:9)', class: 'w-9 h-5' },
  { id: '9:16', label: 'Portrait (9:16)', class: 'w-5 h-9' },
  { id: '4:3', label: 'Classic (4:3)', class: 'w-8 h-6' },
  { id: '3:4', label: 'Portrait (3:4)', class: 'w-6 h-8' },
];

const SUGGESTIONS = [
  "A majestic phoenix rising from glowing blue embers, digital painting",
  "An adorable white kitten wearing a golden astronaut helmet, 3D render",
  "Cozy warm coffee shop on a rainy street corner, watercolor illustration",
  "A cyberpunk ninja perched on top of a towering neon skyscraper, cinematic"
];

export const ImageGenerationMode: React.FC = () => {
  const { isDarkMode, getAccentClass, getBorderClass } = useTheme();

  // Load image sessions from localStorage
  const [sessions, setSessions] = useState<ImageSession[]>(() => {
    const saved = localStorage.getItem('omnichat_image_sessions');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((s: any) => ({
          ...s,
          updatedAt: Number(s.updatedAt) || Date.now(),
          items: s.items || []
        }));
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(() => {
    return localStorage.getItem('omnichat_image_current') || null;
  });

  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('cinematic');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);

  // Sync current session id
  useEffect(() => {
    if (sessions.length > 0 && !currentSessionId) {
      setCurrentSessionId(sessions[0].id);
    }
  }, [sessions, currentSessionId]);

  // Periodic and unload auto-save for image sessions & current session
  usePeriodicAutoSave('omnichat_image_sessions', sessions, {
    intervalMs: 1500
  });

  usePeriodicAutoSave('omnichat_image_current', currentSessionId, {
    intervalMs: 1500
  });

  const activeSession = sessions.find(s => s.id === currentSessionId) || null;

  const createNewSession = () => {
    if (activeSession && activeSession.items.length === 0) {
      return; // already on an empty session
    }
    const newSession: ImageSession = {
      id: Date.now().toString(),
      title: 'New Artwork Session',
      updatedAt: Date.now(),
      items: []
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    setPrompt('');
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this session?')) {
      const remaining = sessions.filter(s => s.id !== id);
      setSessions(remaining);
      if (currentSessionId === id) {
        setCurrentSessionId(remaining.length > 0 ? remaining[0].id : null);
      }
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);

    // Make sure we have an active session
    let sessionToUse = activeSession;
    let updatedSessions = [...sessions];

    if (!sessionToUse) {
      const newSession: ImageSession = {
        id: Date.now().toString(),
        title: prompt.substring(0, 30) + (prompt.length > 30 ? '...' : ''),
        updatedAt: Date.now(),
        items: []
      };
      updatedSessions = [newSession, ...updatedSessions];
      sessionToUse = newSession;
      setSessions(updatedSessions);
      setCurrentSessionId(newSession.id);
    }

    try {
      const ai = getAiInstance();
      const stylePreset = STYLE_PRESETS.find(s => s.id === selectedStyle);
      const enhancedPrompt = `${prompt}, ${stylePreset ? stylePreset.stylePrompt : ''}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-image',
        contents: {
          parts: [{ text: enhancedPrompt }]
        },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio as any
          }
        }
      });

      let base64Data = '';
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          base64Data = part.inlineData.data;
          break;
        }
      }

      if (!base64Data) {
        throw new Error('No image data returned from Gemini');
      }

      const imageUrl = `data:image/png;base64,${base64Data}`;

      const newItem: GeneratedImageItem = {
        id: Date.now().toString(),
        prompt: prompt,
        style: selectedStyle,
        aspectRatio: aspectRatio,
        url: imageUrl,
        createdAt: Date.now()
      };

      setSessions(prev => prev.map(s => {
        if (s.id === sessionToUse!.id) {
          return {
            ...s,
            title: s.title === 'New Artwork Session' ? prompt.substring(0, 30) + (prompt.length > 30 ? '...' : '') : s.title,
            updatedAt: Date.now(),
            items: [newItem, ...s.items]
          };
        }
        return s;
      }));

    } catch (err: any) {
      console.error('Image generation error:', err);
      alert(`Image generation failed: ${err.message || err}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyPrompt = (p: string) => {
    navigator.clipboard.writeText(p);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-[#07070b] text-white">
      {/* ── Main Content Area ── */}
      <div className="flex-1 h-full overflow-y-auto p-4 md:p-6 space-y-6 flex flex-col justify-between">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/5 pb-4 shrink-0">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-lg md:text-xl font-bold flex items-center gap-2 bg-gradient-to-r from-rose-400 via-pink-400 to-violet-400 bg-clip-text text-transparent">
                  <Sparkles size={20} className="text-pink-400 animate-pulse" />
                  Image Generation
                </h1>
                <p className="text-xs text-white/40">Convert raw imagination into high-resolution masterpieces</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={`p-2 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all`}
                title="Toggle Sidebar"
              >
                <Sliders size={16} />
              </button>
              <button
                onClick={createNewSession}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-pink-500/20 bg-pink-500/10 hover:bg-pink-500/20 text-pink-300 text-xs font-semibold transition-all"
              >
                <Plus size={13} />
                New Artwork
              </button>
            </div>
          </div>

          {/* Form and Controls */}
          <form onSubmit={handleGenerate} className="space-y-4 max-w-4xl">
            {/* Prompt Input Box */}
            <div className="relative group">
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="Describe what you want to create... (e.g., 'A gorgeous oil painting of an ancient mystical tree of life in the middle of a glowing cosmos')"
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white placeholder-white/30 focus:outline-none focus:border-pink-500/50 focus:bg-white/8 transition-all resize-none leading-relaxed"
                disabled={isGenerating}
              />
              <div className="absolute right-3 bottom-3 flex items-center gap-2">
                <button
                  type="submit"
                  disabled={!prompt.trim() || isGenerating}
                  className="bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-400 hover:to-pink-400 text-white font-medium rounded-xl px-4 py-2 text-xs transition-all shadow-lg flex items-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Sparkles size={13} />
                      Generate
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Prompt Suggestions */}
            {!prompt && (
              <div className="space-y-1.5">
                <div className="text-[10px] uppercase font-bold tracking-wider text-white/30">Stuck? Try a prompt suggestion:</div>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setPrompt(s)}
                      className="text-[11px] text-white/50 hover:text-pink-300 bg-white/3 hover:bg-pink-500/10 border border-white/5 hover:border-pink-500/20 px-3 py-1.5 rounded-xl text-left transition-all"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Options grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* Aspect Ratio selection */}
              <div className="bg-white/3 border border-white/5 rounded-2xl p-4 space-y-3">
                <label className="text-[11px] uppercase tracking-wider font-bold text-white/40 flex items-center gap-1.5">
                  <Sliders size={12} className="text-pink-400" />
                  Aspect Ratio
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {ASPECT_RATIOS.map(ratio => (
                    <button
                      key={ratio.id}
                      type="button"
                      onClick={() => setAspectRatio(ratio.id)}
                      className={`p-2.5 rounded-xl border flex flex-col items-center justify-between gap-2.5 transition-all ${
                        aspectRatio === ratio.id
                          ? 'border-pink-500/40 bg-pink-500/10 text-pink-300'
                          : 'border-white/5 bg-black/20 text-white/40 hover:border-white/10 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <div className={`border rounded border-current/25 flex items-center justify-center ${ratio.class}`} />
                      <span className="text-[10px] font-medium leading-none text-center">{ratio.id}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Style Presets */}
              <div className="bg-white/3 border border-white/5 rounded-2xl p-4 space-y-3">
                <label className="text-[11px] uppercase tracking-wider font-bold text-white/40 flex items-center gap-1.5">
                  <Sparkles size={12} className="text-pink-400" />
                  Artistic Preset
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-[140px] overflow-y-auto scrollbar-thin pr-1">
                  {STYLE_PRESETS.map(preset => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setSelectedStyle(preset.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        selectedStyle === preset.id
                          ? 'border-pink-500/40 bg-pink-500/10 text-pink-300'
                          : 'border-white/5 bg-black/20 text-white/50 hover:border-white/10 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <div className="text-xs font-semibold">{preset.label}</div>
                      <div className="text-[9px] text-white/30 truncate mt-0.5">{preset.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </form>

          {/* Active Generated Artwork Showcase */}
          <div className="max-w-4xl space-y-4">
            <h2 className="text-xs uppercase font-bold tracking-wider text-white/40 flex items-center gap-1.5">
              <ImageIcon size={13} className="text-pink-400" />
              Generated Canvas
            </h2>

            {isGenerating && (
              <div className="bg-white/3 border border-white/5 rounded-2xl p-8 flex flex-col items-center justify-center min-h-[300px] gap-4">
                <div className="relative">
                  <Loader2 size={40} className="text-pink-500 animate-spin" />
                  <Sparkles size={18} className="text-rose-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-semibold text-white">Synthesizing Pixels...</p>
                  <p className="text-xs text-white/40">Translating prompt via gemini-3.1-flash-lite-image</p>
                </div>
              </div>
            )}

            {!isGenerating && (!activeSession || activeSession.items.length === 0) && (
              <div className="border border-dashed border-white/10 bg-white/2 rounded-2xl p-12 flex flex-col items-center justify-center min-h-[300px] text-white/20 gap-3">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                  <ImageIcon size={22} className="text-white/35" />
                </div>
                <div className="text-center">
                  <div className="text-xs font-semibold text-white/60">No generated images in this session</div>
                  <div className="text-[11px] text-white/30 mt-1">Provide a prompt above and click generate to build an image</div>
                </div>
              </div>
            )}

            {!isGenerating && activeSession && activeSession.items.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Feature display */}
                <div className="bg-white/3 border border-white/5 rounded-2xl overflow-hidden group/card relative flex flex-col justify-between">
                  <div className="relative aspect-square overflow-hidden bg-black/30 flex items-center justify-center">
                    <img
                      src={activeSession.items[0].url}
                      alt={activeSession.items[0].prompt}
                      className="w-full h-full object-contain cursor-zoom-in group-hover/card:scale-[1.01] transition-transform duration-500"
                      onClick={() => setZoomImageUrl(activeSession.items[0].url)}
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-3 right-3 flex items-center gap-1.5 opacity-0 group-hover/card:opacity-100 transition-opacity duration-200">
                      <button
                        onClick={() => setZoomImageUrl(activeSession.items[0].url)}
                        className="p-2 rounded-xl bg-black/60 hover:bg-black/80 backdrop-blur text-white/80 hover:text-white border border-white/10 transition-colors"
                        title="Zoom Image"
                      >
                        <ZoomIn size={14} />
                      </button>
                      <a
                        href={activeSession.items[0].url}
                        download={`generated-${activeSession.items[0].id}.png`}
                        className="p-2 rounded-xl bg-black/60 hover:bg-black/80 backdrop-blur text-white/80 hover:text-white border border-white/10 transition-colors"
                        title="Download Artwork"
                      >
                        <Download size={14} />
                      </a>
                    </div>
                  </div>

                  <div className="p-4 border-t border-white/5 bg-black/20 space-y-3 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold uppercase tracking-wider bg-pink-500/15 text-pink-300 border border-pink-500/20 px-2 py-0.5 rounded-full">
                          Preset: {activeSession.items[0].style}
                        </span>
                        <span className="text-[10px] text-white/30">Aspect: {activeSession.items[0].aspectRatio}</span>
                      </div>
                      <p className="text-xs text-white/80 leading-relaxed mt-2 italic font-mono">
                        "{activeSession.items[0].prompt}"
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleCopyPrompt(activeSession.items[0].prompt)}
                        className="flex-1 py-1.5 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5"
                      >
                        {copiedPrompt ? (
                          <>
                            <Check size={12} className="text-emerald-400" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy size={12} />
                            Copy Prompt
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Grid of previous images in this same session */}
                <div className="space-y-3">
                  <div className="text-[11px] uppercase tracking-wider font-bold text-white/30">Previous images in session:</div>
                  {activeSession.items.length <= 1 ? (
                    <div className="border border-dashed border-white/5 bg-white/1 rounded-2xl p-6 text-center text-white/20 text-xs">
                      No other images generated in this session.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 max-h-[380px] overflow-y-auto scrollbar-thin pr-1">
                      {activeSession.items.slice(1).map((item) => (
                        <div 
                          key={item.id} 
                          className="group border border-white/5 rounded-xl overflow-hidden bg-black/20 cursor-pointer relative"
                          onClick={() => {
                            // promote to primary by swapping or simply viewing
                            setPrompt(item.prompt);
                            setSelectedStyle(item.style);
                            setAspectRatio(item.aspectRatio);
                            // swap session items order so clicked item becomes index 0
                            setSessions(prev => prev.map(s => {
                              if (s.id === currentSessionId) {
                                const remaining = s.items.filter(i => i.id !== item.id);
                                return {
                                  ...s,
                                  items: [item, ...remaining]
                                };
                              }
                              return s;
                            }));
                          }}
                        >
                          <div className="aspect-square bg-black/35 flex items-center justify-center">
                            <img
                              src={item.url}
                              alt={item.prompt}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <div className="p-2 bg-black/40 text-[10px] text-white/40 truncate">
                            {item.prompt}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Collapsible History Sidebar ── */}
      <AnimatePresence initial={false}>
        {showHistory && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            className={`h-full shrink-0 border-l ${getBorderClass()} bg-black/40 backdrop-blur-md overflow-hidden flex flex-col`}
          >
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <span className="text-xs font-semibold text-white/40 uppercase tracking-wider flex items-center gap-2">
                <ImageIcon size={14} className="text-pink-400" />
                Artwork History
              </span>
              <button
                onClick={createNewSession}
                className="p-1.5 rounded-lg hover:bg-white/5 text-white/60 hover:text-white transition-colors"
                title="New Session"
              >
                <Plus size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin">
              {sessions.length === 0 ? (
                <div className="text-center py-10 text-white/35 text-xs">
                  No artworks generated yet.
                </div>
              ) : (
                sessions.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => {
                      setCurrentSessionId(s.id);
                      if (s.items.length > 0) {
                        setPrompt(s.items[0].prompt);
                        setSelectedStyle(s.items[0].style);
                        setAspectRatio(s.items[0].aspectRatio);
                      }
                    }}
                    className={`w-full text-left p-3 rounded-xl flex items-center gap-3 transition-colors cursor-pointer select-none ${
                      currentSessionId === s.id
                        ? 'bg-pink-500/10 text-pink-300 border border-pink-500/20'
                        : 'hover:bg-white/5 text-white/70 hover:text-white border border-transparent'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0 border border-white/5">
                      {s.items.length > 0 ? (
                        <img 
                          src={s.items[0].url} 
                          alt="preview" 
                          className="w-full h-full object-cover rounded-lg" 
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <ImageIcon size={14} className="text-white/40" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-xs truncate">{s.title}</div>
                      <div className="text-[10px] text-white/30 mt-0.5">{s.items.length} images</div>
                    </div>
                    <button
                      onClick={(e) => deleteSession(s.id, e)}
                      className="p-1 rounded hover:bg-red-500/20 text-white/20 hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Zoom Modal ── */}
      <AnimatePresence>
        {zoomImageUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm"
            onClick={() => setZoomImageUrl(null)}
          >
            <button
              onClick={() => setZoomImageUrl(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <Minimize2 size={20} />
            </button>
            <motion.img
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              transition={{ type: 'spring', damping: 25 }}
              src={zoomImageUrl}
              alt="Zoomed preview"
              className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl"
              onClick={e => e.stopPropagation()}
              referrerPolicy="no-referrer"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
