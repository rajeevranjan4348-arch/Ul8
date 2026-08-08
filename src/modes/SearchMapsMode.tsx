import React, { useState, useRef, useEffect } from 'react';
import { Message } from '../types';
import { ChatMessage } from '../components/ChatMessage';
import { ChatInput } from '../components/ChatInput';
import { getSearchGroundedResponse, getMapsGroundedResponse } from '../services/gemini';
import { GoogleMapView } from '../components/GoogleMapView';
import { OfflineMapView } from '../components/OfflineMapView';
import { MapPin, Search, Plus, Trash2, MessageSquare, Mic, X, Map as MapIcon, Columns, Maximize2, WifiOff, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from '../contexts/ThemeContext';

interface Conversation {
  id: string;
  title: string;
  updatedAt: Date;
  messages: Message[];
}

interface SearchMapsModeProps {
  voiceSearchTrigger?: number;
}

export const SearchMapsMode: React.FC<SearchMapsModeProps> = ({ voiceSearchTrigger }) => {
  const { isDarkMode, getAccentClass } = useTheme();
  
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    const saved = localStorage.getItem('omnichat_searchmaps_conversations');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((c: any) => ({
          ...c,
          updatedAt: new Date(c.updatedAt),
          messages: c.messages.map((m: any) => ({
            ...m,
            timestamp: m.timestamp ? new Date(m.timestamp) : new Date()
          }))
        }));
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const [currentConversationId, setCurrentConversationId] = useState<string | null>(() => {
    const saved = localStorage.getItem('omnichat_searchmaps_current_conv');
    return saved || null;
  });

  const [showHistory, setShowHistory] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchType, setSearchType] = useState<'search' | 'maps' | 'offline'>('maps');
  const [mapViewMode, setMapViewMode] = useState<'split' | 'map' | 'chat'>('split');
  const [mapSearchQuery, setMapSearchQuery] = useState<string>('');
  
  const [isListening, setIsListening] = useState(false);
  const [voiceQuery, setVoiceQuery] = useState('');
  const [recognitionError, setRecognitionError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Trigger voice search when voiceSearchTrigger prop changes
  useEffect(() => {
    if (voiceSearchTrigger && voiceSearchTrigger > 0) {
      startListening();
    }
  }, [voiceSearchTrigger]);

  const startListening = () => {
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      setRecognitionError('Speech Recognition is not supported by your browser. Please try Chrome, Safari, or Edge.');
      setIsListening(true);
      return;
    }

    setRecognitionError(null);
    setVoiceQuery('');
    setIsListening(true);

    try {
      const rec = new SpeechRecognitionAPI();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onstart = () => {
        console.log('Voice search listening started...');
      };

      rec.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const currentText = finalTranscript || interimTranscript;
        setVoiceQuery(currentText);

        if (finalTranscript) {
          setTimeout(() => {
            handleVoiceSubmit(finalTranscript);
          }, 800);
        }
      };

      rec.onerror = (event: any) => {
        if (event.error === 'aborted' || event.error === 'no-speech') {
          return;
        }
        if (event.error === 'not-allowed') {
          console.warn('Speech recognition blocked: Microphone permission not allowed.');
          setRecognitionError('Microphone permission is required for voice search. Please grant access in your browser address bar.');
          return;
        }
        console.error('Speech recognition error:', event.error);
        setRecognitionError(`Voice error: ${event.error}`);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (e: any) {
      console.error('Failed to initialize speech recognition:', e);
      setRecognitionError(e?.message || 'Failed to start microphone.');
    }
  };

  const cancelListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {}
    }
    setIsListening(false);
    setVoiceQuery('');
  };

  const handleVoiceSubmit = (queryText: string) => {
    const finalQuery = queryText.trim();
    if (!finalQuery) return;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }

    setIsListening(false);
    
    // Auto-detect if maps-specific queries are mentioned
    const lower = finalQuery.toLowerCase();
    if (
      lower.includes('near me') || 
      lower.includes('where is') || 
      lower.includes('find a') || 
      lower.includes('restaurant') || 
      lower.includes('maps') || 
      lower.includes('directions to') || 
      lower.includes('location of')
    ) {
      setSearchType('maps');
    }

    handleSendMessage(finalQuery);
  };

  useEffect(() => {
    if (conversations.length > 0 && !currentConversationId) {
      setCurrentConversationId(conversations[0].id);
    }
  }, [conversations, currentConversationId]);

  useEffect(() => {
    localStorage.setItem('omnichat_searchmaps_conversations', JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    if (currentConversationId) {
      localStorage.setItem('omnichat_searchmaps_current_conv', currentConversationId);
    } else {
      localStorage.removeItem('omnichat_searchmaps_current_conv');
    }
  }, [currentConversationId]);

  // Ensure there is at least one conversation
  useEffect(() => {
    if (conversations.length === 0) {
      createNewChat();
    }
  }, []);

  const currentConversation = conversations.find(c => c.id === currentConversationId);
  const messages = currentConversation?.messages || [];

  const setMessages = (updater: Message[] | ((prev: Message[]) => Message[])) => {
    setConversations(prevConvs => {
      let activeId = currentConversationId;
      let existingConvs = [...prevConvs];
      
      if (!activeId) {
        const newId = Date.now().toString();
        const newConv: Conversation = {
          id: newId,
          title: 'Search Chat',
          updatedAt: new Date(),
          messages: []
        };
        existingConvs = [newConv, ...existingConvs];
        activeId = newId;
        setCurrentConversationId(newId);
      }
      
      return existingConvs.map(c => {
        if (c.id === activeId) {
          const newMessages = typeof updater === 'function' ? updater(c.messages) : updater;
          
          let title = c.title;
          if (title === 'Search Chat' || title === 'New Chat') {
            const firstUserMsg = newMessages.find(m => m.role === 'user');
            if (firstUserMsg) {
              title = firstUserMsg.text.substring(0, 30);
              if (firstUserMsg.text.length > 30) title += '...';
            }
          }
          
          return {
            ...c,
            title,
            updatedAt: new Date(),
            messages: newMessages
          };
        }
        return c;
      });
    });
  };

  const createNewChat = () => {
    if (currentConversation && currentConversation.messages.length === 0) {
      // Already an empty conversation exists, just keep it focused
      return;
    }
    const newConv: Conversation = {
      id: Date.now().toString(),
      title: 'New Chat',
      updatedAt: new Date(),
      messages: []
    };
    setConversations(prev => [newConv, ...prev]);
    setCurrentConversationId(newConv.id);
  };

  const deleteConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this search session?')) {
      setConversations(prev => prev.filter(c => c.id !== id));
      if (currentConversationId === id) {
        setCurrentConversationId(null);
      }
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;

    if (searchType === 'maps') {
      setMapSearchQuery(text);
    }

    const userMessage: Message = { id: Date.now().toString(), role: 'user', text };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    const modelMessageId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, { id: modelMessageId, role: 'model', text: 'Searching...', isStreaming: true }]);

    try {
      let response;
      if (searchType === 'maps') {
        let lat = 37.78193; // Default to SF
        let lng = -122.40476;
        
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject);
          });
          lat = position.coords.latitude;
          lng = position.coords.longitude;
        } catch (e) {
          console.log("Could not get location, using default.");
        }
        
        response = await getMapsGroundedResponse(text, lat, lng);
      } else {
        response = await getSearchGroundedResponse(text);
      }
      
      const responseText = response.text;
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === modelMessageId ? { ...msg, text: responseText, groundingChunks: chunks } : msg
        )
      );
    } catch (error: any) {
      console.error('Search error:', error);
      const errorMessage = error?.message || 'Sorry, an error occurred while searching. Please try again.';
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === modelMessageId ? { ...msg, text: `**Error:** ${errorMessage}` } : msg
        )
      );
    } finally {
      setIsLoading(false);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === modelMessageId ? { ...msg, isStreaming: false } : msg
        )
      );
    }
  };

  const handleDeleteMessage = (messageId: string) => {
    setMessages(prev => prev.filter(m => m.id !== messageId));
  };

  const handleEditMessage = (messageId: string, newText: string) => {
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, text: newText } : m));
  };

  const handleRegenerateMessage = async (messageId: string) => {
    const msgIndex = messages.findIndex(m => m.id === messageId);
    if (msgIndex === -1) return;
    
    let lastUserMessage: Message | null = null;
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        lastUserMessage = messages[i];
        break;
      }
    }
    
    if (!lastUserMessage) return;
    
    const historyToKeep = messages.slice(0, msgIndex);
    setMessages(historyToKeep);
    
    handleSendMessage(lastUserMessage.text);
  };

  const handleExportMessage = (message: Message) => {
    const element = document.createElement("a");
    const file = new Blob([message.text], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `searchmaps-response-${message.id}.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className={`flex h-full w-full relative overflow-hidden ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* Search History Collapsible Sidebar */}
      <AnimatePresence initial={false}>
        {showHistory && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 260, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            style={{ willChange: 'width, opacity' }}
            className={`flex flex-col h-full border-r shrink-0 relative z-10 overflow-hidden ${
              isDarkMode ? 'border-white/10 bg-black/30' : 'border-slate-200 bg-slate-50'
            }`}
          >
            <div style={{ width: 260 }} className="flex flex-col h-full p-4">
              <div className="flex items-center justify-between mb-4 shrink-0">
                <span className={`text-[10px] font-bold uppercase tracking-wider opacity-60 ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>Search History</span>
                <button
                  type="button"
                  onClick={createNewChat}
                  title="New Search"
                  className={`p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-xs flex items-center gap-1 ${getAccentClass()}`}
                >
                  <Plus size={14} /> <span className="text-[10px] font-semibold">New</span>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 hide-scrollbar">
                {conversations.map(conv => {
                  const messageCount = conv.messages.length;
                  return (
                    <div
                      key={conv.id}
                      onClick={() => setCurrentConversationId(conv.id)}
                      className={`group flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all border ${
                        currentConversationId === conv.id
                          ? (isDarkMode ? 'bg-white/10 border-white/20 text-white shadow-md' : 'bg-slate-200 border-slate-300 text-slate-900 shadow-sm')
                          : (isDarkMode ? 'hover:bg-white/5 border-transparent text-white/60 hover:text-white' : 'hover:bg-slate-100 border-transparent text-slate-600 hover:text-slate-900')
                      }`}
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden flex-1 min-w-0">
                        <MessageSquare size={14} className="shrink-0 opacity-50 text-blue-500" />
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-xs truncate font-medium">{conv.title}</span>
                          <span className="text-[9px] opacity-40">{messageCount} {messageCount === 1 ? 'message' : 'messages'}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => deleteConversation(conv.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-red-500 transition-all ml-1 shrink-0"
                        title="Delete Session"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Grounded Chat Panel */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
        
        {/* Header Tabs with Toggle Button & View Modes */}
        <div className={`p-4 border-b flex items-center justify-between shrink-0 ${
          isDarkMode ? 'bg-slate-900/50 border-white/10' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className="flex bg-slate-100 dark:bg-white/5 rounded-full p-0.5">
              <button
                onClick={() => setSearchType('search')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  searchType === 'search' 
                    ? 'bg-blue-500 text-white shadow-sm' 
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/5'
                }`}
              >
                <Search size={13} />
                Web Search
              </button>
              <button
                onClick={() => setSearchType('maps')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  searchType === 'maps' 
                    ? 'bg-emerald-500 text-white shadow-sm' 
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/5'
                }`}
              >
                <MapPin size={13} />
                Google Maps
              </button>
              <button
                onClick={() => setSearchType('offline')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  searchType === 'offline' 
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm' 
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/5'
                }`}
              >
                <WifiOff size={13} className="text-cyan-400" />
                Offline World Map
              </button>
            </div>

            {/* Map View Layout Selector when in Maps mode */}
            {searchType === 'maps' && (
              <div className="hidden sm:flex bg-slate-100 dark:bg-white/5 rounded-full p-0.5 items-center">
                <button
                  onClick={() => setMapViewMode('split')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                    mapViewMode === 'split'
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Split View (Chat + Map)"
                >
                  <Columns size={12} />
                  <span>Split</span>
                </button>
                <button
                  onClick={() => setMapViewMode('map')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                    mapViewMode === 'map'
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Full Google Map View"
                >
                  <MapIcon size={12} />
                  <span>Map Only</span>
                </button>
                <button
                  onClick={() => setMapViewMode('chat')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                    mapViewMode === 'chat'
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Chat Only View"
                >
                  <MessageSquare size={12} />
                  <span>Chat Only</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={createNewChat}
              title="New Chat Session"
              className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? 'text-white/60 hover:bg-white/10 hover:text-white' : 'text-slate-500 hover:bg-slate-200 hover:text-slate-900'}`}
            >
              <Plus size={18} />
            </button>
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              title="Toggle Chat History"
              className={`p-1.5 rounded-md transition-colors ${
                showHistory 
                  ? `bg-black/10 dark:bg-white/10 ${getAccentClass()}` 
                  : (isDarkMode ? 'text-white/60 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-200')
              }`}
            >
              <MessageSquare size={18} />
            </button>
          </div>
        </div>

        {/* Content Body: Conditional Split / Map / Chat / Offline World Map */}
        <div className="flex-1 flex flex-col md:flex-row h-full min-h-0 overflow-hidden relative">
          
          {/* Offline World Map Mode View */}
          {searchType === 'offline' ? (
            <div className="w-full h-full p-2 md:p-4">
              <OfflineMapView isOpen={true} />
            </div>
          ) : (
            <>
              {/* Chat Panel (Hidden if mapViewMode === 'map' in Maps mode) */}
              {(searchType !== 'maps' || mapViewMode !== 'map') && (
                <div className={`flex-1 flex flex-col h-full min-w-0 overflow-hidden ${
                  searchType === 'maps' && mapViewMode === 'split' ? 'md:w-1/2 md:border-r border-slate-200 dark:border-white/10' : 'w-full'
                }`}>
                  {/* Message Log */}
                  <div className="flex-1 overflow-y-auto">
                    {messages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                          searchType === 'search' ? 'bg-blue-100 text-blue-500' : 'bg-emerald-100 text-emerald-500'
                        }`}>
                          {searchType === 'search' ? <Search size={32} /> : <MapPin size={32} />}
                        </div>
                        <h2 className={`text-xl font-semibold mb-2 ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                          {searchType === 'search' ? 'Search Grounding' : 'Maps Grounding'}
                        </h2>
                        <p className="max-w-md text-sm leading-relaxed opacity-70">
                          {searchType === 'search' 
                            ? 'Ask questions about recent events or facts. The AI will search the web to provide accurate, up-to-date answers.'
                            : 'Ask about places, restaurants, or directions. The AI will search Google Maps and display interactive pins nearby.'}
                        </p>
                      </div>
                    ) : (
                      <div className={`divide-y ${isDarkMode ? 'divide-white/5' : 'divide-slate-100'}`}>
                        {messages.map((msg) => (
                          <ChatMessage 
                            key={msg.id} 
                            message={msg} 
                            onEdit={handleEditMessage}
                            onRegenerate={handleRegenerateMessage}
                            onDelete={handleDeleteMessage}
                            onExport={handleExportMessage}
                          />
                        ))}
                        <div ref={messagesEndRef} />
                      </div>
                    )}
                  </div>

                  {/* Chat Input Bar */}
                  <ChatInput 
                    onSendMessage={handleSendMessage} 
                    isLoading={isLoading} 
                    placeholder={`Ask about ${searchType === 'search' ? 'recent news...' : 'places nearby...'}`} 
                    draftKey="omnichat_draft_search_maps"
                  />
                </div>
              )}

              {/* Interactive Google Map Panel (Visible when searchType === 'maps' and mapViewMode !== 'chat') */}
              {searchType === 'maps' && mapViewMode !== 'chat' && (
                <div className={`h-full min-h-0 overflow-hidden relative ${
                  mapViewMode === 'map' ? 'w-full flex-1' : 'w-full md:w-1/2 h-80 md:h-full'
                }`}>
                  <GoogleMapView
                    searchQuery={mapSearchQuery}
                    onAskAboutPlace={(name, address) => {
                      handleSendMessage(`Tell me more details and user reviews about ${name}${address ? ' at ' + address : ''}`);
                    }}
                  />
                </div>
              )}
            </>
          )}

        </div>

      </div>

      {/* Immersive Voice Search Overlay */}
      <AnimatePresence>
        {isListening && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-xl p-6 text-center text-white"
          >
            {/* Top Close Button */}
            <button
              onClick={cancelListening}
              className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>

            <div className="max-w-xl flex flex-col items-center gap-8">
              {/* Pulsing Mic Target */}
              <div className="relative flex items-center justify-center">
                {/* Ripple animations */}
                <div className="absolute w-36 h-36 bg-blue-500/20 rounded-full animate-ping pointer-events-none" />
                <div className="absolute w-28 h-28 bg-blue-400/30 rounded-full animate-pulse pointer-events-none" />
                
                <div className="relative w-20 h-20 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/30 border border-blue-400/30">
                  <Mic size={36} className="text-white animate-bounce" style={{ animationDuration: '2s' }} />
                </div>
              </div>

              {/* Status Header */}
              <div className="space-y-2">
                <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-indigo-200 to-white bg-clip-text text-transparent">
                  Listening for Voice Query
                </h3>
                <p className="text-xs text-white/40 uppercase tracking-widest font-semibold">
                  Speak now to search the web or Google Maps
                </p>
              </div>

              {/* Dynamic Transcript Container */}
              <div className="min-h-[100px] flex items-center justify-center px-4">
                {recognitionError ? (
                  <p className="text-red-400 text-sm font-medium border border-red-500/20 bg-red-500/10 rounded-2xl px-4 py-3 max-w-sm">
                    {recognitionError}
                  </p>
                ) : voiceQuery ? (
                  <p className="text-xl md:text-2xl font-medium text-slate-100 tracking-tight leading-relaxed max-w-lg italic">
                    "{voiceQuery}"
                  </p>
                ) : (
                  <p className="text-lg text-slate-400 animate-pulse font-light tracking-wide">
                    Listening to your voice...
                  </p>
                )}
              </div>

              {/* Bottom Actions */}
              <div className="flex items-center gap-4 mt-4">
                <button
                  onClick={cancelListening}
                  className="px-6 py-2.5 rounded-full border border-white/10 hover:bg-white/5 text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
                {voiceQuery && !recognitionError && (
                  <button
                    onClick={() => handleVoiceSubmit(voiceQuery)}
                    className="px-6 py-2.5 rounded-full bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-500/20 text-sm font-semibold transition-colors"
                  >
                    Search Now
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
