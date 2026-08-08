import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Terminal, Compass, Folder, Mail, Calendar, 
  ListTodo, Users, Sparkles, Database, CheckSquare,
  ChevronsRight, HelpCircle, Eye, Command, MessageSquare,
  FileCode, Mic, Volume2, FileAudio, MapPin, ImageIcon,
  Cpu, Code, Clock, Shield, Sparkle, Tag, FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppMode } from '../types';
import { appLogger } from '../utils/logger';
import { getWorkspaceLogs, auth, db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { sounds, triggerHaptic } from './PremiumEffects';

interface CommandPaletteProps {
  currentMode: string;
  onModeChange: (mode: any) => void;
  onClose?: () => void;
}

export interface SearchItem {
  id: string;
  category: 'chats' | 'files' | 'voice' | 'workspace' | 'modes' | 'logs';
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  sourceLabel: string;
  updatedAt?: number;
  highlightText?: string;
  action: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ currentMode, onModeChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'chats' | 'files' | 'voice' | 'workspace' | 'modes'>('all');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [items, setItems] = useState<SearchItem[]>([]);
  const [isLoadingFirebase, setIsLoadingFirebase] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Toggle open/close on Cmd+K or Ctrl+K or custom event
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen(prev => {
          const next = !prev;
          if (next) {
            sounds.playClick();
            triggerHaptic('light');
          }
          return next;
        });
      } else if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        sounds.playClick();
      }
    };

    const handleCustomOpen = () => {
      setIsOpen(true);
      sounds.playClick();
      triggerHaptic('light');
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-global-search', handleCustomOpen);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-global-search', handleCustomOpen);
    };
  }, [isOpen]);

  // Focus input & index data when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setSearch('');
      setSelectedIndex(0);
      loadGlobalIndexedItems();
    }
  }, [isOpen]);

  const loadGlobalIndexedItems = async () => {
    setIsLoadingFirebase(true);
    const globalItems: SearchItem[] = [];

    // Helper for time formatting
    const toTs = (v: any) => v ? (typeof v === 'number' ? v : new Date(v).getTime()) : Date.now();

    // ── 1. App Modes ──
    const modeLabels: Record<string, { label: string; icon: React.ReactNode; desc: string }> = {
      dashboard: { label: 'Dashboard Portal', icon: <Compass size={16} className="text-cyan-400" />, desc: 'System dashboard, dynamic weather & AI assistant stats' },
      history: { label: 'Chat History', icon: <Clock size={16} className="text-amber-400" />, desc: 'Review historical conversation logs and voice recordings' },
      'omni-chat': { label: 'Omni Chat (Default)', icon: <Sparkles size={16} className="text-violet-400" />, desc: 'Converse with multi-model Gemini agents' },
      'chat-pro': { label: 'Pro Chat (Thinking)', icon: <MessageSquare size={16} className="text-indigo-400" />, desc: 'Deep research grounding with live search API' },
      'liquid-chat': { label: 'Liquid Chat', icon: <Sparkles size={16} className="text-pink-400" />, desc: 'Ambient animated chat container with fluid particles' },
      'chat-fast': { label: 'Manus Agent (Taskforce)', icon: <Sparkles size={16} className="text-emerald-400" />, desc: 'Auto-pilot agent for scheduling complex pipelines' },
      coder: { label: 'AI Coder IDE', icon: <Code size={16} className="text-teal-400" />, desc: 'Generate, validate, and preview code changes real-time' },
      jarvis: { label: 'J.A.R.V.I.S. HUD Interface', icon: <Cpu size={16} className="text-amber-400" />, desc: 'Immersive voice & canvas analytics cockpit' },
      'voice-live': { label: 'Voice AI (Live Stream)', icon: <Mic size={16} className="text-rose-400" />, desc: 'Hands-free deep male voice assistant' },
      'image-gen': { label: 'Image Studio', icon: <ImageIcon size={16} className="text-purple-400" />, desc: 'Convert text queries into high fidelity visual assets' },
      'search-maps': { label: 'Search & Maps', icon: <MapPin size={16} className="text-orange-400" />, desc: 'Explore locations and retrieve details with Maps integration' },
      transcription: { label: 'Audio Transcription', icon: <FileAudio size={16} className="text-sky-400" />, desc: 'Upload or record voice files to extract high precision transcriptions' },
      tts: { label: 'Text to Speech Synth', icon: <Volume2 size={16} className="text-indigo-400" />, desc: 'Convert text blocks into deep lifelike voice speech' },
      workspace: { label: 'Workspace Central', icon: <Database size={16} className="text-cyan-400" />, desc: 'Connected Gmail, Drive, Calendar, Tasks and Keep Notes' },
      settings: { label: 'Preferences & Voice Settings', icon: <Shield size={16} className="text-slate-400" />, desc: 'Configure deep male voice, themes and API keys' },
      logs: { label: 'Audit Logs', icon: <Terminal size={16} className="text-slate-400" />, desc: 'Verify real-time system executions and security audits' }
    };

    Object.entries(modeLabels).forEach(([modeId, detail]) => {
      globalItems.push({
        id: `mode-${modeId}`,
        category: 'modes',
        title: detail.label,
        subtitle: detail.desc,
        icon: detail.icon,
        sourceLabel: 'Mode Navigation',
        action: () => {
          onModeChange(modeId as any);
          setIsOpen(false);
          sounds.playSuccess();
          triggerHaptic('success');
        }
      });
    });

    // ── 2. Chat History Conversations ──
    // a. Omni Chat
    try {
      const raw = JSON.parse(localStorage.getItem('omnichat_conversations_v2') || '[]');
      if (Array.isArray(raw)) {
        raw.forEach(c => {
          const msgs = c.messages || [];
          const lastMsg = msgs.slice().reverse().find((m: any) => m.role === 'model')?.text || msgs[0]?.text || '';
          globalItems.push({
            id: `omni-${c.id}`,
            category: 'chats',
            title: c.title || 'Omni Chat Session',
            subtitle: lastMsg.slice(0, 120) || 'No messages yet',
            icon: <Sparkles size={16} className="text-violet-400" />,
            sourceLabel: 'Omni Chat',
            updatedAt: toTs(c.updatedAt),
            action: () => {
              localStorage.setItem('omnichat_omni_current_session', c.id);
              onModeChange('omni-chat');
              setIsOpen(false);
              sounds.playSuccess();
            }
          });
        });
      }
    } catch (e) {}

    // b. Pro Chat
    try {
      const raw = JSON.parse(localStorage.getItem('omnichat_conversations_chat-pro') || '[]');
      if (Array.isArray(raw)) {
        raw.forEach(c => {
          const msgs = c.messages || [];
          const lastMsg = msgs.slice().reverse().find((m: any) => m.role === 'model')?.text || msgs[0]?.text || '';
          globalItems.push({
            id: `pro-${c.id}`,
            category: 'chats',
            title: c.title || 'Pro Chat Thinking Session',
            subtitle: lastMsg.slice(0, 120) || 'Deep research query',
            icon: <MessageSquare size={16} className="text-indigo-400" />,
            sourceLabel: 'Pro Chat',
            updatedAt: toTs(c.updatedAt),
            action: () => {
              localStorage.setItem('omnichat_active_id_chat-pro', c.id);
              onModeChange('chat-pro');
              setIsOpen(false);
              sounds.playSuccess();
            }
          });
        });
      }
    } catch (e) {}

    // c. Liquid Chat
    try {
      const raw = JSON.parse(localStorage.getItem('omnichat_liquid_sessions') || '[]');
      if (Array.isArray(raw)) {
        raw.forEach(s => {
          const msgs = s.messages || [];
          const lastMsg = msgs.slice().reverse().find((m: any) => m.role === 'model')?.text || msgs[0]?.text || '';
          globalItems.push({
            id: `liquid-${s.id}`,
            category: 'chats',
            title: s.name || 'Liquid Chat Session',
            subtitle: lastMsg.slice(0, 120) || 'Liquid conversation',
            icon: <Sparkles size={16} className="text-pink-400" />,
            sourceLabel: 'Liquid Chat',
            updatedAt: toTs(s.updatedAt),
            action: () => {
              localStorage.setItem('omnichat_liquid_current_session', s.id);
              onModeChange('liquid-chat');
              setIsOpen(false);
              sounds.playSuccess();
            }
          });
        });
      }
    } catch (e) {}

    // d. Manus Agent
    try {
      const raw = JSON.parse(localStorage.getItem('omnichat_manus_sessions') || '[]');
      if (Array.isArray(raw)) {
        raw.forEach(s => {
          const msgs = s.messages || [];
          const lastMsg = msgs.slice().reverse().find((m: any) => m.role === 'model')?.text || msgs[0]?.text || '';
          globalItems.push({
            id: `manus-${s.id}`,
            category: 'chats',
            title: s.title || 'Manus Task Pipeline',
            subtitle: lastMsg.slice(0, 120) || 'Agent execution flow',
            icon: <Sparkles size={16} className="text-emerald-400" />,
            sourceLabel: 'Manus Agent',
            updatedAt: toTs(s.updatedAt),
            action: () => {
              localStorage.setItem('omnichat_manus_current_session_id', s.id);
              onModeChange('chat-fast');
              setIsOpen(false);
              sounds.playSuccess();
            }
          });
        });
      }
    } catch (e) {}

    // ── 3. Files, Code & Projects ──
    try {
      const rawProjects = JSON.parse(localStorage.getItem('omnichat_coder_projects') || '[]');
      if (Array.isArray(rawProjects)) {
        rawProjects.forEach((p: any) => {
          // Project record
          globalItems.push({
            id: `coder-proj-${p.id}`,
            category: 'files',
            title: `Project: ${p.title || 'AI Coder Workspace'}`,
            subtitle: `${(p.files || []).length} code files • ${(p.commits || []).length} commits`,
            icon: <Code size={16} className="text-teal-400" />,
            sourceLabel: 'Coder IDE Project',
            updatedAt: toTs(p.updatedAt),
            action: () => {
              localStorage.setItem('omnichat_coder_current_project', p.id);
              onModeChange('coder');
              setIsOpen(false);
              sounds.playSuccess();
            }
          });

          // Individual code files inside the project
          if (Array.isArray(p.files)) {
            p.files.forEach((file: any) => {
              globalItems.push({
                id: `coder-file-${p.id}-${file.name}`,
                category: 'files',
                title: file.name,
                subtitle: (file.content || '').slice(0, 140) || 'Code source file',
                icon: <FileCode size={16} className="text-cyan-400" />,
                sourceLabel: `File in ${p.title || 'Project'}`,
                updatedAt: toTs(p.updatedAt),
                action: () => {
                  localStorage.setItem('omnichat_coder_current_project', p.id);
                  onModeChange('coder');
                  setIsOpen(false);
                  sounds.playSuccess();
                }
              });
            });
          }
        });
      }
    } catch (e) {}

    // ── 4. Firebase Firestore Structures (Voice Commands, Voice Sessions, Keep Notes) ──
    const user = auth.currentUser;
    if (user) {
      try {
        // Firebase Voice Commands
        const voiceCmdSnap = await getDocs(collection(db, 'users', user.uid, 'voice_commands'));
        voiceCmdSnap.forEach(docSnap => {
          const data = docSnap.data();
          globalItems.push({
            id: `fb-voicecmd-${docSnap.id}`,
            category: 'voice',
            title: data.title || 'Voice Command Recording',
            subtitle: data.text || 'Cloud synchronized voice interaction',
            icon: <Mic size={16} className="text-rose-400" />,
            sourceLabel: 'Firebase Voice Command',
            updatedAt: toTs(data.updatedAt || data.timestamp),
            action: () => {
              onModeChange('history');
              setIsOpen(false);
              sounds.playSuccess();
            }
          });
        });

        // Firebase Voice Sessions
        const voiceSessSnap = await getDocs(collection(db, 'users', user.uid, 'voice_sessions'));
        voiceSessSnap.forEach(docSnap => {
          const data = docSnap.data();
          globalItems.push({
            id: `fb-voicesess-${docSnap.id}`,
            category: 'voice',
            title: data.title || 'Voice Call Session',
            subtitle: data.transcript || `Voice call • Duration: ${data.duration || '0s'}`,
            icon: <Mic size={16} className="text-emerald-400" />,
            sourceLabel: 'Firebase Voice Session',
            updatedAt: toTs(data.updatedAt),
            action: () => {
              localStorage.setItem('omnichat_voice_current', docSnap.id);
              onModeChange('voice-live');
              setIsOpen(false);
              sounds.playSuccess();
            }
          });
        });

        // Firebase Keep Notes
        const keepSnap = await getDocs(collection(db, 'users', user.uid, 'keep_notes'));
        keepSnap.forEach(docSnap => {
          const data = docSnap.data();
          globalItems.push({
            id: `fb-keep-${docSnap.id}`,
            category: 'workspace',
            title: `Note: ${data.title || 'Untitled Note'}`,
            subtitle: data.content || 'Cloud synchronized workspace note',
            icon: <FileText size={16} className="text-amber-400" />,
            sourceLabel: 'Firebase Keep Note',
            updatedAt: toTs(data.updatedAt || data.createdAt),
            action: () => {
              onModeChange('workspace');
              setIsOpen(false);
              sounds.playSuccess();
            }
          });
        });
      } catch (e) {
        console.warn('Firebase search indexing notice:', e);
      }
    }

    // Local Storage Voice Sessions fallback
    try {
      const rawVS = JSON.parse(localStorage.getItem('omnichat_voice_sessions') || '[]');
      if (Array.isArray(rawVS)) {
        rawVS.forEach(s => {
          globalItems.push({
            id: `local-vs-${s.id}`,
            category: 'voice',
            title: s.title || 'Voice Session',
            subtitle: s.transcript ? s.transcript.slice(0, 120) : `Call duration: ${s.duration || '0s'}`,
            icon: <Mic size={16} className="text-rose-400" />,
            sourceLabel: 'Voice Call',
            updatedAt: toTs(s.updatedAt),
            action: () => {
              localStorage.setItem('omnichat_voice_current', s.id);
              onModeChange('voice-live');
              setIsOpen(false);
              sounds.playSuccess();
            }
          });
        });
      }
    } catch (e) {}

    // Transcriptions & TTS
    try {
      const rawTr = JSON.parse(localStorage.getItem('omnichat_transcription_sessions') || '[]');
      if (Array.isArray(rawTr)) {
        rawTr.forEach(s => {
          globalItems.push({
            id: `tr-${s.id}`,
            category: 'files',
            title: s.title || 'Audio Transcription File',
            subtitle: (s.text || '').slice(0, 120) || 'Extracted audio speech text',
            icon: <FileAudio size={16} className="text-sky-400" />,
            sourceLabel: 'Transcription',
            updatedAt: toTs(s.updatedAt),
            action: () => {
              localStorage.setItem('omnichat_transcription_current', s.id);
              onModeChange('transcription');
              setIsOpen(false);
              sounds.playSuccess();
            }
          });
        });
      }
    } catch (e) {}

    // Workspace Logs
    try {
      const logs = await getWorkspaceLogs();
      logs.slice(0, 15).forEach(wLog => {
        globalItems.push({
          id: `wslog-${wLog.id}`,
          category: 'workspace',
          title: `Workspace Activity: ${wLog.service}`,
          subtitle: `${wLog.action} • ${wLog.details}`,
          icon: <Database size={16} className="text-cyan-400" />,
          sourceLabel: 'Workspace Audit',
          updatedAt: toTs(wLog.timestamp),
          action: () => {
            onModeChange('workspace');
            setIsOpen(false);
            sounds.playSuccess();
          }
        });
      });
    } catch (e) {}

    // Sort by timestamp if available
    globalItems.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    setItems(globalItems);
    setIsLoadingFirebase(false);
  };

  const filteredItems = items.filter(item => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || 
      item.title.toLowerCase().includes(q) || 
      item.subtitle.toLowerCase().includes(q) ||
      item.sourceLabel.toLowerCase().includes(q);
    const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  useEffect(() => {
    setSelectedIndex(0);
  }, [search, activeCategory]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % Math.max(1, filteredItems.length));
      sounds.playClick();
      triggerHaptic('light');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
      sounds.playClick();
      triggerHaptic('light');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action();
      }
    }
  };

  useEffect(() => {
    const activeEl = scrollContainerRef.current?.querySelector('[data-active="true"]');
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] md:pt-[12vh] px-3 md:px-0">
          {/* Backdrop Blur Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 bg-black/75 backdrop-blur-md"
          />

          {/* Main Global Search Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -15 }}
            transition={{ type: 'spring', damping: 26, stiffness: 360 }}
            className="relative w-full max-w-2xl bg-[#0b0c14] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[600px] max-h-[82vh] backdrop-blur-2xl text-white"
            onKeyDown={handleKeyDown}
          >
            {/* Top Search Bar Header */}
            <div className="p-4 border-b border-white/10 flex items-center gap-3 bg-slate-900/60">
              <Search className="text-cyan-400 shrink-0" size={20} />
              <input
                ref={inputRef}
                type="text"
                placeholder="Global Search across Chat History, Files & Firebase Data..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="flex-1 bg-transparent border-none text-white text-sm md:text-base placeholder-white/35 outline-none font-medium w-full"
              />
              <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 text-[11px] font-mono text-white/50 border border-white/10 shrink-0">
                <span>ESC to exit</span>
              </div>
            </div>

            {/* Category Filter Chips */}
            <div className="px-4 py-2.5 flex gap-1.5 border-b border-white/5 bg-slate-950/40 overflow-x-auto whitespace-nowrap scrollbar-none shrink-0">
              {[
                { id: 'all', label: '🌟 All Data' },
                { id: 'chats', label: '💬 Chat History' },
                { id: 'files', label: '📁 Files & Code' },
                { id: 'voice', label: '🎙️ Voice & Audio' },
                { id: 'workspace', label: '📋 Notes & Logs' },
                { id: 'modes', label: '⚡ App Modes' }
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setActiveCategory(cat.id as any);
                    sounds.playClick();
                  }}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-all cursor-pointer font-medium border ${
                    activeCategory === cat.id
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-semibold shadow-sm'
                      : 'bg-white/5 hover:bg-white/10 text-white/60 border-transparent'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Results List Container */}
            <div 
              ref={scrollContainerRef}
              className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-white/5 scrollbar-thin scroll-smooth"
            >
              {filteredItems.length === 0 ? (
                <div className="text-center py-16 text-white/40 flex flex-col items-center justify-center gap-3">
                  <HelpCircle size={32} className="text-white/20 animate-bounce" />
                  <span className="text-xs font-mono">No results matched "{search}".</span>
                </div>
              ) : (
                filteredItems.map((item, index) => {
                  const isSelected = index === selectedIndex;
                  return (
                    <div
                      key={item.id}
                      data-active={isSelected ? "true" : "false"}
                      onClick={() => item.action()}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`w-full flex items-start gap-3.5 p-3 rounded-xl transition-all duration-150 cursor-pointer ${
                        isSelected 
                          ? 'bg-gradient-to-r from-cyan-500/15 via-violet-500/10 to-transparent border border-cyan-500/30 shadow-md' 
                          : 'border border-transparent hover:bg-white/5'
                      }`}
                    >
                      <div className={`p-2.5 rounded-xl shrink-0 ${
                        isSelected ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-white/5 text-white/60'
                      } transition-colors`}>
                        {item.icon}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-xs md:text-sm font-semibold truncate ${isSelected ? 'text-white' : 'text-white/90'}`}>
                            {item.title}
                          </span>
                          <span className="text-[10px] font-mono text-cyan-300/80 px-2 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-500/20 shrink-0">
                            {item.sourceLabel}
                          </span>
                        </div>
                        <p className="text-[11px] text-white/50 mt-1 leading-relaxed line-clamp-1">
                          {item.subtitle}
                        </p>
                      </div>

                      {isSelected && (
                        <div className="self-center flex items-center justify-center shrink-0 text-cyan-400 animate-pulse pl-1">
                          <ChevronsRight size={16} />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Keyboard Shortcuts Strip */}
            <div className="p-3 border-t border-white/10 bg-black/60 flex items-center justify-between text-[11px] text-white/50 font-mono shrink-0">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="px-1.5 py-0.5 rounded bg-white/10 border border-white/15 font-bold">↑↓</span> Navigate
                </span>
                <span className="flex items-center gap-1">
                  <span className="px-1.5 py-0.5 rounded bg-white/10 border border-white/15 font-bold">↵</span> Select
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span>Indexed items: <strong className="text-cyan-400">{filteredItems.length}</strong></span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
