import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  History, Search, Trash2, MessageSquare, Clock, Bot,
  Zap, Sparkles, X, ChevronRight, Calendar, Filter,
  AlertTriangle, Cpu, Code, Mic, MapPin, FileAudio, Volume2, 
  Image as ImageIcon, TerminalSquare, AlertCircle, Play, Check, ExternalLink, RefreshCw,
  Cloud, Pause, Download, Share2, Edit2, ShieldAlert, FileText, Activity, Radio, Layers, Info, Copy
} from 'lucide-react';
import { appLogger } from '../utils/logger';
import { motion, AnimatePresence } from 'motion/react';
import { playTextToSpeech, stopCurrentReadAloud } from '../utils/readAloud';
import { sounds, triggerHaptic } from '../components/PremiumEffects';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, syncVoiceCommands, deleteVoiceCommandFromCloud, clearVoiceCommandsFromCloud } from '../lib/firebase';

/* ─── Types ────────────────────────────────────────────── */
interface AnyMessage {
  id?: string;
  role: string;
  text?: string;
  content?: string;
}

interface SearchItem {
  id: string;
  title: string;
  source: 'chat-pro' | 'chat-fast' | 'omni-chat' | 'jarvis' | 'coder' | 'liquid-chat' | 'voice-live' | 'transcription' | 'tts' | 'search-maps' | 'image-gen' | 'logs' | 'voice-command';
  updatedAt: number;
  preview: string;
  messages: AnyMessage[];
  statusBadge?: string; // level for logs, status for voice
  duration?: string; // voice
  text?: string; // transcription raw text
  files?: Array<{ name: string; content: string }>; // coder
  durationSecs?: number;
  audioPath?: string;
  transcript?: string;
  model?: string;
  hasRecording?: boolean;
  audioMimeType?: string;
  // Metadata for wake-word & voice commands
  activeModeContext?: string;
  targetMode?: string;
  sensitivity?: number | string;
  context?: Record<string, any>;
  triggerSource?: string;
}

const SOURCE_META = {
  'omni-chat':     { label: 'Omni Chat',        icon: Bot,            color: 'text-violet-400',  bg: 'bg-violet-500/15 border-violet-500/25',  dot: 'bg-violet-400',  badge: 'text-violet-300 bg-violet-500/20', mode: 'omni-chat' },
  'chat-pro':      { label: 'Pro Chat',          icon: MessageSquare,  color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/25', dot: 'bg-emerald-400', badge: 'text-emerald-300 bg-emerald-500/20', mode: 'chat-pro' },
  'chat-fast':     { label: 'Fast Chat',         icon: Zap,            color: 'text-amber-400',   bg: 'bg-amber-500/15 border-amber-500/25',    dot: 'bg-amber-400',   badge: 'text-amber-300 bg-amber-500/20', mode: 'chat-fast' },
  'liquid-chat':   { label: 'Liquid Chat',       icon: Sparkles,       color: 'text-pink-400',    bg: 'bg-pink-500/15 border-pink-500/25',      dot: 'bg-pink-400',    badge: 'text-pink-300 bg-pink-500/20', mode: 'liquid-chat' },
  'jarvis':        { label: 'J.A.R.V.I.S.',      icon: Cpu,            color: 'text-cyan-400',    bg: 'bg-cyan-500/15 border-cyan-500/25',      dot: 'bg-cyan-400',    badge: 'text-cyan-300 bg-cyan-500/20', mode: 'jarvis' },
  'coder':         { label: 'AI Coder IDE',      icon: Code,           color: 'text-teal-400',    bg: 'bg-teal-500/15 border-teal-500/25',      dot: 'bg-teal-400',    badge: 'text-teal-300 bg-teal-500/20', mode: 'coder' },
  'voice-live':    { label: 'Voice AI',          icon: Mic,            color: 'text-rose-400',    bg: 'bg-rose-500/15 border-rose-500/25',      dot: 'bg-rose-400',    badge: 'text-rose-300 bg-rose-500/20', mode: 'voice-live' },
  'search-maps':   { label: 'Search & Maps',     icon: MapPin,         color: 'text-orange-400',  bg: 'bg-orange-500/15 border-orange-500/25',  dot: 'bg-orange-400',  badge: 'text-orange-300 bg-orange-500/20', mode: 'search-maps' },
  'transcription': { label: 'Transcription',     icon: FileAudio,      color: 'text-sky-400',     bg: 'bg-sky-500/15 border-sky-500/25',      dot: 'bg-sky-400',     badge: 'text-sky-300 bg-sky-500/20', mode: 'transcription' },
  'tts':           { label: 'Text to Speech',    icon: Volume2,        color: 'text-indigo-400',  bg: 'bg-indigo-500/15 border-indigo-500/25',  dot: 'bg-indigo-400',  badge: 'text-indigo-300 bg-indigo-500/20', mode: 'tts' },
  'image-gen':     { label: 'Image Gen',         icon: ImageIcon,      color: 'text-rose-400',    bg: 'bg-rose-500/15 border-rose-500/25',      dot: 'bg-rose-400',    badge: 'text-rose-300 bg-rose-500/20', mode: 'image-gen' },
  'logs':          { label: 'System Logs',       icon: TerminalSquare, color: 'text-slate-400',   bg: 'bg-slate-500/15 border-slate-500/25',    dot: 'bg-slate-400',   badge: 'text-slate-300 bg-slate-500/20', mode: 'logs' },
  'voice-command': { label: 'Voice Command',     icon: Mic,            color: 'text-sky-400',     bg: 'bg-sky-500/15 border-sky-500/25',      dot: 'bg-sky-400',     badge: 'text-sky-300 bg-sky-500/20', mode: 'voice-live' },
} as const;

/* ─── Helpers ───────────────────────────────────────────── */
function toTimestamp(v: number | string | Date | undefined): number {
  if (!v) return Date.now();
  if (typeof v === 'number') return v;
  return new Date(v).getTime();
}

function loadAllIndexedItems(): SearchItem[] {
  const items: SearchItem[] = [];

  // 1. Chat Pro
  try {
    const raw = JSON.parse(localStorage.getItem('omnichat_conversations_chat-pro') || '[]');
    if (Array.isArray(raw)) {
      raw.forEach(c => {
        const msgs = c.messages || [];
        const preview = msgs.slice().reverse().find(m => m.role === 'model')?.text || '';
        items.push({
          id: c.id,
          title: c.title || 'Untitled Pro Chat',
          source: 'chat-pro',
          updatedAt: toTimestamp(c.updatedAt),
          preview: preview.slice(0, 150) || 'No messages yet',
          messages: msgs
        });
      });
    }
  } catch {}

  // 2. Chat Fast
  try {
    const raw = JSON.parse(localStorage.getItem('omnichat_conversations_chat-fast') || '[]');
    if (Array.isArray(raw)) {
      raw.forEach(c => {
        const msgs = c.messages || [];
        const preview = msgs.slice().reverse().find(m => m.role === 'model')?.text || '';
        items.push({
          id: c.id,
          title: c.title || 'Untitled Fast Chat',
          source: 'chat-fast',
          updatedAt: toTimestamp(c.updatedAt),
          preview: preview.slice(0, 150) || 'No messages yet',
          messages: msgs
        });
      });
    }
  } catch {}

  // 3. Omni Chat
  try {
    const raw = JSON.parse(localStorage.getItem('omnichat_conversations_v2') || '[]');
    if (Array.isArray(raw)) {
      raw.forEach(c => {
        const msgs = c.messages || [];
        const preview = msgs.slice().reverse().find(m => m.role === 'model')?.text || '';
        items.push({
          id: c.id,
          title: c.title || 'Untitled Omni Chat',
          source: 'omni-chat',
          updatedAt: toTimestamp(c.updatedAt),
          preview: preview.slice(0, 150) || 'No messages yet',
          messages: msgs
        });
      });
    }
  } catch {}

  // 4. Liquid Chat
  try {
    const raw = JSON.parse(localStorage.getItem('omnichat_liquid_sessions') || '[]');
    if (Array.isArray(raw)) {
      raw.forEach(s => {
        const msgs = s.messages || [];
        const preview = msgs.slice().reverse().find(m => m.role === 'model')?.text || '';
        items.push({
          id: s.id,
          title: s.name || 'Untitled Liquid Chat',
          source: 'liquid-chat',
          updatedAt: toTimestamp(s.updatedAt || Date.now()),
          preview: preview.slice(0, 150) || 'No messages yet',
          messages: msgs.map((m: any) => ({ role: m.role, text: m.text }))
        });
      });
    }
  } catch {}

  // 5. J.A.R.V.I.S. HUD
  try {
    const raw = JSON.parse(localStorage.getItem('omnichat_jarvis_messages') || '[]');
    if (Array.isArray(raw) && raw.length > 0) {
      const userCount = raw.filter(m => m.role === 'user').length;
      items.push({
        id: 'jarvis-global-session',
        title: 'J.A.R.V.I.S. Command Stream',
        source: 'jarvis',
        updatedAt: Date.now(),
        preview: `Active command session with ${userCount} queries.`,
        messages: raw.map(m => ({ role: m.role, text: m.text }))
      });
    }
  } catch {}

  // 6. AI Coder Projects
  try {
    const raw = JSON.parse(localStorage.getItem('omnichat_coder_projects') || '[]');
    if (Array.isArray(raw)) {
      raw.forEach(p => {
        const msgs = p.messages || [];
        const preview = msgs.slice().reverse().find(m => m.role === 'model')?.text || '';
        items.push({
          id: p.id,
          title: p.title || 'Untitled Coder Project',
          source: 'coder',
          updatedAt: toTimestamp(p.updatedAt),
          preview: preview.slice(0, 150) || 'No messages yet',
          messages: msgs,
          files: p.files || []
        });
      });
    }
  } catch {}

  // 7. Voice AI Calls
  try {
    const raw = JSON.parse(localStorage.getItem('omnichat_voice_sessions') || '[]');
    if (Array.isArray(raw)) {
      raw.forEach(s => {
        items.push({
          id: s.id,
          title: s.title || 'Voice call',
          source: 'voice-live',
          updatedAt: toTimestamp(s.updatedAt),
          preview: s.transcript ? s.transcript.slice(0, 150) : `Voice session - status: ${s.status || 'Completed'} - duration: ${s.duration || '0:00'}`,
          statusBadge: s.status,
          duration: s.duration,
          durationSecs: s.durationSecs,
          audioPath: s.audioPath,
          transcript: s.transcript,
          model: s.model,
          hasRecording: s.hasRecording,
          audioMimeType: s.audioMimeType,
          messages: []
        });
      });
    }
  } catch {}

  // 8. Search & Maps groundings
  try {
    const raw = JSON.parse(localStorage.getItem('omnichat_searchmaps_conversations') || '[]');
    if (Array.isArray(raw)) {
      raw.forEach(c => {
        const msgs = c.messages || [];
        const preview = msgs.slice().reverse().find(m => m.role === 'model')?.text || '';
        items.push({
          id: c.id,
          title: c.title || 'Search & Maps Session',
          source: 'search-maps',
          updatedAt: toTimestamp(c.updatedAt),
          preview: preview.slice(0, 150) || 'No messages yet',
          messages: msgs
        });
      });
    }
  } catch {}

  // 9. Audio Transcription
  try {
    const raw = JSON.parse(localStorage.getItem('omnichat_transcription_sessions') || '[]');
    if (Array.isArray(raw)) {
      raw.forEach(s => {
        items.push({
          id: s.id,
          title: s.title || 'Audio Transcription',
          source: 'transcription',
          updatedAt: toTimestamp(s.updatedAt),
          preview: (s.text || '').slice(0, 150) || 'Empty transcription text',
          text: s.text,
          messages: [{ role: 'model', text: s.text }]
        });
      });
    }
  } catch {}

  // 10. Text to Speech
  try {
    const raw = JSON.parse(localStorage.getItem('omnichat_tts_sessions') || '[]');
    if (Array.isArray(raw)) {
      raw.forEach(s => {
        items.push({
          id: s.id,
          title: s.title || 'Speech Synthesis',
          source: 'tts',
          updatedAt: toTimestamp(s.updatedAt),
          preview: `Voice: ${s.voice || 'Puck'} - "${(s.text || '').slice(0, 100)}"`,
          text: s.text,
          messages: [{ role: 'user', text: s.text }]
        });
      });
    }
  } catch {}

  // 11. Image Generation Artworks
  try {
    const raw = JSON.parse(localStorage.getItem('omnichat_image_sessions') || '[]');
    if (Array.isArray(raw)) {
      raw.forEach(s => {
        const itemsList = s.items || [];
        const previewText = itemsList.length > 0 
          ? `Prompt: "${itemsList[0].prompt}" (${itemsList[0].style || 'cinematic'})`
          : 'Empty Artwork Session';
        items.push({
          id: s.id,
          title: s.title || 'Artwork Creation',
          source: 'image-gen',
          updatedAt: toTimestamp(s.updatedAt),
          preview: previewText,
          messages: itemsList.map((item: any) => ({
            role: 'model',
            text: `Style: ${item.style} | Prompt: ${item.prompt} | URL: ${item.url}`
          }))
        });
      });
    }
  } catch {}

  // 12. Application logs
  try {
    const logs = appLogger.getLogs();
    logs.forEach(log => {
      items.push({
        id: log.id,
        title: `Log: [${log.level.toUpperCase()}]`,
        source: 'logs',
        updatedAt: toTimestamp(log.timestamp),
        preview: log.message,
        statusBadge: log.level,
        messages: [{ role: 'model', text: log.message }]
      });
    });
  } catch {}

  // 13. Voice Commands & Wake-word Triggers
  try {
    const raw = JSON.parse(localStorage.getItem('omnichat_voice_commands') || '[]');
    if (Array.isArray(raw)) {
      raw.forEach(s => {
        const isWakeWord = s.source === 'wake-word' || s.id?.startsWith('vc-ww') || s.title?.toLowerCase().includes('wake-word');
        const activeCtx = s.activeModeContext || s.context?.activeMode || s.currentMode || 'Global';
        const tgtMode = s.targetMode || s.context?.targetMode || 'jarvis';
        const sens = s.sensitivity || s.context?.sensitivity;

        items.push({
          id: s.id,
          title: s.title || (isWakeWord ? 'Wake-word Triggered' : 'Voice Command'),
          source: 'voice-command',
          updatedAt: toTimestamp(s.updatedAt || s.timestamp),
          preview: s.text || 'No transcription text',
          text: s.text,
          messages: s.messages || [{ role: 'user', text: s.text }],
          activeModeContext: activeCtx,
          targetMode: tgtMode,
          sensitivity: sens,
          context: s.context || {
            activeMode: activeCtx,
            targetMode: tgtMode,
            sensitivity: sens || 'Default (75%)',
            listener: isWakeWord ? 'Web Speech API Wake-word Listener' : 'Voice Assistant Engine',
            triggeredAt: new Date(toTimestamp(s.updatedAt || s.timestamp)).toISOString()
          },
          triggerSource: s.source || (isWakeWord ? 'wake-word' : 'voice-live')
        });
      });
    }
  } catch {}

  return items.sort((a, b) => b.updatedAt - a.updatedAt);
}

function deleteItemFromSource(item: SearchItem) {
  const { source, id } = item;
  try {
    if (source === 'chat-pro') {
      const raw = JSON.parse(localStorage.getItem('omnichat_conversations_chat-pro') || '[]');
      localStorage.setItem('omnichat_conversations_chat-pro', JSON.stringify(raw.filter((c: any) => c.id !== id)));
    } else if (source === 'chat-fast') {
      const raw = JSON.parse(localStorage.getItem('omnichat_conversations_chat-fast') || '[]');
      localStorage.setItem('omnichat_conversations_chat-fast', JSON.stringify(raw.filter((c: any) => c.id !== id)));
    } else if (source === 'omni-chat') {
      const raw = JSON.parse(localStorage.getItem('omnichat_conversations_v2') || '[]');
      localStorage.setItem('omnichat_conversations_v2', JSON.stringify(raw.filter((c: any) => c.id !== id)));
    } else if (source === 'liquid-chat') {
      const raw = JSON.parse(localStorage.getItem('omnichat_liquid_sessions') || '[]');
      localStorage.setItem('omnichat_liquid_sessions', JSON.stringify(raw.filter((s: any) => s.id !== id)));
    } else if (source === 'jarvis') {
      localStorage.removeItem('omnichat_jarvis_messages');
    } else if (source === 'coder') {
      const raw = JSON.parse(localStorage.getItem('omnichat_coder_projects') || '[]');
      localStorage.setItem('omnichat_coder_projects', JSON.stringify(raw.filter((p: any) => p.id !== id)));
    } else if (source === 'voice-live') {
      const raw = JSON.parse(localStorage.getItem('omnichat_voice_sessions') || '[]');
      localStorage.setItem('omnichat_voice_sessions', JSON.stringify(raw.filter((s: any) => s.id !== id)));
    } else if (source === 'search-maps') {
      const raw = JSON.parse(localStorage.getItem('omnichat_searchmaps_conversations') || '[]');
      localStorage.setItem('omnichat_searchmaps_conversations', JSON.stringify(raw.filter((c: any) => c.id !== id)));
    } else if (source === 'transcription') {
      const raw = JSON.parse(localStorage.getItem('omnichat_transcription_sessions') || '[]');
      localStorage.setItem('omnichat_transcription_sessions', JSON.stringify(raw.filter((s: any) => s.id !== id)));
    } else if (source === 'tts') {
      const raw = JSON.parse(localStorage.getItem('omnichat_tts_sessions') || '[]');
      localStorage.setItem('omnichat_tts_sessions', JSON.stringify(raw.filter((s: any) => s.id !== id)));
    } else if (source === 'image-gen') {
      const raw = JSON.parse(localStorage.getItem('omnichat_image_sessions') || '[]');
      localStorage.setItem('omnichat_image_sessions', JSON.stringify(raw.filter((s: any) => s.id !== id)));
    } else if (source === 'voice-command') {
      const raw = JSON.parse(localStorage.getItem('omnichat_voice_commands') || '[]');
      localStorage.setItem('omnichat_voice_commands', JSON.stringify(raw.filter((s: any) => s.id !== id)));
    } else if (source === 'logs') {
      appLogger.clearLogs();
    }
  } catch (e) {
    console.error('Failed to delete item:', e);
  }
}

function getMatchingSnippet(item: SearchItem, query: string): { snippet: string; startIdx: number; endIdx: number } | null {
  if (!query) return null;
  const q = query.toLowerCase();

  // 1. Search in title
  if (item.title.toLowerCase().includes(q)) {
    const idx = item.title.toLowerCase().indexOf(q);
    return {
      snippet: item.title,
      startIdx: idx,
      endIdx: idx + q.length
    };
  }

  // 2. Search in preview
  if (item.preview.toLowerCase().includes(q)) {
    const idx = item.preview.toLowerCase().indexOf(q);
    const start = Math.max(0, idx - 40);
    const end = Math.min(item.preview.length, idx + q.length + 60);
    const text = (start > 0 ? '...' : '') + item.preview.substring(start, end) + (end < item.preview.length ? '...' : '');
    const cleanIdx = text.toLowerCase().indexOf(q);
    return {
      snippet: text,
      startIdx: cleanIdx,
      endIdx: cleanIdx + q.length
    };
  }

  // 3. Search in messages list
  for (const msg of item.messages) {
    const text = msg.text || msg.content || '';
    if (text.toLowerCase().includes(q)) {
      const idx = text.toLowerCase().indexOf(q);
      const start = Math.max(0, idx - 40);
      const end = Math.min(text.length, idx + q.length + 60);
      const fullText = `${msg.role === 'user' ? 'User' : 'AI'}: ` + (start > 0 ? '...' : '') + text.substring(start, end) + (end < text.length ? '...' : '');
      const cleanIdx = fullText.toLowerCase().indexOf(q);
      return {
        snippet: fullText,
        startIdx: cleanIdx,
        endIdx: cleanIdx + q.length
      };
    }
  }

  // 4. Search in files (for coder)
  if (item.files) {
    for (const file of item.files) {
      if (file.name.toLowerCase().includes(q)) {
        return {
          snippet: `File: ${file.name}`,
          startIdx: 6,
          endIdx: 6 + q.length
        };
      }
      if (file.content.toLowerCase().includes(q)) {
        const idx = file.content.toLowerCase().indexOf(q);
        const start = Math.max(0, idx - 40);
        const end = Math.min(file.content.length, idx + q.length + 60);
        const fullText = `File [${file.name}]: ` + (start > 0 ? '...' : '') + file.content.substring(start, end) + (end < file.content.length ? '...' : '');
        const cleanIdx = fullText.toLowerCase().indexOf(q);
        return {
          snippet: fullText,
          startIdx: cleanIdx,
          endIdx: cleanIdx + q.length
        };
      }
    }
  }

  return null;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatFullDateTime(ts: number): string {
  return new Date(ts).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 7) return `${d}d ago`;
  return formatDate(ts);
}

/* ─── Highlights rendering component ─── */
const HighlightedText: React.FC<{ text: string; start: number; end: number }> = ({ text, start, end }) => {
  if (start < 0 || end < 0 || start >= text.length) {
    return <span className="text-white/60">{text}</span>;
  }
  const before = text.substring(0, start);
  const match = text.substring(start, end);
  const after = text.substring(end);
  return (
    <span className="text-white/60">
      {before}
      <mark className="bg-amber-500/30 text-amber-200 border-b border-amber-400 px-0.5 rounded font-semibold">{match}</mark>
      {after}
    </span>
  );
};

/* ─── Voice Recording Player Sub-component ────────────────── */
interface VoiceRecordingPlayerProps {
  sessionId: string;
  sessionTitle: string;
  hasRecording: boolean;
  mimeType?: string;
  transcript?: string;
  modelName?: string;
  duration?: string;
  onRename: (newTitle: string) => void;
}

const VoiceRecordingPlayer: React.FC<VoiceRecordingPlayerProps> = ({
  sessionId,
  sessionTitle,
  hasRecording,
  mimeType = 'audio/webm',
  transcript,
  modelName = 'Gemini 3.1 Flash Live',
  duration,
  onRename
}) => {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [copying, setCopying] = useState(false);
  const [showTranscript, setShowTranscript] = useState(true);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load and decrypt recording on mount
  useEffect(() => {
    if (!hasRecording) return;
    
    let active = true;
    const fetchAndDecrypt = async () => {
      setLoading(true);
      setError(null);
      try {
        const { getRecordingFromIDB, decryptAudioBlob } = await import('../utils/audioDB');
        const record = await getRecordingFromIDB(sessionId);
        if (!record) {
          throw new Error('Encrypted audio recording file not found in local index storage.');
        }

        const decryptedBlob = await decryptAudioBlob(record.encryptedBuffer, record.iv, mimeType);
        if (active) {
          const url = URL.createObjectURL(decryptedBlob);
          setAudioUrl(url);
        }
      } catch (err: any) {
        console.error('Failed to decrypt audio session:', err);
        if (active) {
          setError(err.message || 'Decryption failed.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchAndDecrypt();

    return () => {
      active = false;
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [sessionId, hasRecording, mimeType]);

  // Handle Playback toggles
  const handlePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(e => {
        console.error('Audio playback failed:', e);
        setError('Playback failed. Check permissions.');
      });
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    setTotalDuration(audioRef.current.duration || 0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const val = parseFloat(e.target.value);
    audioRef.current.currentTime = val;
    setCurrentTime(val);
  };

  const formatSecs = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleRenameClick = () => {
    const newTitle = window.prompt('Enter new custom title for this voice session:', sessionTitle);
    if (newTitle && newTitle.trim()) {
      onRename(newTitle.trim());
    }
  };

  const handleDownload = async () => {
    if (!hasRecording) return;
    try {
      const { getRecordingFromIDB, decryptAudioBlob } = await import('../utils/audioDB');
      const record = await getRecordingFromIDB(sessionId);
      if (!record) return alert('Recording not found');

      const decryptedBlob = await decryptAudioBlob(record.encryptedBuffer, record.iv, mimeType);
      const url = URL.createObjectURL(decryptedBlob);
      const a = document.createElement('a');
      a.href = url;
      const fileExt = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp3') ? 'mp3' : 'm4a';
      a.download = `${sessionTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}_session.${fileExt}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to download decrypted audio file.');
    }
  };

  const handleShare = () => {
    setCopying(true);
    const shareText = `🎙️ Voice Session Call with OmniChat\n📅 Session: ${sessionTitle}\n🤖 AI Model: ${modelName}\n⏱️ Duration: ${duration || 'Completed'}\n\n📝 Transcript Summary:\n${transcript || 'No transcript available.'}`;
    navigator.clipboard.writeText(shareText);
    setTimeout(() => setCopying(false), 2000);
  };

  return (
    <div className="space-y-4 p-4 rounded-2xl bg-white/3 border border-white/5 shadow-md">
      {/* Recording Player Area */}
      {hasRecording ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest flex items-center gap-1.5">
              <Activity size={12} className={isPlaying ? "animate-pulse text-emerald-400" : ""} />
              {loading ? "Decrypting Call Audio..." : "Secure Cryptographic Recording"}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleRenameClick}
                className="p-1.5 rounded-lg hover:bg-white/5 text-white/50 hover:text-white transition-all"
                title="Rename Call Session"
              >
                <Edit2 size={13} />
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="p-1.5 rounded-lg hover:bg-white/5 text-white/50 hover:text-white transition-all"
                title="Decrypt & Download Call Audio (.m4a/.webm)"
              >
                <Download size={13} />
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="p-1.5 rounded-lg hover:bg-white/5 text-white/50 hover:text-white transition-all relative"
                title="Share Transcript and Session Info"
              >
                {copying ? (
                  <span className="text-[9px] text-emerald-400 font-bold uppercase absolute right-0 -top-5 bg-emerald-500/10 border border-emerald-500/20 px-1 py-0.2 rounded whitespace-nowrap">Copied!</span>
                ) : null}
                <Share2 size={13} />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="py-4 flex flex-col items-center justify-center text-xs text-white/40 gap-2">
              <RefreshCw size={20} className="animate-spin text-violet-500 animate-pulse" />
              <span>Decrypting AES-256 secure binary buffer...</span>
            </div>
          ) : error ? (
            <div className="py-3 px-4 rounded-xl bg-red-500/10 border border-red-500/20 text-[11px] text-red-400 flex items-start gap-2">
              <ShieldAlert size={14} className="shrink-0 mt-0.5" />
              <span>Error loading encrypted record: {error}</span>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Hidden HTML Audio Element */}
              {audioUrl && (
                <audio
                  ref={audioRef}
                  src={audioUrl}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onEnded={() => setIsPlaying(false)}
                />
              )}

              {/* Progress Seek Bar with Waveform decoration */}
              <div className="space-y-1">
                {/* Custom waveform aesthetic bars */}
                <div className="h-8 flex items-end justify-between px-2 gap-0.5 pointer-events-none opacity-80">
                  {Array.from({ length: 40 }).map((_, i) => {
                    const progress = totalDuration ? currentTime / totalDuration : 0;
                    const barIndex = i / 40;
                    const isActive = barIndex <= progress;
                    
                    const height = 15 + Math.sin(i * 0.4) * 10 + Math.cos(i * 0.8) * 5;
                    return (
                      <div
                        key={i}
                        className={`w-1 rounded-full transition-all duration-300 ${
                          isPlaying && isActive
                            ? 'bg-gradient-to-t from-violet-600 to-indigo-400'
                            : isActive
                            ? 'bg-violet-500/60'
                            : 'bg-white/10'
                        }`}
                        style={{ height: `${Math.max(4, height)}px` }}
                      />
                    );
                  })}
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-mono text-white/45 w-10 text-right">
                    {formatSecs(currentTime)}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={totalDuration || 100}
                    value={currentTime}
                    onChange={handleSeek}
                    className="flex-1 accent-violet-500 bg-white/10 h-1 rounded-lg outline-none cursor-pointer"
                  />
                  <span className="text-[10px] font-mono text-white/45 w-10 text-left">
                    {formatSecs(totalDuration || 0)}
                  </span>
                </div>
              </div>

              {/* Player controls */}
              <div className="flex items-center justify-center gap-4 pt-1">
                <button
                  type="button"
                  onClick={handlePlayPause}
                  className="w-10 h-10 rounded-full bg-violet-600 hover:bg-violet-500 text-white flex items-center justify-center transition-all shadow-md shadow-violet-600/20 active:scale-95"
                >
                  {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-3.5 rounded-xl border border-dashed border-white/10 text-xs text-white/40 flex items-center justify-center gap-2">
          <ShieldAlert size={15} />
          <span>No call audio recording enabled for this session.</span>
        </div>
      )}

      {/* Transcript Collapsible Panel */}
      <div className="border-t border-white/5 pt-3.5 space-y-2">
        <button
          type="button"
          onClick={() => setShowTranscript(!showTranscript)}
          className="flex items-center justify-between w-full text-[10px] font-bold text-white/40 hover:text-white uppercase tracking-wider"
        >
          <span className="flex items-center gap-1.5">
            <FileText size={12} /> Conversation Transcript Summary
          </span>
          <span className="text-xs">{showTranscript ? "Hide" : "Show"}</span>
        </button>

        {showTranscript && (
          <div className="rounded-xl p-3 bg-black/40 border border-white/5 text-[11px] leading-relaxed text-white/70 max-h-48 overflow-y-auto whitespace-pre-wrap font-sans scrollbar-thin text-left">
            {transcript || "No transcript text captured."}
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── Conversation Detail Panel ─────────────────────────── */
function ConversationDetail({
  item, onClose, onDelete, onJump, onRename
}: {
  item: SearchItem;
  onClose: () => void;
  onDelete: () => void;
  onJump: () => void;
  onRename?: (newTitle: string) => void;
}) {
  const meta = SOURCE_META[item.source];
  const Icon = meta.icon;

  return (
    <div className="flex flex-col h-full bg-[#0d0d16] border-l border-white/5 shadow-2xl relative">
      {/* Header */}
      <div className="flex items-start justify-between p-5 border-b border-white/5 bg-black/10">
        <div className="flex-1 min-w-0 pr-3">
          <div className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-0.5 rounded-full border mb-2.5 ${meta.badge} border-current/10`}>
            <Icon size={11} />
            {meta.label}
          </div>
          <h2 className="text-sm font-bold text-white/90 leading-snug">{item.title}</h2>
          <div className="flex items-center gap-3 mt-2 text-[11px] text-white/40">
            <span className="flex items-center gap-1"><Clock size={11}/> {timeAgo(item.updatedAt)}</span>
            {item.messages.length > 0 && (
              <span>· {item.messages.length} interaction lines</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onJump}
            className="p-1.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all"
            title={`Open in ${meta.label}`}
          >
            <ExternalLink size={14} />
          </button>
          <button 
            onClick={onDelete}
            className="p-1.5 rounded-xl hover:bg-red-500/15 hover:text-red-400 text-white/30 transition-all border border-transparent" 
            title="Delete from records"
          >
            <Trash2 size={14}/>
          </button>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/5 text-white/40 hover:text-white transition-all border border-transparent"
          >
            <X size={14}/>
          </button>
        </div>
      </div>

      {/* Detail Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {/* Render files for Coder */}
        {item.source === 'coder' && item.files && item.files.length > 0 && (
          <div className="space-y-2">
            <div className="text-[10px] uppercase font-bold text-white/30 tracking-wider">Project Files:</div>
            <div className="grid grid-cols-2 gap-2">
              {item.files.map((file, fIdx) => (
                <div key={fIdx} className="p-2.5 rounded-xl bg-white/3 border border-white/5 text-xs font-mono text-teal-300 flex items-center gap-2">
                  <Code size={12} />
                  <span className="truncate">{file.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Render image preview if it is Image Gen */}
        {item.source === 'image-gen' && item.messages.length > 0 && (
          <div className="space-y-3">
            <div className="text-[10px] uppercase font-bold text-white/30 tracking-wider">Generated Artwork:</div>
            <div className="grid grid-cols-1 gap-2.5">
              {item.messages.map((m, mIdx) => {
                // Parse prompt and url
                const styleMatch = m.text?.match(/Style:\s*([^\s|]+)/);
                const promptMatch = m.text?.match(/Prompt:\s*([^\s|]+[^|]*)/);
                const urlMatch = m.text?.match(/URL:\s*(data:image[^\s]+)/);
                
                const styleStr = styleMatch ? styleMatch[1] : 'cinematic';
                const promptStr = promptMatch ? promptMatch[1] : '';
                const urlStr = urlMatch ? urlMatch[1] : '';

                if (!urlStr) return null;

                return (
                  <div key={mIdx} className="bg-white/3 border border-white/5 rounded-2xl overflow-hidden p-3 space-y-2">
                    <img 
                      src={urlStr} 
                      alt="Art preview" 
                      className="w-full aspect-square object-cover rounded-xl bg-black/40" 
                      referrerPolicy="no-referrer"
                    />
                    <div className="text-xs text-white/80 italic font-medium leading-relaxed">
                      "{promptStr}"
                    </div>
                    <div className="text-[9px] uppercase font-bold tracking-wider text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded-full inline-block">
                      Preset: {styleStr}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Voice Command Metadata Detail View */}
        {item.source === 'voice-command' ? (
          <div className="space-y-4">
            {/* Header Badge & Type */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent border border-indigo-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                  item.triggerSource === 'wake-word' || item.id.startsWith('vc-ww')
                    ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300'
                    : 'bg-violet-500/15 border-violet-500/30 text-violet-300'
                }`}>
                  <Zap size={12} className="animate-pulse" />
                  {item.triggerSource === 'wake-word' || item.id.startsWith('vc-ww') ? 'Wake-word Triggered' : 'Voice Command'}
                </span>
                <span className="text-[11px] text-white/40 flex items-center gap-1">
                  <Clock size={12} />
                  {timeAgo(item.updatedAt)}
                </span>
              </div>

              {/* Exact Chronological Timestamp */}
              <div className="text-xs text-white/70 bg-black/30 border border-white/5 rounded-xl px-3 py-2 flex items-center justify-between">
                <span className="text-white/40 font-medium text-[11px]">Timestamp Logged:</span>
                <span className="font-mono font-semibold text-indigo-200 text-[11px]">{formatFullDateTime(item.updatedAt)}</span>
              </div>
            </div>

            {/* Transcript Callout */}
            <div className="space-y-1.5">
              <div className="text-[10px] uppercase font-bold text-white/30 tracking-wider flex items-center gap-1.5">
                <Mic size={12} className="text-indigo-400" />
                Captured Voice Transcript:
              </div>
              <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/20 text-sm font-medium text-white/90 leading-relaxed italic shadow-inner">
                "{item.preview || item.text}"
              </div>
            </div>

            {/* Context Metadata Grid */}
            <div className="space-y-2">
              <div className="text-[10px] uppercase font-bold text-white/30 tracking-wider flex items-center gap-1.5">
                <Layers size={12} className="text-violet-400" />
                Capture Context & Metadata:
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 rounded-xl bg-white/3 border border-white/5 space-y-1">
                  <span className="text-[10px] text-white/40 block">Captured In Context</span>
                  <span className="font-semibold text-violet-300 capitalize">{item.activeModeContext || 'Omni Chat'}</span>
                </div>
                <div className="p-3 rounded-xl bg-white/3 border border-white/5 space-y-1">
                  <span className="text-[10px] text-white/40 block">Target Executed Mode</span>
                  <span className="font-semibold text-cyan-300 capitalize">{item.targetMode || 'J.A.R.V.I.S. HUD'}</span>
                </div>
                <div className="p-3 rounded-xl bg-white/3 border border-white/5 space-y-1">
                  <span className="text-[10px] text-white/40 block">Listener Engine</span>
                  <span className="font-semibold text-indigo-300">{item.context?.listener || 'Web Speech Listener'}</span>
                </div>
                <div className="p-3 rounded-xl bg-white/3 border border-white/5 space-y-1">
                  <span className="text-[10px] text-white/40 block">Sensitivity Setting</span>
                  <span className="font-semibold text-amber-300">{item.sensitivity || '75%'}</span>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-white/3 border border-white/5 text-xs flex items-center justify-between">
                <span className="text-white/40 text-[11px]">Command ID</span>
                <span className="font-mono text-[10px] text-white/60 truncate max-w-[180px]">{item.id}</span>
              </div>
            </div>

            {/* Assistant Result / Messages Stream */}
            {item.messages && item.messages.length > 1 && (
              <div className="space-y-2 pt-2">
                <div className="text-[10px] uppercase font-bold text-white/30 tracking-wider flex items-center gap-1.5">
                  <Bot size={12} className="text-emerald-400" />
                  Executed Action / Response:
                </div>
                <div className="p-3 rounded-2xl bg-emerald-950/20 border border-emerald-500/20 text-xs text-emerald-200/90 leading-relaxed">
                  {item.messages[1].text || item.messages[1].content}
                </div>
              </div>
            )}
          </div>
        ) : item.source === 'voice-live' ? (
          <VoiceRecordingPlayer
            sessionId={item.id}
            sessionTitle={item.title}
            hasRecording={!!item.hasRecording}
            mimeType={item.audioMimeType}
            transcript={item.transcript}
            modelName={item.model}
            duration={item.duration}
            onRename={onRename || (() => {})}
          />
        ) : item.messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-white/20">
            <MessageSquare size={28} className="mb-2 text-white/10"/>
            <span className="text-xs">No chat history lines recorded</span>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-[10px] uppercase font-bold text-white/30 tracking-wider">Interaction Stream:</div>
            {item.messages.map((msg, i) => {
              const isUser = msg.role === 'user';
              const text = msg.text || msg.content || '';
              if (item.source === 'image-gen' && text.includes('URL: data:image')) {
                return null; // already rendered above
              }
              return (
                <div key={i} className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold mt-1 ${
                    isUser ? 'bg-violet-500/20 text-violet-300 border border-violet-500/10' : 'bg-white/5 text-white/40 border border-white/5'
                  }`}>
                    {isUser ? 'U' : 'AI'}
                  </div>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                    isUser
                      ? 'bg-violet-500/15 text-white/80 rounded-tr-sm'
                      : 'bg-white/5 text-white/60 rounded-tl-sm border border-white/5'
                  }`}>
                    {text.slice(0, 800)}{text.length > 800 && <span className="text-white/30"> ... (truncated)</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom shortcut */}
      <div className="p-4 border-t border-white/5 bg-black/10 flex justify-center">
        <button
          onClick={onJump}
          className={`flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-lg shadow-violet-500/10 hover:shadow-violet-500/20 transition-all`}
        >
          <ExternalLink size={13} />
          Jump into Active Mode
        </button>
      </div>
    </div>
  );
}

function getLocalVoiceCommands(): any[] {
  try {
    const raw = localStorage.getItem('omnichat_voice_commands');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/* ─── Main HistoryMode ──────────────────────────────────── */
interface HistoryModeProps {
  onModeChange: (mode: string) => void;
}

type SortOrder = 'newest' | 'oldest';
type FilterGroup = 'all' | 'chats' | 'audio' | 'art' | 'voice-commands' | 'logs';

export const HistoryMode: React.FC<HistoryModeProps> = ({ onModeChange }) => {
  const [allItems, setAllItems] = useState<SearchItem[]>(() => loadAllIndexedItems());
  const [search, setSearch] = useState('');
  const [activeGroup, setActiveGroup] = useState<FilterGroup>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [selected, setSelected] = useState<SearchItem | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [voiceSubFilter, setVoiceSubFilter] = useState<'all' | 'wake-word' | 'voice-live'>('all');
  const [user, setUser] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const exportVoiceCommandsJSON = useCallback(() => {
    const voiceCmds = allItems.filter(i => i.source === 'voice-command');
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(voiceCmds, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `wake_word_voice_commands_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }, [allItems]);

  // Synchronize voice commands when user is authenticated
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setIsSyncing(true);
        try {
          const localCmds = getLocalVoiceCommands();
          const syncedCmds = await syncVoiceCommands(localCmds);
          localStorage.setItem('omnichat_voice_commands', JSON.stringify(syncedCmds));
          // Reload the list after sync
          setAllItems(loadAllIndexedItems());
        } catch (err) {
          console.error("Voice command synchronization failed:", err);
        } finally {
          setIsSyncing(false);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Stop any active TTS audio when leaving the History view
  useEffect(() => {
    return () => {
      stopCurrentReadAloud();
    };
  }, []);

  const handleToggleSpeak = async (item: SearchItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    if (speakingId === item.id) {
      stopCurrentReadAloud();
      setSpeakingId(null);
      return;
    }

    try {
      setSpeakingId(item.id);
      sounds.playClick();
      triggerHaptic('light');
      
      const responseText = item.messages?.[1]?.text || item.messages?.[1]?.content;
      const textToSpeak = responseText || item.text || item.preview;
      const audio = await playTextToSpeech(textToSpeak);
      if (audio) {
        audio.onended = () => {
          setSpeakingId(null);
        };
      } else {
        setSpeakingId(null);
      }
    } catch {
      setSpeakingId(null);
    }
  };

  const handleReTrigger = (item: SearchItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    sounds.playSuccess();
    triggerHaptic('success');
    
    // Save to localStorage so that OmniChatMode will capture and auto-run it on redirect!
    localStorage.setItem('omnichat_pending_query', item.text || item.preview);
    
    // Seamlessly swap mode to Omni Chat
    onModeChange('omni-chat');
  };

  // Background Truncation Engine
  useEffect(() => {
    try {
      const raw = localStorage.getItem('omnichat_voice_commands');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 100) {
          // Keep the 100 most recent records by timestamp
          const sorted = parsed
            .map(item => ({ 
              ...item, 
              ts: item.updatedAt || item.timestamp ? new Date(item.updatedAt || item.timestamp).getTime() : Date.now() 
            }))
            .sort((a, b) => b.ts - a.ts);
          
          const truncated = sorted.slice(0, 100).map(({ ts, ...rest }) => rest);
          localStorage.setItem('omnichat_voice_commands', JSON.stringify(truncated));
          console.log(`[Voice Command Truncator] Successfully truncated storage log from ${parsed.length} to 100 entries.`);
          setAllItems(loadAllIndexedItems());
        }
      }
    } catch (e) {
      console.error('[Voice Command Truncator] Failed during background truncation run:', e);
    }
  }, []);

  const reload = useCallback(() => {
    setAllItems(loadAllIndexedItems());
    setSelected(null);
  }, []);

  const handleDelete = useCallback((item: SearchItem) => {
    if (!window.confirm(`Are you sure you want to delete this record?`)) return;
    deleteItemFromSource(item);
    if (item.source === 'voice-command' && auth.currentUser) {
      deleteVoiceCommandFromCloud(item.id).catch(err => {
        console.error('Failed to delete voice command from cloud:', err);
      });
    } else if (item.source === 'voice-live') {
      import('../utils/audioDB').then(({ deleteRecordingFromIDB }) => {
        deleteRecordingFromIDB(item.id).catch(err => console.error('Failed to delete recording from IndexedDB:', err));
      });
      if (auth.currentUser) {
        import('../lib/firebase').then(({ deleteVoiceSessionFromCloud }) => {
          deleteVoiceSessionFromCloud(item.id).catch(err => console.error('Failed to delete voice session from cloud:', err));
        });
      }
    }
    setAllItems(prev => prev.filter(c => !(c.id === item.id && c.source === item.source)));
    if (selected?.id === item.id) setSelected(null);
  }, [selected]);

  const handleClearAll = useCallback(() => {
    if (auth.currentUser) {
      clearVoiceCommandsFromCloud().catch(err => {
        console.error('Failed to clear voice commands from cloud:', err);
      });
    }
    // Clear major storage lists
    localStorage.removeItem('omnichat_conversations_chat-pro');
    localStorage.removeItem('omnichat_conversations_chat-fast');
    localStorage.removeItem('omnichat_conversations_v2');
    localStorage.removeItem('omnichat_liquid_sessions');
    localStorage.removeItem('omnichat_coder_projects');
    localStorage.removeItem('omnichat_voice_sessions');
    localStorage.removeItem('omnichat_searchmaps_conversations');
    localStorage.removeItem('omnichat_transcription_sessions');
    localStorage.removeItem('omnichat_tts_sessions');
    localStorage.removeItem('omnichat_image_sessions');
    localStorage.removeItem('omnichat_jarvis_messages');
    localStorage.removeItem('omnichat_voice_commands');
    appLogger.clearLogs();
    
    setAllItems([]);
    setSelected(null);
    setConfirmClearAll(false);
  }, []);

  // Filter & Search Logic
  const filteredAndSorted = useMemo(() => {
    let result = [...allItems];

    // Filter by group tab
    if (activeGroup === 'chats') {
      result = result.filter(item => ['chat-pro', 'chat-fast', 'omni-chat', 'liquid-chat', 'jarvis'].includes(item.source));
    } else if (activeGroup === 'audio') {
      result = result.filter(item => ['voice-live', 'transcription', 'tts'].includes(item.source));
    } else if (activeGroup === 'art') {
      result = result.filter(item => ['coder', 'image-gen', 'search-maps'].includes(item.source));
    } else if (activeGroup === 'voice-commands') {
      result = result.filter(item => item.source === 'voice-command');
      if (voiceSubFilter === 'wake-word') {
        result = result.filter(item => item.triggerSource === 'wake-word' || item.id.startsWith('vc-ww'));
      } else if (voiceSubFilter === 'voice-live') {
        result = result.filter(item => item.triggerSource !== 'wake-word' && !item.id.startsWith('vc-ww'));
      }
    } else if (activeGroup === 'logs') {
      result = result.filter(item => item.source === 'logs');
    }

    // Filter by search query
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(item => {
        // Search in title or preview
        if (item.title.toLowerCase().includes(q) || item.preview.toLowerCase().includes(q)) {
          return true;
        }
        // Search in messages
        for (const msg of item.messages) {
          if ((msg.text || msg.content || '').toLowerCase().includes(q)) {
            return true;
          }
        }
        // Search in files
        if (item.files) {
          for (const f of item.files) {
            if (f.name.toLowerCase().includes(q) || f.content.toLowerCase().includes(q)) {
              return true;
            }
          }
        }
        return false;
      });
    }

    // Filter by selected date (especially for voice commands)
    if (selectedDate) {
      result = result.filter(item => {
        const itemDate = new Date(item.updatedAt);
        const year = itemDate.getFullYear();
        const month = String(itemDate.getMonth() + 1).padStart(2, '0');
        const day = String(itemDate.getDate()).padStart(2, '0');
        const localDStr = `${year}-${month}-${day}`;
        return localDStr === selectedDate;
      });
    }

    // Sort order
    if (sortOrder === 'newest') {
      result.sort((a, b) => b.updatedAt - a.updatedAt);
    } else if (sortOrder === 'oldest') {
      result.sort((a, b) => a.updatedAt - b.updatedAt);
    }

    return result;
  }, [allItems, activeGroup, search, sortOrder, selectedDate, voiceSubFilter]);

  return (
    <div className="flex h-full w-full overflow-hidden bg-[#07070b]">
      {/* ── Left: Main List Panel ─────────────────────── */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        
        {/* Premium Top Search Bar */}
        <div className="p-4 md:p-6 pb-3 border-b border-white/5 space-y-4 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h1 className="text-lg font-bold flex items-center gap-2 bg-gradient-to-r from-violet-400 via-indigo-400 to-pink-400 bg-clip-text text-transparent">
                  <Search size={18} className="text-violet-400" />
                  Global Intelligence Index
                </h1>
                {user && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isSyncing ? (
                      <span className="text-[10px] text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 animate-pulse">
                        <RefreshCw size={10} className="animate-spin text-indigo-400" />
                        Syncing voice logs...
                      </span>
                    ) : (
                      <span className="text-[10px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 shadow-md shadow-emerald-500/5">
                        <Cloud size={10} className="text-emerald-400 animate-pulse" />
                        Cloud Synced
                      </span>
                    )}
                  </div>
                )}
              </div>
              <p className="text-[11px] text-white/40 mt-1">Search and navigate across conversation indexes, synthetic voice, artworks, logs, and codes</p>
            </div>
            {allItems.length > 0 && !confirmClearAll && (
              <button onClick={() => setConfirmClearAll(true)}
                className="text-[11px] font-semibold text-red-400/80 hover:text-red-400 border border-red-500/25 bg-red-500/5 hover:bg-red-500/10 px-3 py-1.5 rounded-xl transition-all">
                Wipe Index Records
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1 group">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-violet-400 transition-colors" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={activeGroup === 'voice-commands' ? "Search voice command transcripts by keyword..." : "Query keyword, phrase, or code snippet across all modes..."}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50 focus:bg-white/8 transition-all"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white">
                  <X size={14} />
                </button>
              )}
            </div>
            
            <select
              value={sortOrder}
              onChange={e => setSortOrder(e.target.value as SortOrder)}
              className="text-xs bg-white/5 border border-white/10 text-white/60 rounded-xl px-3 py-2.5 outline-none cursor-pointer focus:border-violet-500/30 hover:bg-white/8 transition-all"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>

          {/* Group Tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {[
              { id: 'all', label: 'All Indices', count: allItems.length },
              { id: 'chats', label: 'Chats & Agents', count: allItems.filter(item => ['chat-pro', 'chat-fast', 'omni-chat', 'liquid-chat', 'jarvis'].includes(item.source)).length },
              { id: 'audio', label: 'Audio & Speech', count: allItems.filter(item => ['voice-live', 'transcription', 'tts'].includes(item.source)).length },
              { id: 'art', label: 'Workspace & Art', count: allItems.filter(item => ['coder', 'image-gen', 'search-maps'].includes(item.source)).length },
              { id: 'voice-commands', label: 'Voice Commands', count: allItems.filter(item => item.source === 'voice-command').length },
              { id: 'logs', label: 'Console Logs', count: allItems.filter(item => item.source === 'logs').length },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveGroup(tab.id as FilterGroup)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all flex items-center gap-1.5 ${
                  activeGroup === tab.id
                    ? 'bg-violet-500/10 border-violet-500/30 text-violet-300 font-bold'
                    : 'bg-white/3 border-white/5 text-white/50 hover:border-white/10 hover:text-white'
                }`}
              >
                {tab.label}
                <span className={`text-[9px] px-1.5 py-0.2 rounded-full ${activeGroup === tab.id ? 'bg-violet-500/25 text-violet-300' : 'bg-white/5 text-white/30'}`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Dedicated Voice Commands Intelligence Dashboard Banner */}
          {activeGroup === 'voice-commands' && (
            <div className="space-y-3 animate-fade-in">
              {/* Stat Summary Header */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-950/40 via-indigo-950/30 to-purple-950/40 border border-cyan-500/20 shadow-xl flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-300">
                    <Radio size={20} className="animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white tracking-wide">Wake-word & Voice Commands Log</h3>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                        Live Tracking
                      </span>
                    </div>
                    <p className="text-xs text-white/50 mt-0.5">Chronological log of captured wake-word listener triggers and voice commands with context metadata</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={exportVoiceCommandsJSON}
                    className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                    title="Export all voice command logs with metadata as JSON"
                  >
                    <Download size={13} className="text-cyan-400" />
                    Export Log (.JSON)
                  </button>
                </div>
              </div>

              {/* Stats & Sub-Filter Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-white/3 border border-white/5">
                {/* Sub-Filter Tabs */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setVoiceSubFilter('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border active:scale-95 ${
                      voiceSubFilter === 'all'
                        ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-200'
                        : 'bg-white/3 border-white/5 text-white/50 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <Radio size={12} />
                    All Logs ({allItems.filter(i => i.source === 'voice-command').length})
                  </button>

                  <button
                    onClick={() => setVoiceSubFilter('wake-word')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border active:scale-95 ${
                      voiceSubFilter === 'wake-word'
                        ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-200'
                        : 'bg-white/3 border-white/5 text-white/50 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <Zap size={12} className="text-cyan-400" />
                    Wake-Word Triggers ({allItems.filter(i => i.source === 'voice-command' && (i.triggerSource === 'wake-word' || i.id.startsWith('vc-ww'))).length})
                  </button>

                  <button
                    onClick={() => setVoiceSubFilter('voice-live')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border active:scale-95 ${
                      voiceSubFilter === 'voice-live'
                        ? 'bg-violet-500/20 border-violet-500/40 text-violet-200'
                        : 'bg-white/3 border-white/5 text-white/50 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <Mic size={12} className="text-violet-400" />
                    Assistant Commands ({allItems.filter(i => i.source === 'voice-command' && i.triggerSource !== 'wake-word' && !i.id.startsWith('vc-ww')).length})
                  </button>
                </div>

                {/* Date Filter Controls */}
                <div className="flex items-center gap-2">
                  <Calendar size={13} className="text-cyan-400" />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    className="text-xs bg-white/5 border border-white/10 text-white rounded-xl px-3 py-1.5 focus:border-cyan-500/50 outline-none transition-all cursor-pointer [color-scheme:dark]"
                  />
                  {selectedDate && (
                    <button
                      onClick={() => setSelectedDate('')}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 font-semibold px-2 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Wipe confirm banner */}
        {confirmClearAll && (
          <div className="mx-6 my-4 p-4 rounded-2xl border border-red-500/30 bg-red-500/10 shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={15} className="text-red-400 animate-pulse"/>
              <span className="text-sm font-bold text-red-300">Wipe entire records index?</span>
            </div>
            <p className="text-xs text-white/55 mb-3 leading-relaxed">This will erase all local databases including Chat History, Liquid Sessions, Coder projects, Speech synthesis, and Transcriptions. This action is irreversible.</p>
            <div className="flex gap-2">
              <button onClick={handleClearAll} className="px-4 py-2 rounded-xl bg-red-500/25 hover:bg-red-500/35 text-red-300 text-xs font-semibold transition-all">Yes, Erase Everything</button>
              <button onClick={() => setConfirmClearAll(false)} className="px-4 py-2 rounded-xl bg-white/6 hover:bg-white/10 text-white/60 text-xs transition-all">Cancel</button>
            </div>
          </div>
        )}

        {/* Results Container */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-6 pt-2 scrollbar-thin">
          {filteredAndSorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-white/20">
              <History size={36} className="text-white/10" />
              <div className="text-center space-y-1">
                <p className="text-sm font-semibold">No indexed results found</p>
                <p className="text-xs text-white/40">Try adjusting your query or filters, or create a new session</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5 max-w-4xl">
              {filteredAndSorted.map((item, index) => {
                const meta = SOURCE_META[item.source];
                const Icon = meta.icon;
                const matchInfo = getMatchingSnippet(item, search);

                if (item.source === 'voice-command') {
                  const isSelected = selected?.id === item.id && selected.source === item.source;
                  const isSpeaking = speakingId === item.id;
                  const isWakeWord = item.triggerSource === 'wake-word' || item.id.startsWith('vc-ww');
                  
                  return (
                    <div
                      key={`voice-command-${item.id}`}
                      onClick={() => setSelected(isSelected ? null : item)}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 relative group flex flex-col gap-3 ${
                        isSelected
                          ? isWakeWord
                            ? 'bg-cyan-500/10 border-cyan-500/30 shadow-lg shadow-cyan-500/5'
                            : 'bg-violet-500/10 border-violet-500/30 shadow-lg shadow-violet-500/5'
                          : 'bg-white/3 border-white/5 hover:border-white/10 hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-start gap-4 w-full">
                        {/* Custom Animated Mic/Voice Indicator */}
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border relative ${
                          isWakeWord
                            ? 'bg-cyan-500/15 border-cyan-500/25 text-cyan-300'
                            : 'bg-violet-500/15 border-violet-500/25 text-violet-300'
                        } ${isSpeaking ? 'animate-pulse' : ''}`}>
                          {isSpeaking && (
                            <div className={`absolute inset-0 rounded-2xl animate-ping ${isWakeWord ? 'bg-cyan-500/20' : 'bg-violet-500/20'}`} />
                          )}
                          {isWakeWord ? (
                            <Zap size={18} className={isSpeaking ? 'text-cyan-300' : 'text-cyan-400'} />
                          ) : (
                            <Mic size={18} className={isSpeaking ? 'text-violet-300' : 'text-violet-400'} />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Card Header & Badges */}
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                isWakeWord
                                  ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300'
                                  : 'bg-violet-500/15 border-violet-500/30 text-violet-300'
                              }`}>
                                {isWakeWord ? <Zap size={10} /> : <Mic size={10} />}
                                {isWakeWord ? 'WAKE-WORD TRIGGER' : 'VOICE COMMAND'}
                              </span>

                              {/* Active Mode Pill */}
                              {item.activeModeContext && (
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-white/60 capitalize">
                                  Captured in: {item.activeModeContext}
                                </span>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[10px] text-white/40 flex items-center gap-1 font-mono">
                                <Clock size={10} />
                                {formatFullDateTime(item.updatedAt)}
                              </span>
                              <span className="text-[10px] text-white/30 font-medium">({timeAgo(item.updatedAt)})</span>
                              <button
                                onClick={e => { e.stopPropagation(); handleDelete(item); }}
                                className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400/80 hover:text-red-300 border border-red-500/20 hover:border-red-500/30 transition-all flex items-center justify-center shadow-sm active:scale-95 ml-1"
                                title="Delete record"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>

                          {/* Captured Transcript Quote */}
                          <div className="p-3 rounded-xl bg-black/40 border border-white/5 text-xs font-medium text-white/90 leading-relaxed italic">
                            "{item.preview || item.text}"
                          </div>

                          {/* Metadata Row */}
                          <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                            {item.targetMode && (
                              <span className="text-[10px] text-cyan-300/80 bg-cyan-950/40 border border-cyan-500/20 rounded-md px-2 py-0.5">
                                Target: {item.targetMode}
                              </span>
                            )}
                            {item.sensitivity && (
                              <span className="text-[10px] text-amber-300/80 bg-amber-950/40 border border-amber-500/20 rounded-md px-2 py-0.5">
                                Sensitivity: {item.sensitivity}
                              </span>
                            )}
                            <span className="text-[10px] text-white/30 bg-white/3 border border-white/5 rounded-md px-2 py-0.5">
                              {item.context?.listener || 'Web Speech Listener'}
                            </span>
                          </div>

                          {/* Extra info if they have an assistant response */}
                          {item.messages && item.messages.length > 1 && (
                            <div className="mt-2 text-xs text-emerald-300/80 border-l-2 border-emerald-500/40 pl-3 py-1 italic line-clamp-2 bg-emerald-950/10 rounded-r-lg">
                              {item.messages[1].text || item.messages[1].content}
                            </div>
                          )}

                          {/* Interactive Action Row */}
                          <div className="flex items-center gap-2 mt-3 pt-1">
                            <button
                              onClick={(e) => handleReTrigger(item, e)}
                              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/10 active:scale-95"
                              title="Execute this command again in Omni Chat"
                            >
                              <RefreshCw size={12} />
                              Re-trigger Action
                            </button>

                            <button
                              onClick={(e) => handleToggleSpeak(item, e)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border active:scale-95 ${
                                isSpeaking 
                                  ? 'bg-rose-500/15 border-rose-500/20 text-rose-300 animate-pulse' 
                                  : 'bg-white/5 border-white/5 hover:border-white/10 text-white/70 hover:text-white'
                              }`}
                              title={isSpeaking ? "Mute playback" : "Listen to transcription"}
                            >
                              {isSpeaking ? (
                                <>
                                  <span className="flex gap-0.5 items-center justify-center">
                                    <span className="w-1 h-2.5 bg-rose-400 rounded-full" />
                                    <span className="w-1 h-3.5 bg-rose-400 rounded-full" />
                                    <span className="w-1 h-2 bg-rose-400 rounded-full" />
                                  </span>
                                  Stop Listening
                                </>
                              ) : (
                                <>
                                  <Volume2 size={12} />
                                  Speak Aloud
                                </>
                              )}
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(item.preview || item.text || '');
                                triggerHaptic('light');
                              }}
                              className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 text-white/60 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95"
                              title="Copy transcript to clipboard"
                            >
                              <Copy size={12} />
                              Copy Text
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={`${item.source}-${item.id}`}
                    onClick={() => setSelected(selected?.id === item.id && selected.source === item.source ? null : item)}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 relative group flex items-start gap-4 ${
                      selected?.id === item.id && selected.source === item.source
                        ? 'bg-violet-500/10 border-violet-500/30'
                        : 'bg-white/3 border-white/5 hover:border-white/10 hover:bg-white/5'
                    }`}
                  >
                    {/* Source Icon Indicator */}
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border border-white/5 ${meta.bg}`}>
                      <Icon size={16} className={meta.color} />
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-xs text-white/95 truncate">
                          {item.title}
                        </span>
                        
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-white/30 flex items-center gap-1">
                            <Clock size={10} />
                            {timeAgo(item.updatedAt)}
                          </span>
                          <button
                            onClick={e => { e.stopPropagation(); handleDelete(item); }}
                            className="p-1.5 rounded-lg hover:bg-red-500/15 hover:text-red-400 text-white/20 transition-all opacity-0 group-hover:opacity-100"
                            title="Delete"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Display match snippet if active query, else regular preview */}
                      {matchInfo ? (
                        <div className="text-[11px] leading-relaxed bg-black/30 border border-white/5 rounded-lg p-2 mt-1">
                          <HighlightedText 
                            text={matchInfo.snippet} 
                            start={matchInfo.startIdx} 
                            end={matchInfo.endIdx} 
                          />
                        </div>
                      ) : (
                        <p className="text-[11px] text-white/45 truncate leading-relaxed">
                          {item.preview}
                        </p>
                      )}

                      {/* Info Badges */}
                      <div className="flex items-center gap-2 pt-1 flex-wrap">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border border-current/10 ${meta.badge}`}>
                          {meta.label}
                        </span>
                        {item.statusBadge && (
                          <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${
                            item.statusBadge === 'error' || item.statusBadge === 'Disconnected'
                              ? 'text-red-400 border-red-500/20 bg-red-500/5'
                              : item.statusBadge === 'warn'
                              ? 'text-amber-400 border-amber-500/20 bg-amber-500/5'
                              : 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5'
                          }`}>
                            {item.statusBadge.toUpperCase()}
                          </span>
                        )}
                        {item.duration && (
                          <span className="text-[10px] text-white/30 font-mono">
                            Duration: {item.duration}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Right: Comprehensive Detail Panel ─────────── */}
      <AnimatePresence>
        {selected && (
          <>
            {/* Desktop Panel */}
            <motion.div 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 440, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              className="hidden lg:block h-full shrink-0 overflow-hidden"
            >
              <ConversationDetail
                item={selected}
                onClose={() => setSelected(null)}
                onDelete={() => handleDelete(selected)}
                onRename={(newTitle) => {
                  // Update in local state
                  setAllItems(prev => prev.map(s => s.id === selected.id && s.source === selected.source ? { ...s, title: newTitle } : s));
                  setSelected(prev => prev ? { ...prev, title: newTitle } : null);
                  
                  // Save to local storage
                  try {
                    const raw = JSON.parse(localStorage.getItem('omnichat_voice_sessions') || '[]');
                    if (Array.isArray(raw)) {
                      const updated = raw.map((s: any) => s.id === selected.id ? { ...s, title: newTitle, updatedAt: new Date().toISOString() } : s);
                      localStorage.setItem('omnichat_voice_sessions', JSON.stringify(updated));
                    }
                  } catch (e) {
                    console.error(e);
                  }

                  // Sync with cloud
                  if (auth.currentUser) {
                    import('../lib/firebase').then(({ saveVoiceSessionToCloud }) => {
                      saveVoiceSessionToCloud({
                        userId: auth.currentUser!.uid,
                        id: selected.id,
                        title: newTitle,
                        status: selected.statusBadge || 'Completed',
                        duration: selected.duration || '0:00',
                        durationSecs: selected.durationSecs,
                        audioPath: selected.audioPath,
                        transcript: selected.transcript,
                        model: selected.model,
                        hasRecording: selected.hasRecording,
                        audioMimeType: selected.audioMimeType,
                        updatedAt: Date.now()
                      });
                    });
                  }
                  sounds.playSuccess();
                  triggerHaptic('success');
                }}
                onJump={() => {
                  const meta = SOURCE_META[selected.source];
                  if (selected.source === 'chat-pro') {
                    localStorage.setItem('omnichat_active_id_chat-pro', selected.id);
                  } else if (selected.source === 'omni-chat') {
                    localStorage.setItem('omnichat_omni_current_session', selected.id);
                  } else if (selected.source === 'liquid-chat') {
                    localStorage.setItem('omnichat_liquid_current_session', selected.id);
                  }
                  onModeChange(meta.mode);
                }}
              />
            </motion.div>

            {/* Mobile Backdrop & Slide-up Sheet */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelected(null)}
              className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center"
            >
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-xl rounded-t-3xl bg-[#0d0d16] border-t border-white/10 flex flex-col overflow-hidden h-[80vh]"
              >
                {/* Drag Indicator */}
                <div className="w-12 h-1 bg-white/20 rounded-full mx-auto my-3 shrink-0" />
                <div className="flex-1 overflow-hidden">
                  <ConversationDetail
                    item={selected}
                    onClose={() => setSelected(null)}
                    onDelete={() => handleDelete(selected)}
                    onRename={(newTitle) => {
                      // Update in local state
                      setAllItems(prev => prev.map(s => s.id === selected.id && s.source === selected.source ? { ...s, title: newTitle } : s));
                      setSelected(prev => prev ? { ...prev, title: newTitle } : null);
                      
                      // Save to local storage
                      try {
                        const raw = JSON.parse(localStorage.getItem('omnichat_voice_sessions') || '[]');
                        if (Array.isArray(raw)) {
                          const updated = raw.map((s: any) => s.id === selected.id ? { ...s, title: newTitle, updatedAt: new Date().toISOString() } : s);
                          localStorage.setItem('omnichat_voice_sessions', JSON.stringify(updated));
                        }
                      } catch (e) {
                        console.error(e);
                      }

                      // Sync with cloud
                      if (auth.currentUser) {
                        import('../lib/firebase').then(({ saveVoiceSessionToCloud }) => {
                          saveVoiceSessionToCloud({
                            userId: auth.currentUser!.uid,
                            id: selected.id,
                            title: newTitle,
                            status: selected.statusBadge || 'Completed',
                            duration: selected.duration || '0:00',
                            durationSecs: selected.durationSecs,
                            audioPath: selected.audioPath,
                            transcript: selected.transcript,
                            model: selected.model,
                            hasRecording: selected.hasRecording,
                            audioMimeType: selected.audioMimeType,
                            updatedAt: Date.now()
                          });
                        });
                      }
                      sounds.playSuccess();
                      triggerHaptic('success');
                    }}
                    onJump={() => {
                      const meta = SOURCE_META[selected.source];
                      if (selected.source === 'chat-pro') {
                        localStorage.setItem('omnichat_active_id_chat-pro', selected.id);
                      } else if (selected.source === 'omni-chat') {
                        localStorage.setItem('omnichat_omni_current_session', selected.id);
                      } else if (selected.source === 'liquid-chat') {
                        localStorage.setItem('omnichat_liquid_current_session', selected.id);
                      }
                      onModeChange(meta.mode);
                    }}
                  />
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
