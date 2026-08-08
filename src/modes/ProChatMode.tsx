import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Telescope, MessageSquare, Plus, Trash2, Globe, Sparkles, 
  ArrowRight, Compass, TrendingUp, Cpu, BookOpen, Layers, Clock, AlertCircle, X,
  Pin, Archive, Edit2
} from 'lucide-react';
import { getAiInstance } from '../services/gemini';
import { useTheme } from '../contexts/ThemeContext';
import { useSettings } from '../contexts/SettingsContext';
import { speakText, stopSpeech } from '../utils/speech';
import { motion, AnimatePresence } from 'motion/react';
import { SearchBar } from '../components/research/SearchBar';
import { WorkingTimeline } from '../components/research/WorkingTimeline';
import { AnswerView } from '../components/research/AnswerView';
import { WorkspaceWidget } from '../components/WorkspaceWidget';
import { sounds, triggerHaptic } from '../components/PremiumEffects';

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  parts?: any[];
}

interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
  messages: Message[];
  pinned?: boolean;
  archived?: boolean;
}

export const ProChatMode: React.FC = () => {
  const { isDarkMode, getAccentClass, getBorderClass } = useTheme();
  const { readAloud, ttsVoice } = useSettings();

  // Thread lists
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    const saved = localStorage.getItem('omnichat_conversations_chat-pro');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const [activeId, setActiveId] = useState<string | null>(() => {
    return localStorage.getItem('omnichat_active_id_chat-pro') || null;
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showWorkspace, setShowWorkspace] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [optimisticQuery, setOptimisticQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'answer' | 'links'>('answer');
  const [error, setError] = useState<string | null>(null);

  const [selectedModel, setSelectedModel] = useState<'gemini' | 'kimi-k3'>(() => {
    return (localStorage.getItem('omnichat_selected_model_pro') as 'gemini' | 'kimi-k3') || 'gemini';
  });

  useEffect(() => {
    localStorage.setItem('omnichat_selected_model_pro', selectedModel);
  }, [selectedModel]);

  // ChatGPT History Manager State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeHistoryTab, setActiveHistoryTab] = useState<'all' | 'pinned' | 'archived'>('all');
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingChatTitle, setEditingChatTitle] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('omnichat_conversations_chat-pro', JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    if (activeId) {
      localStorage.setItem('omnichat_active_id_chat-pro', activeId);
    } else {
      localStorage.removeItem('omnichat_active_id_chat-pro');
    }
  }, [activeId]);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversations, isLoading, isStreaming, optimisticQuery]);

  useEffect(() => {
    stopSpeech();
  }, [activeId]);

  useEffect(() => {
    return () => {
      stopSpeech();
    };
  }, []);

  const activeConversation = conversations.find(c => c.id === activeId) || null;
  const messages = activeConversation ? activeConversation.messages : [];

  // Filter & Sort conversations for ChatGPT Style Sidebar
  const sortedAndFilteredConversations = React.useMemo(() => {
    const sorted = [...conversations].sort((a, b) => {
      const pinA = a.pinned ? 1 : 0;
      const pinB = b.pinned ? 1 : 0;
      if (pinA !== pinB) {
        return pinB - pinA;
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    return sorted.filter(c => {
      const matchesSearch = c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.messages.some(m => m.text.toLowerCase().includes(searchQuery.toLowerCase()));

      if (activeHistoryTab === 'pinned') {
        return matchesSearch && c.pinned;
      }
      if (activeHistoryTab === 'archived') {
        return matchesSearch && c.archived;
      }
      return matchesSearch && !c.archived;
    });
  }, [conversations, searchQuery, activeHistoryTab]);

  const handleCreateNewChat = () => {
    if (activeConversation && activeConversation.messages.length === 0) {
      return; // Already on an empty chat
    }
    const newChat: Conversation = {
      id: `pro_${Date.now()}`,
      title: 'New Search Thread',
      updatedAt: new Date().toISOString(),
      messages: []
    };
    setConversations(prev => [newChat, ...prev]);
    setActiveId(newChat.id);
    setError(null);
  };

  const handleTogglePin = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConversations(prev => prev.map(c => {
      if (c.id === id) {
        return { ...c, pinned: !c.pinned };
      }
      return c;
    }));
  };

  const handleToggleArchive = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConversations(prev => prev.map(c => {
      if (c.id === id) {
        return { ...c, archived: !c.archived };
      }
      return c;
    }));
  };

  const handleStartRename = (id: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingChatId(id);
    setEditingChatTitle(currentTitle);
  };

  const handleSaveRename = (id: string) => {
    if (!editingChatTitle.trim()) return;
    setConversations(prev => prev.map(c => {
      if (c.id === id) {
        return { ...c, title: editingChatTitle.trim(), updatedAt: new Date().toISOString() };
      }
      return c;
    }));
    setEditingChatId(null);
    setEditingChatTitle('');
  };

  const handleCancelRename = () => {
    setEditingChatId(null);
    setEditingChatTitle('');
  };

  const handleOpenDeleteModal = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setChatToDelete(id);
  };

  const handleConfirmDelete = () => {
    if (!chatToDelete) return;
    const id = chatToDelete;
    const remaining = conversations.filter(c => c.id !== id);
    setConversations(remaining);
    if (activeId === id) {
      setActiveId(remaining.length > 0 ? remaining[0].id : null);
    }
    setChatToDelete(null);
  };

  // Handle + New Chat from Sidebar
  useEffect(() => {
    const handleNewChat = () => {
      const newConv: Conversation = {
        id: `pro_${Date.now()}`,
        title: 'New Conversation',
        updatedAt: new Date().toISOString(),
        messages: []
      };
      setConversations(prev => [newConv, ...prev]);
      setActiveId(newConv.id);
      setError(null);
    };
    window.addEventListener('omnichat-new-chat', handleNewChat);
    return () => window.removeEventListener('omnichat-new-chat', handleNewChat);
  }, []);

  const handleSearch = async (query: string, searchMode: 'search' | 'research') => {
    if (!query.trim() || isLoading) return;

    sounds.playClick();
    triggerHaptic('light');

    setError(null);
    setIsLoading(true);
    setOptimisticQuery(query);
    setActiveTab('answer');

    let currentConv = activeConversation;
    let updatedConversations = [...conversations];

    // Create a new conversation if we don't have one or if the active one already has messages
    if (!currentConv || currentConv.messages.length > 0) {
      currentConv = {
        id: `pro_${Date.now()}`,
        title: query.substring(0, 32) + (query.length > 32 ? '...' : ''),
        updatedAt: new Date().toISOString(),
        messages: []
      };
      updatedConversations = [currentConv, ...updatedConversations];
      setConversations(updatedConversations);
      setActiveId(currentConv.id);
    }

    // Append user message
    const userMessage: Message = {
      id: `usr_${Date.now()}`,
      role: 'user',
      text: query,
      timestamp: new Date().toISOString()
    };

    const conversationWithUser = {
      ...currentConv,
      title: currentConv.title === 'New Search Thread' ? query.substring(0, 32) + (query.length > 32 ? '...' : '') : currentConv.title,
      updatedAt: new Date().toISOString(),
      messages: [...currentConv.messages, userMessage]
    };

    setConversations(prev => prev.map(c => c.id === conversationWithUser.id ? conversationWithUser : c));

    // Prepare assistant message
    const assistantMessageId = `ast_${Date.now()}`;
    const assistantMessagePlaceholder: Message = {
      id: assistantMessageId,
      role: 'model',
      text: '',
      timestamp: new Date().toISOString(),
      parts: []
    };

    // Update conversation with assistant placeholder
    setConversations(prev => prev.map(c => {
      if (c.id === conversationWithUser.id) {
        return {
          ...c,
          messages: [...c.messages, assistantMessagePlaceholder]
        };
      }
      return c;
    }));

    setOptimisticQuery('');
    setIsStreaming(true);

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
          setConversations(prev => prev.map(c => {
            if (c.id === conversationWithUser.id) {
              return {
                ...c,
                messages: c.messages.map(m => m.id === assistantMessageId ? { ...m, text: formattedThinking + answerText } : m)
              };
            }
            return c;
          }));
        };

        await streamKimiK3Response(
          query,
          [],
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
              sounds.playSuccess();
              triggerHaptic('success');
              setIsLoading(false);
              setIsStreaming(false);
            },
            onError: (err: any) => {
              answerText += `\n\n**Error:** ${err?.message ?? 'Something went wrong.'}`;
              updateUI();
              sounds.playError();
              triggerHaptic('error');
              setIsLoading(false);
              setIsStreaming(false);
            }
          }
        );
        return;
      }

      const ai = getAiInstance();
      
      // Build chat history content
      const historyContents = conversationWithUser.messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      // Set up Google Search Grounding with Optional thinking Config
      const responseStream = await ai.models.generateContentStream({
        model: 'gemini-3.5-flash',
        contents: historyContents,
        config: {
          systemInstruction: 'You are a comprehensive search engine agent. Analyze sources meticulously, synthesize detailed answers, and use bracketed citations like [1], [2] to reference the reviewed sources. At the very end of your response, output a header "### Sources:" followed by a list of your sources in the format "[1] Source Title: URL", each on a new line.',
          tools: [{ googleSearch: {} }]
        }
      });

      let fullText = '';
      let accumulatedQueries: string[] = [];
      let accumulatedChunks: any[] = [];
      let generatedParts: any[] = [];

      for await (const chunk of responseStream) {
        const candidate = chunk.candidates?.[0];
        
        // Extract search metadata
        if (candidate?.groundingMetadata) {
          const metadata = candidate.groundingMetadata;
          
          if (metadata.webSearchQueries) {
            accumulatedQueries = [...accumulatedQueries, ...metadata.webSearchQueries];
          }
          
          if (metadata.groundingChunks) {
            accumulatedChunks = [...accumulatedChunks, ...metadata.groundingChunks];
          }

          // Build parts format for WorkingTimeline
          generatedParts = [];
          
          if (accumulatedQueries.length > 0) {
            generatedParts.push({
              type: 'tool-invocation',
              toolName: 'webSearch',
              args: { query: accumulatedQueries.join(', ') },
              state: 'result',
              result: accumulatedChunks.map(c => ({
                url: c.web?.uri,
                title: c.web?.title
              }))
            });
          }
        }

        // Extract content
        const text = chunk.text;
        if (text) {
          fullText += text;
          
          // Update message state in real-time
          setConversations(prev => prev.map(c => {
            if (c.id === conversationWithUser.id) {
              return {
                ...c,
                messages: c.messages.map(m => {
                  if (m.id === assistantMessageId) {
                    return {
                      ...m,
                      text: fullText,
                      parts: generatedParts
                    };
                  }
                  return m;
                })
              };
            }
            return c;
          }));
        }
      }

      // Finish streaming
      setIsStreaming(false);
      sounds.playSuccess();
      triggerHaptic('success');

      if (readAloud && fullText) {
        speakText(fullText, ttsVoice);
      }

    } catch (err: any) {
      console.error('Pro chat execution error:', err);
      sounds.playError();
      triggerHaptic('error');
      setError(err?.message || 'An error occurred during search grounding.');
      setIsStreaming(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-[#07070a] text-white font-sans">
      
      {/* ── Main Workspace ── */}
      <div className="flex-1 flex flex-col h-full relative overflow-hidden bg-[#07070a]">
        
        {/* Workspace Topbar */}
        <div className="h-14 border-b border-slate-800/60 px-4 md:px-6 flex items-center justify-between shrink-0 bg-slate-950/20 backdrop-blur-md z-30">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-bold text-slate-200 tracking-tight flex items-center gap-1.5 uppercase select-none">
              <Telescope size={16} className="text-emerald-400 animate-pulse" />
              Pro Research Mode
            </h1>
          </div>

          {/* Tab selectors for current conversation */}
          <div className="flex-1 flex justify-center">
            {messages.length > 0 && (
              <div className="flex items-center bg-slate-900 border border-slate-800 p-0.5 rounded-full shadow-inner">
                <button
                  onClick={() => setActiveTab('answer')}
                  className={`px-3 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                    activeTab === 'answer' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Deep Answer
                </button>
                <button
                  onClick={() => setActiveTab('links')}
                  className={`px-3 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                    activeTab === 'links' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Sources Map
                </button>
              </div>
            )}
          </div>

          {/* Thread list toggle on the right side */}
          <div className="flex items-center gap-2">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value as 'gemini' | 'kimi-k3')}
              className="bg-slate-900/80 text-slate-300 text-xs px-2 py-1.5 rounded-lg border border-emerald-500/20 focus:outline-none focus:border-emerald-500 cursor-pointer transition-all hover:bg-slate-800"
            >
              <option value="gemini">♊ Gemini 3.5</option>
              <option value="kimi-k3">👑 Kimi-K3 (Super Reasoning)</option>
            </select>
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-medium ${
                isSidebarOpen 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                  : 'bg-transparent border-transparent text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Toggle Research Threads"
            >
              <Clock size={16} />
              <span className="hidden sm:inline">Threads</span>
            </button>
          </div>
        </div>

        {/* Dynamic Workspace Container */}
        <div className="flex-1 overflow-y-auto pb-44 scrollbar-none relative">
          
          {/* BACKGROUND GLOWS */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none" />

          {messages.length === 0 ? (
            /* ── Interactive Homepage ── */
            <div className="h-full flex flex-col justify-center items-center max-w-2xl mx-auto px-4 py-16 animate-slide-up">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/10 flex items-center justify-center border border-emerald-500/30 shadow-lg shadow-emerald-500/5">
                  <Telescope className="w-5 h-5 text-emerald-400" />
                </div>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-emerald-100 via-white to-slate-300 bg-clip-text text-transparent tracking-tight text-center mb-10 select-none">
                What do you want to explore?
              </h2>

              {/* Homepage Search bar */}
              <div className="w-full">
                {showWorkspace && (
                  <div className="mb-4">
                    <WorkspaceWidget 
                      onInsertText={(text) => {}} // SearchBar is listening globally to workspace-insert-text
                      onClose={() => setShowWorkspace(false)} 
                    />
                  </div>
                )}
                <SearchBar 
                  onSearch={handleSearch} 
                  isLoading={isLoading} 
                  showWorkspace={showWorkspace} 
                  onToggleWorkspace={() => setShowWorkspace(!showWorkspace)} 
                />
              </div>
            </div>
          ) : (
            /* ── Active Conversation Screen ── */
            <div className="max-w-3xl mx-auto px-4 md:px-6 py-8 space-y-10">
              
              {/* Error Callout */}
              {error && (
                <div className="flex items-start gap-3 p-4 bg-red-950/20 border border-red-500/20 rounded-2xl text-red-300 text-xs animate-fade-in">
                  <AlertCircle size={16} className="shrink-0 text-red-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold">Execution Failed</p>
                    <p className="mt-1 opacity-80">{error}</p>
                  </div>
                </div>
              )}

              {/* Rendered interactions */}
              {messages.map((message, i) => (
                <div key={message.id} className="space-y-4 animate-fade-in-up fill-mode-forwards">
                  {message.role === 'user' ? (
                    /* User Question Block */
                    <div className="flex items-start justify-end gap-3">
                      <div className="bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-2xl max-w-[85%] text-slate-100 font-medium text-[15px] leading-relaxed shadow-lg">
                        {message.text}
                      </div>
                    </div>
                  ) : (
                    /* Model Response Block */
                    <div className="space-y-5">
                      <WorkingTimeline
                        parts={message.parts || []}
                        userQuery={messages[i - 1]?.role === 'user' ? messages[i - 1].text : ''}
                        isComplete={i < messages.length - 1 || !isStreaming}
                        hasContent={!!message.text}
                      />
                      <AnswerView
                        content={message.text}
                        isLinksTab={activeTab === 'links'}
                        isStreaming={isStreaming && i === messages.length - 1}
                        onRewrite={() => handleSearch(messages[i - 1]?.text || '', 'search')}
                      />
                    </div>
                  )}
                </div>
              ))}

              {/* Optimistic loading user bubble */}
              {isLoading && optimisticQuery && (
                <div className="flex items-start justify-end gap-3 animate-fade-in">
                  <div className="bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-2xl max-w-[85%] text-slate-100 font-medium text-[15px] leading-relaxed shadow-lg">
                    {optimisticQuery}
                  </div>
                </div>
              )}

              {/* Thinking dots while preparing search */}
              {isLoading && !isStreaming && (
                <div className="space-y-4 animate-fade-in">
                  <WorkingTimeline
                    parts={[]}
                    userQuery={optimisticQuery || (messages.length > 0 ? messages[messages.length - 1].text : '')}
                    isComplete={false}
                  />
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Fixed Bottom search container */}
        {messages.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 z-25 pointer-events-none flex justify-center">
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/90 to-transparent pointer-events-none -top-12" />
            <div className="relative w-full max-w-3xl px-4 md:px-6 pb-6 pt-2 pointer-events-auto flex flex-col gap-3">
              {showWorkspace && (
                <div className="w-full">
                  <WorkspaceWidget 
                    onInsertText={(text) => {}} // SearchBar is listening globally to workspace-insert-text
                    onClose={() => setShowWorkspace(false)} 
                  />
                </div>
              )}
              <SearchBar 
                onSearch={handleSearch} 
                isLoading={isLoading} 
                compact 
                showWorkspace={showWorkspace} 
                onToggleWorkspace={() => setShowWorkspace(!showWorkspace)} 
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Thread History Sidebar ── */}
      <AnimatePresence initial={false}>
        {isSidebarOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            className={`h-full shrink-0 border-l ${getBorderClass()} bg-black/45 backdrop-blur-md overflow-hidden flex flex-row justify-end`}
          >
            <div style={{ width: 280 }} className="h-full flex flex-col shrink-0">
              {/* Sidebar Header */}
              <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Clock size={14} className="text-emerald-400" />
                  Research Threads
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleCreateNewChat}
                    className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title="New Search Thread"
                  >
                    <Plus size={16} />
                  </button>
                  <button
                    onClick={() => setIsSidebarOpen(false)}
                    className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title="Close History Panel"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* ChatGPT Search Bar */}
              <div className="px-3 pt-3 pb-2">
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search threads..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-white/5 hover:bg-white/10 focus:bg-slate-900 text-xs text-white placeholder-slate-500 rounded-xl border border-white/5 focus:border-emerald-500/50 outline-none transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-2.5 text-slate-500 hover:text-white"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* ChatGPT Style Category/Tab Filter */}
              <div className="px-3 pb-2 flex gap-1 border-b border-white/5">
                {(['all', 'pinned', 'archived'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveHistoryTab(tab)}
                    className={`flex-1 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${
                      activeHistoryTab === tab
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/10'
                        : 'text-slate-500 hover:text-slate-350 bg-transparent'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Thread list */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin">
                {sortedAndFilteredConversations.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-xs">
                    {searchQuery ? 'No matching threads.' : 'No threads in this category.'}
                  </div>
                ) : (
                  sortedAndFilteredConversations.map((c) => (
                    <div key={c.id}>
                      {editingChatId === c.id ? (
                        <div className="p-2 rounded-xl bg-slate-900 border border-emerald-500/30 flex items-center gap-1.5">
                          <input
                            type="text"
                            value={editingChatTitle}
                            onChange={(e) => setEditingChatTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRename(c.id);
                              if (e.key === 'Escape') handleCancelRename();
                            }}
                            className="flex-1 px-2 py-1 bg-black/40 text-xs text-white rounded-lg border border-white/5 outline-none focus:border-emerald-500"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveRename(c.id)}
                            className="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-[10px] font-bold transition-colors"
                          >
                            Save
                          </button>
                          <button
                            onClick={handleCancelRename}
                            className="p-1 rounded hover:bg-white/5 text-slate-400"
                            title="Cancel"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <div
                          onClick={() => {
                            setActiveId(c.id);
                            setError(null);
                          }}
                          className={`w-full text-left p-2.5 rounded-xl flex items-center gap-2.5 transition-all border group cursor-pointer select-none ${
                            activeId === c.id
                              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20 shadow-inner'
                              : 'hover:bg-slate-900/60 text-slate-350 hover:text-white border-transparent'
                          }`}
                        >
                          <MessageSquare size={13} className={activeId === c.id ? 'text-emerald-400' : 'text-slate-500'} />
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-xs truncate leading-snug">{c.title}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                              <span>{c.messages.length} interactions</span>
                              {c.pinned && (
                                <span className="inline-flex items-center text-[9px] text-emerald-400 bg-emerald-500/10 px-1 rounded font-medium">
                                  Pinned
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {/* ChatGPT action buttons */}
                          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity duration-150 shrink-0">
                            <button
                              onClick={(e) => handleTogglePin(c.id, e)}
                              className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-emerald-400 transition-colors"
                              title={c.pinned ? "Unpin Thread" : "Pin Thread"}
                            >
                              <Pin size={11} className={c.pinned ? 'fill-emerald-400 text-emerald-400' : ''} />
                            </button>
                            <button
                              onClick={(e) => handleToggleArchive(c.id, e)}
                              className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-amber-400 transition-colors"
                              title={c.archived ? "Restore Thread" : "Archive Thread"}
                            >
                              <Archive size={11} className={c.archived ? 'fill-amber-400/20 text-amber-400' : ''} />
                            </button>
                            <button
                              onClick={(e) => handleStartRename(c.id, c.title, e)}
                              className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-blue-400 transition-colors"
                              title="Rename Thread"
                            >
                              <Edit2 size={11} />
                            </button>
                            <button
                              onClick={(e) => handleOpenDeleteModal(c.id, e)}
                              className="p-1 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                              title="Delete Thread"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ChatGPT Style Delete Confirmation Modal */}
      {chatToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col gap-4 text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto">
              <Trash2 size={24} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center justify-center gap-1.5">
                🗑️ Delete Chat?
              </h3>
              <p className="text-xs text-slate-300 mt-2">
                Are you sure you want to delete this chat?
              </p>
              <p className="text-[11px] text-slate-500 italic mt-1">
                This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-2.5 mt-2">
              <button
                onClick={() => setChatToDelete(null)}
                className="flex-1 py-2 text-xs font-semibold text-slate-300 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/5 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 active:bg-red-700 rounded-xl transition-all shadow-lg shadow-red-600/10 cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
