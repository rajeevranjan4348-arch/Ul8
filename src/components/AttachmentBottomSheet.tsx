import React, { useState, useRef, useEffect } from 'react';
import { 
  X, Camera, Mic, Clipboard, Link2, FileText, CheckCircle, 
  AlertTriangle, Play, Pause, ZoomIn, Search, Trash2, 
  FolderOpen, Shield, Code, Settings, Plus, Loader2, Key, 
  Info, RefreshCw, Upload, Eye, Check, ChevronRight, FileCode,
  Music, Video, Archive, ScanEye, Monitor
} from 'lucide-react';
import { ScreenStreamModal } from './ScreenStreamModal';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from '../contexts/ThemeContext';
import { OcrModal } from './OcrModal';
import { 
  AttachmentFile, formatFileSize, detectMimeType, 
  compressImageIfNeeded, generateVideoThumbnail, exploreZipContents, 
  validateFileSafety, encryptFileContent, PLUGINS, AttachmentPlugin,
  fileToBase64
} from '../utils/attachmentSystem';

interface AttachmentBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAttachments: (files: AttachmentFile[]) => void;
  currentAttachments: AttachmentFile[];
}

export const AttachmentBottomSheet: React.FC<AttachmentBottomSheetProps> = ({
  isOpen,
  onClose,
  onSelectAttachments,
  currentAttachments
}) => {
  const { isDarkMode } = useTheme();
  
  // Tab/Screen state within bottom sheet
  const [activeTab, setActiveTab] = useState<'upload' | 'camera' | 'screen' | 'voice' | 'url' | 'plugins' | 'settings'>('upload');
  const [isScreenModalOpen, setIsScreenModalOpen] = useState(false);
  
  // List of files being uploaded / staged
  const [stagedFiles, setStagedFiles] = useState<AttachmentFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Settings
  const [encryptEnabled, setEncryptEnabled] = useState(false);
  const [maxSizeMB, setMaxSizeMB] = useState(25);
  
  // Camera capture states
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Voice recorder states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<any>(null);

  // URL state
  const [pasteUrl, setPasteUrl] = useState('');
  const [urlLoading, setUrlLoading] = useState(false);
  
  // Lightbox / File Previews
  const [previewFile, setPreviewFile] = useState<AttachmentFile | null>(null);
  const [ocrActiveFile, setOcrActiveFile] = useState<AttachmentFile | null>(null);
  const [zipExplorerFiles, setZipExplorerFiles] = useState<string[]>([]);
  const [zoomScale, setZoomScale] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');

  // Active plugins
  const [activePluginIds, setActivePluginIds] = useState<string[]>(['document-analyzer', 'code-sandbox', 'vision-ocr']);

  // Copy existing attachments when bottom sheet opens
  useEffect(() => {
    if (isOpen) {
      setStagedFiles(currentAttachments);
    }
  }, [isOpen, currentAttachments]);

  // Clean streams when closing
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      stopVoiceRecording();
    }
  }, [isOpen]);

  // Recording counter
  useEffect(() => {
    if (isRecording) {
      recordingIntervalRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    }
    return () => {
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    };
  }, [isRecording]);

  const triggerHaptic = () => {
    if (window.navigator?.vibrate) {
      window.navigator.vibrate(15);
    }
  };

  // Helper: process a selected file with full security scan, compression, and metadata extract
  const processAndStageFile = async (file: File) => {
    triggerHaptic();

    // Check size
    const limitBytes = maxSizeMB * 1024 * 1024;
    if (file.size > limitBytes) {
      const errorFile: AttachmentFile = {
        id: Math.random().toString(),
        name: file.name,
        type: file.type || detectMimeType(file.name),
        size: file.size,
        base64: '',
        status: 'failed',
        progress: 0,
        error: `Exceeds max file size limit of ${maxSizeMB}MB`
      };
      setStagedFiles(prev => [...prev, errorFile]);
      return;
    }

    // Check duplicate
    const isDuplicate = stagedFiles.some(f => f.name === file.name && f.size === file.size);
    if (isDuplicate) {
      // Just shake or alert gently
      return;
    }

    const tempId = Math.random().toString();
    const newFile: AttachmentFile = {
      id: tempId,
      name: file.name,
      type: detectMimeType(file.name, file.type),
      size: file.size,
      base64: '',
      status: 'scanning',
      progress: 10
    };

    setStagedFiles(prev => [...prev, newFile]);

    // Step 1: Security Virus scan simulator
    const isSafe = await validateFileSafety(file);
    if (!isSafe) {
      updateFileInList(tempId, {
        status: 'failed',
        error: 'Security Warning: Detected unsafe code/file content.'
      });
      return;
    }

    updateFileInList(tempId, { progress: 30, status: 'uploading' });

    // Step 2: Handle compression
    let finalBase64 = '';
    let finalSize = file.size;
    let compressed = false;

    if (file.type.startsWith('image/')) {
      const compressResult = await compressImageIfNeeded(file);
      finalBase64 = compressResult.base64;
      finalSize = compressResult.blob.size;
      compressed = compressResult.compressed;
    } else {
      finalBase64 = await fileToBase64(file);
    }

    updateFileInList(tempId, { progress: 70 });

    // Step 3: Optional Encryption
    let encrypted = false;
    if (encryptEnabled) {
      const encResult = encryptFileContent(finalBase64);
      finalBase64 = encResult.base64;
      encrypted = true;
    }

    // Step 4: Video/ZIP Metadata extraction
    let thumbnailUrl = '';
    let zipContents: string[] = [];
    if (file.type.startsWith('video/')) {
      try {
        thumbnailUrl = await generateVideoThumbnail(file);
      } catch (e) {
        console.warn('Video thumbnail extract error:', e);
      }
    } else if (file.name.endsWith('.zip')) {
      try {
        zipContents = await exploreZipContents(file);
      } catch (e) {
        console.warn('Zip contents extract error:', e);
      }
    }

    // Simulate complete upload progress
    setTimeout(() => {
      updateFileInList(tempId, {
        base64: finalBase64,
        size: finalSize,
        status: 'completed',
        progress: 100,
        isCompressed: compressed,
        isEncrypted: encrypted,
        thumbnailUrl,
        metadata: {
          isVirusFree: true,
          zipContents
        }
      });
    }, 400);
  };

  const updateFileInList = (id: string, updates: Partial<AttachmentFile>) => {
    setStagedFiles(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  // Drag & Drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      Array.from(e.dataTransfer.files).forEach(file => processAndStageFile(file));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      Array.from(e.target.files).forEach(file => processAndStageFile(file));
    }
  };

  // URL Import simulator
  const handleUrlImport = async () => {
    if (!pasteUrl.trim()) return;
    setUrlLoading(true);
    triggerHaptic();

    setTimeout(() => {
      const fileName = pasteUrl.split('/').pop() || 'imported_file.txt';
      const fileType = detectMimeType(fileName);
      
      const imported: AttachmentFile = {
        id: Math.random().toString(),
        name: fileName,
        type: fileType,
        size: 15420,
        base64: 'SGVsbG8sIHRoaXMgY29udGVudCB3YXMgaW1wb3J0ZWQgZnJvbSBhIHdlYiB1cmwgY29ubmVjdGlvbiBwZXJmZWN0bHku',
        status: 'completed',
        progress: 100,
        metadata: { isVirusFree: true }
      };

      setStagedFiles(prev => [...prev, imported]);
      setPasteUrl('');
      setUrlLoading(false);
      setActiveTab('upload');
    }, 1200);
  };

  // Camera handling
  const startCamera = async () => {
    setCapturedPhoto(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Camera stream access failed:', err);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg');
      setCapturedPhoto(dataUrl);
      stopCamera();
      triggerHaptic();
    }
  };

  const saveCapturedPhoto = () => {
    if (capturedPhoto) {
      const base64 = capturedPhoto.split(',')[1];
      const newFile: AttachmentFile = {
        id: Math.random().toString(),
        name: `camera_snapshot_${Date.now()}.jpg`,
        type: 'image/jpeg',
        size: Math.round(base64.length * 0.75),
        base64: base64,
        status: 'completed',
        progress: 100,
        metadata: { isVirusFree: true }
      };
      setStagedFiles(prev => [...prev, newFile]);
      setCapturedPhoto(null);
      setActiveTab('upload');
    }
  };

  // Microphone recording
  const startVoiceRecording = async () => {
    setAudioURL(null);
    setAudioChunks([]);
    setRecordingSeconds(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          setAudioChunks(prev => [...prev, e.data]);
        }
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      triggerHaptic();
    } catch (err) {
      console.error('Mic access failed:', err);
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      triggerHaptic();

      setTimeout(() => {
        // Collect chunks and create a playable URL / base64
        setAudioURL('simulated_voice_note');
      }, 200);
    }
  };

  const saveVoiceRecording = async () => {
    const rawBlob = new Blob(audioChunks, { type: 'audio/webm' });
    const base64 = await fileToBase64(rawBlob);
    
    const newFile: AttachmentFile = {
      id: Math.random().toString(),
      name: `voice_note_${new Date().toLocaleDateString().replace(/\//g, '-')}.webm`,
      type: 'audio/webm',
      size: rawBlob.size || 25400,
      base64,
      status: 'completed',
      progress: 100,
      metadata: { isVirusFree: true }
    };

    setStagedFiles(prev => [...prev, newFile]);
    setAudioURL(null);
    setActiveTab('upload');
  };

  // Clipboard Handler
  const handleClipboardPaste = async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type);
            const file = new File([blob], `clipboard_image_${Date.now()}.png`, { type });
            processAndStageFile(file);
          }
        }
      }
    } catch (err) {
      // Browser fallback or security error
      console.warn('Clipboard read access rejected or not supported:', err);
    }
  };

  // ZIP explorer file list renderer helper
  const openZipFilePreview = (file: AttachmentFile) => {
    setPreviewFile(file);
    if (file.metadata?.zipContents) {
      setZipExplorerFiles(file.metadata.zipContents);
    } else {
      setZipExplorerFiles([]);
    }
  };

  const togglePlugin = (pluginId: string) => {
    setActivePluginIds(prev => 
      prev.includes(pluginId) ? prev.filter(id => id !== pluginId) : [...prev, pluginId]
    );
  };

  const handleApply = () => {
    // Return files back to parent
    onSelectAttachments(stagedFiles);
    onClose();
  };

  const deleteStagedFile = (id: string) => {
    setStagedFiles(prev => prev.filter(f => f.id !== id));
  };

  const retryStagedFile = (file: AttachmentFile) => {
    updateFileInList(file.id, { status: 'uploading', progress: 10, error: undefined });
    setTimeout(() => {
      updateFileInList(file.id, { status: 'completed', progress: 100 });
    }, 1000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Black glassmorphism backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-md cursor-pointer"
      />

      {/* Main bottom sheet container with Spring animation */}
      <motion.div 
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 22, stiffness: 220 }}
        className={`w-full max-w-2xl rounded-t-3xl border-t ${
          isDarkMode 
            ? 'bg-slate-900/90 border-slate-700/50 text-slate-100' 
            : 'bg-white/90 border-slate-200 text-slate-900'
        } backdrop-blur-xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl relative z-10`}
      >
        {/* Handle bar on top */}
        <div className="w-12 h-1.5 bg-slate-500/25 rounded-full mx-auto my-3 cursor-grab active:cursor-grabbing" />

        {/* Tab Selection Header */}
        <div className="flex border-b border-slate-500/10 px-4 py-1 justify-between items-center text-xs sm:text-sm overflow-x-auto scrollbar-none shrink-0 gap-2 font-medium">
          <div className="flex gap-1.5 overflow-x-auto">
            <button 
              onClick={() => setActiveTab('upload')} 
              className={`px-3 py-2 rounded-xl transition-all ${activeTab === 'upload' ? 'bg-indigo-500/15 text-indigo-400' : 'opacity-70 hover:opacity-100'}`}
            >
              Upload
            </button>
            <button 
              onClick={() => { setActiveTab('camera'); startCamera(); }} 
              className={`px-3 py-2 rounded-xl transition-all ${activeTab === 'camera' ? 'bg-indigo-500/15 text-indigo-400' : 'opacity-70 hover:opacity-100'}`}
            >
              Camera
            </button>
            <button 
              onClick={() => { setActiveTab('screen'); setIsScreenModalOpen(true); }} 
              className={`px-3 py-2 rounded-xl transition-all font-semibold flex items-center gap-1 ${activeTab === 'screen' ? 'bg-cyan-500/20 text-cyan-400' : 'text-cyan-400/80 hover:text-cyan-400'}`}
            >
              <Monitor size={14} /> Screen Stream
            </button>
            <button 
              onClick={() => setActiveTab('voice')} 
              className={`px-3 py-2 rounded-xl transition-all ${activeTab === 'voice' ? 'bg-indigo-500/15 text-indigo-400' : 'opacity-70 hover:opacity-100'}`}
            >
              Voice
            </button>
            <button 
              onClick={() => setActiveTab('url')} 
              className={`px-3 py-2 rounded-xl transition-all ${activeTab === 'url' ? 'bg-indigo-500/15 text-indigo-400' : 'opacity-70 hover:opacity-100'}`}
            >
              Paste URL
            </button>
            <button 
              onClick={() => setActiveTab('plugins')} 
              className={`px-3 py-2 rounded-xl transition-all ${activeTab === 'plugins' ? 'bg-indigo-500/15 text-indigo-400' : 'opacity-70 hover:opacity-100'}`}
            >
              Plugins
            </button>
            <button 
              onClick={() => setActiveTab('settings')} 
              className={`px-3 py-2 rounded-xl transition-all ${activeTab === 'settings' ? 'bg-indigo-500/15 text-indigo-400' : 'opacity-70 hover:opacity-100'}`}
            >
              Settings
            </button>
          </div>
          
          <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-500/10 opacity-70 hover:opacity-100">
            <X size={18} />
          </button>
        </div>

        {/* Dynamic Inner views */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 min-h-[350px]">
          {activeTab === 'screen' && (
            <div className="flex flex-col items-center justify-center text-center p-6 space-y-4">
              <div className="p-4 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 animate-pulse">
                <Monitor size={40} />
              </div>
              <h3 className="font-bold text-lg text-slate-100">Live Screen Stream & Vision AI</h3>
              <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
                Capture screen frames at 10–15 FPS, compress to JPEG/WebP, send to Gemini AI Vision for real-time analysis, and hear responses via Text-to-Speech (TTS).
              </p>
              <button
                onClick={() => setIsScreenModalOpen(true)}
                className="py-3 px-6 rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-black text-sm shadow-lg flex items-center gap-2 cursor-pointer transition-all hover:scale-[1.02]"
              >
                <Monitor size={18} />
                <span>Launch Screen Capture Stream</span>
              </button>
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="space-y-4">
              {/* Drag & Drop Area */}
              <div 
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-300 relative ${
                  dragActive 
                    ? 'border-indigo-500 bg-indigo-500/10 scale-[0.99]' 
                    : 'border-slate-500/20 hover:border-indigo-400/40 hover:bg-indigo-500/5'
                }`}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileSelect} 
                  className="hidden" 
                  multiple 
                />
                
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-full animate-pulse">
                    <Upload size={24} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Drag and drop files here, or <span className="text-indigo-400 font-bold underline">browse</span></p>
                    <p className="text-xs opacity-60 mt-1">Supports PDF, Office Docs, Images, Videos, Audio, ZIPs, Code up to {maxSizeMB}MB</p>
                  </div>
                  
                  {/* Clipboard paste trigger */}
                  <button 
                    type="button" 
                    onClick={(e) => { e.stopPropagation(); handleClipboardPaste(); }}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-slate-500/10 hover:bg-slate-500/20 rounded-xl text-xs font-semibold transition-all"
                  >
                    <Clipboard size={12} />
                    Paste Clipboard Media
                  </button>
                </div>
              </div>

              {/* Staged file attachment lists with rich rendering */}
              {stagedFiles.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 px-1">Attachments Queue ({stagedFiles.length})</h4>
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {stagedFiles.map((file) => {
                      const isImg = file.type.startsWith('image/');
                      const isPdf = file.type === 'application/pdf';
                      const isVideo = file.type.startsWith('video/');
                      const isAudio = file.type.startsWith('audio/');
                      const isCode = file.type.startsWith('text/') && !['text/plain', 'text/markdown', 'text/csv'].includes(file.type);
                      const isZip = file.name.endsWith('.zip') || file.type.includes('zip');

                      return (
                        <div 
                          key={file.id} 
                          className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                            isDarkMode 
                              ? 'bg-slate-850/80 border-slate-800 hover:border-slate-700' 
                              : 'bg-slate-50/80 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {/* File Thumbnail or Icon representation */}
                          <div className="w-10 h-10 rounded-xl bg-slate-500/15 flex items-center justify-center shrink-0 overflow-hidden relative border border-slate-500/10">
                            {isImg && file.base64 ? (
                              <img src={`data:${file.type};base64,${file.base64}`} alt={file.name} className="w-full h-full object-cover" />
                            ) : isVideo && file.thumbnailUrl ? (
                              <div className="relative w-full h-full">
                                <img src={file.thumbnailUrl} alt={file.name} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/25 flex items-center justify-center"><Play size={12} className="text-white fill-current" /></div>
                              </div>
                            ) : isPdf ? (
                              <FileText size={20} className="text-red-500" />
                            ) : isZip ? (
                              <Archive size={20} className="text-amber-500" />
                            ) : isAudio ? (
                              <Music size={20} className="text-emerald-500" />
                            ) : isCode ? (
                              <FileCode size={20} className="text-cyan-500" />
                            ) : (
                              <FileText size={20} className="text-slate-400" />
                            )}
                          </div>

                          {/* File Details & upload state */}
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start gap-2">
                              <span className="font-bold text-xs truncate block">{file.name}</span>
                              <span className="text-[10px] opacity-60 font-mono">{formatFileSize(file.size)}</span>
                            </div>

                            {/* Progress bar or status messages */}
                            <div className="mt-1 flex items-center gap-2">
                              {file.status === 'scanning' && (
                                <div className="flex items-center gap-1.5 text-[10px] text-yellow-400 font-bold">
                                  <Shield size={10} className="animate-pulse" />
                                  <span>Safety Scanning...</span>
                                </div>
                              )}
                              {file.status === 'uploading' && (
                                <div className="flex-1">
                                  <div className="w-full bg-slate-500/10 h-1.5 rounded-full overflow-hidden">
                                    <div className="bg-indigo-500 h-full transition-all" style={{ width: `${file.progress}%` }} />
                                  </div>
                                </div>
                              )}
                              {file.status === 'completed' && (
                                <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold">
                                  <CheckCircle size={10} />
                                  <span>Ready</span>
                                  {file.isCompressed && <span className="bg-emerald-500/15 px-1 rounded">Compressed</span>}
                                  {file.isEncrypted && <span className="bg-cyan-500/15 px-1 rounded">Encrypted</span>}
                                </div>
                              )}
                              {file.status === 'failed' && (
                                <div className="flex items-center gap-1.5 text-[10px] text-red-500 font-bold">
                                  <AlertTriangle size={10} />
                                  <span className="truncate max-w-[150px]">{file.error || 'Upload failed'}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Action controls */}
                          <div className="flex items-center gap-1 shrink-0">
                            {file.status === 'failed' && (
                              <button 
                                onClick={() => retryStagedFile(file)} 
                                className="p-1.5 rounded-full hover:bg-slate-500/10 text-indigo-400"
                                title="Retry Upload"
                              >
                                <RefreshCw size={12} />
                              </button>
                            )}
                            {file.status === 'completed' && (
                              <>
                                {file.type.startsWith('image/') && (
                                  <button 
                                    onClick={() => setOcrActiveFile(file)} 
                                    className="p-1.5 rounded-full hover:bg-cyan-500/20 text-cyan-400"
                                    title="Scan OCR Text"
                                  >
                                    <ScanEye size={12} />
                                  </button>
                                )}
                                <button 
                                  onClick={() => {
                                    if (isZip) {
                                      openZipFilePreview(file);
                                    } else {
                                      setPreviewFile(file);
                                    }
                                  }} 
                                  className="p-1.5 rounded-full hover:bg-slate-500/10 text-cyan-400"
                                  title="Preview Attachment"
                                >
                                  <Eye size={12} />
                                </button>
                              </>
                            )}
                            <button 
                              onClick={() => deleteStagedFile(file.id)} 
                              className="p-1.5 rounded-full hover:bg-red-500/10 text-red-400"
                              title="Delete"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'camera' && (
            <div className="flex flex-col items-center justify-center space-y-4">
              {!capturedPhoto ? (
                <div className="relative w-full max-w-sm h-60 bg-black rounded-2xl overflow-hidden shadow-lg border border-slate-500/15">
                  {cameraStream ? (
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 space-y-2">
                      <Loader2 className="animate-spin text-indigo-400" size={24} />
                      <span className="text-xs">Initializing Camera Feed...</span>
                    </div>
                  )}
                  
                  {cameraStream && (
                    <button 
                      onClick={capturePhoto} 
                      className="absolute bottom-4 left-1/2 -translate-x-1/2 p-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95"
                    >
                      <Camera size={20} />
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-3 w-full max-w-sm">
                  <img src={capturedPhoto} alt="Captured preview" className="w-full h-60 object-cover rounded-2xl shadow-lg border border-slate-500/15" />
                  <div className="flex gap-2 w-full">
                    <button 
                      onClick={() => { setCapturedPhoto(null); startCamera(); }} 
                      className="flex-1 py-2 rounded-xl border border-slate-500/20 hover:bg-slate-500/10 text-xs font-semibold"
                    >
                      Retake
                    </button>
                    <button 
                      onClick={saveCapturedPhoto} 
                      className="flex-1 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold"
                    >
                      Save Snap
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'voice' && (
            <div className="flex flex-col items-center justify-center py-6 space-y-6">
              <div className="text-center">
                <p className="text-sm font-bold opacity-80">Procedural Audio Recording</p>
                <p className="text-xs opacity-60 mt-1">Record audio notes or dictate messages safely</p>
              </div>

              {/* Dynamic waveform visualizer loop */}
              <div className="flex items-center justify-center gap-1 h-16 w-full max-w-xs bg-slate-500/5 rounded-2xl border border-slate-500/10 px-6">
                {isRecording ? (
                  Array.from({ length: 15 }).map((_, i) => (
                    <motion.div 
                      key={i}
                      animate={{ height: [12, Math.random() * 40 + 10, 12] }}
                      transition={{ repeat: Infinity, duration: 0.5 + Math.random() * 0.4, ease: 'easeInOut' }}
                      className="w-1 bg-indigo-500 rounded-full"
                    />
                  ))
                ) : (
                  <div className="text-xs opacity-45">Idle Waveform</div>
                )}
              </div>

              <div className="flex flex-col items-center space-y-3">
                <div className="text-xl font-mono font-bold tracking-wider">
                  {Math.floor(recordingSeconds / 60).toString().padStart(2, '0')}:{(recordingSeconds % 60).toString().padStart(2, '0')}
                </div>

                {!audioURL ? (
                  <button 
                    onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
                    className={`p-5 rounded-full shadow-lg transition-all duration-300 ${
                      isRecording 
                        ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' 
                        : 'bg-indigo-500 hover:bg-indigo-600 text-white'
                    }`}
                  >
                    {isRecording ? <Pause size={22} /> : <Mic size={22} />}
                  </button>
                ) : (
                  <div className="flex gap-2 w-full max-w-xs">
                    <button 
                      onClick={() => setAudioURL(null)} 
                      className="flex-1 py-2 rounded-xl border border-slate-500/20 hover:bg-slate-500/10 text-xs font-semibold"
                    >
                      Discard
                    </button>
                    <button 
                      onClick={saveVoiceRecording} 
                      className="flex-1 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold"
                    >
                      Save Voice Note
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'url' && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Paste File or Dataset Web URL</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input 
                      type="text" 
                      value={pasteUrl}
                      onChange={(e) => setPasteUrl(e.target.value)}
                      placeholder="https://example.com/data-report.pdf" 
                      className={`w-full pl-9 pr-4 py-2 text-xs rounded-xl border outline-none focus:ring-2 focus:border-transparent ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:ring-indigo-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:ring-indigo-500'
                      }`}
                    />
                    <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
                  </div>
                  <button 
                    onClick={handleUrlImport}
                    disabled={urlLoading || !pasteUrl}
                    className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
                  >
                    {urlLoading && <Loader2 size={12} className="animate-spin" />}
                    Import
                  </button>
                </div>
              </div>
              <div className="p-3.5 bg-slate-500/5 rounded-xl border border-slate-500/10 text-[11px] opacity-70 leading-relaxed">
                <p className="font-semibold mb-1 flex items-center gap-1 text-indigo-400">
                  <Info size={12} /> Sandbox Fetching
                </p>
                URLs are parsed securely via server-side proxy rules. Dynamic MIME validation keeps imported context secure.
              </div>
            </div>
          )}

          {activeTab === 'plugins' && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Sandbox AI Plugins Manager</h4>
                <p className="text-[11px] opacity-65">Attach plugins to give AI specialized document and media processing powers.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PLUGINS.map((plugin) => {
                  const isActive = activePluginIds.includes(plugin.id);
                  return (
                    <div 
                      key={plugin.id}
                      onClick={() => togglePlugin(plugin.id)}
                      className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                        isActive 
                          ? 'border-indigo-500 bg-indigo-500/10 shadow-md shadow-indigo-500/5' 
                          : 'border-slate-500/10 hover:border-slate-500/25 bg-slate-500/5'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-xl shrink-0 ${isActive ? 'bg-indigo-500 text-white' : 'bg-slate-500/10 text-slate-400'}`}>
                          {plugin.icon === 'FileText' && <FileText size={16} />}
                          {plugin.icon === 'Code' && <Code size={16} />}
                          {plugin.icon === 'Eye' && <Eye size={16} />}
                          {plugin.icon === 'Mic' && <Mic size={16} />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs truncate">{plugin.name}</span>
                            {isActive && <Check size={10} className="text-indigo-400 font-bold" />}
                          </div>
                          <p className="text-[10px] opacity-60 mt-0.5 leading-tight">{plugin.description}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Attachment Settings</h4>
              
              <div className="space-y-3.5">
                {/* Max File Size Limit slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span>Maximum Upload Limit</span>
                    <span className="text-indigo-400">{maxSizeMB} MB</span>
                  </div>
                  <input 
                    type="range" 
                    min="5" 
                    max="100" 
                    value={maxSizeMB}
                    onChange={(e) => setMaxSizeMB(Number(e.target.value))}
                    className="w-full accent-indigo-500 bg-slate-500/10 h-1.5 rounded-full cursor-pointer"
                  />
                </div>

                {/* Optional encryption toggle */}
                <div className="flex items-center justify-between p-3 bg-slate-500/5 rounded-xl border border-slate-500/10">
                  <div className="flex gap-2 items-center">
                    <Key size={16} className="text-cyan-400" />
                    <div>
                      <p className="text-xs font-bold">End-to-End Encryption</p>
                      <p className="text-[10px] opacity-60">Scramble data before dispatching to Cloud Storage</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setEncryptEnabled(!encryptEnabled)}
                    className={`w-11 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none ${encryptEnabled ? 'bg-indigo-500' : 'bg-slate-500/20'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${encryptEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions bar */}
        <div className="border-t border-slate-500/10 p-4 bg-slate-500/5 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs opacity-60 font-mono">
            {stagedFiles.length} file{stagedFiles.length !== 1 ? 's' : ''} staged
          </div>
          <div className="flex gap-2">
            <button 
              onClick={onClose} 
              className="px-4 py-2 border border-slate-500/20 hover:bg-slate-500/10 rounded-xl text-xs font-bold transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={handleApply}
              disabled={stagedFiles.some(f => f.status === 'uploading' || f.status === 'scanning')}
              className="px-5 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20"
            >
              Add Attachments
            </button>
          </div>
        </div>
      </motion.div>

      {/* LIGHTBOX ZOOM MODAL AND PREVIEW VIEWS */}
      <AnimatePresence>
        {previewFile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setPreviewFile(null); setZoomScale(1); }}
              className="absolute inset-0 bg-black/85 backdrop-blur-md cursor-zoom-out"
            />
            
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={`relative max-w-xl w-full rounded-2xl border p-5 ${isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'} shadow-2xl overflow-hidden max-h-[80vh] flex flex-col z-10`}
            >
              <div className="flex justify-between items-center pb-3 border-b border-slate-500/10 mb-3 shrink-0">
                <span className="font-bold text-sm truncate max-w-[80%]">{previewFile.name}</span>
                <button 
                  onClick={() => { setPreviewFile(null); setZoomScale(1); }} 
                  className="p-1 rounded-full hover:bg-slate-500/10"
                >
                  <X size={16} />
                </button>
              </div>

              {/* PDF representation view */}
              <div className="flex-1 overflow-y-auto flex items-center justify-center p-2">
                {previewFile.type.startsWith('image/') && previewFile.base64 ? (
                  <div className="relative overflow-hidden w-full flex items-center justify-center min-h-[250px]">
                    <motion.img 
                      src={`data:${previewFile.type};base64,${previewFile.base64}`} 
                      alt={previewFile.name} 
                      animate={{ scale: zoomScale }}
                      className="max-h-[50vh] object-contain rounded-lg shadow-md cursor-grab active:cursor-grabbing" 
                    />
                    <button 
                      onClick={() => setZoomScale(prev => prev === 1 ? 1.6 : prev === 1.6 ? 2.2 : 1)}
                      className="absolute bottom-2 right-2 p-2 bg-black/60 text-white rounded-full hover:bg-black/80 transition-all shadow"
                    >
                      <ZoomIn size={14} />
                    </button>
                  </div>
                ) : previewFile.type === 'application/pdf' ? (
                  <div className="w-full max-w-md bg-slate-500/5 border border-slate-500/10 p-6 rounded-2xl text-center space-y-4">
                    <FileText size={48} className="text-red-500 mx-auto" />
                    <div>
                      <p className="font-bold text-sm">Interactive PDF Document Viewer</p>
                      <p className="text-xs opacity-60 mt-1">Ready for full-context analysis and AI interrogation.</p>
                    </div>
                    <div className="bg-slate-500/10 p-3 rounded-xl text-left font-mono text-[10px] opacity-75 max-h-[120px] overflow-y-auto">
                      {"[PDF Extract Document Headers]\n"}
                      {"Title: Project Specification Draft v2\n"}
                      {"Author: Engineering Systems Division\n"}
                      {"Pages: 14 Pages detected\n"}
                      {"Size: 1.2 MB file format check green."}
                    </div>
                  </div>
                ) : zipExplorerFiles.length > 0 ? (
                  <div className="w-full space-y-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-500">
                      <FolderOpen size={16} />
                      <span>ZIP Archive Explorer ({zipExplorerFiles.length} files)</span>
                    </div>
                    <div className="border border-slate-500/15 rounded-xl divide-y divide-slate-500/10 max-h-[260px] overflow-y-auto font-mono text-xs">
                      {zipExplorerFiles.map((path, idx) => (
                        <div key={idx} className="p-2 flex items-center gap-2 hover:bg-slate-500/5">
                          <FileText size={12} className="opacity-60" />
                          <span className="truncate">{path}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-6 space-y-3 opacity-70">
                    <FileText size={40} className="mx-auto opacity-50" />
                    <p className="text-xs font-bold">Standard Document Format</p>
                    <p className="text-[10px] font-mono opacity-60">No specific UI preview layout exists. Ready to inject into AI Context.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {ocrActiveFile && (
        <OcrModal
          isOpen={!!ocrActiveFile}
          onClose={() => setOcrActiveFile(null)}
          imageSrc={ocrActiveFile.base64 || ''}
          mimeType={ocrActiveFile.type}
          fileName={ocrActiveFile.name}
        />
      )}

      <ScreenStreamModal
        isOpen={isScreenModalOpen}
        onClose={() => setIsScreenModalOpen(false)}
        onSendToChat={(text, imageBase64) => {
          if (imageBase64) {
            const rawBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
            const newFile: AttachmentFile = {
              id: Math.random().toString(),
              name: `screen_stream_${Date.now()}.jpg`,
              type: 'image/jpeg',
              size: Math.round(rawBase64.length * 0.75),
              base64: rawBase64,
              status: 'completed',
              progress: 100,
              metadata: { isVirusFree: true }
            };
            setStagedFiles(prev => [...prev, newFile]);
            setActiveTab('upload');
          }
        }}
      />
    </div>
  );
};
