import React, { useState, useRef, useEffect, useCallback } from 'react';
import { getAiInstance, transcribeAudio } from '../services/gemini';
import { useSettings } from '../contexts/SettingsContext';
import { Send, Mic, Square, Loader2, Bot, User, Trash2, RotateCcw, Copy, Check, Sparkles, MessageSquare, Plus, X, FileText, Archive, Download, Paperclip, Video, Briefcase, Pin, PinOff, ScanEye, HelpCircle } from 'lucide-react';
import { Attachment } from '../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from 'motion/react';
import { WorkspaceWidget } from '../components/WorkspaceWidget';
import { sounds, triggerHaptic } from '../components/PremiumEffects';
import { OcrModal } from '../components/OcrModal';
import { useAutoSaveDraft } from '../hooks/useAutoSaveDraft';
import { usePeriodicAutoSave } from '../hooks/usePeriodicAutoSave';

/* ─── Keyframe animations ─────────────────────────────── */
const STYLES = `
  @keyframes omni-float {
    0%, 100% { transform: translateY(0px) scale(1); }
    50%       { transform: translateY(-22px) scale(1.04); }
  }
  @keyframes omni-float2 {
    0%, 100% { transform: translateY(0px) scale(1); }
    50%       { transform: translateY(18px) scale(0.96); }
  }
  @keyframes omni-float3 {
    0%, 100% { transform: translateY(0px) translateX(0px); }
    33%       { transform: translateY(-14px) translateX(10px); }
    66%       { transform: translateY(10px) translateX(-8px); }
  }
  @keyframes omni-pulse-ring {
    0%   { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(139,92,246,0.5); }
    70%  { transform: scale(1);    box-shadow: 0 0 0 14px rgba(139,92,246,0); }
    100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(139,92,246,0); }
  }
  @keyframes omni-spin-slow {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes omni-msg-in {
    from { opacity: 0; transform: translateY(14px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes omni-fade-up {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes omni-glow {
    0%, 100% { opacity: 0.5; }
    50%       { opacity: 1; }
  }
  @keyframes omni-particle {
    0%   { transform: translateY(0) translateX(0) scale(1); opacity: 0.7; }
    50%  { opacity: 0.3; }
    100% { transform: translateY(-60px) translateX(20px) scale(0.4); opacity: 0; }
  }
  @keyframes omni-typing-dot {
    0%, 80%, 100% { transform: scale(0.6); opacity: 0.3; }
    40%           { transform: scale(1);   opacity: 1; }
  }
  @keyframes omni-border-glow {
    0%, 100% { border-color: rgba(139,92,246,0.25); box-shadow: 0 0 0 0 rgba(139,92,246,0); }
    50%       { border-color: rgba(139,92,246,0.6);  box-shadow: 0 0 18px rgba(139,92,246,0.15); }
  }
  @keyframes omni-card-in {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .omni-msg-in    { animation: omni-msg-in 0.35s cubic-bezier(0.34,1.56,0.64,1) both; }
  .omni-fade-up   { animation: omni-fade-up 0.5s ease both; }
  .omni-card-0    { animation: omni-card-in 0.4s 0.1s ease both; }
  .omni-card-1    { animation: omni-card-in 0.4s 0.2s ease both; }
  .omni-card-2    { animation: omni-card-in 0.4s 0.3s ease both; }
  .omni-card-3    { animation: omni-card-in 0.4s 0.4s ease both; }
`;

/* ─── Animated background orbs ──────────────────────── */
function BackgroundOrbs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      <div style={{
        position: 'absolute', top: '-10%', left: '-5%',
        width: 480, height: 480, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 70%)',
        animation: 'omni-float 9s ease-in-out infinite',
        filter: 'blur(40px)',
      }} />
      <div style={{
        position: 'absolute', bottom: '5%', right: '-8%',
        width: 420, height: 420, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99,102,241,0.16) 0%, transparent 70%)',
        animation: 'omni-float2 11s ease-in-out infinite',
        filter: 'blur(50px)',
      }} />
      <div style={{
        position: 'absolute', top: '40%', right: '20%',
        width: 280, height: 280, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(168,85,247,0.12) 0%, transparent 70%)',
        animation: 'omni-float3 13s ease-in-out infinite',
        filter: 'blur(35px)',
      }} />
      <div style={{
        position: 'absolute', top: '20%', left: '30%',
        width: 200, height: 200, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(79,70,229,0.1) 0%, transparent 70%)',
        animation: 'omni-float2 7s 2s ease-in-out infinite',
        filter: 'blur(30px)',
      }} />
    </div>
  );
}

/* ─── Floating particles on welcome screen ───────────── */
function Particles() {
  const dots = Array.from({ length: 14 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: 30 + Math.random() * 50,
    size: 2 + Math.random() * 3,
    delay: Math.random() * 4,
    dur: 3 + Math.random() * 3,
  }));
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {dots.map(d => (
        <div key={d.id} style={{
          position: 'absolute',
          left: `${d.x}%`, top: `${d.y}%`,
          width: d.size, height: d.size,
          borderRadius: '50%',
          background: `rgba(${139 + Math.random() * 30},${92 + Math.random() * 30},246,0.6)`,
          animation: `omni-particle ${d.dur}s ${d.delay}s ease-out infinite`,
        }} />
      ))}
    </div>
  );
}

/* ─── Animated Omni avatar ──────────────────────────── */
function OmniAvatar({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'lg' ? 72 : size === 'sm' ? 28 : 36;
  const iconSize = size === 'lg' ? 32 : size === 'sm' ? 13 : 16;
  return (
    <div style={{
      width: dim, height: dim, borderRadius: '50%', position: 'relative', flexShrink: 0,
      animation: size === 'lg' ? 'omni-pulse-ring 2.5s ease-out infinite' : undefined,
    }}>
      {size === 'lg' && (
        <div style={{
          position: 'absolute', inset: -4, borderRadius: '50%',
          background: 'conic-gradient(from 0deg, rgba(139,92,246,0.8), rgba(99,102,241,0.4), rgba(168,85,247,0.8), rgba(139,92,246,0.8))',
          animation: 'omni-spin-slow 4s linear infinite',
          padding: 2,
        }}>
          <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#0e1117' }} />
        </div>
      )}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 50%, #a855f7 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: size === 'lg'
          ? '0 0 30px rgba(139,92,246,0.5), 0 0 60px rgba(139,92,246,0.2)'
          : '0 0 10px rgba(139,92,246,0.4)',
      }}>
        <Bot size={iconSize} color="white" />
      </div>
    </div>
  );
}

/* ─── Copy button ───────────────────────────────────── */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard?.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="opacity-0 group-hover:opacity-100 transition-all p-1 rounded text-white/25 hover:text-white/60"
      title="Copy"
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

/* ─── Main component ────────────────────────────────── */
interface Msg { id: string; role: 'user' | 'model'; text: string; streaming?: boolean; attachments?: Attachment[]; pinned?: boolean; }

interface Conversation {
  id: string;
  title: string;
  messages: Msg[];
  updatedAt: number;
}

const sanitizeConversationsForStorage = (convs: Conversation[]): Conversation[] => {
  return convs.map(conv => ({
    ...conv,
    messages: conv.messages.map(msg => {
      if (!msg.attachments || msg.attachments.length === 0) return msg;
      return {
        ...msg,
        attachments: msg.attachments.map(att => {
          // Keep base64 if it's a small image (under 50KB base64 size) to allow light previews
          const isSmallImage = att.type?.startsWith('image/') && att.base64 && att.base64.length < 70000;
          return {
            ...att,
            base64: isSmallImage ? att.base64 : ''
          };
        })
      };
    })
  }));
};

export const OmniChatMode: React.FC = () => {
  const { userProfile, setMicPermissionError } = useSettings();
  const apiKey = process.env.GEMINI_API_KEY;

  const [conversations, setConversations] = useState<Conversation[]>(() => {
    const saved = localStorage.getItem('omnichat_omni_sessions');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    // Migration from old single-chat format
    const oldSaved = localStorage.getItem('omnichat_omni_messages');
    if (oldSaved) {
      try {
        const parsed = JSON.parse(oldSaved);
        if (parsed && parsed.length > 0) {
          const newConv = {
            id: Date.now().toString(),
            title: parsed.find((m: any) => m.role === 'user')?.text?.substring(0, 30) || 'Previous Omni Chat',
            updatedAt: Date.now(),
            messages: parsed
          };
          return [newConv];
        }
      } catch (e) {}
    }
    return [{ id: '1', title: 'New Chat', messages: [], updatedAt: Date.now() }];
  });

  const [currentConversationId, setCurrentConversationId] = useState<string>(() => {
    const saved = localStorage.getItem('omnichat_omni_current_session');
    return saved || '1';
  });

  const [selectedModel, setSelectedModel] = useState<'gemini' | 'kimi-k3'>(() => {
    return (localStorage.getItem('omnichat_selected_model_omni') as 'gemini' | 'kimi-k3') || 'gemini';
  });

  useEffect(() => {
    localStorage.setItem('omnichat_selected_model_omni', selectedModel);
  }, [selectedModel]);

  // Handle + New Chat event from Sidebar
  useEffect(() => {
    const handleNewChat = () => {
      setMessages([]);
      setAttachments([]);
      setInput('');
    };
    window.addEventListener('omnichat-new-chat', handleNewChat);
    return () => window.removeEventListener('omnichat-new-chat', handleNewChat);
  }, []);

  const [isMobileHistoryOpen, setIsMobileHistoryOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showWorkspace, setShowWorkspace] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [ocrActiveImage, setOcrActiveImage] = useState<{ src: string; name: string; type: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const newAttachments: Attachment[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const base64 = await fileToBase64(file);
        newAttachments.push({
          name: file.name,
          type: file.type || getMimeTypeFromExtension(file.name),
          base64: base64
        });
      } catch (err) {
        console.error('Failed to read file', file.name, err);
      }
    }

    setAttachments(prev => [...prev, ...newAttachments]);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: Attachment[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const base64 = await fileToBase64(file);
        newAttachments.push({
          name: file.name,
          type: file.type || getMimeTypeFromExtension(file.name),
          base64: base64
        });
      } catch (err) {
        console.error('Failed to read file', file.name, err);
      }
    }

    setAttachments(prev => [...prev, ...newAttachments]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const getMimeTypeFromExtension = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return 'application/pdf';
    if (ext === 'zip') return 'application/zip';
    if (ext === 'mp4') return 'video/mp4';
    if (ext === 'mov') return 'video/quicktime';
    if (ext === 'png') return 'image/png';
    if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
    if (ext === 'webp') return 'image/webp';
    return 'application/octet-stream';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const activeConversation = conversations.find(c => c.id === currentConversationId) || conversations[0] || { id: '1', title: 'New Chat', messages: [], updatedAt: Date.now() };
  const messages = activeConversation.messages || [];

  const setMessages = (updater: Msg[] | ((prev: Msg[]) => Msg[])) => {
    setConversations(prevConvs => {
      const activeId = currentConversationId;
      return prevConvs.map(c => {
        if (c.id === activeId) {
          const newMessages = typeof updater === 'function' ? updater(c.messages) : updater;
          let title = c.title;
          if (title === 'New Chat' || title === 'Untitled Chat') {
            const firstUserMsg = newMessages.find(m => m.role === 'user');
            if (firstUserMsg) {
              title = firstUserMsg.text.substring(0, 30);
              if (firstUserMsg.text.length > 30) title += '...';
            }
          }
          return {
            ...c,
            title,
            updatedAt: Date.now(),
            messages: newMessages
          };
        }
        return c;
      });
    });
  };

  const togglePinMessage = (msgId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    sounds.playClick();
    triggerHaptic('light');
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, pinned: !m.pinned } : m));
  };

  const scrollToMessage = (msgId: string) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-violet-500', 'ring-offset-2', 'ring-offset-black', 'rounded-2xl');
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-violet-500', 'ring-offset-2', 'ring-offset-black', 'rounded-2xl');
      }, 2000);
    }
  };

  const pinnedMessages = messages.filter(m => m.pinned);

  const createNewChat = () => {
    if (activeConversation && activeConversation.messages.length === 0) {
      // Already an empty conversation exists, just keep it focused
      return;
    }
    const newId = Date.now().toString();
    const newConv: Conversation = {
      id: newId,
      title: 'New Chat',
      messages: [],
      updatedAt: Date.now()
    };
    setConversations(prev => [newConv, ...prev]);
    setCurrentConversationId(newId);
  };

  const deleteConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Delete this conversation?')) {
      const remaining = conversations.filter(c => c.id !== id);
      if (remaining.length === 0) {
        const defaultConv = { id: '1', title: 'New Chat', messages: [], updatedAt: Date.now() };
        setConversations([defaultConv]);
        setCurrentConversationId('1');
      } else {
        setConversations(remaining);
        if (currentConversationId === id) {
          setCurrentConversationId(remaining[0].id);
        }
      }
    }
  };

  const [input, setInput, clearInputDraft] = useAutoSaveDraft('omnichat_draft_omnichat');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);

  const chatRef = useRef<any>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Reset chat reference when current conversation changes
  useEffect(() => {
    chatRef.current = null;
  }, [currentConversationId]);

  // Periodic and unload auto-save for Omni sessions & active chat
  usePeriodicAutoSave('omnichat_omni_sessions', conversations, {
    intervalMs: 1500,
    sanitize: sanitizeConversationsForStorage
  });

  usePeriodicAutoSave('omnichat_omni_current_session', currentConversationId, {
    intervalMs: 1500
  });

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const initChat = useCallback((currentMessages: Msg[] = messages) => {
    if (!apiKey) return;
    const ai = getAiInstance();
    let sys = `You are Omni, a brilliant and warm AI assistant. Be genuinely helpful, clear, and concise. When appropriate, use markdown for structure.`;
    if (userProfile.name) sys += ` The user's name is ${userProfile.name}.`;
    if (userProfile.preferences) sys += ` User context: ${userProfile.preferences}`;
    const history = currentMessages.filter(m => !m.streaming && m.text).map(m => ({ role: m.role, parts: [{ text: m.text }] }));
    chatRef.current = ai.chats.create({
      model: 'gemini-3.5-flash',
      config: { systemInstruction: { parts: [{ text: sys }] } },
      history: history.length ? history : undefined,
    });
  }, [messages, userProfile, apiKey]);

  const autoResize = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
  };

  const sendMessage = async (text: string, currentAttachments: Attachment[] = attachments) => {
    if ((!text.trim() && currentAttachments.length === 0) || isLoading) return;
    if (!apiKey) {
      setMessages(prev => [
        ...prev,
        { id: `u-${Date.now()}`, role: 'user', text, attachments: currentAttachments },
        { id: `m-${Date.now()}`, role: 'model', text: '**No API key found.** Add your `GEMINI_API_KEY` in the Secrets panel, then restart the app.' },
      ]);
      return;
    }
    if (!chatRef.current) initChat(messages);

    sounds.playClick();
    triggerHaptic('light');

    const userMsg: Msg = { id: `u-${Date.now()}`, role: 'user', text, attachments: currentAttachments };
    const modelId = `m-${Date.now() + 1}`;
    setMessages(prev => [...prev, userMsg, { id: modelId, role: 'model', text: '', streaming: true }]);
    setIsLoading(true);
    clearInputDraft();
    setAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    try {
      if (selectedModel === 'kimi-k3') {
        const { streamKimiK3Response } = await import('../services/kimiK3');
        let thinkingSteps: string[] = [];
        let liveThinking = '';
        let answerText = '';

        const updateUI = () => {
          const stepsPart = thinkingSteps.map(s => `> \`${s}\``).join('\n');
          const reasoningPart = liveThinking ? `\n> \n> 🧠 **Thinking Process:**\n> ${liveThinking.trim().replace(/\n/g, '\n> ')}` : '';
          const formattedThinking = (stepsPart || reasoningPart) ? `${stepsPart}${reasoningPart}\n\n` : '';
          setMessages(prev => prev.map(m => m.id === modelId ? { ...m, text: formattedThinking + answerText } : m));
        };

        await streamKimiK3Response(
          text,
          currentAttachments,
          {
            onThinkingStep: (stepText, isDone) => {
              thinkingSteps.push(stepText);
              updateUI();
            },
            onThinkingChunk: (chunk) => {
              liveThinking += chunk;
              updateUI();
            },
            onTextChunk: (chunk) => {
              answerText += chunk;
              updateUI();
            },
            onComplete: (full) => {
              answerText = full;
              updateUI();
              setMessages(prev => prev.map(m => m.id === modelId ? { ...m, streaming: false } : m));
              sounds.playSuccess();
              triggerHaptic('success');
              setIsLoading(false);
            },
            onError: (err: any) => {
              answerText += `\n\n**Error:** ${err?.message ?? 'Something went wrong.'}`;
              updateUI();
              setMessages(prev => prev.map(m => m.id === modelId ? { ...m, streaming: false } : m));
              sounds.playError();
              triggerHaptic('error');
              setIsLoading(false);
            }
          }
        );
        return;
      }

      let messageContent: any = text;
      if (currentAttachments && currentAttachments.length > 0) {
        messageContent = [
          { text: text },
          ...currentAttachments.map(att => ({
            inlineData: {
              data: att.base64,
              mimeType: att.type
            }
          }))
        ];
      }

      const stream = await chatRef.current.sendMessageStream({ message: messageContent });
      let full = '';
      for await (const chunk of stream) {
        if (chunk.text) full += chunk.text;
        setMessages(prev => prev.map(m => m.id === modelId ? { ...m, text: full } : m));
      }
      sounds.playSuccess();
      triggerHaptic('success');
    } catch (err: any) {
      sounds.playError();
      triggerHaptic('error');
      setMessages(prev => prev.map(m => m.id === modelId ? { ...m, text: `**Error:** ${err?.message ?? 'Something went wrong.'}` } : m));
    } finally {
      setIsLoading(false);
      setMessages(prev => prev.map(m => m.id === modelId ? { ...m, streaming: false } : m));
    }
  };

  const clearChat = () => {
    if (!messages.length || !window.confirm('Clear all messages?')) return;
    setMessages([]); chatRef.current = null;
  };

  const retryLast = () => {
    const last = [...messages].reverse().find(m => m.role === 'user');
    if (!last) return;
    setMessages(prev => prev.slice(0, prev.lastIndexOf(last)));
    chatRef.current = null;
    setTimeout(() => sendMessage(last.text), 50);
  };

  // Handle auto-triggered pending query from voice command history re-trigger
  useEffect(() => {
    const pending = localStorage.getItem('omnichat_pending_query');
    if (pending) {
      localStorage.removeItem('omnichat_pending_query');
      setInput(pending);
      // Wait briefly for UI and connection to settle, then execute command
      const timer = setTimeout(() => {
        sendMessage(pending);
      }, 550);
      return () => clearTimeout(timer);
    }
  }, [apiKey]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      audioChunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        setIsTranscribing(true);
        const blob = new Blob(audioChunksRef.current, { type: mr.mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          const b64 = (reader.result as string).split(',')[1];
          try {
            const res = await transcribeAudio(b64, blob.type || 'audio/webm');
            if (res.text) setInput(p => p + (p ? ' ' : '') + res.text);
          } catch { alert('Transcription failed.'); }
          finally { setIsTranscribing(false); }
        };
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start(); setIsRecording(true);
    } catch { setMicPermissionError(true); }
  };

  const stopRecording = () => { mediaRecorderRef.current?.stop(); setIsRecording(false); };

  const SUGGESTIONS = [
    { emoji: '✨', text: 'What can you help me with?' },
    { emoji: '🪶', text: 'Share a peaceful reflection from Lord Krishna on inner calmness.' },
    { emoji: '🌊', text: 'Write a short poem about the serene ocean sunset.' },
    { emoji: '⚛️', text: 'Explain quantum computing simply.' },
    { emoji: '🚀', text: 'Give me a productivity tip.' },
  ];

  return (
    <>
      <style>{STYLES}</style>
      <div className="flex h-full w-full text-white relative overflow-hidden" style={{ background: 'linear-gradient(160deg, #0b0d14 0%, #0e1020 50%, #0d0b14 100%)' }}>
        <BackgroundOrbs />

        {/* ── Main Chat Area ────────────────────────── */}
        <div 
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className="flex-1 flex flex-col h-full overflow-hidden relative z-10"
        >
          {isDragging && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-violet-950/40 backdrop-blur-md border-2 border-dashed border-violet-500 m-4 rounded-3xl pointer-events-none animate-pulse">
              <Paperclip className="text-violet-400 mb-2" size={36} />
              <span className="text-lg font-bold text-violet-200">Drop files to attach</span>
              <span className="text-xs text-violet-400 mt-1">Photo, Video, PDF, or ZIP</span>
            </div>
          )}
          {/* ── Top bar ───────────────────────────────── */}
          <div className="relative z-10 flex items-center justify-between px-5 py-3 shrink-0"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(11,13,20,0.7)', backdropFilter: 'blur(20px)' }}>
            <div className="flex items-center gap-3">
              <OmniAvatar size="sm" />
              <div>
                <p className="text-sm font-semibold leading-none tracking-wide">Omni</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ animation: 'omni-glow 2s ease-in-out infinite' }} />
                  <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>Powered by Gemini</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value as 'gemini' | 'kimi-k3')}
                className="bg-zinc-900/60 text-zinc-300 text-[11px] font-medium px-2 py-1.5 rounded-lg border border-violet-500/20 focus:outline-none focus:border-violet-500 mr-2 cursor-pointer transition-all hover:bg-zinc-800"
              >
                <option value="gemini">♊ Gemini 3.5</option>
                <option value="kimi-k3">👑 Kimi-K3 (Super Reasoning)</option>
              </select>
              <button onClick={() => setIsMobileHistoryOpen(true)} title="Chat History"
                className="md:hidden p-2 rounded-lg transition-all hover:bg-white/5 mr-1"
                style={{ color: 'rgba(255,255,255,0.3)' }}>
                <MessageSquare size={15} />
              </button>
              <button onClick={() => setShowHistory(!showHistory)} title="Toggle Chat History"
                className="hidden md:block p-2 rounded-lg transition-all hover:bg-white/5 mr-1"
                style={{ color: showHistory ? '#a78bfa' : 'rgba(255,255,255,0.3)' }}>
                <MessageSquare size={15} />
              </button>
              <button onClick={createNewChat} title="New Chat"
                className="p-2 rounded-lg transition-all hover:bg-violet-500/10 hover:text-violet-400"
                style={{ color: 'rgba(255,255,255,0.3)' }}>
                <Plus size={15} />
              </button>
            </div>
          </div>

          {/* ── Pinned Messages Anchored Bar ───────────────── */}
          {pinnedMessages.length > 0 && (
            <div className="relative z-20 shrink-0 border-b border-violet-500/20 bg-violet-950/50 backdrop-blur-md px-4 py-2 flex flex-col gap-1.5 transition-all">
              <div className="flex items-center justify-between text-xs font-semibold text-violet-300">
                <div className="flex items-center gap-1.5">
                  <Pin size={13} className="text-violet-400 fill-violet-400/40" />
                  <span>Anchored / Pinned Messages ({pinnedMessages.length})</span>
                </div>
                <button 
                  onClick={() => setMessages(prev => prev.map(m => ({ ...m, pinned: false })))}
                  className="text-[10px] text-violet-400/70 hover:text-violet-200 underline transition-colors"
                >
                  Unpin All
                </button>
              </div>
              <div className="flex gap-2 overflow-x-auto py-1 hide-scrollbar">
                {pinnedMessages.map((pm) => (
                  <div
                    key={pm.id}
                    onClick={() => scrollToMessage(pm.id)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-violet-500/30 bg-violet-900/40 text-xs text-white shrink-0 max-w-[280px] cursor-pointer hover:bg-violet-900/70 transition-all group shadow-sm"
                  >
                    <span className="shrink-0 font-bold text-[10px] uppercase text-violet-300">
                      {pm.role === 'user' ? 'You' : 'Omni'}:
                    </span>
                    <span className="truncate flex-1 text-slate-200 text-[11px]">
                      {pm.text || (pm.attachments?.length ? `[${pm.attachments.length} file(s)]` : 'Pinned message')}
                    </span>
                    <button
                      onClick={(e) => togglePinMessage(pm.id, e)}
                      className="p-1 rounded-md text-violet-400/60 hover:text-red-300 hover:bg-red-500/20 transition-all"
                      title="Unpin message"
                    >
                      <PinOff size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Messages ──────────────────────────────── */}
          <div className="flex-1 overflow-y-auto relative z-10 px-4 py-6">
            {messages.length === 0 ? (
              /* Welcome screen */
              <div className="flex flex-col items-center justify-center h-full gap-10 text-center relative">
                <Particles />

                {/* Avatar hero */}
                <div className="omni-fade-up flex flex-col items-center gap-5">
                  <OmniAvatar size="lg" />
                  <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-1.5"
                      style={{ background: 'linear-gradient(135deg,#c4b5fd,#818cf8,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                      Hey, I'm Omni
                    </h1>
                    <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 14 }}>
                      Your AI companion — ask me absolutely anything.
                    </p>
                  </div>
                </div>

                {/* Suggestion cards */}
                <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
                  {SUGGESTIONS.map((s, i) => (
                    <button key={s.text} onClick={() => sendMessage(s.text)}
                      className={`omni-card-${i} text-left px-4 py-3 rounded-2xl flex flex-col gap-1.5 transition-all group`}
                      style={{
                        background: 'rgba(139,92,246,0.06)',
                        border: '1px solid rgba(139,92,246,0.18)',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(139,92,246,0.12)';
                        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(139,92,246,0.4)';
                        (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(139,92,246,0.06)';
                        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(139,92,246,0.18)';
                        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                      }}
                    >
                      <span className="text-lg">{s.emoji}</span>
                      <span className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>{s.text}</span>
                    </button>
                  ))}
                </div>

                {/* Bottom hint */}
                <div className="flex items-center gap-2" style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>
                  <Sparkles size={12} />
                  <span>Powered by Gemini 2.5 Flash</span>
                </div>
              </div>
            ) : (
              /* Chat messages */
              <div className="max-w-2xl mx-auto w-full space-y-5">
                {messages.map(msg => (
                  <motion.div 
                    key={msg.id}
                    id={`msg-${msg.id}`}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className={`omni-msg-in flex gap-3 group transition-all ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    {/* Avatar */}
                    {msg.role === 'model' ? (
                      <OmniAvatar size="sm" />
                    ) : (
                      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <User size={13} style={{ color: 'rgba(255,255,255,0.6)' }} />
                      </div>
                    )}

                    {/* Bubble */}
                    <div className={`relative max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${msg.role === 'user' ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}
                      style={msg.role === 'user' ? {
                        background: 'linear-gradient(135deg, rgba(139,92,246,0.85) 0%, rgba(99,102,241,0.85) 100%)',
                        boxShadow: '0 4px 20px rgba(139,92,246,0.25)',
                      } : {
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
                      }}>
                      {msg.pinned && (
                        <div 
                          className={`absolute -top-2 ${msg.role === 'user' ? '-left-2' : '-right-2'} bg-violet-600 text-white p-1 rounded-full shadow-lg border border-violet-400/50 z-10 flex items-center justify-center`}
                          title="Pinned message"
                        >
                          <Pin size={10} className="fill-white" />
                        </div>
                      )}
                      {msg.role === 'model' ? (
                        <>
                          {msg.streaming && !msg.text ? (
                            <span className="inline-flex gap-1.5 items-center py-1">
                              {[0, 1, 2].map(i => (
                                <span key={i} style={{
                                  width: 7, height: 7, borderRadius: '50%',
                                  background: 'rgba(139,92,246,0.7)',
                                  display: 'inline-block',
                                  animation: `omni-typing-dot 1.2s ${i * 0.2}s ease-in-out infinite`,
                                }} />
                              ))}
                            </span>
                          ) : (
                            <div className="prose prose-invert prose-sm max-w-none prose-p:my-1.5 prose-pre:bg-black/50 prose-pre:border prose-pre:border-white/10 prose-code:text-violet-300 prose-code:bg-violet-950/50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-headings:text-white prose-headings:font-semibold">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                            </div>
                          )}
                          <div className="absolute -bottom-5 left-2 flex items-center gap-1.5">
                            <CopyButton text={msg.text} />
                            <button
                              onClick={(e) => togglePinMessage(msg.id, e)}
                              className={`p-1 rounded transition-all text-xs flex items-center gap-1 ${
                                msg.pinned 
                                  ? 'opacity-100 text-violet-400 font-medium' 
                                  : 'opacity-0 group-hover:opacity-100 text-white/30 hover:text-white/70'
                              }`}
                              title={msg.pinned ? "Unpin message" : "Pin message to top"}
                            >
                              {msg.pinned ? <Pin size={12} className="fill-violet-400/50" /> : <Pin size={12} />}
                            </button>
                          </div>
                        </>
                      ) : (
                        <div>
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="flex flex-col gap-2 mb-2 max-w-full">
                              {msg.attachments.map((att, i) => {
                                const dataUrl = `data:${att.type};base64,${att.base64}`;
                                if (att.type.startsWith('image/')) {
                                  return (
                                    <img 
                                      key={i} 
                                      src={dataUrl} 
                                      alt={att.name} 
                                      className="max-w-xs max-h-60 rounded-lg object-contain bg-black/5 border border-white/10" 
                                    />
                                  );
                                } else if (att.type.startsWith('video/')) {
                                  return (
                                    <video 
                                      key={i} 
                                      src={dataUrl} 
                                      controls 
                                      className="max-w-xs max-h-60 rounded-lg bg-black/5 border border-white/10" 
                                    />
                                  );
                                } else {
                                  const isPdf = att.type === 'application/pdf';
                                  const isZip = att.type.includes('zip') || att.type.includes('compressed') || att.name.endsWith('.zip');
                                  return (
                                    <a 
                                      key={i} 
                                      href={dataUrl} 
                                      download={att.name}
                                      className="flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-medium transition-colors max-w-xs bg-white/10 border-white/20 text-white hover:bg-white/20"
                                    >
                                      {isPdf ? (
                                        <FileText size={18} className="text-red-400" />
                                      ) : isZip ? (
                                        <Archive size={18} className="text-amber-400" />
                                      ) : (
                                        <FileText size={18} className="text-slate-400" />
                                      )}
                                      <span className="truncate flex-1 max-w-[150px]">{att.name}</span>
                                      <Download size={14} className="shrink-0 opacity-60" />
                                    </a>
                                  );
                                }
                              })}
                            </div>
                          )}
                          <p className="whitespace-pre-wrap">{msg.text}</p>
                          <div className="absolute -bottom-5 right-2 flex items-center gap-1.5">
                            <button
                              onClick={(e) => togglePinMessage(msg.id, e)}
                              className={`p-1 rounded transition-all text-xs flex items-center gap-1 ${
                                msg.pinned 
                                  ? 'opacity-100 text-violet-400 font-medium' 
                                  : 'opacity-0 group-hover:opacity-100 text-white/30 hover:text-white/70'
                              }`}
                              title={msg.pinned ? "Unpin message" : "Pin message to top"}
                            >
                              {msg.pinned ? <Pin size={12} className="fill-violet-400/50" /> : <Pin size={12} />}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* ── Input bar ─────────────────────────────── */}
          <div className="shrink-0 px-4 pb-5 pt-2 relative z-10">
            <div className="max-w-2xl mx-auto font-sans">
              {/* Workspace Widget */}
              {showWorkspace && (
                <div className="mb-4">
                  <WorkspaceWidget 
                    onInsertText={(text) => setInput(prev => prev + (prev ? '\n' : '') + text)} 
                    onAttachFile={(name, type, base64) => setAttachments(prev => [...prev, { name, type, base64 }])}
                    onClose={() => setShowWorkspace(false)} 
                  />
                </div>
              )}

              {/* Attachments Preview */}
              {attachments.length > 0 && (
                <div className="flex flex-col gap-2 mb-3 max-w-2xl mx-auto px-1">
                  {/* Quick Action Chips when Images are attached */}
                  {attachments.some(a => a.type.startsWith('image/')) && (
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                      <span className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider flex items-center gap-1 shrink-0">
                        <ScanEye size={12} /> Image OCR:
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const firstImg = attachments.find(a => a.type.startsWith('image/'));
                          if (firstImg) {
                            setOcrActiveImage({
                              src: firstImg.base64,
                              name: firstImg.name,
                              type: firstImg.type
                            });
                          }
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-semibold hover:bg-cyan-500/25 transition-all shrink-0 cursor-pointer"
                      >
                        <ScanEye size={12} />
                        <span>Extract Text (OCR)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setInput(prev => prev + (prev ? ' ' : '') + 'Extract and analyze all text from the attached image, then answer questions about it.');
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-violet-500/15 border border-violet-500/30 text-violet-300 font-medium hover:bg-violet-500/25 transition-all shrink-0 cursor-pointer"
                      >
                        <HelpCircle size={12} />
                        <span>Ask about image text</span>
                      </button>
                    </div>
                  )}

                  {/* Attachment Tiles */}
                  <div className="flex flex-wrap gap-2">
                    {attachments.map((att, idx) => {
                      const isImg = att.type.startsWith('image/');
                      const isPdf = att.type === 'application/pdf';
                      const isZip = att.type.includes('zip') || att.type.includes('compressed') || att.name.endsWith('.zip');
                      return (
                        <div 
                          key={idx} 
                          className="relative flex items-center gap-2 pl-2 pr-14 py-1.5 rounded-xl border border-white/10 bg-white/5 text-slate-200 text-xs animate-in fade-in-50 duration-200"
                        >
                          {isImg ? (
                            <img 
                              src={`data:${att.type};base64,${att.base64}`} 
                              alt={att.name} 
                              className="w-8 h-8 rounded-md object-cover bg-black/5" 
                            />
                          ) : isPdf ? (
                            <FileText size={16} className="text-red-400 shrink-0" />
                          ) : isZip ? (
                            <Archive size={16} className="text-amber-400 shrink-0" />
                          ) : att.type.startsWith('video/') ? (
                            <Video size={16} className="text-indigo-400 shrink-0" />
                          ) : (
                            <FileText size={16} className="text-slate-400 shrink-0" />
                          )}
                          <span className="max-w-[120px] truncate font-medium">{att.name}</span>

                          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                            {isImg && (
                              <button
                                type="button"
                                onClick={() => {
                                  setOcrActiveImage({
                                    src: att.base64,
                                    name: att.name,
                                    type: att.type
                                  });
                                }}
                                className="p-1 rounded-md bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors cursor-pointer"
                                title="Scan OCR Text"
                              >
                                <ScanEye size={12} />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => removeAttachment(idx)}
                              className="p-1 rounded-md hover:bg-red-500/15 text-red-500 transition-colors cursor-pointer"
                              title="Remove file"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div
                className="flex items-end gap-2 rounded-2xl px-3 py-2.5 transition-all"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: `1px solid ${inputFocused ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.08)'}`,
                  boxShadow: inputFocused
                    ? '0 0 0 3px rgba(139,92,246,0.08), 0 8px 32px rgba(0,0,0,0.3)'
                    : '0 4px 20px rgba(0,0,0,0.25)',
                  backdropFilter: 'blur(20px)',
                  animation: isLoading ? 'omni-border-glow 1.8s ease-in-out infinite' : undefined,
                }}
              >
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading || isTranscribing}
                  title="Attach file (Photo, Video, PDF, ZIP)"
                  className="p-1.5 rounded-lg transition-all shrink-0 mb-0.5 text-white/30 hover:text-white/60 disabled:opacity-40"
                >
                  <Plus size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowWorkspace(!showWorkspace)}
                  disabled={isLoading || isTranscribing}
                  title="Google Workspace Assistant"
                  className={`p-1.5 rounded-lg transition-all shrink-0 mb-0.5 ${showWorkspace ? 'text-cyan-400 bg-cyan-500/10' : 'text-white/30 hover:text-white/60'} disabled:opacity-40`}
                >
                  <Briefcase size={16} />
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  className="hidden" 
                  multiple 
                  accept="image/*,video/*,application/pdf,application/zip,application/x-zip-compressed,.zip" 
                />

                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isLoading || isTranscribing}
                  title={isRecording ? 'Stop' : 'Voice input'}
                  className="p-1.5 rounded-lg transition-all shrink-0 mb-0.5 disabled:opacity-40"
                  style={{
                    color: isRecording ? '#f87171' : 'rgba(255,255,255,0.3)',
                    background: isRecording ? 'rgba(239,68,68,0.15)' : 'transparent',
                    animation: isRecording ? 'omni-glow 1s ease-in-out infinite' : undefined,
                  }}
                >
                  {isRecording ? <Square size={16} className="fill-current" /> : <Mic size={16} />}
                </button>

                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={input}
                  onChange={e => { setInput(e.target.value); autoResize(); }}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setInputFocused(false)}
                  disabled={isLoading || isTranscribing || isRecording}
                  placeholder={isTranscribing ? 'Transcribing…' : isRecording ? 'Listening…' : 'Message Omni…'}
                  className="flex-1 bg-transparent resize-none outline-none text-sm leading-relaxed disabled:opacity-50 py-0.5"
                  style={{ color: 'rgba(255,255,255,0.9)', caretColor: '#8b5cf6', maxHeight: 160 }}
                />

                <button
                  onClick={() => sendMessage(input)}
                  disabled={(!input.trim() && attachments.length === 0) || isLoading || isTranscribing}
                  className="p-1.5 rounded-xl transition-all shrink-0 mb-0.5 disabled:cursor-not-allowed"
                  style={{
                    background: (input.trim() || attachments.length > 0) && !isLoading && !isTranscribing
                      ? 'linear-gradient(135deg,#8b5cf6,#6366f1)'
                      : 'rgba(255,255,255,0.05)',
                    color: (input.trim() || attachments.length > 0) && !isLoading && !isTranscribing ? 'white' : 'rgba(255,255,255,0.2)',
                    boxShadow: (input.trim() || attachments.length > 0) && !isLoading && !isTranscribing
                      ? '0 4px 14px rgba(139,92,246,0.4)'
                      : 'none',
                    transform: (input.trim() || attachments.length > 0) && !isLoading && !isTranscribing ? 'scale(1)' : 'scale(0.95)',
                  }}
                >
                  {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} style={{ transform: 'translateX(1px)' }} />}
                </button>
              </div>

              <p className="text-center mt-2" style={{ color: 'rgba(255,255,255,0.15)', fontSize: 10 }}>
                Enter to send · Shift+Enter for new line
              </p>
            </div>
          </div>
        </div>

        {/* ── Omni Sidebar (Desktop) ───────────────── */}
        <AnimatePresence initial={false}>
          {showHistory && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 260, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 34 }}
              className="hidden md:flex flex-row justify-end border-l shrink-0 relative z-10 overflow-hidden h-full"
              style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(11,13,20,0.6)', backdropFilter: 'blur(20px)', willChange: 'width, opacity' }}
            >
              <div style={{ width: '260px' }} className="flex flex-col h-full shrink-0">
                <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  <span className="text-xs font-semibold uppercase tracking-wider text-violet-300">History</span>
                  <button 
                    onClick={createNewChat} 
                    title="New Chat"
                    className="p-1.5 rounded-lg transition-colors hover:bg-white/5 text-violet-300 hover:text-white"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1 hide-scrollbar">
                  {conversations.map(conv => (
                    <div 
                      key={conv.id}
                      onClick={() => setCurrentConversationId(conv.id)}
                      className={`group flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all border ${
                        currentConversationId === conv.id 
                          ? 'bg-violet-950/20 text-white border-violet-500/30 shadow-md shadow-violet-950/20' 
                          : 'hover:bg-white/5 text-slate-400 hover:text-slate-200 border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
                        <MessageSquare size={14} className="shrink-0 opacity-60 text-violet-400" />
                        <span className="text-xs truncate font-medium">{conv.title}</span>
                      </div>
                      <button 
                        onClick={(e) => deleteConversation(conv.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-red-400 transition-all ml-1 shrink-0"
                        title="Delete Chat"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile History Drawer Overlay */}
        {isMobileHistoryOpen && (
          <div 
            className="fixed inset-0 bg-black/70 z-50 md:hidden backdrop-blur-sm"
            onClick={() => setIsMobileHistoryOpen(false)}
          >
            <div 
              className="absolute right-0 top-0 bottom-0 w-64 p-4 flex flex-col"
              style={{ background: '#0e111a', borderLeft: '1px solid rgba(255,255,255,0.08)' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center pb-4 border-b mb-4" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                <span className="text-sm font-semibold uppercase tracking-wider text-violet-300">History</span>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => { createNewChat(); setIsMobileHistoryOpen(false); }} 
                    title="New Chat"
                    className="p-1.5 rounded-lg transition-colors hover:bg-white/5 text-violet-300 hover:text-white"
                  >
                    <Plus size={16} />
                  </button>
                  <button 
                    onClick={() => setIsMobileHistoryOpen(false)}
                    className="p-1.5 rounded-lg transition-colors hover:bg-white/5 text-slate-400"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto space-y-1 hide-scrollbar">
                {conversations.map(conv => (
                  <div 
                    key={conv.id}
                    onClick={() => { setCurrentConversationId(conv.id); setIsMobileHistoryOpen(false); }}
                    className={`group flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all border ${
                      currentConversationId === conv.id 
                        ? 'bg-violet-950/20 text-white border-violet-500/30' 
                        : 'hover:bg-white/5 text-slate-400 hover:text-slate-200 border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
                      <MessageSquare size={14} className="shrink-0 opacity-60 text-violet-400" />
                      <span className="text-xs truncate font-medium">{conv.title}</span>
                    </div>
                    <button 
                      onClick={(e) => deleteConversation(conv.id, e)}
                      className="p-1 rounded hover:bg-red-500/20 text-red-400 transition-all ml-1 shrink-0"
                      title="Delete Chat"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {ocrActiveImage && (
          <OcrModal
            isOpen={!!ocrActiveImage}
            onClose={() => setOcrActiveImage(null)}
            imageSrc={ocrActiveImage.src}
            mimeType={ocrActiveImage.type}
            fileName={ocrActiveImage.name}
            onInsertText={(extracted) => {
              setInput(prev => prev + (prev ? '\n\n' : '') + extracted);
            }}
            onAskQuestion={(extracted) => {
              setInput(`Here is the text extracted from the image "${ocrActiveImage.name}":\n\n"""\n${extracted}\n"""\n\nQuestion regarding this text: `);
            }}
          />
        )}
      </div>
    </>
  );
};
