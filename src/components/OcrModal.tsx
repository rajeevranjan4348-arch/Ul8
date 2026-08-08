import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, ScanEye, Copy, Check, Send, HelpCircle, Download, RefreshCw, 
  Table, FileText, PenTool, Sparkles, AlertCircle, Eye
} from 'lucide-react';
import { performOcrOnImage, OcrResult } from '../services/ocrService';
import { toast } from 'sonner';

interface OcrModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string; // Base64 or Data URL
  mimeType?: string;
  fileName?: string;
  onInsertText?: (extractedText: string) => void;
  onAskQuestion?: (extractedText: string) => void;
}

export const OcrModal: React.FC<OcrModalProps> = ({
  isOpen,
  onClose,
  imageSrc,
  mimeType = 'image/jpeg',
  fileName = 'Image',
  onInsertText,
  onAskQuestion
}) => {
  const [ocrMode, setOcrMode] = useState<'full' | 'table' | 'summary' | 'handwriting'>('full');
  const [loading, setLoading] = useState<boolean>(false);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Normalize image data URL for rendering and base64 for processing
  const displayImageSrc = imageSrc.startsWith('data:') 
    ? imageSrc 
    : `data:${mimeType};base64,${imageSrc}`;
  
  const base64Data = imageSrc.includes(',') 
    ? imageSrc.split(',')[1] 
    : imageSrc;

  const runOcr = async (mode: 'full' | 'table' | 'summary' | 'handwriting' = ocrMode) => {
    if (!base64Data) return;
    setLoading(true);
    setError(null);
    try {
      const res = await performOcrOnImage(base64Data, mimeType, mode);
      setOcrResult(res);
      toast.success('OCR Text Extracted Successfully!');
    } catch (err: any) {
      console.error('OCR Extraction error:', err);
      setError(err?.message || 'Failed to extract text from image. Please try again.');
      toast.error('OCR Extraction Failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && base64Data) {
      runOcr(ocrMode);
    } else if (!isOpen) {
      setOcrResult(null);
      setError(null);
    }
  }, [isOpen, imageSrc]);

  const handleCopy = () => {
    if (!ocrResult?.text) return;
    navigator.clipboard.writeText(ocrResult.text);
    setCopied(true);
    toast.success('Text copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!ocrResult?.text) return;
    const blob = new Blob([ocrResult.text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName.replace(/\.[^/.]+$/, '')}_ocr_extracted.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Downloaded extracted text as TXT');
  };

  const handleInsert = () => {
    if (!ocrResult?.text) return;
    if (onInsertText) {
      onInsertText(ocrResult.text);
      toast.success('Extracted text inserted into prompt');
      onClose();
    }
  };

  const handleAsk = () => {
    if (!ocrResult?.text) return;
    if (onAskQuestion) {
      onAskQuestion(ocrResult.text);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400">
                <ScanEye size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">AI Vision & OCR Scanner</h3>
                  <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-bold uppercase tracking-wider border border-cyan-500/30">
                    Gemini 3.5 Multimodal
                  </span>
                </div>
                <p className="text-xs text-slate-400 truncate max-w-md">{fileName}</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* OCR Mode Chips */}
          <div className="flex items-center justify-between px-5 py-2.5 bg-slate-950/40 border-b border-slate-800/80 overflow-x-auto gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">OCR Mode:</span>
              <button
                onClick={() => { setOcrMode('full'); runOcr('full'); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  ocrMode === 'full'
                    ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/20'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <FileText size={13} />
                <span>Standard OCR</span>
              </button>

              <button
                onClick={() => { setOcrMode('table'); runOcr('table'); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  ocrMode === 'table'
                    ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/20'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Table size={13} />
                <span>Tables & Structure</span>
              </button>

              <button
                onClick={() => { setOcrMode('handwriting'); runOcr('handwriting'); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  ocrMode === 'handwriting'
                    ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/20'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <PenTool size={13} />
                <span>Handwriting</span>
              </button>

              <button
                onClick={() => { setOcrMode('summary'); runOcr('summary'); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  ocrMode === 'summary'
                    ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/20'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Sparkles size={13} />
                <span>Summary & Text</span>
              </button>
            </div>

            <button
              onClick={() => runOcr(ocrMode)}
              disabled={loading}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              <span>Rescan</span>
            </button>
          </div>

          {/* Content Body: Split View */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 p-5 overflow-y-auto min-h-0">
            {/* Image Preview Panel with Scan Reticle */}
            <div className="relative flex flex-col items-center justify-center bg-slate-950 rounded-2xl border border-slate-800/80 p-3 overflow-hidden group min-h-[260px]">
              <img
                src={displayImageSrc}
                alt={fileName}
                className="max-h-[380px] w-auto object-contain rounded-xl shadow-lg"
              />

              {/* Scanning Animation Line */}
              {loading && (
                <div className="absolute inset-0 pointer-events-none flex flex-col justify-between overflow-hidden">
                  <div className="w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse shadow-[0_0_15px_#22d3ee]" />
                  <motion.div
                    animate={{ y: [0, 320, 0] }}
                    transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                    className="w-full h-1 bg-cyan-400 shadow-[0_0_12px_#38bdf8]"
                  />
                  <div className="absolute inset-0 bg-cyan-500/10 backdrop-blur-[1px] flex items-center justify-center">
                    <div className="px-4 py-2 bg-slate-900/90 border border-cyan-500/40 rounded-xl flex items-center gap-2 shadow-2xl">
                      <RefreshCw size={16} className="animate-spin text-cyan-400" />
                      <span className="text-xs font-bold text-cyan-300">Extracting text with Gemini AI...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Extracted Text Result Panel */}
            <div className="flex flex-col bg-slate-950 rounded-2xl border border-slate-800/80 overflow-hidden min-h-[260px]">
              {/* Toolbar Header */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/80 border-b border-slate-800 text-xs">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Eye size={14} className="text-cyan-400" /> Extracted Text Output
                </span>
                {ocrResult && (
                  <span className="text-[11px] text-slate-400 font-mono">
                    {ocrResult.wordCount} words • {ocrResult.charCount} chars
                  </span>
                )}
              </div>

              {/* Text Area Content */}
              <div className="flex-1 p-4 overflow-y-auto text-xs font-mono text-slate-200 leading-relaxed whitespace-pre-wrap select-text">
                {loading ? (
                  <div className="flex flex-col items-center justify-center h-full py-12 text-slate-500 gap-3">
                    <RefreshCw size={24} className="animate-spin text-cyan-400" />
                    <span>Analyzing image text pixels...</span>
                  </div>
                ) : error ? (
                  <div className="flex flex-col items-center justify-center h-full py-8 text-center text-rose-400 space-y-2">
                    <AlertCircle size={28} />
                    <p className="text-xs">{error}</p>
                    <button
                      onClick={() => runOcr(ocrMode)}
                      className="px-3 py-1 bg-rose-500/20 border border-rose-500/30 rounded-lg text-rose-300 font-semibold text-xs hover:bg-rose-500/30 transition-colors"
                    >
                      Try Again
                    </button>
                  </div>
                ) : ocrResult ? (
                  <div>{ocrResult.text}</div>
                ) : (
                  <div className="text-slate-500 text-center py-12">No OCR result yet.</div>
                )}
              </div>

              {/* Action Toolbar */}
              <div className="p-3 bg-slate-900/90 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleCopy}
                    disabled={!ocrResult?.text}
                    className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl border border-slate-700 transition-colors disabled:opacity-40 cursor-pointer"
                    title="Copy extracted text"
                  >
                    {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    <span>{copied ? 'Copied!' : 'Copy'}</span>
                  </button>

                  <button
                    onClick={handleDownload}
                    disabled={!ocrResult?.text}
                    className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl border border-slate-700 transition-colors disabled:opacity-40 cursor-pointer"
                    title="Download as TXT file"
                  >
                    <Download size={13} />
                    <span>Download</span>
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  {onInsertText && (
                    <button
                      onClick={handleInsert}
                      disabled={!ocrResult?.text}
                      className="flex items-center gap-1 px-3 py-1.5 bg-cyan-600/80 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-cyan-600/20 disabled:opacity-40 cursor-pointer"
                    >
                      <Send size={12} />
                      <span>Insert into Prompt</span>
                    </button>
                  )}

                  {onAskQuestion && (
                    <button
                      onClick={handleAsk}
                      disabled={!ocrResult?.text}
                      className="flex items-center gap-1 px-3 py-1.5 bg-violet-600/80 hover:bg-violet-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-violet-600/20 disabled:opacity-40 cursor-pointer"
                    >
                      <HelpCircle size={12} />
                      <span>Ask AI Question</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
