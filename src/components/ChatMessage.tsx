import React, { useState, useEffect } from 'react';
import { Message } from '../types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { 
  Bot, User, Volume2, Loader2, Square, Check, CheckCheck, FileText, 
  Archive, Download, Copy, ThumbsUp, ThumbsDown, Share2, MoreHorizontal, 
  Edit2, RefreshCw, Trash2, Pin, PinOff, ScanEye
} from 'lucide-react';
import { generateSpeech } from '../services/gemini';
import { useTheme } from '../contexts/ThemeContext';
import { useSettings } from '../contexts/SettingsContext';
import { motion } from 'motion/react';
import { OcrModal } from './OcrModal';

interface ChatMessageProps {
  message: Message;
  onEdit?: (messageId: string, newText: string) => void;
  onRegenerate?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  onExport?: (message: Message) => void;
  onPin?: (messageId: string) => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ 
  message,
  onEdit,
  onRegenerate,
  onDelete,
  onExport,
  onPin
}) => {
  const { isDarkMode, getBorderClass } = useTheme();
  const { userProfile } = useSettings();
  const isUser = message.role === 'user';
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  const [isLiked, setIsLiked] = useState(false);
  const [isDisliked, setIsDisliked] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.text);
  const [ocrActiveImage, setOcrActiveImage] = useState<{ src: string; name: string; type: string } | null>(null);

  const [displayedText, setDisplayedText] = useState(isUser ? message.text : '');

  useEffect(() => {
    if (isUser) {
      setDisplayedText(message.text);
      return;
    }

    let isCancelled = false;
    let index = displayedText.length;
    
    if (message.text.length < displayedText.length) {
      setDisplayedText(message.text);
      return;
    }

    const typeNextCharacter = () => {
      if (isCancelled) return;

      if (index < message.text.length) {
        const remainingLength = message.text.length - index;
        const step = remainingLength > 50 ? 5 : remainingLength > 20 ? 3 : 1;
        
        index += step;
        setDisplayedText(message.text.slice(0, index));
        
        const delay = message.isStreaming ? 10 : 5;
        setTimeout(typeNextCharacter, delay);
      }
    };

    typeNextCharacter();

    return () => {
      isCancelled = true;
    };
  }, [message.text, isUser, message.isStreaming]);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'OmniChat AI Response',
        text: message.text,
      }).catch((err) => console.log('Error sharing:', err));
    } else {
      handleCopy();
    }
  };

  const handleLike = () => {
    setIsLiked(!isLiked);
    if (!isLiked) {
      setIsDisliked(false);
    }
  };

  const handleDislike = () => {
    setIsDisliked(!isDisliked);
    if (!isDisliked) {
      setIsLiked(false);
    }
  };

  const handlePlayAudio = async () => {
    if (isPlaying && audioElement) {
      audioElement.pause();
      setIsPlaying(false);
      return;
    }

    if (!message.text) return;

    setIsGenerating(true);
    try {
      const response = await generateSpeech(message.text);
      const inlineData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      
      if (inlineData && inlineData.data) {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        
        const binaryString = window.atob(inlineData.data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        const pcm16 = new Int16Array(bytes.buffer);
        const float32 = new Float32Array(pcm16.length);
        for (let i = 0; i < pcm16.length; i++) {
          float32[i] = pcm16[i] / 32768.0;
        }
        
        const audioBuffer = audioCtx.createBuffer(1, float32.length, 24000);
        audioBuffer.getChannelData(0).set(float32);
        
        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioCtx.destination);
        source.onended = () => setIsPlaying(false);
        source.start(0);
        
        setAudioElement({ pause: () => { source.stop(); audioCtx.close(); } } as any);
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('TTS error:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return null;
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: isUser ? 24 : -24, y: 8 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 280 }}
      className={`flex gap-3 sm:gap-4 p-2 sm:p-4 ${isUser ? 'flex-row-reverse' : 'flex-row'} group`}
    >
      <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm overflow-hidden ${isUser ? (isDarkMode ? 'bg-indigo-600 text-white' : 'bg-indigo-500 text-white') : (isDarkMode ? 'bg-emerald-600 text-white' : 'bg-emerald-500 text-white')}`}>
        {isUser ? (
          userProfile.avatarUrl ? (
            <img src={userProfile.avatarUrl} alt="User Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : userProfile.name ? (
            <span className="text-xs sm:text-sm font-bold">{getInitials(userProfile.name)}</span>
          ) : (
            <User size={18} />
          )
        ) : (
          <Bot size={18} />
        )}
      </div>
      
      <div className={`flex flex-col max-w-[85%] sm:max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`flex items-center gap-2 mb-1.5 px-1`}>
          <span className={`text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            {isUser ? (userProfile.name || 'You') : 'OmniChat AI'}
          </span>
          {message.timestamp && (
            <div className={`text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'} flex items-center gap-1`}>
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {isUser && (
                <span className="opacity-70" title={message.status || 'sent'}>
                  {message.status === 'read' ? (
                    <CheckCheck size={12} className={isDarkMode ? 'text-indigo-400' : 'text-indigo-500'} />
                  ) : message.status === 'delivered' ? (
                    <CheckCheck size={12} className={isDarkMode ? 'text-slate-400' : 'text-slate-400'} />
                  ) : (
                    <Check size={12} className={isDarkMode ? 'text-slate-400' : 'text-slate-400'} />
                  )}
                </span>
              )}
            </div>
          )}
          {onPin && (
            <button
              onClick={() => onPin(message.id)}
              className={`p-0.5 rounded transition-all ${
                message.pinned
                  ? 'text-violet-500 opacity-100'
                  : 'opacity-0 group-hover/bubble:opacity-100 text-slate-400 hover:text-slate-200'
              }`}
              title={message.pinned ? "Unpin message" : "Pin message to top"}
            >
              <Pin size={11} className={message.pinned ? 'fill-violet-500' : ''} />
            </button>
          )}
        </div>
        
        <div className="relative group/bubble" id={`msg-${message.id}`}>
          {message.pinned && (
            <div 
              className={`absolute -top-2 ${isUser ? '-left-2' : '-right-2'} bg-violet-600 text-white p-1 rounded-full shadow-lg border border-violet-400/50 z-10 flex items-center justify-center`}
              title="Pinned message"
            >
              <Pin size={10} className="fill-white" />
            </div>
          )}
          <div className={`px-4 py-3 sm:px-5 sm:py-4 rounded-2xl shadow-sm ${
            isUser 
              ? (isDarkMode ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-indigo-500 text-white rounded-tr-sm')
              : (isDarkMode ? 'bg-slate-800 text-slate-200 rounded-tl-sm border border-slate-700' : 'bg-white text-slate-800 rounded-tl-sm border border-slate-200')
          }`}>
            {message.attachments && message.attachments.length > 0 && (
              <div className="flex flex-col gap-2 mb-3 max-w-full">
                {message.attachments.map((att, i) => {
                  const hasBase64 = !!att.base64;
                  const dataUrl = hasBase64 ? `data:${att.type};base64,${att.base64}` : '';
                  if (att.type.startsWith('image/') && hasBase64) {
                    return (
                      <div key={i} className="relative group/img max-w-xs inline-block">
                        <img 
                          src={dataUrl} 
                          alt={att.name} 
                          className="max-w-xs max-h-60 rounded-lg object-contain bg-black/5 border border-white/10" 
                        />
                        <button
                          onClick={() => {
                            setOcrActiveImage({
                              src: att.base64,
                              name: att.name,
                              type: att.type
                            });
                          }}
                          className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-lg bg-black/75 hover:bg-cyan-600 text-white text-[10px] font-bold border border-white/20 shadow-lg opacity-80 group-hover/img:opacity-100 transition-all cursor-pointer"
                          title="Extract Text (OCR)"
                        >
                          <ScanEye size={12} className="text-cyan-400 group-hover/img:text-white" />
                          <span>Scan OCR</span>
                        </button>
                      </div>
                    );
                  } else if (att.type.startsWith('video/') && hasBase64) {
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
                    const itemClasses = `flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-medium transition-colors max-w-xs ${
                      isUser
                        ? 'bg-white/10 border-white/20 text-white hover:bg-white/20'
                        : (isDarkMode ? 'bg-slate-900/60 border-slate-700 text-slate-200 hover:bg-slate-900/80' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100')
                    }`;
                    if (hasBase64) {
                      return (
                        <a 
                          key={i} 
                          href={dataUrl} 
                          download={att.name}
                          className={itemClasses}
                        >
                          {isPdf ? (
                            <FileText size={18} className={isUser ? 'text-white' : 'text-red-400'} />
                          ) : isZip ? (
                            <Archive size={18} className={isUser ? 'text-white' : 'text-amber-400'} />
                          ) : (
                            <FileText size={18} className={isUser ? 'text-white' : 'text-slate-400'} />
                          )}
                          <span className="truncate flex-1">{att.name}</span>
                          <Download size={14} className="shrink-0 opacity-60" />
                        </a>
                      );
                    } else {
                      return (
                        <div 
                          key={i} 
                          className={`${itemClasses} opacity-85`}
                          title="File metadata preserved"
                        >
                          {isPdf ? (
                            <FileText size={18} className={isUser ? 'text-white' : 'text-red-400'} />
                          ) : isZip ? (
                            <Archive size={18} className={isUser ? 'text-white' : 'text-amber-400'} />
                          ) : (
                            <FileText size={18} className={isUser ? 'text-white' : 'text-slate-400'} />
                          )}
                          <span className="truncate flex-1">{att.name} (Uploaded)</span>
                        </div>
                      );
                    }
                  }
                })}
              </div>
            )}
            {message.isStreaming && !message.text ? (
              <div className="flex items-center gap-1.5 h-6 px-2">
                <div className={`w-2 h-2 rounded-full animate-bounce ${isUser ? 'bg-white/70' : (isDarkMode ? 'bg-emerald-500' : 'bg-emerald-500')}`} style={{ animationDelay: '0ms' }}></div>
                <div className={`w-2 h-2 rounded-full animate-bounce ${isUser ? 'bg-white/70' : (isDarkMode ? 'bg-emerald-500' : 'bg-emerald-500')}`} style={{ animationDelay: '150ms' }}></div>
                <div className={`w-2 h-2 rounded-full animate-bounce ${isUser ? 'bg-white/70' : (isDarkMode ? 'bg-emerald-500' : 'bg-emerald-500')}`} style={{ animationDelay: '300ms' }}></div>
              </div>
            ) : isEditing ? (
              <div className="space-y-3 w-full min-w-[240px] sm:min-w-[320px] py-1">
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className={`w-full p-3 text-sm rounded-xl border outline-none focus:ring-2 font-sans transition-all duration-200 resize-none ${
                    isDarkMode 
                      ? 'bg-slate-900 border-slate-700 focus:ring-indigo-500 text-slate-100 placeholder-slate-500' 
                      : 'bg-slate-50 border-slate-200 focus:ring-indigo-500 text-slate-900 placeholder-slate-400'
                  }`}
                  rows={Math.max(3, editText.split('\n').length)}
                  placeholder="Edit message..."
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditText(message.text);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      isDarkMode ? 'bg-slate-700 hover:bg-slate-650 text-slate-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      if (onEdit) onEdit(message.id, editText);
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-500 hover:bg-indigo-600 text-white transition-colors shadow-md shadow-indigo-500/10"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <MarkdownRenderer content={displayedText} forceInvert={isUser} />
            )}
          </div>

          {!isUser && !message.isStreaming && message.text && (
            <div className="flex items-center gap-1 mt-2 text-slate-400 select-none animate-fade-in">
              {/* Pin */}
              <button
                onClick={() => onPin && onPin(message.id)}
                className={`p-1.5 rounded-lg transition-all ${
                  message.pinned
                    ? 'text-violet-500 bg-violet-500/10'
                    : isDarkMode ? 'hover:text-slate-100 hover:bg-slate-800' : 'hover:text-slate-800 hover:bg-slate-100'
                }`}
                title={message.pinned ? "Unpin message" : "Pin message to top"}
              >
                <Pin size={14} className={message.pinned ? 'fill-violet-500/20' : ''} />
              </button>

              {/* Copy */}
              <button
                onClick={handleCopy}
                className={`p-1.5 rounded-lg transition-all ${
                  isDarkMode 
                    ? 'hover:text-slate-100 hover:bg-slate-800' 
                    : 'hover:text-slate-800 hover:bg-slate-100'
                }`}
                title="Copy response"
              >
                {copied ? <Check size={14} className="text-emerald-500 animate-pulse" /> : <Copy size={14} />}
              </button>

              {/* Like */}
              <button
                onClick={handleLike}
                className={`p-1.5 rounded-lg transition-all ${
                  isLiked 
                    ? 'text-emerald-500' 
                    : isDarkMode ? 'hover:text-slate-100 hover:bg-slate-800' : 'hover:text-slate-800 hover:bg-slate-100'
                }`}
                title="Like"
              >
                <ThumbsUp size={14} className={isLiked ? 'fill-emerald-500/20' : ''} />
              </button>

              {/* Dislike */}
              <button
                onClick={handleDislike}
                className={`p-1.5 rounded-lg transition-all ${
                  isDisliked 
                    ? 'text-rose-500' 
                    : isDarkMode ? 'hover:text-slate-100 hover:bg-slate-800' : 'hover:text-slate-800 hover:bg-slate-100'
                }`}
                title="Dislike"
              >
                <ThumbsDown size={14} className={isDisliked ? 'fill-rose-500/20' : ''} />
              </button>

              {/* Speak / Text-to-Speech */}
              <button
                onClick={handlePlayAudio}
                disabled={isGenerating}
                className={`p-1.5 rounded-lg transition-all ${
                  isPlaying 
                    ? 'text-indigo-500' 
                    : isDarkMode ? 'hover:text-slate-100 hover:bg-slate-800' : 'hover:text-slate-800 hover:bg-slate-100'
                }`}
                title={isPlaying ? "Stop playing" : "Speak text"}
              >
                {isGenerating ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : isPlaying ? (
                  <Square size={14} className="fill-indigo-500/10" />
                ) : (
                  <Volume2 size={14} />
                )}
              </button>

              {/* Share */}
              <button
                onClick={handleShare}
                className={`p-1.5 rounded-lg transition-all ${
                  isDarkMode 
                    ? 'hover:text-slate-100 hover:bg-slate-800' 
                    : 'hover:text-slate-800 hover:bg-slate-100'
                }`}
                title="Share"
              >
                <Share2 size={14} />
              </button>

              {/* More Actions Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className={`p-1.5 rounded-lg transition-all ${
                    showMenu
                      ? isDarkMode ? 'bg-slate-800 text-slate-100' : 'bg-slate-100 text-slate-800'
                      : isDarkMode ? 'hover:text-slate-100 hover:bg-slate-800' : 'hover:text-slate-800 hover:bg-slate-100'
                  }`}
                  title="More options"
                >
                  <MoreHorizontal size={14} />
                </button>

                {showMenu && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)} />
                    <div className={`absolute left-0 mt-1 w-36 rounded-xl border shadow-xl z-40 py-1.5 overflow-hidden animate-in fade-in slide-in-from-top-1 ${
                      isDarkMode 
                        ? 'bg-slate-850 border-slate-700 text-slate-200' 
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}>
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          setIsEditing(true);
                        }}
                        className={`w-full px-3 py-2 text-left text-xs font-semibold flex items-center gap-2 transition-colors ${
                          isDarkMode ? 'hover:bg-slate-800 hover:text-white' : 'hover:bg-slate-50 hover:text-slate-900'
                        }`}
                      >
                        <Edit2 size={13} />
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          if (onRegenerate) onRegenerate(message.id);
                        }}
                        className={`w-full px-3 py-2 text-left text-xs font-semibold flex items-center gap-2 transition-colors ${
                          isDarkMode ? 'hover:bg-slate-800 hover:text-white' : 'hover:bg-slate-50 hover:text-slate-900'
                        }`}
                      >
                        <RefreshCw size={13} />
                        Regenerate
                      </button>
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          if (onDelete) onDelete(message.id);
                        }}
                        className={`w-full px-3 py-2 text-left text-xs font-semibold flex items-center gap-2 transition-colors text-rose-500 ${
                          isDarkMode ? 'hover:bg-rose-950/30' : 'hover:bg-rose-50'
                        }`}
                      >
                        <Trash2 size={13} />
                        Delete
                      </button>
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          if (onExport) onExport(message);
                        }}
                        className={`w-full px-3 py-2 text-left text-xs font-semibold flex items-center gap-2 transition-colors ${
                          isDarkMode ? 'hover:bg-slate-800 hover:text-white' : 'hover:bg-slate-50 hover:text-slate-900'
                        }`}
                      >
                        <Download size={13} />
                        Export
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
        
        {message.groundingChunks && message.groundingChunks.length > 0 && (
          <div className={`mt-2 flex flex-wrap gap-1.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {message.groundingChunks.map((chunk, idx) => {
              if (chunk.web) {
                return (
                  <a key={idx} href={chunk.web.uri} target="_blank" rel="noopener noreferrer" className={`text-[10px] sm:text-xs px-2 py-1 rounded-full border flex items-center gap-1 transition-colors ${isDarkMode ? 'text-blue-400 hover:text-blue-300 bg-blue-900/20 border-blue-900/50 hover:bg-blue-900/40' : 'text-blue-600 hover:text-blue-700 bg-blue-50 border-blue-100 hover:bg-blue-100'}`}>
                    <span className="truncate max-w-[150px] sm:max-w-[200px]">{chunk.web.title || new URL(chunk.web.uri).hostname}</span>
                  </a>
                );
              }
              if (chunk.maps) {
                return (
                  <a key={idx} href={chunk.maps.uri} target="_blank" rel="noopener noreferrer" className={`text-[10px] sm:text-xs px-2 py-1 rounded-full border flex items-center gap-1 transition-colors ${isDarkMode ? 'text-emerald-400 hover:text-emerald-300 bg-emerald-900/20 border-emerald-900/50 hover:bg-emerald-900/40' : 'text-emerald-600 hover:text-emerald-700 bg-emerald-50 border-emerald-100 hover:bg-emerald-100'}`}>
                    <span className="truncate max-w-[150px] sm:max-w-[200px]">{chunk.maps.title || 'View on Google Maps'}</span>
                  </a>
                );
              }
              return null;
            })}
          </div>
        )}
      </div>

      {ocrActiveImage && (
        <OcrModal
          isOpen={!!ocrActiveImage}
          onClose={() => setOcrActiveImage(null)}
          imageSrc={ocrActiveImage.src}
          mimeType={ocrActiveImage.type}
          fileName={ocrActiveImage.name}
        />
      )}
    </motion.div>
  );
};

