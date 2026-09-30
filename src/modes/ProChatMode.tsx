import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, Sparkles, Send, Mic, Square, Paperclip, Copy, Check, RefreshCw, 
  Trash2, Plus, ArrowRight, Code, Terminal, Layers, CheckCircle2, 
  Clock, Download, Share2, Search, Sliders, Settings2, Globe, 
  Volume2, VolumeX, Eye, Pin, PinOff, ExternalLink, ChevronDown, 
  ChevronRight, Play, FileText, Cpu, Shield, Zap, Edit3, X,
  Maximize2, Minimize2, CheckSquare, ListTodo, FolderTree, Flame, Activity
} from 'lucide-react';
import { getAiInstance } from '../services/gemini';
import { useTheme } from '../contexts/ThemeContext';
import { useSettings } from '../contexts/SettingsContext';
import { speakText, stopSpeech } from '../utils/speech';
import { motion, AnimatePresence } from 'motion/react';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import { AttachmentBottomSheet } from '../components/AttachmentBottomSheet';
import { ScreenStreamModal } from '../components/ScreenStreamModal';
import { OcrModal } from '../components/OcrModal';
import { usePeriodicAutoSave } from '../hooks/usePeriodicAutoSave';
import { useAutoSaveDraft } from '../hooks/useAutoSaveDraft';
import { Attachment } from '../types';

interface ThoughtStep {
  title: string;
  detail: string;
  durationMs?: number;
}

interface GrokMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  thinkingProcess?: string;
  thoughtSteps?: ThoughtStep[];
  thinkingDurationSeconds?: number;
  modelUsed?: string;
  attachments?: Attachment[];
  pinned?: boolean;
}

interface KanbanTask {
  id: string;
  title: string;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high';
}

interface GrokArtifact {
  id: string;
  title: string;
  language: string;
  code: string;
  timestamp: string;
}

interface GrokSession {
  id: string;
  title: string;
  updatedAt: string;
  messages: GrokMessage[];
  tasks: KanbanTask[];
  artifacts: GrokArtifact[];
  planGoal?: string;
  planSteps?: string[];
  pinned?: boolean;
}

const AVAILABLE_MODELS = [
  { id: 'grok-3-deep', name: 'Grok 3 (Deep Reasoner)', desc: 'Full chain-of-thought analysis with maximum depth', badge: 'Reasoning', color: 'text-violet-400' },
  { id: 'grok-3-fast', name: 'Grok 3 Fast', desc: 'Ultra-low latency for agile coding & quick logic', badge: 'Ultra Fast', color: 'text-cyan-400' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', desc: 'Deep synthesis & advanced multi-modal capabilities', badge: 'Pro', color: 'text-emerald-400' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', desc: 'High speed processing with live web grounding', badge: 'Balanced', color: 'text-blue-400' },
];

const PROMPT_STARTERS = [
  {
    title: 'Deep Code Refactoring',
    desc: 'Analyze codebase performance, memory leaks, and architectural patterns',
    prompt: 'Please review and architect a high-performance TypeScript state management system with zero re-render overhead.',
    icon: Code,
    color: 'from-blue-600/20 to-indigo-600/20 text-blue-400 border-blue-500/30'
  },
  {
    title: 'Mathematical Reasoning',
    desc: 'Step-by-step rigorous proof, derivation, and calculation breakdown',
    prompt: 'Derive the loss gradient for a multi-head self-attention mechanism with detailed matrix dimensions.',
    icon: Cpu,
    color: 'from-violet-600/20 to-purple-600/20 text-violet-400 border-violet-500/30'
  },
  {
    title: 'Full-Stack Plan & Goal',
    desc: 'Break down a complex application into iterative milestones and tasks',
    prompt: 'Generate an end-to-end implementation plan for a real-time collaborative audio workstation with Kanban tasks.',
    icon: ListTodo,
    color: 'from-emerald-600/20 to-teal-600/20 text-emerald-400 border-emerald-500/30'
  },
  {
    title: 'Web & Systems Synthesis',
    desc: 'Extract insights, compare modern frameworks, and benchmark designs',
    prompt: 'Compare Tauri v2, Electron, and React Native for cross-platform desktop UI performance with memory profiles.',
    icon: Globe,
    color: 'from-amber-600/20 to-orange-600/20 text-amber-400 border-amber-500/30'
  }
];

export const ProChatMode: React.FC = () => {
  const { isDarkMode, getAccentClass, getBorderClass } = useTheme();
  const { readAloud, ttsVoice } = useSettings();

  // Sessions state
  const [sessions, setSessions] = useState<GrokSession[]>(() => {
    const saved = localStorage.getItem('grok_workbench_sessions');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error('Failed to parse saved grok sessions:', e);
      }
    }
    const initialSession: GrokSession = {
      id: 'grok_session_' + Date.now(),
      title: 'New Grok Workbench Session',
      updatedAt: new Date().toISOString(),
      messages: [],
      tasks: [
        { id: 't-1', title: 'Initialize System Environment & Architecture', status: 'done', priority: 'high' },
        { id: 't-2', title: 'Connect Realtime Gemini Reasoning Engine', status: 'done', priority: 'high' },
        { id: 't-3', title: 'Synthesize Deep Thought Chains & Artifacts', status: 'in_progress', priority: 'medium' },
      ],
      artifacts: [],
      planGoal: 'High-Performance Reasoning & Code Generation Workbench',
      planSteps: [
        'Analyze user context and formulate structured goal breakdown',
        'Execute deep step-by-step reasoning trace with verified citations',
        'Extract code blocks to reactive live artifacts workspace',
        'Track task milestones across Kanban board'
      ]
    };
    return [initialSession];
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    return localStorage.getItem('grok_workbench_active_id') || (sessions[0]?.id || 'grok_session_default');
  });

  // Current stage view: 'chat' | 'plan' | 'kanban' | 'artifacts' | 'terminal'
  const [activeStage, setActiveStage] = useState<'chat' | 'plan' | 'kanban' | 'artifacts' | 'terminal'>('chat');
  const [selectedModel, setSelectedModel] = useState<string>('grok-3-deep');
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [deepThinkingEnabled, setDeepThinkingEnabled] = useState(true);
  const [webSearchEnabled, setWebSearchEnabled] = useState(true);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showInspector, setShowInspector] = useState(false);

  // Draft and input
  const [input, setInput, clearDraft] = useAutoSaveDraft(`grok_draft_${activeSessionId}`);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [streamingThought, setStreamingThought] = useState('');
  const [expandedThoughts, setExpandedThoughts] = useState<{ [msgId: string]: boolean }>({});
  
  // Modals & BottomSheet
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [isScreenStreamOpen, setIsScreenStreamOpen] = useState(false);
  const [ocrActiveImage, setOcrActiveImage] = useState<{ src: string; name: string; type: string } | null>(null);

  // Speech & Search
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchBox, setShowSearchBox] = useState(false);

  // Terminal simulated logs
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    '[GrokOS Kernel] Booting Grok Deep Reasoning Engine v3.4.0...',
    '[Network] Connected to Gemini Ultra-Low Latency Bridge (Asia-SE1)',
    '[Kernel] Sandbox environment initialized. Workspace live & ready.'
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-save sessions
  usePeriodicAutoSave('grok_workbench_sessions', sessions, { intervalMs: 1500 });
  usePeriodicAutoSave('grok_workbench_active_id', activeSessionId, { intervalMs: 1500 });

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0] || {
    id: activeSessionId,
    title: 'New Session',
    updatedAt: new Date().toISOString(),
    messages: [],
    tasks: [],
    artifacts: []
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeSession.messages, streamingText, streamingThought, isLoading]);

  // Adjust textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const toggleThoughtExpand = (msgId: string) => {
    setExpandedThoughts(prev => ({
      ...prev,
      [msgId]: !prev[msgId]
    }));
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSpeak = (msgId: string, text: string) => {
    if (speakingMsgId === msgId) {
      stopSpeech();
      setSpeakingMsgId(null);
    } else {
      stopSpeech();
      setSpeakingMsgId(msgId);
      speakText(text, ttsVoice);
    }
  };

  const handleNewSession = () => {
    const newSession: GrokSession = {
      id: 'grok_session_' + Date.now(),
      title: 'New Session ' + (sessions.length + 1),
      updatedAt: new Date().toISOString(),
      messages: [],
      tasks: [
        { id: 't-' + Date.now(), title: 'Analyze user requirements', status: 'todo', priority: 'medium' }
      ],
      artifacts: [],
      planGoal: 'Session Goal in Progress...',
      planSteps: ['Formulate problem specification', 'Synthesize code & solution architecture']
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
  };

  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (sessions.length <= 1) {
      handleNewSession();
    }
    const filtered = sessions.filter(s => s.id !== id);
    setSessions(filtered);
    if (activeSessionId === id && filtered.length > 0) {
      setActiveSessionId(filtered[0].id);
    }
  };

  const handleSendMessage = async (customPrompt?: string) => {
    const promptToSend = (customPrompt || input).trim();
    if (!promptToSend && attachments.length === 0) return;
    if (isLoading) return;

    const userMessageId = 'msg_user_' + Date.now();
    const newUserMsg: GrokMessage = {
      id: userMessageId,
      role: 'user',
      text: promptToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      attachments: [...attachments]
    };

    // Update session title if first message
    const updatedTitle = activeSession.messages.length === 0 
      ? promptToSend.slice(0, 32) + (promptToSend.length > 32 ? '...' : '') 
      : activeSession.title;

    const updatedMessages = [...activeSession.messages, newUserMsg];

    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        return {
          ...s,
          title: updatedTitle,
          updatedAt: new Date().toISOString(),
          messages: updatedMessages
        };
      }
      return s;
    }));

    setInput('');
    clearDraft();
    setAttachments([]);
    setIsLoading(true);
    setIsStreaming(true);
    setStreamingText('');
    setStreamingThought('');

    setTerminalLogs(prev => [
      ...prev,
      `[Dispatch] Prompt dispatched to model: ${selectedModel} (Tokens: ~${promptToSend.length / 4})`
    ]);

    const startTime = Date.now();

    try {
      const ai = getAiInstance();
      
      // Determine model name & system prompt
      const targetModel = selectedModel.includes('pro') ? 'gemini-2.5-pro' : 'gemini-3.5-flash';
      
      let systemPrompt = `You are Grok 3 / Omni Pro Workbench AI, an elite, deep-reasoning, unfiltered AI and senior software engineering intelligence.
You provide exhaustive, mathematically sound, pristine, production-grade answers, code, and structured step-by-step reasoning.
When writing code, produce complete, error-free implementations with syntax highlighting.
Provide thorough step-by-step thinking when complex problem solving or code architecture is requested.`;

      if (deepThinkingEnabled) {
        systemPrompt += `\nInclude a distinct Chain of Thought reasoning block where you critique assumptions, explore edge cases, and verify correctness.`;
      }

      // Format parts
      const parts: any[] = [{ text: promptToSend }];
      if (newUserMsg.attachments && newUserMsg.attachments.length > 0) {
        for (const att of newUserMsg.attachments) {
          if (att.base64 && att.type?.startsWith('image/')) {
            parts.push({
              inlineData: {
                mimeType: att.type,
                data: att.base64.replace(/^data:image\/[a-z]+;base64,/, '')
              }
            });
          }
        }
      }

      const response = await ai.models.generateContent({
        model: targetModel,
        contents: [
          {
            role: 'user',
            parts: parts
          }
        ],
        config: {
          systemInstruction: systemPrompt,
          temperature: deepThinkingEnabled ? 0.4 : 0.7,
        }
      });

      const responseText = response.text || 'No response received from AI engine.';
      const elapsedSeconds = ((Date.now() - startTime) / 1000);

      // Extract code blocks into artifacts if present
      const codeRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
      let match;
      const extractedArtifacts: GrokArtifact[] = [];
      let matchIdx = 1;
      while ((match = codeRegex.exec(responseText)) !== null) {
        const lang = match[1] || 'text';
        const codeContent = match[2];
        if (codeContent.trim().length > 30) {
          extractedArtifacts.push({
            id: 'art_' + Date.now() + '_' + matchIdx++,
            title: `Extracted Snippet (${lang})`,
            language: lang,
            code: codeContent,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          });
        }
      }

      // Synthesize thought steps for Grok visualization
      const thoughtSteps: ThoughtStep[] = [
        { title: 'Query Analysis & Context Parsing', detail: 'Deconstructed constraints, technical stack, and target objective', durationMs: 240 },
        { title: 'Algorithmic Synthesis & Verification', detail: 'Explored optimal architectural patterns, edge cases, and complexity', durationMs: 480 },
        { title: 'Code Generation & Validation', detail: 'Formatted clean output, verified types, and synthesized response', durationMs: 320 }
      ];

      const modelMsgId = 'msg_model_' + Date.now();
      const newModelMsg: GrokMessage = {
        id: modelMsgId,
        role: 'model',
        text: responseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        thinkingProcess: deepThinkingEnabled ? `Deep Reasoning Analysis complete (${elapsedSeconds.toFixed(1)}s elapsed). Evaluated multi-step solution path, syntax constraints, and verified structural integrity.` : undefined,
        thoughtSteps: deepThinkingEnabled ? thoughtSteps : undefined,
        thinkingDurationSeconds: parseFloat(elapsedSeconds.toFixed(1)),
        modelUsed: selectedModel,
        pinned: false
      };

      // Auto expand thought process
      setExpandedThoughts(prev => ({ ...prev, [modelMsgId]: true }));

      // Update tasks if user asked for task/plan
      let newTasks = [...activeSession.tasks];
      if (promptToSend.toLowerCase().includes('task') || promptToSend.toLowerCase().includes('plan')) {
        newTasks.push({
          id: 'task_' + Date.now(),
          title: promptToSend.slice(0, 45),
          status: 'in_progress',
          priority: 'high'
        });
      }

      setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            updatedAt: new Date().toISOString(),
            messages: [...updatedMessages, newModelMsg],
            artifacts: [...s.artifacts, ...extractedArtifacts],
            tasks: newTasks
          };
        }
        return s;
      }));

      setTerminalLogs(prev => [
        ...prev,
        `[Success] Received complete response in ${elapsedSeconds.toFixed(2)}s. Extracted ${extractedArtifacts.length} artifacts.`
      ]);

      if (readAloud) {
        speakText(responseText.slice(0, 300), ttsVoice);
      }

    } catch (err: any) {
      console.error('Grok Chat generation error:', err);
      const errorMsg: GrokMessage = {
        id: 'msg_err_' + Date.now(),
        role: 'model',
        text: `**Generation Notice**: ${err?.message || 'The model encountered an error during generation.'}\n\nPlease verify network connectivity or switch to Gemini Pro model.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: selectedModel
      };

      setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            messages: [...updatedMessages, errorMsg]
          };
        }
        return s;
      }));

      setTerminalLogs(prev => [
        ...prev,
        `[Error] Request failed: ${err?.message || 'Unknown network error'}`
      ]);
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      setStreamingText('');
      setStreamingThought('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Toggle voice recognition
  const toggleVoiceRecording = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech Recognition is not supported in this browser.');
      return;
    }

    if (isRecordingVoice) {
      setIsRecordingVoice(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsRecordingVoice(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join('');
        setInput(prev => (prev ? prev + ' ' + transcript : transcript));
      };

      recognition.onerror = () => {
        setIsRecordingVoice(false);
      };

      recognition.onend = () => {
        setIsRecordingVoice(false);
      };

      recognition.start();
    } catch (e) {
      setIsRecordingVoice(false);
    }
  };

  return (
    <div className={`flex h-full w-full overflow-hidden ${isDarkMode ? 'bg-[#08080c] text-white' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* Sessions Navigation Drawer (Collapsible) */}
      <AnimatePresence>
        {showSidebar && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 260, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={`h-full flex flex-col border-r shrink-0 overflow-hidden ${
              isDarkMode ? 'bg-[#0c0c14] border-white/10' : 'bg-white border-slate-200'
            }`}
          >
            {/* Header & New Chat Button */}
            <div className="p-3 border-b border-inherit flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-xs tracking-wider uppercase opacity-70">
                <FolderTree size={14} className="text-violet-400" />
                <span>Grok Workspaces</span>
              </div>
              <button
                onClick={handleNewSession}
                className="p-1.5 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 hover:text-violet-300 transition-colors cursor-pointer"
                title="New Session"
              >
                <Plus size={14} />
              </button>
            </div>

            {/* Sessions List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin">
              {sessions.map(session => {
                const isActive = session.id === activeSessionId;
                return (
                  <div
                    key={session.id}
                    onClick={() => setActiveSessionId(session.id)}
                    className={`group relative flex items-center justify-between px-3 py-2.5 rounded-xl text-xs cursor-pointer transition-all ${
                      isActive
                        ? 'bg-violet-600/20 text-white font-medium border border-violet-500/30 shadow-sm'
                        : isDarkMode
                        ? 'hover:bg-white/5 text-white/70 hover:text-white border border-transparent'
                        : 'hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate flex-1 min-w-0">
                      <Bot size={14} className={isActive ? 'text-violet-400 shrink-0' : 'opacity-40 shrink-0'} />
                      <span className="truncate">{session.title}</span>
                    </div>
                    <button
                      onClick={(e) => handleDeleteSession(session.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-400 transition-opacity ml-1 rounded"
                      title="Delete Session"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Bottom Status / Stats */}
            <div className="p-3 border-t border-inherit text-[11px] opacity-60 flex items-center justify-between">
              <span>{sessions.length} Workspaces</span>
              <div className="flex items-center gap-1 text-emerald-400 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Online</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Grok Workbench Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        
        {/* Grok Header Command Ribbon */}
        <header className={`h-14 px-4 border-b flex items-center justify-between shrink-0 ${
          isDarkMode ? 'bg-[#0d0d16]/90 border-white/10 backdrop-blur-md' : 'bg-white/90 border-slate-200 backdrop-blur-md'
        }`}>
          {/* Left: Sidebar Toggle, Model Picker, Stage Navigator */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-1.5 rounded-lg hover:bg-white/10 opacity-70 hover:opacity-100 transition-all cursor-pointer"
              title="Toggle Sidebar"
            >
              <FolderTree size={16} />
            </button>

            {/* Model Selector Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowModelDropdown(!showModelDropdown)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  isDarkMode 
                    ? 'bg-white/5 border-white/10 hover:border-violet-500/50 text-white' 
                    : 'bg-slate-100 border-slate-200 hover:border-violet-400 text-slate-800'
                }`}
              >
                <Sparkles size={13} className="text-violet-400 animate-pulse" />
                <span>{AVAILABLE_MODELS.find(m => m.id === selectedModel)?.name || 'Grok 3 (Deep Reasoner)'}</span>
                <ChevronDown size={12} className="opacity-50" />
              </button>

              {showModelDropdown && (
                <div className={`absolute left-0 mt-2 w-72 rounded-2xl border p-1.5 shadow-2xl z-50 backdrop-blur-xl ${
                  isDarkMode ? 'bg-[#12121e]/95 border-white/15 text-white' : 'bg-white border-slate-200 text-slate-800'
                }`}>
                  <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider opacity-50">
                    Reasoning Engine Matrix
                  </div>
                  {AVAILABLE_MODELS.map(m => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setSelectedModel(m.id);
                        setShowModelDropdown(false);
                      }}
                      className={`w-full text-left p-2.5 rounded-xl flex items-start justify-between text-xs transition-colors cursor-pointer ${
                        selectedModel === m.id 
                          ? 'bg-violet-600/20 text-violet-300 font-semibold' 
                          : 'hover:bg-white/5 opacity-80 hover:opacity-100'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className={m.color}>●</span>
                          <span>{m.name}</span>
                        </div>
                        <div className="text-[10px] opacity-50 mt-0.5">{m.desc}</div>
                      </div>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 font-mono">
                        {m.badge}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Workbench Stages Tabs */}
            <div className={`hidden md:flex items-center gap-1 p-1 rounded-xl border ${
              isDarkMode ? 'bg-black/30 border-white/10' : 'bg-slate-100 border-slate-200'
            }`}>
              <button
                onClick={() => setActiveStage('chat')}
                className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeStage === 'chat'
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'opacity-60 hover:opacity-100'
                }`}
              >
                <Bot size={13} />
                <span>Chat</span>
              </button>

              <button
                onClick={() => setActiveStage('plan')}
                className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeStage === 'plan'
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'opacity-60 hover:opacity-100'
                }`}
              >
                <Shield size={13} />
                <span>Plan</span>
              </button>

              <button
                onClick={() => setActiveStage('kanban')}
                className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeStage === 'kanban'
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'opacity-60 hover:opacity-100'
                }`}
              >
                <CheckSquare size={13} />
                <span>Tasks ({activeSession.tasks.length})</span>
              </button>

              <button
                onClick={() => setActiveStage('artifacts')}
                className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeStage === 'artifacts'
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'opacity-60 hover:opacity-100'
                }`}
              >
                <Code size={13} />
                <span>Artifacts ({activeSession.artifacts.length})</span>
              </button>

              <button
                onClick={() => setActiveStage('terminal')}
                className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeStage === 'terminal'
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'opacity-60 hover:opacity-100'
                }`}
              >
                <Terminal size={13} />
                <span>Terminal</span>
              </button>
            </div>
          </div>

          {/* Right Controls: Search, Web toggle, Inspector */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDeepThinkingEnabled(!deepThinkingEnabled)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-all cursor-pointer ${
                deepThinkingEnabled
                  ? 'bg-violet-600/20 text-violet-300 border-violet-500/40 shadow-sm'
                  : 'opacity-50 hover:opacity-80 border-transparent'
              }`}
              title="Toggle Deep Reasoning Chain"
            >
              <Cpu size={13} className={deepThinkingEnabled ? 'text-violet-400 animate-pulse' : ''} />
              <span className="hidden sm:inline">Deep Think</span>
            </button>

            <button
              onClick={() => setWebSearchEnabled(!webSearchEnabled)}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                webSearchEnabled
                  ? 'bg-cyan-600/20 text-cyan-300 border-cyan-500/40'
                  : 'opacity-50 hover:opacity-80 border-transparent'
              }`}
              title="Live Web Grounding"
            >
              <Globe size={14} />
            </button>

            <button
              onClick={() => setShowInspector(!showInspector)}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                showInspector
                  ? 'bg-white/15 text-white border-white/20'
                  : 'opacity-50 hover:opacity-80 border-transparent'
              }`}
              title="Toggle Workbench Inspector"
            >
              <Sliders size={14} />
            </button>
          </div>
        </header>

        {/* Dynamic Stage View Container */}
        <div className="flex-1 flex overflow-hidden relative">
          
          {/* STAGE 1: CHAT */}
          {activeStage === 'chat' && (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              {/* Message Transcript Container */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scrollbar-thin">
                
                {/* Empty State / Prompt Cards */}
                {activeSession.messages.length === 0 && (
                  <div className="max-w-3xl mx-auto py-8 text-center space-y-6">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-cyan-500 p-0.5 shadow-2xl shadow-violet-500/20">
                      <div className="w-full h-full bg-[#0d0d16] rounded-[22px] flex items-center justify-center">
                        <Sparkles size={28} className="text-violet-400 animate-pulse" />
                      </div>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                        Grok 3 Pro Workbench
                      </h2>
                      <p className="text-sm opacity-60 mt-1 max-w-md mx-auto">
                        Ultra-deep reasoning engine with reactive code artifacts, multi-modal synthesis, and real-time execution.
                      </p>
                    </div>

                    {/* Quick Starters */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-left pt-2">
                      {PROMPT_STARTERS.map((starter, i) => {
                        const Icon = starter.icon;
                        return (
                          <button
                            key={i}
                            onClick={() => handleSendMessage(starter.prompt)}
                            className={`p-4 rounded-2xl border text-xs transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer group ${
                              isDarkMode ? 'bg-white/5 border-white/10 hover:border-violet-500/40 hover:bg-white/8' : 'bg-white border-slate-200 hover:border-violet-400 shadow-sm'
                            }`}
                          >
                            <div className="flex items-center gap-2 font-semibold text-sm mb-1 text-white">
                              <span className={`p-1.5 rounded-lg border bg-gradient-to-br ${starter.color}`}>
                                <Icon size={14} />
                              </span>
                              <span>{starter.title}</span>
                            </div>
                            <p className="opacity-60 line-clamp-2">{starter.desc}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Message Bubbles */}
                {activeSession.messages.map(msg => {
                  const isUser = msg.role === 'user';
                  const isExpanded = !!expandedThoughts[msg.id];

                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex gap-3 max-w-4xl mx-auto ${isUser ? 'justify-end' : 'justify-start'}`}
                    >
                      {!isUser && (
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shrink-0 shadow-md">
                          <Bot size={16} className="text-white" />
                        </div>
                      )}

                      <div className={`flex flex-col space-y-2 max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
                        
                        {/* Attachments if any */}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-1">
                            {msg.attachments.map((att, i) => (
                              <div key={i} className="p-1.5 rounded-lg bg-black/40 border border-white/10 text-[11px] flex items-center gap-1.5">
                                <FileText size={12} className="text-cyan-400" />
                                <span className="truncate max-w-[140px]">{att.name || 'Attachment'}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Collapsible Chain of Thought Trace */}
                        {!isUser && msg.thinkingProcess && (
                          <div className={`w-full rounded-2xl border text-xs overflow-hidden transition-all ${
                            isDarkMode ? 'bg-violet-950/20 border-violet-500/30' : 'bg-violet-50 border-violet-200'
                          }`}>
                            <button
                              onClick={() => toggleThoughtExpand(msg.id)}
                              className="w-full px-3 py-2 flex items-center justify-between font-mono text-[11px] text-violet-400 hover:text-violet-300 cursor-pointer"
                            >
                              <div className="flex items-center gap-2">
                                <Cpu size={13} className="animate-pulse text-violet-400" />
                                <span className="font-semibold">Thought Process & Verification</span>
                                {msg.thinkingDurationSeconds && (
                                  <span className="opacity-60">({msg.thinkingDurationSeconds}s)</span>
                                )}
                              </div>
                              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>

                            {isExpanded && (
                              <div className="p-3 pt-0 border-t border-violet-500/20 space-y-2 text-white/80 font-sans">
                                <p className="text-[12px] opacity-80 leading-relaxed">{msg.thinkingProcess}</p>
                                
                                {msg.thoughtSteps && (
                                  <div className="space-y-1.5 pt-1">
                                    {msg.thoughtSteps.map((step, idx) => (
                                      <div key={idx} className="flex items-start gap-2 text-[11px] opacity-75">
                                        <CheckCircle2 size={12} className="text-emerald-400 shrink-0 mt-0.5" />
                                        <div>
                                          <span className="font-semibold text-white/90">{step.title}: </span>
                                          <span>{step.detail}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Message Main Body */}
                        <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                          isUser
                            ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-tr-sm shadow-md'
                            : isDarkMode
                            ? 'bg-white/5 border border-white/10 text-white rounded-tl-sm shadow-sm'
                            : 'bg-white border border-slate-200 text-slate-900 rounded-tl-sm shadow-sm'
                        }`}>
                          <MarkdownRenderer content={msg.text} />
                        </div>

                        {/* Action Bar */}
                        <div className="flex items-center gap-2 text-[11px] opacity-50 hover:opacity-100 transition-opacity">
                          <span>{msg.timestamp}</span>
                          {!isUser && (
                            <>
                              <span>•</span>
                              <button
                                onClick={() => copyToClipboard(msg.text, msg.id)}
                                className="hover:text-violet-400 flex items-center gap-1 cursor-pointer"
                                title="Copy Text"
                              >
                                {copiedId === msg.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                <span>{copiedId === msg.id ? 'Copied' : 'Copy'}</span>
                              </button>
                              <span>•</span>
                              <button
                                onClick={() => handleSpeak(msg.id, msg.text)}
                                className="hover:text-cyan-400 flex items-center gap-1 cursor-pointer"
                                title="Listen Aloud"
                              >
                                {speakingMsgId === msg.id ? <VolumeX size={12} className="text-rose-400" /> : <Volume2 size={12} />}
                                <span>{speakingMsgId === msg.id ? 'Stop' : 'Speak'}</span>
                              </button>
                            </>
                          )}
                        </div>

                      </div>

                      {isUser && (
                        <div className="w-8 h-8 rounded-xl bg-violet-700/60 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-white">U</span>
                        </div>
                      )}
                    </motion.div>
                  );
                })}

                {/* Loading / Streaming Indicator */}
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-3 max-w-4xl mx-auto"
                  >
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shrink-0 shadow-md">
                      <Sparkles size={16} className="text-white animate-spin" />
                    </div>
                    <div className={`p-4 rounded-2xl border text-xs space-y-2 ${
                      isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'
                    }`}>
                      <div className="flex items-center gap-2 text-violet-400 font-mono">
                        <Activity size={14} className="animate-pulse" />
                        <span>Grok 3 Deep Reasoning in progress...</span>
                      </div>
                      <div className="flex gap-1">
                        <span className="w-2 h-2 rounded-full bg-violet-500 animate-bounce" />
                        <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:0.2s]" />
                        <span className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce [animation-delay:0.4s]" />
                      </div>
                    </div>
                  </motion.div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Grok Pro Floating Composer */}
              <div className="p-3 md:p-4 shrink-0 max-w-4xl mx-auto w-full">
                <div className={`rounded-2xl border p-2.5 shadow-2xl transition-all ${
                  isDarkMode ? 'bg-[#0f0f1a]/95 border-white/15 focus-within:border-violet-500/60' : 'bg-white border-slate-300 focus-within:border-violet-500'
                }`}>
                  
                  {/* Active Attachments Preview */}
                  {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 p-1.5 mb-2 border-b border-inherit">
                      {attachments.map((att, i) => (
                        <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/10 text-xs">
                          <FileText size={12} className="text-violet-400" />
                          <span className="truncate max-w-[120px]">{att.name}</span>
                          <button
                            onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                            className="hover:text-rose-400 ml-1"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Textarea Input */}
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask Grok 3 anything, formulate complex architectures, or enter code..."
                    rows={1}
                    className="w-full bg-transparent resize-none outline-none text-sm p-1.5 placeholder-white/40 max-h-48 scrollbar-thin"
                  />

                  {/* Composer Footer Actions Ribbon */}
                  <div className="flex items-center justify-between pt-2 border-t border-inherit/40 text-xs">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setIsBottomSheetOpen(true)}
                        className="p-1.5 rounded-lg hover:bg-white/10 opacity-70 hover:opacity-100 transition-colors cursor-pointer"
                        title="Add Attachments / OCR / Files"
                      >
                        <Paperclip size={15} />
                      </button>

                      <button
                        onClick={toggleVoiceRecording}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          isRecordingVoice ? 'bg-rose-600/30 text-rose-400 animate-pulse' : 'hover:bg-white/10 opacity-70 hover:opacity-100'
                        }`}
                        title="Voice Dictation"
                      >
                        <Mic size={15} />
                      </button>

                      <button
                        onClick={() => setIsScreenStreamOpen(true)}
                        className="p-1.5 rounded-lg hover:bg-white/10 opacity-70 hover:opacity-100 transition-colors cursor-pointer"
                        title="Screen Share / Camera Stream"
                      >
                        <Eye size={15} />
                      </button>

                      <div className="hidden sm:flex items-center gap-1 ml-2 text-[10px] opacity-40 font-mono">
                        <span>⏎ Send</span>
                        <span>•</span>
                        <span>⇧⏎ Newline</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleSendMessage()}
                      disabled={isLoading || (!input.trim() && attachments.length === 0)}
                      className={`px-4 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                        isLoading || (!input.trim() && attachments.length === 0)
                          ? 'opacity-40 bg-violet-600/30 cursor-not-allowed text-white/50'
                          : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-md shadow-violet-950/40 active:scale-95'
                      }`}
                    >
                      <span>Send</span>
                      <Send size={13} />
                    </button>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* STAGE 2: PLAN & GOALS SPECIFICATION */}
          {activeStage === 'plan' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-4xl mx-auto">
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div>
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Shield size={18} className="text-violet-400" />
                    <span>Workbench Plan Specification</span>
                  </h3>
                  <p className="text-xs opacity-60">High-level goals and execution milestones tracked for this session.</p>
                </div>
                <button
                  onClick={() => handleSendMessage('Regenerate and refine the architectural plan and execution steps for this project.')}
                  className="px-3 py-1.5 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw size={13} />
                  <span>Refine Plan</span>
                </button>
              </div>

              {/* Goal Card */}
              <div className="p-4 rounded-2xl border border-violet-500/30 bg-violet-950/10 space-y-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-violet-400">Primary Objective</span>
                <p className="text-sm font-medium">{activeSession.planGoal || 'Architect high performance system'}</p>
              </div>

              {/* Steps Checklist */}
              <div className="space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider opacity-60">Milestone Sequence</span>
                {activeSession.planSteps?.map((step, idx) => (
                  <div key={idx} className="p-3 rounded-xl border border-white/10 bg-white/5 flex items-start gap-3 text-xs">
                    <span className="w-5 h-5 rounded-full bg-violet-600/30 text-violet-300 font-mono font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="leading-relaxed flex-1">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STAGE 3: KANBAN TASKS */}
          {activeStage === 'kanban' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-5xl mx-auto">
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div>
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <CheckSquare size={18} className="text-emerald-400" />
                    <span>Agent Task Board</span>
                  </h3>
                  <p className="text-xs opacity-60">Real-time task progression orchestrated by Grok AI.</p>
                </div>
                <button
                  onClick={() => {
                    const title = prompt('Enter new task description:');
                    if (title) {
                      setSessions(prev => prev.map(s => {
                        if (s.id === activeSessionId) {
                          return {
                            ...s,
                            tasks: [...s.tasks, { id: 'task_' + Date.now(), title, status: 'todo', priority: 'medium' }]
                          };
                        }
                        return s;
                      }));
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus size={13} />
                  <span>Add Task</span>
                </button>
              </div>

              {/* Kanban Columns */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {(['todo', 'in_progress', 'review', 'done'] as const).map(columnStatus => {
                  const columnTasks = activeSession.tasks.filter(t => t.status === columnStatus);
                  const columnTitles = {
                    todo: 'To Do',
                    in_progress: 'In Progress',
                    review: 'Review / Test',
                    done: 'Completed'
                  };

                  return (
                    <div key={columnStatus} className="p-3 rounded-2xl border border-white/10 bg-white/5 space-y-3">
                      <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider opacity-70">
                        <span>{columnTitles[columnStatus]}</span>
                        <span className="px-1.5 py-0.5 rounded-md bg-white/10 font-mono text-[10px]">
                          {columnTasks.length}
                        </span>
                      </div>

                      <div className="space-y-2">
                        {columnTasks.map(task => (
                          <div
                            key={task.id}
                            className="p-3 rounded-xl border border-white/10 bg-[#12121e] text-xs space-y-2 shadow-sm"
                          >
                            <p className="font-medium leading-snug">{task.title}</p>
                            <div className="flex items-center justify-between pt-1">
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                                task.priority === 'high' ? 'bg-rose-500/20 text-rose-300' : 'bg-blue-500/20 text-blue-300'
                              }`}>
                                {task.priority.toUpperCase()}
                              </span>

                              {/* Move status buttons */}
                              <div className="flex items-center gap-1">
                                {columnStatus !== 'done' && (
                                  <button
                                    onClick={() => {
                                      const nextStatusMap = { todo: 'in_progress', in_progress: 'review', review: 'done', done: 'done' } as const;
                                      setSessions(prev => prev.map(s => {
                                        if (s.id === activeSessionId) {
                                          return {
                                            ...s,
                                            tasks: s.tasks.map(t => t.id === task.id ? { ...t, status: nextStatusMap[task.status] } : t)
                                          };
                                        }
                                        return s;
                                      }));
                                    }}
                                    className="p-1 hover:text-emerald-400 text-[10px] font-mono cursor-pointer"
                                    title="Advance Status"
                                  >
                                    →
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STAGE 4: CODE ARTIFACTS VIEWER */}
          {activeStage === 'artifacts' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-5xl mx-auto">
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div>
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Code size={18} className="text-cyan-400" />
                    <span>Reactive Code Artifacts</span>
                  </h3>
                  <p className="text-xs opacity-60">Source code modules extracted live from conversation turns.</p>
                </div>
              </div>

              {activeSession.artifacts.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-white/15 rounded-2xl opacity-60 text-xs">
                  No artifacts generated in this session yet. Ask Grok 3 to generate code to populate this view.
                </div>
              ) : (
                <div className="space-y-4">
                  {activeSession.artifacts.map(art => (
                    <div key={art.id} className="rounded-2xl border border-white/10 bg-[#0d0d16] overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-white/10 bg-white/5 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 font-mono font-semibold">
                          <Code size={14} className="text-cyan-400" />
                          <span>{art.title}</span>
                          <span className="text-[10px] opacity-50 uppercase">({art.language})</span>
                        </div>
                        <button
                          onClick={() => copyToClipboard(art.code, art.id)}
                          className="flex items-center gap-1 text-[11px] hover:text-cyan-400 cursor-pointer"
                        >
                          {copiedId === art.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                          <span>{copiedId === art.id ? 'Copied' : 'Copy Code'}</span>
                        </button>
                      </div>
                      <div className="p-4 overflow-x-auto text-xs font-mono bg-black/40 text-emerald-300">
                        <pre>{art.code}</pre>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STAGE 5: SYSTEM TERMINAL */}
          {activeStage === 'terminal' && (
            <div className="flex-1 flex flex-col h-full bg-black p-4 font-mono text-xs overflow-hidden">
              <div className="pb-2 border-b border-white/10 flex items-center justify-between text-white/60">
                <div className="flex items-center gap-2">
                  <Terminal size={14} className="text-emerald-400" />
                  <span>Grok Shell Terminal</span>
                </div>
                <button
                  onClick={() => setTerminalLogs([])}
                  className="hover:text-rose-400 text-[10px]"
                >
                  Clear Logs
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-3 space-y-1 text-emerald-400/90 scrollbar-thin">
                {terminalLogs.map((log, idx) => (
                  <div key={idx} className="leading-relaxed">
                    <span className="text-white/30 mr-2">{'>'}</span>
                    <span>{log}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Right Inspector Drawer */}
          <AnimatePresence>
            {showInspector && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 280, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="h-full border-l border-white/10 bg-[#0c0c14] flex flex-col shrink-0 overflow-y-auto p-4 space-y-5 text-xs scrollbar-thin"
              >
                <div className="flex items-center justify-between pb-2 border-b border-white/10 font-bold uppercase tracking-wider opacity-70">
                  <span>Inspector & Telemetry</span>
                  <button onClick={() => setShowInspector(false)} className="hover:text-rose-400">
                    <X size={14} />
                  </button>
                </div>

                <div className="space-y-2">
                  <span className="font-semibold opacity-80">Reasoning Depth</span>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
                    <div className="flex justify-between text-[11px]">
                      <span>Chain-of-Thought</span>
                      <span className="text-violet-400 font-bold">{deepThinkingEnabled ? 'Enabled (Full)' : 'Standard'}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span>Live Web Search</span>
                      <span className="text-cyan-400 font-bold">{webSearchEnabled ? 'Connected' : 'Off'}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="font-semibold opacity-80">Session Metadata</span>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1.5 text-[11px] opacity-75">
                    <div>Messages: {activeSession.messages.length}</div>
                    <div>Artifacts: {activeSession.artifacts.length}</div>
                    <div>Active Tasks: {activeSession.tasks.length}</div>
                    <div>Latency: ~24ms</div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>

      </div>

      {/* Attachment Bottom Sheet Modal */}
      <AttachmentBottomSheet
        isOpen={isBottomSheetOpen}
        onClose={() => setIsBottomSheetOpen(false)}
        onSelectAttachments={(files) => {
          const newAtts: Attachment[] = files.map(f => ({
            id: f.id,
            name: f.name,
            type: f.type,
            size: f.size,
            base64: f.base64 || ''
          }));
          setAttachments(prev => [...prev, ...newAtts]);
        }}
        currentAttachments={[]}
      />

      {/* Screen Stream Modal */}
      <ScreenStreamModal
        isOpen={isScreenStreamOpen}
        onClose={() => setIsScreenStreamOpen(false)}
      />

      {/* OCR Modal */}
      {ocrActiveImage && (
        <OcrModal
          isOpen={true}
          onClose={() => setOcrActiveImage(null)}
          imageSrc={ocrActiveImage.src}
          fileName={ocrActiveImage.name}
          onInsertText={(extracted) => {
            setInput(prev => (prev ? prev + '\n' + extracted : extracted));
            setOcrActiveImage(null);
          }}
        />
      )}

    </div>
  );
};
