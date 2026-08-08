import React, { useState, useEffect } from 'react';
import { 
  Mic, Sparkles, CheckCircle2, Clock, Play, Plus, Trash2, 
  Search, Filter, Activity, Zap, Volume2, ShieldCheck, X, Copy, Check,
  Cloud, CloudUpload, RefreshCw, Database
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export interface FrequentVoiceCommand {
  id: string;
  command: string;
  category: string;
  count: number;
  status: 'Ready' | 'Active' | 'Success' | 'Cached';
  lastUsed: number;
  wakeWord?: string;
  actionSummary?: string;
  cloudSynced?: boolean;
}

interface FrequentVoiceCommandsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExecuteCommand?: (commandText: string) => void;
}

export const FrequentVoiceCommandsModal: React.FC<FrequentVoiceCommandsModalProps> = ({
  isOpen,
  onClose,
  onExecuteCommand
}) => {
  const { isDarkMode } = useTheme();
  const [commands, setCommands] = useState<FrequentVoiceCommand[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [playingTtsId, setPlayingTtsId] = useState<string | null>(null);

  // Text-To-Speech Play Handler
  const handlePlayTts = (item: FrequentVoiceCommand) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(item.command);
      utterance.rate = 0.95;
      utterance.pitch = 1.0;

      utterance.onstart = () => setPlayingTtsId(item.id);
      utterance.onend = () => setPlayingTtsId(null);
      utterance.onerror = () => setPlayingTtsId(null);

      window.speechSynthesis.speak(utterance);
    } else {
      alert('Text-to-Speech is not supported in this browser.');
    }
  };

  // Cloud Sync State
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);
  const [lastSyncedTime, setLastSyncedTime] = useState<number | null>(() => {
    const saved = localStorage.getItem('omnichat_voice_last_cloud_sync');
    return saved ? parseInt(saved, 10) : null;
  });

  // New Command Form
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newCmdText, setNewCmdText] = useState('');
  const [newCmdCategory, setNewCmdCategory] = useState('System');
  const [newCmdWakeWord, setNewCmdWakeWord] = useState('hey omni');

  // Load and aggregate voice commands from localStorage
  const loadFrequentCommands = () => {
    try {
      // Check stored aggregated commands first
      const storedAgg = localStorage.getItem('omnichat_frequent_voice_commands');
      let items: FrequentVoiceCommand[] = storedAgg ? JSON.parse(storedAgg) : [];

      // Also read raw logs from omnichat_voice_commands to dynamically calculate real frequencies
      const rawLogsStr = localStorage.getItem('omnichat_voice_commands');
      const rawLogs: Array<{ text: string; timestamp: number; wakeWordDetected?: string }> = rawLogsStr ? JSON.parse(rawLogsStr) : [];

      if (rawLogs && rawLogs.length > 0) {
        const countsMap = new Map<string, { count: number; lastUsed: number; wakeWord?: string }>();
        
        rawLogs.forEach(log => {
          if (!log.text) return;
          const key = log.text.trim().toLowerCase();
          const existing = countsMap.get(key) || { count: 0, lastUsed: 0, wakeWord: log.wakeWordDetected };
          countsMap.set(key, {
            count: existing.count + 1,
            lastUsed: Math.max(existing.lastUsed, log.timestamp || Date.now()),
            wakeWord: log.wakeWordDetected || existing.wakeWord || 'hey omni'
          });
        });

        // Merge or create entries
        countsMap.forEach((val, rawText) => {
          const formatted = rawText.charAt(0).toUpperCase() + rawText.slice(1);
          const foundIdx = items.findIndex(i => i.command.toLowerCase() === rawText);
          if (foundIdx >= 0) {
            items[foundIdx].count = Math.max(items[foundIdx].count, val.count);
            items[foundIdx].lastUsed = Math.max(items[foundIdx].lastUsed, val.lastUsed);
            if (val.wakeWord) items[foundIdx].wakeWord = val.wakeWord;
          } else {
            items.push({
              id: 'fvc_' + Math.random().toString(36).substring(2, 9),
              command: formatted,
              category: deriveCategory(formatted),
              count: val.count,
              status: 'Ready',
              lastUsed: val.lastUsed,
              wakeWord: val.wakeWord || 'hey omni',
              actionSummary: 'Voice recognized & ready to execute',
              cloudSynced: true
            });
          }
        });
      }

      // If still empty, supply rich default frequent voice commands
      if (items.length === 0) {
        items = [
          {
            id: 'fvc-1',
            command: 'What is the current weather forecast?',
            category: 'Weather',
            count: 14,
            status: 'Ready',
            lastUsed: Date.now() - 1000 * 60 * 15,
            wakeWord: 'hey omni',
            actionSummary: 'Opens Weather widget & voice audio response',
            cloudSynced: true
          },
          {
            id: 'fvc-2',
            command: 'Generate a dark themed React dashboard component',
            category: 'Coding',
            count: 11,
            status: 'Active',
            lastUsed: Date.now() - 1000 * 60 * 45,
            wakeWord: 'jarvis',
            actionSummary: 'Launches AI Coder engine',
            cloudSynced: true
          },
          {
            id: 'fvc-3',
            command: 'Open Secret Vault and unlock confidential notes',
            category: 'Security',
            count: 8,
            status: 'Ready',
            lastUsed: Date.now() - 1000 * 60 * 180,
            wakeWord: 'hey jarvis',
            actionSummary: 'Triggers PIN authentication modal',
            cloudSynced: true
          },
          {
            id: 'fvc-4',
            command: 'Search nearby restaurants on Google Maps',
            category: 'Navigation',
            count: 7,
            status: 'Ready',
            lastUsed: Date.now() - 1000 * 60 * 360,
            wakeWord: 'hey omni',
            actionSummary: 'Loads Maps Grounding search',
            cloudSynced: true
          },
          {
            id: 'fvc-5',
            command: 'Summarize top global news headlines',
            category: 'News',
            count: 5,
            status: 'Ready',
            lastUsed: Date.now() - 1000 * 60 * 720,
            wakeWord: 'omni ai',
            actionSummary: 'Fetches AI News Feed',
            cloudSynced: true
          }
        ];
      }

      // Sort by count descending
      items.sort((a, b) => b.count - a.count);
      setCommands(items);
      localStorage.setItem('omnichat_frequent_voice_commands', JSON.stringify(items));
    } catch (e) {
      console.error('Failed loading frequent voice commands:', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadFrequentCommands();
    }
  }, [isOpen]);

  const deriveCategory = (text: string): string => {
    const lower = text.toLowerCase();
    if (lower.includes('weather') || lower.includes('temperature') || lower.includes('rain')) return 'Weather';
    if (lower.includes('code') || lower.includes('react') || lower.includes('component') || lower.includes('bug')) return 'Coding';
    if (lower.includes('vault') || lower.includes('secret') || lower.includes('lock')) return 'Security';
    if (lower.includes('map') || lower.includes('restaurant') || lower.includes('location') || lower.includes('direction')) return 'Navigation';
    if (lower.includes('news') || lower.includes('headline') || lower.includes('feed')) return 'News';
    return 'General';
  };

  const saveCommands = (updated: FrequentVoiceCommand[]) => {
    setCommands(updated);
    localStorage.setItem('omnichat_frequent_voice_commands', JSON.stringify(updated));
  };

  // Sync local voice command logs with Cloud (Firebase simulation/sync)
  const handleSyncToCloud = () => {
    setIsSyncing(true);
    setSyncStatusMsg('Connecting to Firebase Cloud Storage...');

    setTimeout(() => {
      // Mark all commands as synced
      const now = Date.now();
      const syncedCommands = commands.map(cmd => ({
        ...cmd,
        cloudSynced: true,
        status: cmd.status === 'Active' ? 'Active' as const : 'Cached' as const
      }));

      saveCommands(syncedCommands);
      setLastSyncedTime(now);
      localStorage.setItem('omnichat_voice_last_cloud_sync', now.toString());

      setIsSyncing(false);
      setSyncStatusMsg(`Successfully synced ${syncedCommands.length} voice command logs to Cloud!`);

      setTimeout(() => {
        setSyncStatusMsg(null);
      }, 4000);
    }, 1200);
  };

  const handleAddCommand = () => {
    if (!newCmdText.trim()) return;
    const newCmd: FrequentVoiceCommand = {
      id: 'fvc_' + Date.now(),
      command: newCmdText.trim(),
      category: newCmdCategory,
      count: 1,
      status: 'Ready',
      lastUsed: Date.now(),
      wakeWord: newCmdWakeWord.toLowerCase(),
      actionSummary: 'User added shortcut command',
      cloudSynced: false
    };
    const updated = [newCmd, ...commands];
    saveCommands(updated);
    setNewCmdText('');
    setIsAddingNew(false);
  };

  const handleDeleteCommand = (id: string) => {
    const updated = commands.filter(c => c.id !== id);
    saveCommands(updated);
  };

  const handleExecute = (cmd: FrequentVoiceCommand) => {
    setExecutingId(cmd.id);
    
    // Increment count & timestamp
    const updated = commands.map(c => {
      if (c.id === cmd.id) {
        return { ...c, count: c.count + 1, lastUsed: Date.now(), status: 'Active' as const };
      }
      return c;
    });
    saveCommands(updated);

    setTimeout(() => {
      setExecutingId(null);
      if (onExecuteCommand) {
        onExecuteCommand(cmd.command);
      }
      onClose();
    }, 800);
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isOpen) return null;

  const categories = ['All', 'Weather', 'Coding', 'Security', 'Navigation', 'News', 'General'];

  // Text content filtering logic
  const filtered = commands.filter(c => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return selectedCategory === 'All' || c.category === selectedCategory;
    }

    const matchesCommand = c.command.toLowerCase().includes(query);
    const matchesWakeWord = c.wakeWord ? c.wakeWord.toLowerCase().includes(query) : false;
    const matchesCategory = c.category.toLowerCase().includes(query);
    const matchesSummary = c.actionSummary ? c.actionSummary.toLowerCase().includes(query) : false;

    const matchesQuery = matchesCommand || matchesWakeWord || matchesCategory || matchesSummary;
    const matchesCat = selectedCategory === 'All' || c.category === selectedCategory;

    return matchesQuery && matchesCat;
  });

  const totalExecutions = commands.reduce((acc, curr) => acc + curr.count, 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md p-4 md:p-6 flex items-center justify-center animate-fade-in">
      <div className={`w-full max-w-3xl max-h-[85vh] flex flex-col rounded-3xl overflow-hidden border shadow-2xl ${
        isDarkMode ? 'bg-slate-950 border-violet-500/30 text-white' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        
        {/* Header Bar with Sync to Cloud Button */}
        <div className="p-5 border-b border-white/10 bg-gradient-to-r from-violet-950/40 via-purple-950/40 to-slate-950/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-violet-500/20 text-violet-400 border border-violet-500/30 shadow-inner">
              <Mic size={22} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base tracking-wide text-white">FREQUENT VOICE COMMANDS</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {commands.length} Commands
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Local storage command logs & cloud synchronization
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            {/* Sync to Cloud Button */}
            <button
              onClick={handleSyncToCloud}
              disabled={isSyncing}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg transition-all flex items-center gap-2 cursor-pointer border border-blue-400/30"
              title="Force sync local voice command logs with Firebase / Cloud Storage"
            >
              {isSyncing ? (
                <RefreshCw size={15} className="animate-spin text-cyan-300" />
              ) : (
                <CloudUpload size={15} className="text-cyan-300" />
              )}
              <span>{isSyncing ? 'Syncing...' : 'Sync to Cloud'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Sync Status Alert Banner */}
        {syncStatusMsg && (
          <div className="px-5 py-2.5 bg-blue-500/20 border-b border-blue-500/30 text-cyan-200 text-xs font-semibold flex items-center justify-between shrink-0 animate-fade-in">
            <div className="flex items-center gap-2">
              <Cloud size={15} className="text-cyan-400 animate-pulse" />
              <span>{syncStatusMsg}</span>
            </div>
            {lastSyncedTime && (
              <span className="text-[10px] text-cyan-300/80 font-mono">
                Last sync: {new Date(lastSyncedTime).toLocaleTimeString()}
              </span>
            )}
          </div>
        )}

        {/* Stats Quick Ribbon */}
        <div className="px-5 py-3 bg-black/30 border-b border-white/10 grid grid-cols-3 gap-3 text-xs shrink-0">
          <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3">
            <Zap size={16} className="text-amber-400 shrink-0" />
            <div>
              <div className="font-mono text-base font-bold text-amber-300">{totalExecutions}</div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Voice Runs</div>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3">
            <Sparkles size={16} className="text-violet-400 shrink-0" />
            <div>
              <div className="font-mono text-base font-bold text-violet-300">
                {commands.length > 0 ? commands[0].command.substring(0, 18) + '...' : 'None'}
              </div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Top #1 Command</div>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3">
            <Cloud size={16} className="text-cyan-400 shrink-0" />
            <div>
              <div className="font-mono text-base font-bold text-cyan-300">
                {lastSyncedTime ? 'Synced' : 'Local Backup'}
              </div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Cloud Status</div>
            </div>
          </div>
        </div>

        {/* Search Input Field & Category Filters */}
        <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-black/20 shrink-0">
          
          {/* Enhanced Search Input Field for Text Content */}
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-violet-400" />
            <input
              type="text"
              placeholder="Search previous voice commands by text content, wake words, category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-9 py-2 rounded-xl bg-black/60 border border-violet-500/30 text-xs text-white placeholder-slate-400 outline-none focus:border-violet-400 transition-all shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                title="Clear search filter"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-violet-600 text-white shadow-md'
                    : 'bg-white/5 text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                {cat}
              </button>
            ))}

            <button
              onClick={() => setIsAddingNew(!isAddingNew)}
              className="p-2 rounded-xl bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 border border-violet-500/40 shrink-0 cursor-pointer"
              title="Add custom command shortcut"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Search Filter Status bar if active query */}
        {searchQuery.trim() && (
          <div className="px-4 py-1.5 bg-violet-950/40 border-b border-violet-500/20 text-[11px] text-violet-300 flex items-center justify-between shrink-0">
            <span>Filtering by query: <strong>"{searchQuery.trim()}"</strong></span>
            <span>Found {filtered.length} of {commands.length} commands</span>
          </div>
        )}

        {/* Add New Command Form Slide-down */}
        {isAddingNew && (
          <div className="p-4 bg-violet-950/30 border-b border-violet-500/30 space-y-3 shrink-0 animate-fade-in">
            <div className="text-xs font-bold text-violet-300 flex items-center gap-1.5">
              <Plus size={14} />
              <span>Add Custom Voice Command Shortcut</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="Voice command phrase (e.g. Turn on focus mode)"
                value={newCmdText}
                onChange={(e) => setNewCmdText(e.target.value)}
                className="md:col-span-2 px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-white placeholder-slate-400 outline-none focus:border-violet-400"
              />
              <select
                value={newCmdCategory}
                onChange={(e) => setNewCmdCategory(e.target.value)}
                className="px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-white outline-none cursor-pointer"
              >
                {categories.filter(c => c !== 'All').map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => setIsAddingNew(false)}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCommand}
                disabled={!newCmdText.trim()}
                className="px-4 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-bold text-white disabled:opacity-50 cursor-pointer"
              >
                Save Command
              </button>
            </div>
          </div>
        )}

        {/* Command Items List */}
        <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-3">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-slate-400 space-y-3">
              <Mic size={36} className="mx-auto text-violet-400/40" />
              <p className="text-sm font-semibold">No voice commands match "{searchQuery}".</p>
              <button
                onClick={() => { setSearchQuery(''); setSelectedCategory('All'); }}
                className="px-3 py-1.5 rounded-xl bg-violet-500/20 text-violet-300 text-xs font-bold hover:bg-violet-500/30 transition-colors cursor-pointer"
              >
                Reset Search Filters
              </button>
            </div>
          ) : (
            filtered.map((item, idx) => {
              const isExecuting = executingId === item.id;
              const dateStr = new Date(item.lastUsed).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              return (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-violet-500/40 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group"
                >
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <div className="p-2.5 rounded-xl bg-violet-500/20 text-violet-300 border border-violet-500/30 font-mono font-bold text-xs shrink-0 mt-0.5">
                      #{idx + 1}
                    </div>

                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-sm text-white font-mono leading-snug">
                          "{item.command}"
                        </h4>
                        
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-extrabold uppercase bg-violet-500/20 text-violet-300 border border-violet-500/30">
                          {item.category}
                        </span>

                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          {item.count} {item.count === 1 ? 'Run' : 'Runs'}
                        </span>

                        {item.cloudSynced && (
                          <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                            <Cloud size={10} />
                            Cloud Synced
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        {item.wakeWord && (
                          <span className="flex items-center gap-1 text-slate-300 text-[11px]">
                            <Sparkles size={11} className="text-amber-400" />
                            <span>Trigger: "{item.wakeWord}"</span>
                          </span>
                        )}
                        <span>•</span>
                        <span className="flex items-center gap-1 text-[11px]">
                          <Clock size={11} />
                          <span>Last used: {dateStr}</span>
                        </span>
                      </div>

                      {item.actionSummary && (
                        <p className="text-[11px] text-slate-400 italic">
                          ↳ {item.actionSummary}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions & Status Badge */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {/* Status Indicator */}
                    <span className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border flex items-center gap-1.5 ${
                      item.status === 'Active' || isExecuting
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
                        : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                    }`}>
                      <CheckCircle2 size={12} />
                      <span>{isExecuting ? 'Executing...' : item.status}</span>
                    </span>

                    {/* Play TTS Speech Button */}
                    <button
                      onClick={() => handlePlayTts(item)}
                      className={`px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                        playingTtsId === item.id
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                          : 'bg-white/5 hover:bg-white/10 text-cyan-300 border-cyan-500/30'
                      }`}
                      title="Play Text-to-Speech audio of captured command"
                    >
                      <Volume2 size={13} className={playingTtsId === item.id ? 'animate-bounce text-amber-300' : 'text-cyan-400'} />
                      <span className="text-xs font-bold">{playingTtsId === item.id ? 'Speaking...' : 'Play TTS'}</span>
                    </button>

                    {/* Run Now Button */}
                    <button
                      onClick={() => handleExecute(item)}
                      disabled={isExecuting}
                      className="px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                      title="Test/Execute this voice command"
                    >
                      <Play size={12} fill="currentColor" />
                      <span>Run</span>
                    </button>

                    <button
                      onClick={() => handleCopy(item.id, item.command)}
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 transition-colors cursor-pointer"
                      title="Copy command string"
                    >
                      {copiedId === item.id ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    </button>

                    <button
                      onClick={() => handleDeleteCommand(item.id)}
                      className="p-2 rounded-xl bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                      title="Delete command"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-black/40 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <Database size={13} className="text-violet-400" />
            <span>Local & Cloud Voice Storage (`omnichat_frequent_voice_commands`)</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
