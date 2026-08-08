import React, { useState, useRef } from 'react';
import { Send, Loader2, Mic, Square, Paperclip, X, FileText, Archive, Video, Plus, ScanEye, Sparkles, HelpCircle, Monitor, Smile } from 'lucide-react';
import { transcribeAudio } from '../services/gemini';
import { useTheme } from '../contexts/ThemeContext';
import { useSettings } from '../contexts/SettingsContext';
import { Attachment } from '../types';
import { AttachmentBottomSheet } from './AttachmentBottomSheet';
import { AttachmentFile } from '../utils/attachmentSystem';
import { OcrModal } from './OcrModal';
import { ScreenStreamModal } from './ScreenStreamModal';
import { useAutoSaveDraft } from '../hooks/useAutoSaveDraft';

const EMOJI_LIST = [
  '😊', '👍', '❤️', '🔥', '🎉', '✨', '🚀', '💡', '💯', '🙌', '👏', '🙏', 
  '🤖', '⚡', '🧠', '💻', '📱', '🌐', '🔮', '⚙️', '📊', '📁', '🛠️', '🔑',
  '😄', '😎', '🤔', '🤩', '🥳', '🧐', '😇', '😍', '😜', '😅', '😴', '🤗',
  '📝', '📌', '📎', '📅', '📈', '🎨', '💬', '🏆', '🎯', '⭐', '🔔', '🏷️'
];

interface ChatInputProps {
  onSendMessage: (message: string, attachments?: Attachment[]) => void;
  isLoading: boolean;
  placeholder?: string;
  draftKey?: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({ 
  onSendMessage, 
  isLoading, 
  placeholder = "Type your message...",
  draftKey = "omnichat_draft_chatinput" 
}) => {
  const { isDarkMode, getBorderClass, getAccentClass } = useTheme();
  const { micId, setMicPermissionError } = useSettings();
  const [input, setInput, clearDraft] = useAutoSaveDraft(draftKey);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [isScreenStreamOpen, setIsScreenStreamOpen] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [ocrActiveImage, setOcrActiveImage] = useState<{ src: string; name: string; type: string } | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((input.trim() || attachments.length > 0) && !isLoading && !isTranscribing) {
      onSendMessage(input.trim(), attachments);
      clearDraft();
      setAttachments([]);
    }
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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsTranscribing(true);
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
        
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64data = reader.result as string;
          const base64Audio = base64data.split(',')[1];
          
          try {
            const response = await transcribeAudio(base64Audio, audioBlob.type || 'audio/webm');
            if (response.text) {
              setInput((prev) => prev + (prev ? ' ' : '') + response.text);
            }
          } catch (error) {
            console.error('Transcription error:', error);
            alert('Failed to transcribe audio. Please try again.');
          } finally {
            setIsTranscribing(false);
          }
        };
        
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setMicPermissionError(true);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleBottomSheetSelect = (selectedFiles: AttachmentFile[]) => {
    const formatted: Attachment[] = selectedFiles.map(file => ({
      name: file.name,
      type: file.type,
      base64: file.base64
    }));
    setAttachments(prev => {
      const merged = [...prev];
      formatted.forEach(f => {
        if (!merged.some(existing => existing.name === f.name)) {
          merged.push(f);
        }
      });
      return merged;
    });
  };

  return (
    <div 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`p-3 sm:p-4 border-t relative transition-all duration-200 ${getBorderClass()} ${
        isDragging 
          ? (isDarkMode ? 'bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/20' : 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20') 
          : (isDarkMode ? 'bg-slate-900/80' : 'bg-white/80')
      } backdrop-blur-md`}
    >
      {isDragging && (
        <div className="absolute inset-0 m-1 sm:m-2 z-30 flex flex-col items-center justify-center bg-emerald-500/10 backdrop-blur-sm border-2 border-dashed border-emerald-500 rounded-2xl pointer-events-none animate-pulse">
          <Paperclip className="text-emerald-500 mb-1" size={24} />
          <span className="text-xs font-semibold text-emerald-500">Drop files here to attach</span>
        </div>
      )}
      {attachments.length > 0 && (
        <div className="flex flex-col gap-2 mb-3 max-w-4xl mx-auto px-1">
          {/* Quick Action Chips when Images are attached */}
          {attachments.some(a => a.type.startsWith('image/')) && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <span className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider flex items-center gap-1 shrink-0">
                <ScanEye size={12} /> Image OCR Actions:
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
                  setInput(prev => prev + (prev ? ' ' : '') + 'Please extract and analyze all text contained inside the attached image, then answer any questions about it.');
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-violet-500/15 border border-violet-500/30 text-violet-300 font-medium hover:bg-violet-500/25 transition-all shrink-0 cursor-pointer"
              >
                <HelpCircle size={12} />
                <span>Ask about image text</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setInput(prev => prev + (prev ? ' ' : '') + 'Extract all tabular data, tables, and structured figures from the attached image into clean Markdown tables.');
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-medium hover:bg-emerald-500/25 transition-all shrink-0 cursor-pointer"
              >
                <Sparkles size={12} />
                <span>Extract Tables / Data</span>
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
                  className={`relative flex items-center gap-2 pl-2 pr-14 py-1.5 rounded-xl border text-xs ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
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

      {/* Emoji Picker Popover */}
      {showEmojiPicker && (
        <div className="absolute bottom-20 left-4 sm:left-6 z-50 p-3 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl backdrop-blur-xl animate-in fade-in-50 zoom-in-95 duration-200 max-w-xs w-72">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Smile size={14} className="text-amber-400" /> Choose Emoji
            </span>
            <button 
              type="button" 
              onClick={() => setShowEmojiPicker(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={13} />
            </button>
          </div>
          <div className="grid grid-cols-6 gap-1.5 max-h-48 overflow-y-auto p-1 scrollbar-thin">
            {EMOJI_LIST.map((emoji, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setInput(prev => prev + emoji);
                }}
                className="w-8 h-8 rounded-xl text-lg flex items-center justify-center hover:bg-white/10 active:scale-95 transition-transform cursor-pointer"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="relative flex items-center gap-2 sm:gap-3 max-w-4xl mx-auto">
        {/* Hidden File Input */}
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          className="hidden" 
          multiple 
          accept="image/*,video/*,application/pdf,application/zip,application/x-zip-compressed,.zip" 
        />

        {/* 📎 Attachment Paperclip Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={`p-2.5 sm:p-3 rounded-full transition-all shrink-0 ${
            isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
          } hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center`}
          title="Attach files (Photos, PDFs, Docs, ZIP)"
        >
          <Paperclip size={18} className="sm:w-5 sm:h-5 text-indigo-400" />
        </button>

        {/* 😊 Emoji Picker Button */}
        <button
          type="button"
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className={`p-2.5 sm:p-3 rounded-full transition-all shrink-0 ${
            showEmojiPicker 
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              : isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
          } hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center`}
          title="Insert Emoji"
        >
          <Smile size={18} className="sm:w-5 sm:h-5 text-amber-400" />
        </button>

        {/* + Plugins & Workspace Bottom Sheet Button */}
        <button
          type="button"
          onClick={() => setIsBottomSheetOpen(true)}
          className={`p-2.5 sm:p-3 rounded-full transition-all shrink-0 ${
            isDarkMode ? 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'
          } hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center`}
          title="More Attachment Options & Workspace Plugins"
        >
          <Plus size={18} className="sm:w-5 sm:h-5" />
        </button>
        
        {/* Type message... Input */}
        <div className="relative flex-1 flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isTranscribing ? "Transcribing voice..." : isRecording ? "Listening..." : placeholder}
            disabled={isLoading || isTranscribing || isRecording}
            className={`w-full pl-4 pr-12 py-3 sm:py-3.5 rounded-2xl border focus:outline-none focus:ring-2 focus:border-transparent disabled:opacity-50 transition-all shadow-sm text-sm sm:text-base ${
              isDarkMode 
                ? `bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:ring-emerald-500 disabled:bg-slate-800/50` 
                : `bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:ring-emerald-500 disabled:bg-slate-50`
            }`}
          />
          
          {/* ➤ Send Button inside input right corner */}
          <button
            type="submit"
            disabled={(!input.trim() && attachments.length === 0) || isLoading || isTranscribing || isRecording}
            className={`absolute right-1.5 p-2 sm:p-2.5 rounded-xl text-white transition-all disabled:opacity-40 disabled:scale-95 ${
              (input.trim() || attachments.length > 0) && !isLoading && !isTranscribing && !isRecording
                ? (isDarkMode ? 'bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-900/20 scale-100' : 'bg-emerald-500 hover:bg-emerald-600 shadow-md shadow-emerald-500/20 scale-100')
                : (isDarkMode ? 'bg-slate-700 text-slate-500' : 'bg-slate-200 text-slate-400')
            }`}
            title="Send Message"
          >
            {isLoading || isTranscribing ? <Loader2 size={16} className="animate-spin sm:w-[18px] sm:h-[18px]" /> : <Send size={16} className="sm:w-[18px] sm:h-[18px] translate-x-[1px] translate-y-[1px]" />}
          </button>
        </div>

        {/* 🎤 Voice Microphone Button */}
        <button
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isLoading || isTranscribing}
          className={`p-2.5 sm:p-3 rounded-full transition-all shrink-0 ${
            isRecording 
              ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse shadow-md shadow-red-500/20' 
              : `${isDarkMode ? 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'}`
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          title={isRecording ? "Stop recording" : "Voice input (Microphone)"}
        >
          {isRecording ? <Square size={18} className="fill-current sm:w-5 sm:h-5 text-red-100" /> : <Mic size={18} className="sm:w-5 sm:h-5 text-emerald-400" />}
        </button>

        {/* Live Screen Stream AI Vision Button */}
        <button
          type="button"
          onClick={() => setIsScreenStreamOpen(true)}
          disabled={isLoading}
          className={`p-2.5 sm:p-3 rounded-full transition-all shrink-0 ${
            isDarkMode
              ? 'bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/25 border border-cyan-500/30'
              : 'bg-cyan-50 text-cyan-600 hover:bg-cyan-100 border border-cyan-200'
          } hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center disabled:opacity-50`}
          title="Screen Capture & AI Vision Stream"
        >
          <Monitor size={18} className="sm:w-5 sm:h-5" />
        </button>
      </form>

      <AttachmentBottomSheet 
        isOpen={isBottomSheetOpen}
        onClose={() => setIsBottomSheetOpen(false)}
        onSelectAttachments={handleBottomSheetSelect}
        currentAttachments={attachments.map((att, i) => ({
          id: i.toString(),
          name: att.name,
          type: att.type,
          size: Math.round(att.base64.length * 0.75),
          base64: att.base64,
          status: 'completed',
          progress: 100
        }))}
      />

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

      <ScreenStreamModal
        isOpen={isScreenStreamOpen}
        onClose={() => setIsScreenStreamOpen(false)}
        onSendToChat={(text, imageBase64) => {
          if (imageBase64) {
            const rawBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
            onSendMessage(text, [{
              name: 'screen_capture_' + Date.now() + '.jpg',
              type: 'image/jpeg',
              base64: rawBase64
            }]);
          } else {
            onSendMessage(text);
          }
        }}
      />
    </div>
  );
};
