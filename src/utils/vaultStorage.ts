// IndexedDB storage utility for Secret Vault
export interface VaultFile {
  id: string;
  name: string;
  type: string; // mime type
  category: 'image' | 'video' | 'pdf' | 'zip' | 'other';
  size: number;
  dateAdded: number;
  dataBlob: Blob;
  previewUrl?: string;
  notes?: string;
}

const DB_NAME = 'OmniChatVaultDB';
const DB_VERSION = 1;
const STORE_NAME = 'secret_files';

function openVaultDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('category', 'category', { unique: false });
        store.createIndex('dateAdded', 'dateAdded', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveFileToVault(file: File, notes?: string): Promise<VaultFile> {
  const db = await openVaultDB();
  
  let category: VaultFile['category'] = 'other';
  if (file.type.startsWith('image/')) category = 'image';
  else if (file.type.startsWith('video/')) category = 'video';
  else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) category = 'pdf';
  else if (file.type.includes('zip') || file.type.includes('compressed') || file.name.endsWith('.zip') || file.name.endsWith('.rar') || file.name.endsWith('.7z')) category = 'zip';

  const vaultItem: VaultFile = {
    id: 'vault_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    name: file.name,
    type: file.type || 'application/octet-stream',
    category,
    size: file.size,
    dateAdded: Date.now(),
    dataBlob: file,
    notes: notes || '',
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.add(vaultItem);

    req.onsuccess = () => resolve(vaultItem);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllVaultFiles(): Promise<VaultFile[]> {
  const db = await openVaultDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();

    req.onsuccess = () => {
      const items: VaultFile[] = req.result || [];
      // Sort newest first
      items.sort((a, b) => b.dateAdded - a.dateAdded);
      resolve(items);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteVaultFile(id: string): Promise<void> {
  const db = await openVaultDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function clearVault(): Promise<void> {
  const db = await openVaultDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// PIN Passcode Management
const PIN_KEY = 'omnichat_vault_pin';

export function getVaultPin(): string | null {
  return localStorage.getItem(PIN_KEY);
}

export function setVaultPin(pin: string): void {
  localStorage.setItem(PIN_KEY, pin);
}

export function isVaultPinSet(): boolean {
  return Boolean(localStorage.getItem(PIN_KEY));
}
