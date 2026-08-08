import JSZip from 'jszip';

export interface AttachmentPlugin {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'media' | 'document' | 'code' | 'system';
  permissions: string[];
}

export interface AttachmentFile {
  id: string;
  name: string;
  type: string;
  size: number;
  base64: string; // complete or preview data URL
  rawBlob?: Blob;
  status: 'pending' | 'uploading' | 'completed' | 'failed' | 'scanning';
  progress: number;
  error?: string;
  isCompressed?: boolean;
  isEncrypted?: boolean;
  thumbnailUrl?: string;
  metadata?: {
    width?: number;
    height?: number;
    duration?: number;
    pages?: number;
    wordCount?: number;
    languages?: string[];
    extractedText?: string;
    zipContents?: string[];
    isVirusFree?: boolean;
  };
}

/**
 * File size formatter helper
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Enhanced MIME Type Detector
 */
export const detectMimeType = (filename: string, systemMime?: string): string => {
  if (systemMime && systemMime !== 'application/octet-stream') return systemMime;
  const ext = filename.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    zip: 'application/zip',
    rar: 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    mkv: 'video/x-matroska',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    aac: 'audio/aac',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    txt: 'text/plain',
    csv: 'text/csv',
    json: 'application/json',
    xml: 'application/xml',
    md: 'text/markdown',
    js: 'text/javascript',
    ts: 'text/typescript',
    tsx: 'text/typescript-jsx',
    py: 'text/x-python',
    java: 'text/x-java',
    cpp: 'text/x-c++src',
    c: 'text/x-csrc',
    go: 'text/x-go',
    rs: 'text/rust',
    php: 'text/x-php',
    html: 'text/html',
    css: 'text/css',
    sql: 'text/x-sql',
    kt: 'text/x-kotlin',
    swift: 'text/x-swift',
  };
  return map[ext || ''] || 'application/octet-stream';
};

/**
 * Dynamic File Compressor (Compresses large images to under 1.5MB)
 */
export const compressImageIfNeeded = async (file: File): Promise<{ blob: Blob; base64: string; compressed: boolean }> => {
  if (!file.type.startsWith('image/') || file.size < 1.5 * 1024 * 1024) {
    const base64 = await fileToBase64(file);
    return { blob: file, base64, compressed: false };
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Downscale keeping aspect ratio
        const maxDim = 1600;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        // Compress quality
        const quality = 0.8;
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const base64 = dataUrl.split(',')[1];
        
        // Convert to Blob
        const binStr = atob(base64);
        const len = binStr.length;
        const arr = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          arr[i] = binStr.charCodeAt(i);
        }
        const blob = new Blob([arr], { type: 'image/jpeg' });

        resolve({ blob, base64, compressed: true });
      };
    };
  });
};

/**
 * File to Base64 utility
 */
export const fileToBase64 = (file: File | Blob): Promise<string> => {
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

/**
 * Generate Video Thumbnail
 */
export const generateVideoThumbnail = async (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.src = URL.createObjectURL(file);
    video.onloadeddata = () => {
      video.currentTime = Math.min(1.0, video.duration / 3);
    };
    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 180;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
        const url = canvas.toDataURL('image/jpeg');
        URL.revokeObjectURL(video.src);
        resolve(url);
      } catch (e) {
        resolve('');
      }
    };
    video.onerror = () => {
      resolve('');
    };
  });
};

/**
 * Reads the structure of a ZIP file using jszip
 */
export const exploreZipContents = async (file: File | Blob): Promise<string[]> => {
  try {
    const zip = await JSZip.loadAsync(file);
    const files: string[] = [];
    zip.forEach((relativePath) => {
      files.push(relativePath);
    });
    return files;
  } catch (e) {
    console.error('Failed to unpack zip file structure:', e);
    return [];
  }
};

/**
 * Simple client-side encryption simulation (XOR cipher or base64 scrambler for privacy demonstration)
 */
export const encryptFileContent = (base64: string): { base64: string; key: string } => {
  // Scramble the base64 characters for security demo
  const scrambled = base64.split('').reverse().join('');
  return { base64: scrambled, key: 'AES-GCM-AUTO-256' };
};

export const decryptFileContent = (scrambled: string): string => {
  return scrambled.split('').reverse().join('');
};

/**
 * Virus / Malicious file signature validation simulator
 */
export const validateFileSafety = async (file: File): Promise<boolean> => {
  // Simulate active malware scanner with heuristic validation
  return new Promise((resolve) => {
    setTimeout(() => {
      const isSuspect = file.name.endsWith('.exe') || file.name.endsWith('.bat') || file.name.includes('malware') || file.name.includes('virus');
      resolve(!isSuspect);
    }, 800);
  });
};

/**
 * Offline Cache / localStorage queue manager for attachments
 */
export const getOfflineUploadQueue = (): { id: string; name: string; type: string; base64: string }[] => {
  const queue = localStorage.getItem('offline_upload_queue');
  return queue ? JSON.parse(queue) : [];
};

export const addToOfflineUploadQueue = (file: { id: string; name: string; type: string; base64: string }) => {
  const queue = getOfflineUploadQueue();
  queue.push(file);
  localStorage.setItem('offline_upload_queue', JSON.stringify(queue));
};

export const clearOfflineUploadQueue = () => {
  localStorage.removeItem('offline_upload_queue');
};

/**
 * Modular Plugins configuration
 */
export const PLUGINS: AttachmentPlugin[] = [
  {
    id: 'document-analyzer',
    name: 'Doc Reader Pro',
    description: 'Summarize, search, compare, and extract tables from PDFs, CSVs, or Docs.',
    icon: 'FileText',
    category: 'document',
    permissions: ['file_read', 'ai_summarization']
  },
  {
    id: 'code-sandbox',
    name: 'Code Explainer',
    description: 'Explore codebase files, explain scripts, and debug syntax with AI.',
    icon: 'Code',
    category: 'code',
    permissions: ['file_read', 'code_interpretation']
  },
  {
    id: 'vision-ocr',
    name: 'Vision & OCR Scanner',
    description: 'Scan whiteboard drawings, analyze flowcharts, and OCR extract text.',
    icon: 'Eye',
    category: 'media',
    permissions: ['camera', 'ocr_extraction']
  },
  {
    id: 'audio-scribe',
    name: 'Scribe Audio Scribe',
    description: 'Transcribe notes, record brainstorm sessions, and clean voice notes.',
    icon: 'Mic',
    category: 'media',
    permissions: ['microphone', 'transcription']
  }
];
