import React, { useState, useRef, useEffect } from 'react';
import { Message, Attachment } from '../types';
import { ChatMessage } from '../components/ChatMessage';
import { ChatInput } from '../components/ChatInput';
import { SystemStatus } from '../components/SystemStatus';
import { getAiInstance } from '../services/gemini';
import { speakText, stopSpeech } from '../utils/speech';
import { ThinkingLevel, Type } from '@google/genai';
import { Settings2, Globe, UserCircle, Link as LinkIcon, Trash2, Plus, MessageSquare, Brain, Pin, PinOff } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useSettings } from '../contexts/SettingsContext';
import { motion, AnimatePresence } from 'motion/react';
import { Panel, Group, Separator } from 'react-resizable-panels';

interface ChatModeProps {
  mode: 'chat-pro' | 'chat-fast';
}

interface Conversation {
  id: string;
  title: string;
  updatedAt: Date;
  messages: Message[];
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

export const ChatMode: React.FC<ChatModeProps> = ({ mode }) => {
  const { isDarkMode, getAccentClass, getBorderClass } = useTheme();
  const { userProfile, memory, setMemory, readAloud, ttsVoice } = useSettings();
  
  const [selectedModel, setSelectedModel] = useState<'gemini' | 'kimi-k3'>(() => {
    return (localStorage.getItem(`omnichat_selected_model_${mode}`) as 'gemini' | 'kimi-k3') || 'gemini';
  });

  useEffect(() => {
    localStorage.setItem(`omnichat_selected_model_${mode}`, selectedModel);
  }, [selectedModel, mode]);
  
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    const saved = localStorage.getItem(`omnichat_conversations_${mode}`);
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
    
    // Migration from old single-chat format
    const oldSaved = localStorage.getItem(`omnichat_history_${mode}`);
    if (oldSaved) {
      try {
        const parsed = JSON.parse(oldSaved);
        if (parsed && parsed.length > 0) {
          const msgs = parsed.map((m: any) => ({
            ...m,
            timestamp: m.timestamp ? new Date(m.timestamp) : new Date()
          }));
          const newConv = {
            id: Date.now().toString(),
            title: msgs[0]?.text?.substring(0, 30) || 'New Chat',
            updatedAt: new Date(),
            messages: msgs
          };
          return [newConv];
        }
      } catch (e) {
        // ignore
      }
    }
    
    return [];
  });

  const [currentConversationId, setCurrentConversationId] = useState<string | null>(() => {
    const saved = localStorage.getItem(`omnichat_current_conv_${mode}`);
    return saved || null;
  });

  useEffect(() => {
    if (conversations.length > 0 && !currentConversationId) {
      setCurrentConversationId(conversations[0].id);
    }
  }, [conversations, currentConversationId]);

  useEffect(() => {
    try {
      const sanitized = sanitizeConversationsForStorage(conversations);
      localStorage.setItem(`omnichat_conversations_${mode}`, JSON.stringify(sanitized));
    } catch (error) {
      console.warn('Failed to save to localStorage with sanitized attachments, stripping all base64...', error);
      try {
        const fullyPruned = conversations.map(c => ({
          ...c,
          messages: c.messages.map(m => {
            if (!m.attachments || m.attachments.length === 0) return m;
            return {
              ...m,
              attachments: m.attachments.map(att => ({ ...att, base64: '' }))
            };
          })
        }));
        localStorage.setItem(`omnichat_conversations_${mode}`, JSON.stringify(fullyPruned));
      } catch (err) {
        console.error('Even fully pruned failed to save to localStorage', err);
      }
    }
  }, [conversations, mode]);

  useEffect(() => {
    if (currentConversationId) {
      localStorage.setItem(`omnichat_current_conv_${mode}`, currentConversationId);
    } else {
      localStorage.removeItem(`omnichat_current_conv_${mode}`);
    }
  }, [currentConversationId, mode]);

  const currentConversation = conversations.find(c => c.id === currentConversationId);
  const messages = currentConversation?.messages || [];

  const currentConversationIdRef = useRef(currentConversationId);
  useEffect(() => {
    currentConversationIdRef.current = currentConversationId;
  }, [currentConversationId]);

  const setMessages = (updater: Message[] | ((prev: Message[]) => Message[])) => {
    setConversations(prevConvs => {
      const convId = currentConversationIdRef.current;
      if (!convId) return prevConvs;
      
      return prevConvs.map(c => {
        if (c.id === convId) {
          const newMessages = typeof updater === 'function' ? updater(c.messages) : updater;
          return {
            ...c,
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
      // Already an empty chat exists, just keep it focused
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
    if (window.confirm('Are you sure you want to delete this chat?')) {
      setConversations(prev => prev.filter(c => c.id !== id));
      if (currentConversationId === id) {
        setCurrentConversationId(null);
      }
    }
  };

  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  
  const [language, setLanguage] = useState('English');
  const [personality, setPersonality] = useState('Witty');
  const [urlContext, setUrlContext] = useState('');
  const [useWebSearch, setUseWebSearch] = useState(false);
  
  const chatRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef(messages);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const initChat = () => {
    const ai = getAiInstance();
    const modelName = mode === 'chat-pro' ? 'gemini-3.1-pro-preview' : 'gemini-3.1-flash-lite-preview';
    
    let systemInstruction = `You are OmniChat AI, an advanced, highly intelligent, and versatile AI assistant. `;
    
    switch(personality) {
      case 'Friendly':
        systemInstruction += `Your tone is warm, encouraging, and highly empathetic. You speak like a supportive mentor or a knowledgeable friend. You use positive language, occasionally use emojis, and always aim to make the user feel heard and understood.`;
        break;
      case 'Formal':
        systemInstruction += `Your tone is strictly professional, objective, and highly structured. You speak like an expert consultant or a seasoned academic. You avoid slang, use precise terminology, and present information in a clear, logical, and highly organized manner.`;
        break;
      case 'Witty':
        systemInstruction += `Your tone is incredibly witty, charming, and highly engaging. You speak like a brilliant conversationalist who enjoys clever wordplay, sharp observations, and a good pun. You have a background as a digital polymath who has read everything but prefers to keep things light and entertaining. You are deeply helpful, but you always add a touch of sparkling wit or a smart, engaging remark to make the conversation memorable.`;
        break;
      case 'Sarcastic':
        systemInstruction += `Your tone is highly sarcastic, cynical, and slightly exasperated, yet you still provide accurate and helpful answers. You speak like a genius who is slightly annoyed by having to explain things, but you do it anyway. Expect eye-rolls in text form.`;
        break;
      case 'Pirate':
        systemInstruction += `Your tone is that of a swashbuckling pirate captain. You use pirate slang (arrr, matey, shiver me timbers), talk about the high seas, and frame your helpful answers as if you are sharing buried treasure or navigating a ship.`;
        break;
      case 'Poetic':
        systemInstruction += `Your tone is deeply poetic, lyrical, and evocative. You speak in metaphors, vivid imagery, and rhythmic prose. You treat every answer as a piece of art, weaving facts into beautiful, flowing verses.`;
        break;
      case 'Cynical':
        systemInstruction += `Your tone is deeply cynical, pessimistic, and world-weary. You provide helpful answers but always point out the flaws, inevitable doom, or the futility of it all. You are a helpful AI who has seen too much and expects the worst.`;
        break;
      case 'Humorous':
        systemInstruction += `Your tone is lighthearted, funny, and comedic. You love telling jokes, making light of situations, and keeping the user laughing. You provide accurate information wrapped in a stand-up comedy routine.`;
        break;
      case 'Verbose':
        systemInstruction += `Your tone is incredibly verbose, overly detailed, and exhaustive. You leave no stone unturned, providing massive amounts of context, history, and tangential information for even the simplest of questions.`;
        break;
      case 'Empathetic':
        systemInstruction += `Your tone is profoundly empathetic, gentle, and emotionally intelligent. You prioritize the user's feelings, validate their experiences, and offer comfort alongside your helpful answers.`;
        break;
      case 'Direct':
        systemInstruction += `Your tone is blunt, concise, and straight to the point. You use as few words as possible. No fluff, no pleasantries, just the raw facts and the exact answer requested.`;
        break;
      default:
        systemInstruction += `Your tone is helpful, clear, and concise.`;
    }
    
    systemInstruction += `\n\nPlease respond in ${language}.`;
    
    if (userProfile.name) {
      systemInstruction += `\n\nThe user's name is ${userProfile.name}.`;
    }
    if (userProfile.preferences) {
      systemInstruction += `\n\nUser preferences and context:\n${userProfile.preferences}`;
    }
    if (memory && memory.length > 0) {
      systemInstruction += `\n\nMemory (facts you have learned about the user):\n- ${memory.join('\n- ')}`;
    }
    
    const config: any = {
      systemInstruction: { parts: [{ text: systemInstruction }] },
    };
    
    if (mode === 'chat-pro') {
      config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
    }
    
    if (urlContext.trim()) {
      config.tools = config.tools || [];
      config.tools.push({ urlContext: {} });
    }

    if (useWebSearch) {
      config.tools = config.tools || [];
      config.tools.push({ googleSearch: {} });
    }
    
    // Add memory tool
    config.tools = config.tools || [];
    config.tools.push({
      functionDeclarations: [{
        name: "save_memory",
        description: "Save a key detail, fact, or preference about the user to long-term memory.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            fact: {
              type: Type.STRING,
              description: "The fact to remember (e.g., 'User likes Python', 'User lives in London')"
            }
          },
          required: ["fact"]
        }
      }]
    });
    
    const history = messages
      .filter(m => !m.isStreaming && m.text)
      .map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

    chatRef.current = ai.chats.create({
      model: modelName,
      history: history.length > 0 ? history : undefined,
      config,
    });
  };

  useEffect(() => {
    initChat();
  }, [mode, language, personality, urlContext, useWebSearch, currentConversationId, userProfile, memory]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    stopSpeech();
  }, [currentConversationId]);

  useEffect(() => {
    return () => {
      stopSpeech();
    };
  }, []);

  const handleSendMessage = async (text: string, attachments?: Attachment[]) => {
    if ((!text.trim() && (!attachments || attachments.length === 0)) || !chatRef.current) return;

    let convId = currentConversationIdRef.current;
    if (!convId) {
      convId = Date.now().toString();
      const displayTitle = text ? (text.substring(0, 30) + (text.length > 30 ? '...' : '')) : (attachments?.[0]?.name || 'Attachment Chat');
      const newConv: Conversation = {
        id: convId,
        title: displayTitle,
        updatedAt: new Date(),
        messages: []
      };
      setConversations(prev => [newConv, ...prev]);
      setCurrentConversationId(convId);
      currentConversationIdRef.current = convId; // Update ref immediately
    } else {
      // Update title if it's the first user message
      setConversations(prev => prev.map(c => {
        if (c.id === convId && c.messages.length === 0) {
          const displayTitle = text ? (text.substring(0, 30) + (text.length > 30 ? '...' : '')) : (attachments?.[0]?.name || 'Attachment Chat');
          return { ...c, title: displayTitle };
        }
        return c;
      }));
    }

    // Check for "open [app]" command
    const openAppMatch = text.match(/^(?:open|launch)\s+(.+)$/i);
    if (openAppMatch) {
      let appName = openAppMatch[1].trim().toLowerCase();
      appName = appName.replace(/\s+(please|now)$/i, '');
      
      const appMap: Record<string, string> = {
        'youtube': 'https://youtube.com',
        'google': 'https://google.com',
        'gmail': 'https://mail.google.com',
        'maps': 'https://maps.google.com',
        'spotify': 'https://open.spotify.com',
        'twitter': 'https://twitter.com',
        'x': 'https://x.com',
        'facebook': 'https://facebook.com',
        'instagram': 'https://instagram.com',
        'reddit': 'https://reddit.com',
        'github': 'https://github.com',
        'chatgpt': 'https://chat.openai.com',
        'netflix': 'https://netflix.com',
        'amazon': 'https://amazon.com',
        'linkedin': 'https://linkedin.com',
        'twitch': 'https://twitch.tv',
        'discord': 'https://discord.com/app',
      };

      let url = '';
      if (appMap[appName]) {
        url = appMap[appName];
      } else {
        url = `https://${appName.replace(/\s+/g, '')}.com`;
      }

      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'user',
        text,
        timestamp: new Date()
      }]);
      
      const replyText = `Opening ${appName}...`;
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: replyText,
        timestamp: new Date()
      }]);
      
      window.open(url, '_blank');
      return;
    }

    let messageToSend: any = text;
    if (urlContext.trim() && messages.length === 0) {
      messageToSend = `Context URL: ${urlContext}\n\n${text}`;
    }

    if (attachments && attachments.length > 0) {
      messageToSend = [
        { text: messageToSend },
        ...attachments.map(att => ({
          inlineData: {
            data: att.base64,
            mimeType: att.type
          }
        }))
      ];
    }

    const userMessage: Message = { id: Date.now().toString(), role: 'user', text, timestamp: new Date(), status: 'sent', attachments };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    const modelMessageId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, { id: modelMessageId, role: 'model', text: '', isStreaming: true, timestamp: new Date() }]);

    if (selectedModel === 'kimi-k3') {
      try {
        const { streamKimiK3Response } = await import('../services/kimiK3');
        let thinkingSteps: string[] = [];
        let liveThinking = '';
        let answerText = '';

        const updateUI = () => {
          const stepsPart = thinkingSteps.map(s => `> \`${s}\``).join('\n');
          const reasoningPart = liveThinking ? `\n> \n> 🧠 **Thinking Process:**\n> ${liveThinking.trim().replace(/\n/g, '\n> ')}` : '';
          const formattedThinking = (stepsPart || reasoningPart) ? `${stepsPart}${reasoningPart}\n\n` : '';
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === modelMessageId ? { ...msg, text: formattedThinking + answerText } : msg
            )
          );
        };

        await streamKimiK3Response(
          text,
          attachments,
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
              setMessages((prev) =>
                prev.map((msg) => {
                  if (msg.id === modelMessageId) return { ...msg, isStreaming: false };
                  if (msg.id === userMessage.id) return { ...msg, status: 'read' };
                  return msg;
                })
              );
              setIsLoading(false);
              if (readAloud && full) {
                speakText(full, ttsVoice);
              }
            },
            onError: (err: any) => {
              answerText += `\n\n**Error:** ${err?.message ?? 'Something went wrong.'}`;
              updateUI();
              setMessages((prev) =>
                prev.map((msg) => {
                  if (msg.id === modelMessageId) return { ...msg, isStreaming: false };
                  return msg;
                })
              );
              setIsLoading(false);
            }
          }
        );
      } catch (error) {
        console.error('KimiK3 Chat error:', error);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === modelMessageId ? { ...msg, text: '**Error:** Failed to load Kimi-K3 service.', isStreaming: false } : msg
          )
        );
        setIsLoading(false);
      }
      return;
    }

    try {
      let responseStream = await chatRef.current.sendMessageStream({ message: messageToSend });
      
      let fullText = '';
      let chunks: any[] = [];
      let functionCalls: any[] = [];
      
      let isFirstChunk = true;
      for await (const chunk of responseStream) {
        if (isFirstChunk) {
          setMessages((prev) => prev.map((msg) => msg.id === userMessage.id ? { ...msg, status: 'delivered' } : msg));
          isFirstChunk = false;
        }
        if (chunk.text) fullText += chunk.text;
        if (chunk.candidates?.[0]?.groundingMetadata?.groundingChunks) {
          chunks = chunk.candidates[0].groundingMetadata.groundingChunks;
        }
        if (chunk.functionCalls) {
          functionCalls.push(...chunk.functionCalls);
        }
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === modelMessageId ? { ...msg, text: fullText, groundingChunks: chunks } : msg
          )
        );
      }

      if (functionCalls.length > 0) {
        const toolResponses = functionCalls.map(call => {
          if (call.name === 'save_memory') {
            const fact = call.args?.fact;
            if (fact) {
              setMemory(prev => {
                if (!prev.includes(fact)) return [...prev, fact];
                return prev;
              });
            }
            return {
              functionResponse: {
                name: 'save_memory',
                response: { status: 'success', fact_saved: fact }
              }
            };
          }
          return null;
        }).filter(Boolean);

        if (toolResponses.length > 0) {
          const followUpStream = await chatRef.current.sendMessageStream({ message: toolResponses });
          for await (const chunk of followUpStream) {
            if (chunk.text) fullText += chunk.text;
            if (chunk.candidates?.[0]?.groundingMetadata?.groundingChunks) {
              chunks = chunk.candidates[0].groundingMetadata.groundingChunks;
            }
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === modelMessageId ? { ...msg, text: fullText, groundingChunks: chunks } : msg
              )
            );
          }
        }
      }

      if (readAloud && fullText) {
        speakText(fullText, ttsVoice);
      }

    } catch (error: any) {
      console.error('Chat error:', error);
      const errorMessage = error?.message || 'Sorry, an error occurred while processing your request. Please try again.';
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === modelMessageId ? { ...msg, text: `**Error:** ${errorMessage}` } : msg
        )
      );
    } finally {
      setIsLoading(false);
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === modelMessageId) return { ...msg, isStreaming: false };
          if (msg.id === userMessage.id) return { ...msg, status: 'read' };
          return msg;
        })
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
    
    handleSendMessage(lastUserMessage.text, lastUserMessage.attachments);
  };

  const handleExportMessage = (message: Message) => {
    const element = document.createElement("a");
    const file = new Blob([message.text], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `ai-response-${message.id}.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handlePinMessage = (messageId: string) => {
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, pinned: !m.pinned } : m));
  };

  const scrollToMessage = (msgId: string) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-purple-500', 'ring-offset-2');
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-purple-500', 'ring-offset-2');
      }, 2000);
    }
  };

  const pinnedMessages = messages.filter(m => m.pinned);

  return (
    <div className={`flex h-full w-full relative overflow-hidden ${isDarkMode ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-900'}`}>
      {/* Main Chat Panel */}
      <div className="flex-1 flex flex-col h-full relative overflow-hidden">
        <SystemStatus />
        <div className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border-b p-3 flex justify-between items-center z-10`}>
          <div className="flex items-center gap-2 mr-2 min-w-0">
            <div className={`flex-1 min-w-0 flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm overflow-x-auto hide-scrollbar whitespace-nowrap ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              <span className={`font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{mode === 'chat-pro' ? 'Pro Chat' : 'Fast Chat'}</span>
              <span className={`px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-purple-950/40 text-purple-400 border border-purple-900/30' : 'bg-purple-50 text-purple-600'}`}>{selectedModel === 'kimi-k3' ? '👑 Kimi-K3' : '💎 Gemini'}</span>
              <span className={`px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>{language}</span>
              <span className={`px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>{personality}</span>
              {urlContext && <span className={`px-2 py-0.5 rounded-full flex items-center gap-1 ${isDarkMode ? 'bg-blue-900/50 text-blue-400' : 'bg-blue-50 text-blue-600'}`}><LinkIcon size={10} className="sm:w-3 sm:h-3"/> URL Context</span>}
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <button 
              onClick={() => {
                if (window.confirm('Are you sure you want to clear the current chat history?')) {
                  setMessages([]);
                  setTimeout(() => initChat(), 0);
                }
              }}
              title="Clear Current History"
              className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'text-slate-400 hover:bg-red-900/30 hover:text-red-400' : 'text-slate-400 hover:bg-red-50 hover:text-red-500'}`}
            >
              <Trash2 size={18} />
            </button>
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-lg transition-colors ${showSettings ? `bg-opacity-20 ${getAccentClass()}` : `${isDarkMode ? 'text-slate-400 hover:bg-slate-700' : 'text-slate-400 hover:bg-slate-100'}`}`}
            >
              <Settings2 size={18} />
            </button>
            <button 
              onClick={() => setShowHistory(!showHistory)}
              title="Toggle Chat History"
              className={`p-1.5 rounded-md transition-colors ${showHistory ? `bg-opacity-20 ${getAccentClass()}` : `${isDarkMode ? 'text-slate-400 hover:bg-slate-700' : 'text-slate-400 hover:bg-slate-100'}`}`}
            >
              <MessageSquare size={18} />
            </button>
          </div>
        </div>

        {showSettings && (
          <div className={`absolute top-14 left-0 right-0 border-b p-4 shadow-lg z-20 animate-in slide-in-from-top-2 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
              <div>
                <label className={`flex items-center gap-2 text-sm font-medium mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}><Brain size={14}/> Active Model</label>
                <select 
                  value={selectedModel} 
                  onChange={(e) => setSelectedModel(e.target.value as 'gemini' | 'kimi-k3')}
                  className={`w-full p-2 text-sm rounded-lg border focus:ring-2 outline-none ${isDarkMode ? 'bg-slate-900 border-slate-600 focus:ring-purple-500 text-white' : 'border-slate-300 focus:ring-purple-500'}`}
                >
                  <option value="gemini">💎 Gemini 3.5</option>
                  <option value="kimi-k3">👑 Kimi-K3 (Super Reasoning)</option>
                </select>
              </div>
              <div>
                <label className={`flex items-center gap-2 text-sm font-medium mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}><Globe size={14}/> Language</label>
                <select 
                  value={language} 
                  onChange={(e) => setLanguage(e.target.value)}
                  className={`w-full p-2 text-sm rounded-lg border focus:ring-2 outline-none ${isDarkMode ? 'bg-slate-900 border-slate-600 focus:ring-emerald-500 text-white' : 'border-slate-300 focus:ring-emerald-500'}`}
                >
                  <option value="English">English</option>
                  <option value="Spanish">Spanish</option>
                  <option value="French">French</option>
                  <option value="German">German</option>
                  <option value="Japanese">Japanese</option>
                  <option value="Chinese">Chinese</option>
                  <option value="Hindi">Hindi</option>
                  <option value="Arabic">Arabic</option>
                  <option value="Portuguese">Portuguese</option>
                  <option value="Russian">Russian</option>
                  <option value="Korean">Korean</option>
                  <option value="Italian">Italian</option>
                  <option value="Dutch">Dutch</option>
                  <option value="Turkish">Turkish</option>
                  <option value="Vietnamese">Vietnamese</option>
                  <option value="Polish">Polish</option>
                  <option value="Indonesian">Indonesian</option>
                  <option value="Thai">Thai</option>
                </select>
              </div>
              <div>
                <label className={`flex items-center gap-2 text-sm font-medium mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}><UserCircle size={14}/> Personality</label>
                <select 
                  value={personality} 
                  onChange={(e) => setPersonality(e.target.value)}
                  className={`w-full p-2 text-sm rounded-lg border focus:ring-2 outline-none ${isDarkMode ? 'bg-slate-900 border-slate-600 focus:ring-emerald-500 text-white' : 'border-slate-300 focus:ring-emerald-500'}`}
                >
                  <option value="Friendly">Friendly</option>
                  <option value="Formal">Formal</option>
                  <option value="Witty">Witty</option>
                  <option value="Sarcastic">Sarcastic</option>
                  <option value="Pirate">Pirate</option>
                  <option value="Poetic">Poetic</option>
                  <option value="Cynical">Cynical</option>
                  <option value="Humorous">Humorous</option>
                  <option value="Verbose">Verbose</option>
                  <option value="Empathetic">Empathetic</option>
                  <option value="Direct">Direct</option>
                </select>
              </div>
              <div>
                <label className={`flex items-center gap-2 text-sm font-medium mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}><LinkIcon size={14}/> URL Context (Optional)</label>
                <input 
                  type="url" 
                  value={urlContext}
                  onChange={(e) => setUrlContext(e.target.value)}
                  placeholder="https://example.com"
                  className={`w-full p-2 text-sm rounded-lg border focus:ring-2 outline-none ${isDarkMode ? 'bg-slate-900 border-slate-600 focus:ring-emerald-500 text-white placeholder-slate-500' : 'border-slate-300 focus:ring-emerald-500'}`}
                />
              </div>
              <div className="flex items-center mt-6">
                <label className={`flex items-center gap-2 text-sm font-medium cursor-pointer ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  <input 
                    type="checkbox" 
                    checked={useWebSearch}
                    onChange={(e) => setUseWebSearch(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                  />
                  <Globe size={14}/> Enable Google Search
                </label>
              </div>
            </div>
            <div className={`mt-4 text-xs text-center ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Note: Changing settings will apply to future messages in this conversation.
            </div>
          </div>
        )}

        {/* Pinned Messages Banner */}
        {pinnedMessages.length > 0 && (
          <div className={`shrink-0 border-b px-4 py-2 flex flex-col gap-1.5 transition-all ${isDarkMode ? 'bg-purple-950/40 border-purple-800/30' : 'bg-purple-50 border-purple-100'}`}>
            <div className={`flex items-center justify-between text-xs font-semibold ${isDarkMode ? 'text-purple-300' : 'text-purple-700'}`}>
              <div className="flex items-center gap-1.5">
                <Pin size={13} className={isDarkMode ? 'text-purple-400 fill-purple-400/40' : 'text-purple-600 fill-purple-600/30'} />
                <span>Anchored / Pinned Messages ({pinnedMessages.length})</span>
              </div>
              <button 
                onClick={() => setMessages(prev => prev.map(m => ({ ...m, pinned: false })))}
                className={`text-[10px] underline transition-colors ${isDarkMode ? 'text-purple-400 hover:text-purple-200' : 'text-purple-600 hover:text-purple-800'}`}
              >
                Unpin All
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto py-1 hide-scrollbar">
              {pinnedMessages.map((pm) => (
                <div
                  key={pm.id}
                  onClick={() => scrollToMessage(pm.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs shrink-0 max-w-[280px] cursor-pointer transition-all shadow-sm ${
                    isDarkMode ? 'bg-slate-800/80 border-purple-500/30 text-white hover:bg-slate-800' : 'bg-white border-purple-200 text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <span className={`shrink-0 font-bold text-[10px] uppercase ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>
                    {pm.role === 'user' ? 'You' : 'AI'}:
                  </span>
                  <span className="truncate flex-1 text-[11px]">
                    {pm.text || (pm.attachments?.length ? `[${pm.attachments.length} attachment(s)]` : 'Pinned message')}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handlePinMessage(pm.id); }}
                    className="p-1 rounded-md opacity-60 hover:opacity-100 hover:text-red-500 transition-all"
                    title="Unpin message"
                  >
                    <PinOff size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className={`flex flex-col items-center justify-center h-full p-8 text-center ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${isDarkMode ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-100 text-emerald-500'}`}>
                <span className="text-2xl font-bold">AI</span>
              </div>
              <h2 className={`text-xl font-semibold mb-2 ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                {mode === 'chat-pro' ? 'Pro Chat (Thinking)' : 'Fast Chat'}
              </h2>
              <p className="max-w-md">
                {mode === 'chat-pro' 
                  ? 'Powered by gemini-3.1-pro-preview. Best for complex reasoning, coding, and deep analysis.'
                  : 'Powered by gemini-3.1-flash-lite-preview. Best for quick answers and low-latency interactions.'}
              </p>
            </div>
          ) : (
            <div className={`flex flex-col gap-2 p-2 sm:p-4`}>
              {messages.map((msg) => (
                <ChatMessage 
                  key={msg.id} 
                  message={msg} 
                  onEdit={handleEditMessage}
                  onRegenerate={handleRegenerateMessage}
                  onDelete={handleDeleteMessage}
                  onExport={handleExportMessage}
                  onPin={handlePinMessage}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
        <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} draftKey="omnichat_draft_chat" />
      </div>

      {/* Sidebar Panel */}
      <AnimatePresence initial={false}>
        {showHistory && (
          <motion.div 
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 260, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            style={{ willChange: 'width, opacity' }}
            className={`flex flex-row justify-end h-full border-l overflow-hidden shrink-0 ${isDarkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-slate-50/50'}`}
          >
            <div style={{ width: 260 }} className="flex flex-col h-full shrink-0">
              <div className={`p-3 border-b flex justify-between items-center ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                <h3 className={`font-semibold text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Chat History</h3>
                <button 
                  onClick={createNewChat} 
                  title="New Chat"
                  className={`p-1.5 rounded-md transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-200 text-slate-500 hover:text-slate-900'}`}
                >
                  <Plus size={16} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {conversations.map(conv => (
                  <div 
                    key={conv.id}
                    onClick={() => setCurrentConversationId(conv.id)}
                    className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                      currentConversationId === conv.id 
                        ? (isDarkMode ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-900') 
                        : (isDarkMode ? 'hover:bg-slate-800/50 text-slate-400 hover:text-slate-200' : 'hover:bg-slate-200/50 text-slate-600 hover:text-slate-800')
                    }`}
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <MessageSquare size={14} className="shrink-0 opacity-50" />
                      <span className="text-sm truncate">{conv.title}</span>
                    </div>
                    <button 
                      onClick={(e) => deleteConversation(conv.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-red-500 transition-all"
                      title="Delete Chat"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {conversations.length === 0 && (
                  <div className={`text-center p-4 text-sm ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    No past conversations
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
