// IndexedDB and Web Crypto AES-256 GCM Encryption for Voice History Recordings
import { auth } from '../lib/firebase';

const DB_NAME = 'OmniVoiceRecordingsDB';
const STORE_NAME = 'recordings';
const DEFAULT_KEY_PHRASE = 'omni-chat-e2e-voice-secret-key-phrase';

export interface AudioRecordingData {
  sessionId: string;
  encryptedBuffer: ArrayBuffer;
  iv: Uint8Array;
}

// Initialize IndexedDB
export function initAudioDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    
    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'sessionId' });
      }
    };

    request.onsuccess = (event: any) => {
      resolve(event.target.result);
    };

    request.onerror = (event: any) => {
      console.error('IndexedDB open error:', event.target.error);
      reject(event.target.error);
    };
  });
}

// Save encrypted recording to IndexedDB
export async function saveRecordingToIDB(sessionId: string, encryptedBuffer: ArrayBuffer, iv: Uint8Array): Promise<void> {
  const db = await initAudioDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const data: AudioRecordingData = { sessionId, encryptedBuffer, iv };
    const request = store.put(data);

    request.onsuccess = () => resolve();
    request.onerror = (event: any) => reject(event.target.error);
  });
}

// Get encrypted recording from IndexedDB
export async function getRecordingFromIDB(sessionId: string): Promise<AudioRecordingData | null> {
  const db = await initAudioDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(sessionId);

    request.onsuccess = (event: any) => {
      resolve(event.target.result || null);
    };
    request.onerror = (event: any) => reject(event.target.error);
  });
}

// Delete recording from IndexedDB
export async function deleteRecordingFromIDB(sessionId: string): Promise<void> {
  const db = await initAudioDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(sessionId);

    request.onsuccess = () => resolve();
    request.onerror = (event: any) => reject(event.target.error);
  });
}

// --- AES-256 GCM Encryption Helpers ---

// Derive encryption key using Web Crypto API
async function getCryptoKey(): Promise<CryptoKey> {
  const password = auth.currentUser?.uid || DEFAULT_KEY_PHRASE;
  const enc = new TextEncoder();
  const passwordBuffer = enc.encode(password);

  // Import key material (raw password)
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  // Derive an AES-GCM 256-bit key
  const salt = enc.encode('omnichat-salt-123456');
  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 1000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Encrypt Blob using AES-GCM
export async function encryptAudioBlob(blob: Blob): Promise<{ encryptedBuffer: ArrayBuffer; iv: Uint8Array }> {
  const key = await getCryptoKey();
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); // GCM standard 12-byte IV
  const audioData = await blob.arrayBuffer();

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    audioData
  );

  return { encryptedBuffer, iv };
}

// Decrypt Buffer back to Blob
export async function decryptAudioBlob(encryptedBuffer: ArrayBuffer, iv: Uint8Array, mimeType = 'audio/webm'): Promise<Blob> {
  const key = await getCryptoKey();

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    encryptedBuffer
  );

  return new Blob([decryptedBuffer], { type: mimeType });
}
