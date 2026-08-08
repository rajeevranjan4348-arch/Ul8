import React, { useState, useEffect } from 'react';
import {
  Folder, Video, MessageSquare, Plus, Trash2, Check, RefreshCw,
  ExternalLink, ShieldAlert, Send, FileText, ChevronRight, NotebookTabs,
  Layers, Pin, Sparkles, HelpCircle, AlertCircle, X, Download, Copy, Share2
} from 'lucide-react';
import {
  getAccessToken, logWorkspaceAction, db, auth
} from '../lib/firebase';
import {
  collection, addDoc, getDocs, deleteDoc, doc, updateDoc, serverTimestamp
} from 'firebase/firestore';
import { useTheme } from '../contexts/ThemeContext';
import { motion, AnimatePresence } from 'motion/react';

interface WorkspaceWidgetProps {
  onInsertText: (text: string) => void;
  onAttachFile?: (name: string, type: string, base64: string) => void;
  onClose?: () => void;
}

export const WorkspaceWidget: React.FC<WorkspaceWidgetProps> = ({
  onInsertText,
  onAttachFile,
  onClose
}) => {
  const { isDarkMode, getBorderClass, getAccentClass, getBgClass } = useTheme();
  
  const [token, setToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<'picker' | 'meet' | 'keep' | 'chat'>('picker');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Drive/Picker states
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [selectedFile, setSelectedFile] = useState<any>(null);

  // Meet states
  const [meetLink, setMeetLink] = useState<string | null>(null);
  const [meetLoading, setMeetLoading] = useState(false);

  // Keep states (Firestore-backed)
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState({ title: '', content: '', color: '#fef08a' });
  const [noteLoading, setNoteLoading] = useState(false);

  // Chat states
  const [spaces, setSpaces] = useState<any[]>([]);
  const [selectedSpace, setSelectedSpace] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newChatMessage, setNewChatMessage] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  const handleInsertText = (text: string) => {
    onInsertText(text);
    window.dispatchEvent(new CustomEvent('workspace-insert-text', { detail: text }));
  };

  useEffect(() => {
    const fetchToken = async () => {
      const activeToken = await getAccessToken();
      if (activeToken) {
        setToken(activeToken);
        setIsAuthenticated(true);
        loadInitialData(activeToken);
      } else {
        setIsAuthenticated(false);
      }
    };
    fetchToken();
  }, []);

  const loadInitialData = (authToken: string) => {
    fetchDriveFiles(authToken);
    fetchKeepNotes();
    fetchChatSpaces(authToken);
  };

  // --- GOOGLE DRIVES/PICKER ---
  const fetchDriveFiles = async (authToken?: string) => {
    const activeToken = authToken || token;
    if (!activeToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('https://www.googleapis.com/drive/v3/files?pageSize=15&fields=files(id,name,mimeType,thumbnailLink,iconLink,webViewLink)', {
        headers: { Authorization: `Bearer ${activeToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDriveFiles(data.files || []);
      } else {
        const errText = await res.text();
        console.warn('Drive fetch error details:', errText);
        setError('Connection expired. Sign in again via Workspace Central.');
      }
    } catch (err) {
      console.error(err);
      setError('Failed to fetch Drive files.');
    } finally {
      setLoading(false);
    }
  };

  const handlePickFile = async (file: any) => {
    setSelectedFile(file);
    if (!token) return;
    
    // Auto-insert link or offer attachment if text content
    handleInsertText(`[Drive File: ${file.name}](${file.webViewLink})`);
    await logWorkspaceAction('Google Picker', 'Pick File', `Selected file "${file.name}" via chat picker.`);
    
    // If it's a text/doc file, we can retrieve its base64 and attach it directly!
    if (onAttachFile) {
      try {
        let fetchUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
        if (file.mimeType.includes('google-apps.document')) {
          fetchUrl = `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=text/plain`;
        }
        const res = await fetch(fetchUrl, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const text = await res.text();
          const base64 = btoa(unescape(encodeURIComponent(text)));
          onAttachFile(file.name, 'text/plain', base64);
        }
      } catch (err) {
        console.error('Failed to auto-attach picked file', err);
      }
    }
  };

  // --- GOOGLE MEET ---
  const handleGenerateMeet = async () => {
    const activeToken = token;
    if (!activeToken) {
      setError('Sign in required.');
      return;
    }
    setMeetLoading(true);
    setError(null);
    try {
      const randomId = Math.random().toString(36).substr(2, 9);
      const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${activeToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          summary: 'Omni Instant Workspace Meet',
          description: 'Instant meeting session scheduled via Chat Integrations.',
          start: { dateTime: new Date().toISOString() },
          end: { dateTime: new Date(Date.now() + 60 * 60 * 1000).toISOString() },
          conferenceData: {
            createRequest: {
              requestId: randomId,
              conferenceSolutionKey: { type: 'hangoutsMeet' }
            }
          }
        })
      });

      if (res.ok) {
        const event = await res.json();
        const generatedLink = event.conferenceData?.entryPoints?.[0]?.uri || event.hangoutLink;
        setMeetLink(generatedLink);
        await logWorkspaceAction('Google Meet', 'Create Meeting', `Generated Meet link in chat: ${generatedLink}`);
      } else {
        setError('Meet creation failed. Ensure Calendar scope is accepted.');
      }
    } catch (err) {
      console.error(err);
      setError('Failed to contact Google Meet API.');
    } finally {
      setMeetLoading(false);
    }
  };

  const handleInsertMeetLink = () => {
    if (meetLink) {
      handleInsertText(`Join my instant Google Meet workspace session: ${meetLink}`);
      setMeetLink(null);
    }
  };

  // --- GOOGLE KEEP (Firestore-backed notes) ---
  const fetchKeepNotes = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setNoteLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'users', user.uid, 'keep_notes'));
      const list: any[] = [];
      snapshot.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setNotes(list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    } catch (err) {
      console.error(err);
    } finally {
      setNoteLoading(false);
    }
  };

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user || !newNote.title.trim() || !newNote.content.trim()) return;

    setNoteLoading(true);
    try {
      await addDoc(collection(db, 'users', user.uid, 'keep_notes'), {
        userId: user.uid,
        title: newNote.title.trim(),
        content: newNote.content.trim(),
        color: newNote.color,
        updatedAt: new Date().toISOString()
      });
      setNewNote({ title: '', content: '', color: '#fef08a' });
      await logWorkspaceAction('Google Keep', 'Create Note', `Created Keep Note: "${newNote.title}"`);
      await fetchKeepNotes();
    } catch (err) {
      console.error(err);
    } finally {
      setNoteLoading(false);
    }
  };

  const handleDeleteNote = async (id: string, title: string) => {
    const user = auth.currentUser;
    if (!user) return;
    if (!window.confirm(`Are you sure you want to delete note "${title}"?`)) return;

    setNoteLoading(true);
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'keep_notes', id));
      await logWorkspaceAction('Google Keep', 'Delete Note', `Deleted Keep Note: "${title}"`);
      await fetchKeepNotes();
    } catch (err) {
      console.error(err);
    } finally {
      setNoteLoading(false);
    }
  };

  const handleInsertNoteText = (note: any) => {
    handleInsertText(`**${note.title}**\n${note.content}`);
  };

  // --- GOOGLE CHAT ---
  const fetchChatSpaces = async (authToken?: string) => {
    const activeToken = authToken || token;
    if (!activeToken) return;
    setChatLoading(true);
    try {
      const res = await fetch('https://chat.googleapis.com/v1/spaces', {
        headers: { Authorization: `Bearer ${activeToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSpaces(data.spaces || []);
        if (data.spaces && data.spaces.length > 0) {
          setSelectedSpace(data.spaces[0].name);
          fetchChatMessages(data.spaces[0].name, activeToken);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setChatLoading(false);
    }
  };

  const fetchChatMessages = async (spaceName: string, authToken?: string) => {
    const activeToken = authToken || token;
    if (!activeToken) return;
    setChatLoading(true);
    try {
      const res = await fetch(`https://chat.googleapis.com/v1/${spaceName}/messages?pageSize=15`, {
        headers: { Authorization: `Bearer ${activeToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setChatMessages(data.messages || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setChatLoading(false);
    }
  };

  const handlePostChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedSpace || !newChatMessage.trim()) return;

    setChatLoading(true);
    try {
      const res = await fetch(`https://chat.googleapis.com/v1/${selectedSpace}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: newChatMessage.trim()
        })
      });

      if (res.ok) {
        setNewChatMessage('');
        await logWorkspaceAction('Google Chat', 'Post Message', `Posted message to Chat Space: ${selectedSpace}`);
        fetchChatMessages(selectedSpace);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setChatLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className={`p-4 rounded-2xl border text-center space-y-3 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <AlertCircle className="mx-auto text-amber-500" size={32} />
        <h3 className="font-semibold text-sm">Google Workspace Central Disconnected</h3>
        <p className="text-xs text-slate-400">
          Please open **Workspace Central** from the sidebar first and sign in with your Google account to grant full clearances for your workspace integrations.
        </p>
        {onClose && (
          <button
            onClick={onClose}
            className="text-xs px-3 py-1 bg-slate-500/15 rounded-lg hover:bg-slate-500/25 transition-all"
          >
            Close
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-96 w-full rounded-2xl border overflow-hidden shadow-xl ${isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'}`}>
      {/* Header bar */}
      <div className={`px-4 py-3 border-b flex justify-between items-center ${isDarkMode ? 'bg-slate-850 border-slate-800' : 'bg-slate-50 border-slate-150'}`}>
        <div className="flex items-center gap-2">
          <Sparkles className="text-cyan-400 animate-pulse" size={16} />
          <span className="text-xs font-bold uppercase tracking-wider">Workspace Assistant</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-500/10 transition-all opacity-70 hover:opacity-100">
            <X size={15} />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-500/10 text-[10px] sm:text-xs font-bold font-mono bg-slate-500/5 divide-x divide-slate-500/10">
        {[
          { id: 'picker', label: 'Picker', icon: Folder },
          { id: 'meet', label: 'Meet', icon: Video },
          { id: 'keep', label: 'Keep', icon: NotebookTabs },
          { id: 'chat', label: 'Chat', icon: MessageSquare }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 transition-all cursor-pointer ${
              activeTab === tab.id
                ? 'bg-cyan-500/15 text-cyan-400'
                : 'opacity-65 hover:opacity-100 hover:bg-slate-500/5'
            }`}
          >
            <tab.icon size={12} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {error && (
          <div className="bg-rose-500/10 text-rose-400 p-2 text-[11px] rounded-xl mb-3 flex items-center gap-1">
            <AlertCircle size={12} className="shrink-0" />
            <span className="truncate">{error}</span>
          </div>
        )}

        {/* 1. PICKER TAB */}
        {activeTab === 'picker' && (
          <div className="space-y-3 h-full flex flex-col">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-mono text-slate-400">PICK A FILE FROM DRIVE TO CHAT</span>
              <button
                onClick={() => fetchDriveFiles()}
                className="p-1 rounded bg-slate-500/10 text-slate-400 hover:text-white"
                title="Refresh Files"
              >
                <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-500/10 border border-slate-500/10 rounded-xl max-h-[200px]">
              {loading ? (
                <div className="text-center py-6 text-xs text-slate-500">Scanning Cloud Storage...</div>
              ) : driveFiles.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500">No Drive files found.</div>
              ) : (
                driveFiles.map(file => (
                  <div
                    key={file.id}
                    onClick={() => handlePickFile(file)}
                    className="p-2 hover:bg-slate-500/5 cursor-pointer flex items-center justify-between text-xs group transition-all"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <img src={file.iconLink} alt="" className="w-3.5 h-3.5 opacity-70" />
                      <span className="truncate font-medium">{file.name}</span>
                    </div>
                    <span className="opacity-0 group-hover:opacity-100 text-[10px] font-mono text-cyan-400 font-bold flex items-center gap-1 shrink-0 bg-cyan-500/10 px-1.5 py-0.5 rounded-md">
                      <span>Insert</span>
                      <ChevronRight size={10} />
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 2. MEET TAB */}
        {activeTab === 'meet' && (
          <div className="h-full flex flex-col justify-center items-center text-center space-y-4 py-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Video size={24} />
            </div>
            <div>
              <p className="font-bold text-xs">Instant Calendar & Meet Link Creator</p>
              <p className="text-[10px] opacity-60 mt-1 max-w-xs mx-auto">Create a real-time Google Meet room. The invite link can be posted instantly to your conversation.</p>
            </div>

            {meetLink ? (
              <div className="space-y-3 w-full max-w-xs">
                <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs font-mono text-emerald-400 select-all truncate">
                  {meetLink}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { navigator.clipboard.writeText(meetLink); alert('Link copied!'); }}
                    className="flex-1 py-1.5 border border-slate-500/20 rounded-xl text-xs font-semibold hover:bg-slate-500/10"
                  >
                    Copy Link
                  </button>
                  <button
                    onClick={handleInsertMeetLink}
                    className="flex-1 py-1.5 bg-emerald-500 text-slate-950 text-xs font-bold rounded-xl shadow-lg hover:bg-emerald-400"
                  >
                    Share in Chat
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={handleGenerateMeet}
                disabled={meetLoading}
                className="px-5 py-2.5 bg-emerald-500 text-slate-950 text-xs font-bold rounded-xl shadow-lg hover:bg-emerald-400 active:scale-95 transition-all flex items-center gap-1.5"
              >
                {meetLoading ? <RefreshCw className="animate-spin" size={13} /> : <Plus size={13} />}
                <span>Generate Meet Invite Link</span>
              </button>
            )}
          </div>
        )}

        {/* 3. KEEP TAB */}
        {activeTab === 'keep' && (
          <div className="space-y-3 h-full flex flex-col">
            <form onSubmit={handleCreateNote} className="flex gap-2 shrink-0">
              <input
                type="text"
                placeholder="Title..."
                value={newNote.title}
                onChange={e => setNewNote(prev => ({ ...prev, title: e.target.value }))}
                className={`flex-1 px-3 py-1.5 text-xs rounded-xl border outline-none ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-950'
                }`}
              />
              <input
                type="text"
                placeholder="Body..."
                value={newNote.content}
                onChange={e => setNewNote(prev => ({ ...prev, content: e.target.value }))}
                className={`flex-1.5 px-3 py-1.5 text-xs rounded-xl border outline-none ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-950'
                }`}
              />
              <button
                type="submit"
                disabled={noteLoading || !newNote.title.trim() || !newNote.content.trim()}
                className="px-3 py-1.5 bg-amber-500 text-slate-950 text-xs font-bold rounded-xl hover:bg-amber-400 disabled:opacity-40"
              >
                Add
              </button>
            </form>

            <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-2 max-h-[160px] pr-1">
              {noteLoading && notes.length === 0 ? (
                <div className="col-span-2 text-center py-6 text-xs text-slate-500">Syncing Keep Notes...</div>
              ) : notes.length === 0 ? (
                <div className="col-span-2 text-center py-6 text-xs text-slate-500">Your Keep Notes desk is empty.</div>
              ) : (
                notes.map(note => (
                  <div
                    key={note.id}
                    className="p-2.5 rounded-xl border text-left relative flex flex-col justify-between group transition-all duration-200 hover:scale-[1.01]"
                    style={{
                      backgroundColor: isDarkMode ? 'rgba(30,41,59,0.5)' : '#fffbeb',
                      borderColor: isDarkMode ? '#334155' : '#fef3c7'
                    }}
                  >
                    <div>
                      <h4 className="font-bold text-xs truncate mb-1 text-amber-500">{note.title}</h4>
                      <p className="text-[10px] opacity-80 line-clamp-3 leading-snug">{note.content}</p>
                    </div>
                    <div className="mt-2 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleInsertNoteText(note)}
                        className="text-[9px] font-mono font-bold text-cyan-400 flex items-center gap-0.5 hover:underline"
                      >
                        <Share2 size={8} />
                        <span>Insert</span>
                      </button>
                      <button
                        onClick={() => handleDeleteNote(note.id, note.title)}
                        className="text-red-400 hover:text-red-500"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 4. CHAT TAB */}
        {activeTab === 'chat' && (
          <div className="space-y-3 h-full flex flex-col">
            <div className="flex gap-2 shrink-0 items-center justify-between">
              <select
                value={selectedSpace}
                onChange={e => { setSelectedSpace(e.target.value); fetchChatMessages(e.target.value); }}
                className={`px-2 py-1 text-xs rounded-lg border outline-none font-mono ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-950'
                }`}
              >
                {spaces.length === 0 ? (
                  <option value="">No Google Chat Spaces</option>
                ) : (
                  spaces.map(s => (
                    <option key={s.name} value={s.name}>{s.displayName || s.name}</option>
                  ))
                )}
              </select>
              <button
                onClick={() => fetchChatSpaces()}
                className="p-1 rounded bg-slate-500/10 text-slate-400 hover:text-white"
                title="Refresh Rooms"
              >
                <RefreshCw size={11} className={chatLoading ? 'animate-spin' : ''} />
              </button>
            </div>

            {/* Chat Room History */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-500/5 border border-slate-500/10 rounded-xl max-h-[120px] p-2 space-y-2 bg-black/10">
              {chatLoading && chatMessages.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500">Syncing chat room feeds...</div>
              ) : chatMessages.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500">No messages in room.</div>
              ) : (
                chatMessages.map((msg, i) => (
                  <div key={i} className="text-[10px] space-y-0.5 leading-normal p-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-cyan-400">{msg.sender?.displayName || 'Workspace Partner'}</span>
                      <span className="opacity-55">{msg.createTime ? new Date(msg.createTime).toLocaleTimeString() : ''}</span>
                    </div>
                    <p className="opacity-90">{msg.text}</p>
                  </div>
                ))
              )}
            </div>

            {/* Post Message Form */}
            <form onSubmit={handlePostChatMessage} className="flex gap-1.5 shrink-0">
              <input
                type="text"
                placeholder="Post to Google Chat..."
                value={newChatMessage}
                onChange={e => setNewChatMessage(e.target.value)}
                disabled={!selectedSpace || chatLoading}
                className={`flex-1 px-3 py-1 text-xs rounded-lg border outline-none ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-950'
                }`}
              />
              <button
                type="submit"
                disabled={chatLoading || !newChatMessage.trim() || !selectedSpace}
                className="p-1.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 disabled:opacity-40"
              >
                <Send size={12} />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
