import React, { useState, useEffect, useRef } from 'react';
import { 
  Lock, Unlock, ShieldAlert, Eye, EyeOff, Upload, FileText, Image as ImageIcon, 
  Video as VideoIcon, FileArchive, Download, Trash2, X, Plus, KeyRound, 
  Check, File, Search, AlertCircle, Shield, FolderKey, HardDrive
} from 'lucide-react';
import { 
  VaultFile, getAllVaultFiles, saveFileToVault, deleteVaultFile, 
  clearVault, getVaultPin, setVaultPin, isVaultPinSet 
} from '../utils/vaultStorage';
import { useTheme } from '../contexts/ThemeContext';

interface SecretVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SecretVaultModal: React.FC<SecretVaultModalProps> = ({ isOpen, onClose }) => {
  const { isDarkMode } = useTheme();

  // Authentication & PIN State
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isSettingNewPin, setIsSettingNewPin] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  // Files State
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<'all' | 'image' | 'video' | 'pdf' | 'zip' | 'other'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Selected file preview modal
  const [previewFile, setPreviewFile] = useState<{ file: VaultFile; url: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal opens or closes
  useEffect(() => {
    if (isOpen) {
      if (!isVaultPinSet()) {
        setIsSettingNewPin(true);
      } else {
        setIsUnlocked(false);
      }
      setPinInput('');
      setPinError('');
    } else {
      setIsUnlocked(false);
      if (previewFile) {
        URL.revokeObjectURL(previewFile.url);
        setPreviewFile(null);
      }
    }
  }, [isOpen]);

  // Load files when unlocked
  useEffect(() => {
    if (isUnlocked) {
      loadVaultFiles();
    }
  }, [isUnlocked]);

  const loadVaultFiles = async () => {
    setLoading(true);
    try {
      const items = await getAllVaultFiles();
      setFiles(items);
    } catch (err) {
      console.error('Failed to load vault files:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const savedPin = getVaultPin();
    if (pinInput === savedPin) {
      setIsUnlocked(true);
      setPinError('');
      setPinInput('');
    } else {
      setPinError('Incorrect 4-digit security PIN!');
      setPinInput('');
    }
  };

  const handleSetPinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.length < 4) {
      setPinError('PIN must be at least 4 digits');
      return;
    }
    if (newPin !== confirmPin) {
      setPinError('PINs do not match');
      return;
    }
    setVaultPin(newPin);
    setIsSettingNewPin(false);
    setIsUnlocked(true);
    setPinError('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles || uploadedFiles.length === 0) return;

    setIsUploading(true);
    try {
      for (let i = 0; i < uploadedFiles.length; i++) {
        await saveFileToVault(uploadedFiles[i]);
      }
      await loadVaultFiles();
    } catch (err) {
      console.error('Failed to save files to vault:', err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm('Are you sure you want to permanently delete this file from the secret vault?')) return;

    try {
      await deleteVaultFile(id);
      setFiles(prev => prev.filter(f => f.id !== id));
      if (previewFile && previewFile.file.id === id) {
        URL.revokeObjectURL(previewFile.url);
        setPreviewFile(null);
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const handleDownload = (fileItem: VaultFile, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const url = URL.createObjectURL(fileItem.dataBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileItem.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleOpenFilePreview = (fileItem: VaultFile) => {
    const url = URL.createObjectURL(fileItem.dataBlob);
    setPreviewFile({ file: fileItem, url });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const filteredFiles = files.filter(f => {
    const matchesCategory = activeCategory === 'all' || f.category === activeCategory;
    const matchesSearch = !searchQuery || f.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className={`relative w-full max-w-4xl h-[85vh] rounded-3xl border shadow-2xl flex flex-col overflow-hidden ${
        isDarkMode ? 'bg-slate-950/95 border-amber-500/30 text-white' : 'bg-white border-slate-300 text-slate-900'
      }`}>
        
        {/* Modal Top Header */}
        <div className={`px-6 py-4 border-b flex items-center justify-between shrink-0 ${
          isDarkMode ? 'bg-slate-900/80 border-white/10' : 'bg-slate-100 border-slate-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <FolderKey size={22} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-extrabold tracking-wide text-amber-400">SECRET VAULT</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  AES-Storage Encrypted
                </span>
              </div>
              <p className="text-xs text-slate-400">Hide private photos, videos, PDFs, ZIPs, and personal documents</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isUnlocked && (
              <button
                onClick={() => setIsUnlocked(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold border border-amber-500/40 transition-colors cursor-pointer"
                title="Lock Vault"
              >
                <Lock size={14} />
                <span>Lock Vault</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* PIN Entry / PIN Setup Screen */}
        {(!isUnlocked || isSettingNewPin) ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-6">
            <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-xl shadow-amber-500/10">
              <ShieldAlert size={40} />
            </div>

            {isSettingNewPin ? (
              <form onSubmit={handleSetPinSubmit} className="max-w-xs w-full space-y-4">
                <div>
                  <h4 className="text-xl font-bold text-white">Set Your Vault Security PIN</h4>
                  <p className="text-xs text-slate-400 mt-1">Choose a 4-digit security code to protect your hidden files</p>
                </div>

                {pinError && (
                  <div className="p-2.5 rounded-xl bg-red-500/20 text-red-300 border border-red-500/30 text-xs flex items-center justify-center gap-1.5">
                    <AlertCircle size={14} />
                    <span>{pinError}</span>
                  </div>
                )}

                <input
                  type="password"
                  maxLength={6}
                  placeholder="Enter 4-6 digit PIN"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  className="w-full p-3 rounded-2xl bg-black/60 border border-amber-500/40 text-center font-mono text-xl tracking-widest text-amber-300 outline-none focus:border-amber-400"
                  autoFocus
                />

                <input
                  type="password"
                  maxLength={6}
                  placeholder="Confirm PIN"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  className="w-full p-3 rounded-2xl bg-black/60 border border-amber-500/40 text-center font-mono text-xl tracking-widest text-amber-300 outline-none focus:border-amber-400"
                />

                <button
                  type="submit"
                  className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm shadow-xl shadow-amber-500/20 transition-all cursor-pointer"
                >
                  Save Security PIN
                </button>
              </form>
            ) : (
              <form onSubmit={handlePinSubmit} className="max-w-xs w-full space-y-4">
                <div>
                  <h4 className="text-xl font-bold text-white">Enter Vault Passcode</h4>
                  <p className="text-xs text-slate-400 mt-1">Enter your secret PIN to access hidden items</p>
                </div>

                {pinError && (
                  <div className="p-2.5 rounded-xl bg-red-500/20 text-red-300 border border-red-500/30 text-xs flex items-center justify-center gap-1.5">
                    <AlertCircle size={14} />
                    <span>{pinError}</span>
                  </div>
                )}

                <input
                  type="password"
                  maxLength={6}
                  placeholder="••••"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  className="w-full p-3 rounded-2xl bg-black/60 border border-amber-500/40 text-center font-mono text-2xl tracking-widest text-amber-300 outline-none focus:border-amber-400"
                  autoFocus
                />

                <button
                  type="submit"
                  className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm shadow-xl shadow-amber-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Unlock size={18} />
                  <span>Unlock Secret Vault</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Reset Vault PIN? (This will require setting a new passcode)')) {
                      setIsSettingNewPin(true);
                      setNewPin('');
                      setConfirmPin('');
                    }
                  }}
                  className="text-[11px] text-amber-400/80 hover:underline cursor-pointer"
                >
                  Forgot / Change PIN?
                </button>
              </form>
            )}
          </div>
        ) : (
          /* Main Unlocked Vault Interface */
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            
            {/* Toolbar: Category Filter Tabs, Search & Upload Button */}
            <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0 bg-black/20">
              
              {/* Category Pills */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 hide-scrollbar text-xs">
                {[
                  { id: 'all', label: 'All Files', icon: HardDrive },
                  { id: 'image', label: 'Photos', icon: ImageIcon },
                  { id: 'video', label: 'Videos', icon: VideoIcon },
                  { id: 'pdf', label: 'PDFs', icon: FileText },
                  { id: 'zip', label: 'ZIPs', icon: FileArchive },
                  { id: 'other', label: 'Others', icon: File },
                ].map(cat => {
                  const Icon = cat.icon;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.id as any)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium transition-all shrink-0 cursor-pointer ${
                        activeCategory === cat.id
                          ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                          : 'bg-white/5 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      <Icon size={14} />
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Search & Add File Button */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:w-48">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search vault..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-black/40 border border-white/15 text-xs text-white placeholder-slate-400 outline-none focus:border-amber-400"
                  />
                </div>

                <input
                  type="file"
                  multiple
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                />

                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all cursor-pointer shrink-0 disabled:opacity-50"
                >
                  <Plus size={16} />
                  <span>{isUploading ? 'Encrypting...' : 'Add Files'}</span>
                </button>
              </div>
            </div>

            {/* Files Grid / List Container */}
            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
                  <FolderKey size={32} className="animate-spin text-amber-400" />
                  <p className="text-xs">Decrypting Vault Storage...</p>
                </div>
              ) : filteredFiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center p-8 border-2 border-dashed border-white/10 rounded-3xl space-y-3">
                  <Shield size={48} className="text-amber-500/40" />
                  <div>
                    <h4 className="text-sm font-bold text-white">No Files Hidden Yet</h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm">
                      Tap 'Add Files' above to hide pictures, videos, PDFs, ZIP archives, or documents safely inside your encrypted vault.
                    </p>
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold hover:bg-amber-500/30 transition-colors cursor-pointer"
                  >
                    Select Files to Hide
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {filteredFiles.map((fileItem) => {
                    return (
                      <div
                        key={fileItem.id}
                        onClick={() => handleOpenFilePreview(fileItem)}
                        className="group relative rounded-2xl bg-slate-900/60 border border-white/10 hover:border-amber-400/50 p-3 flex flex-col justify-between transition-all hover:scale-[1.02] cursor-pointer shadow-lg overflow-hidden"
                      >
                        {/* File Thumbnail / Icon */}
                        <div className="w-full h-28 rounded-xl bg-black/40 flex items-center justify-center overflow-hidden mb-2 relative">
                          {fileItem.category === 'image' ? (
                            <img
                              src={URL.createObjectURL(fileItem.dataBlob)}
                              alt={fileItem.name}
                              className="w-full h-full object-cover"
                              onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
                            />
                          ) : fileItem.category === 'video' ? (
                            <div className="flex flex-col items-center text-amber-400">
                              <VideoIcon size={32} />
                              <span className="text-[10px] text-slate-400 mt-1">Video</span>
                            </div>
                          ) : fileItem.category === 'pdf' ? (
                            <div className="flex flex-col items-center text-rose-400">
                              <FileText size={32} />
                              <span className="text-[10px] text-slate-400 mt-1">PDF</span>
                            </div>
                          ) : fileItem.category === 'zip' ? (
                            <div className="flex flex-col items-center text-purple-400">
                              <FileArchive size={32} />
                              <span className="text-[10px] text-slate-400 mt-1">ZIP Archive</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center text-cyan-400">
                              <File size={32} />
                              <span className="text-[10px] text-slate-400 mt-1">File</span>
                            </div>
                          )}

                          {/* Hover Overlay Actions */}
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button
                              onClick={(e) => handleDownload(fileItem, e)}
                              className="p-2 rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition-colors"
                              title="Export / Unhide File"
                            >
                              <Download size={16} />
                            </button>
                            <button
                              onClick={(e) => handleDelete(fileItem.id, e)}
                              className="p-2 rounded-xl bg-red-600 text-white font-bold hover:bg-red-500 transition-colors"
                              title="Delete Permanently"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>

                        {/* File Info */}
                        <div className="space-y-0.5">
                          <h5 className="text-xs font-bold text-white truncate" title={fileItem.name}>{fileItem.name}</h5>
                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span>{formatFileSize(fileItem.size)}</span>
                            <span>{new Date(fileItem.dateAdded).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer Summary */}
            <div className="p-3 border-t border-white/10 bg-black/40 text-xs text-slate-400 flex items-center justify-between shrink-0 px-6">
              <span>Vault Storage: {files.length} item(s) hidden</span>
              <button
                onClick={() => {
                  if (confirm('Clear ALL hidden files from Vault?')) {
                    clearVault().then(() => setFiles([]));
                  }
                }}
                className="text-red-400 hover:underline cursor-pointer text-[11px]"
              >
                Clear All Files
              </button>
            </div>
          </div>
        )}

      </div>

      {/* File Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-60 bg-black/90 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="relative max-w-3xl w-full bg-slate-900 border border-white/20 rounded-3xl p-6 flex flex-col space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-white truncate">{previewFile.file.name}</h4>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownload(previewFile.file)}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs flex items-center gap-1"
                >
                  <Download size={14} />
                  <span>Unhide / Export</span>
                </button>
                <button
                  onClick={() => {
                    URL.revokeObjectURL(previewFile.url);
                    setPreviewFile(null);
                  }}
                  className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 flex items-center justify-center bg-black/60 rounded-2xl p-4 min-h-[300px]">
              {previewFile.file.category === 'image' ? (
                <img src={previewFile.url} alt={previewFile.file.name} className="max-h-[60vh] object-contain rounded-xl" />
              ) : previewFile.file.category === 'video' ? (
                <video src={previewFile.url} controls className="max-h-[60vh] w-full rounded-xl" />
              ) : previewFile.file.category === 'pdf' ? (
                <iframe src={previewFile.url} className="w-full h-[60vh] rounded-xl border-none" title="PDF Preview" />
              ) : (
                <div className="text-center text-slate-400 space-y-2">
                  <FileArchive size={48} className="mx-auto text-amber-400" />
                  <p className="text-xs">Compressed Archive or Document File</p>
                  <p className="text-[11px] text-slate-500 font-mono">{previewFile.file.name}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
