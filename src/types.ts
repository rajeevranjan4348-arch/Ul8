export type AppMode = 
  | 'dashboard'
  | 'history'
  | 'chat-pro'
  | 'chat-fast'
  | 'voice-live'
  | 'search-maps'
  | 'transcription'
  | 'tts'
  | 'image-gen'
  | 'jarvis'
  | 'coder'
  | 'omni-chat'
  | 'workspace'
  | 'settings'
  | 'logs';

export interface Attachment {
  name: string;
  type: string; // mimeType
  base64: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  isStreaming?: boolean;
  groundingChunks?: any[];
  timestamp?: Date;
  status?: 'sent' | 'delivered' | 'read';
  attachments?: Attachment[];
  pinned?: boolean;
}
