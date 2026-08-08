import React, { useEffect, useState, useRef } from 'react';
import { 
  Terminal, Trash2, Search, Filter, Mic, Volume2, Clock, Calendar, 
  Sparkles, Copy, Check, Download, Radio, Shield, Cpu, RefreshCw, Layers, FileJson
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { appLogger, LogEntry } from '../utils/logger';

interface VoiceCommandLog {
  id: string;
  timestamp: number;
  source: 'wake-word' | 'voice-mode' | 'speech-input' | string;
  text: string;
  title?: string;
  wakeWordDetected?: string;
  confidence?: number;
  messages?: { role: string; text: string }[];
}

export const LogsMode: React.FC = () => {
  const { getAccentClass, getBorderClass, isDarkMode } = useTheme();

  // Tab State: 'voice-logs' (Visual Wake-Word Viewer) vs 'system-logs' (Console)
  const [activeTab, setActiveTab] = useState<'voice-logs' | 'system-logs'>('voice-logs');

  // System Logs State
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLevel, setFilterLevel] = useState<'all' | 'info' | 'warn' | 'error'>('all');
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Wake-Word & Voice Command Logs State
  const [voiceLogs, setVoiceLogs] = useState<VoiceCommandLog[]>([]);
  const [voiceSearch, setVoiceSearch] = useState('');
  const [voiceFilterSource, setVoiceFilterSource] = useState<'all' | 'wake-word' | 'voice-mode'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Load Voice Logs from localStorage with default sample data if empty
  const loadVoiceLogs = () => {
    try {
      const raw = localStorage.getItem('omnichat_voice_commands');
      let items: VoiceCommandLog[] = raw ? JSON.parse(raw) : [];

      // If empty, populate with initial captured wake-word commands for rich visualization
      if (!Array.isArray(items) || items.length === 0) {
        items = [
          {
            id: 'vc-ww-1',
            timestamp: Date.now() - 1000 * 60 * 3, // 3 mins ago
            source: 'wake-word',
            text: 'Hey Omni, what is the weather forecast for today?',
            title: 'Wake-Word Triggered',
            wakeWordDetected: 'hey omni',
            confidence: 0.98,
          },
          {
            id: 'vc-ww-2',
            timestamp: Date.now() - 1000 * 60 * 24, // 24 mins ago
            source: 'wake-word',
            text: 'Jarvis, open AI Coder mode and generate a React component',
            title: 'Wake-Word Triggered',
            wakeWordDetected: 'jarvis',
            confidence: 0.95,
          },
          {
            id: 'vc-ww-3',
            timestamp: Date.now() - 1000 * 60 * 120, // 2 hours ago
            source: 'voice-mode',
            text: 'Omni AI, summarize the top tech news headlines for me',
            title: 'Voice Interactive Mode',
            wakeWordDetected: 'omni ai',
            confidence: 0.96,
          },
          {
            id: 'vc-ww-4',
            timestamp: Date.now() - 1000 * 60 * 360, // 6 hours ago
            source: 'wake-word',
            text: 'Hey Jarvis, set a timer and play background ambient audio',
            title: 'Wake-Word Triggered',
            wakeWordDetected: 'hey jarvis',
            confidence: 0.99,
          }
        ];
        localStorage.setItem('omnichat_voice_commands', JSON.stringify(items));
      }

      // Sort newest first
      items.sort((a, b) => b.timestamp - a.timestamp);
      setVoiceLogs(items);
    } catch (e) {
      console.error('Failed to load voice logs:', e);
    }
  };

  useEffect(() => {
    // Initial system logs load
    setLogs(appLogger.getLogs());
    const unsubscribe = appLogger.subscribe(() => {
      setLogs(appLogger.getLogs());
    });

    // Initial voice logs load
    loadVoiceLogs();

    // Listen for storage changes or periodic refresh for live voice logs
    const interval = setInterval(loadVoiceLogs, 3000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'system-logs') {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, activeTab]);

  const handleClearSystemLogs = () => {
    appLogger.clearLogs();
  };

  const handleClearVoiceLogs = () => {
    if (confirm('Clear all captured wake-word voice command history?')) {
      localStorage.removeItem('omnichat_voice_commands');
      setVoiceLogs([]);
    }
  };

  const handleDeleteVoiceLog = (id: string) => {
    const updated = voiceLogs.filter(item => item.id !== id);
    setVoiceLogs(updated);
    localStorage.setItem('omnichat_voice_commands', JSON.stringify(updated));
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(voiceLogs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `wake_word_voice_logs_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Filtering
  const filteredSystemLogs = logs.filter(log => {
    const matchesSearch = log.message.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLevel = filterLevel === 'all' || log.level === filterLevel;
    return matchesSearch && matchesLevel;
  });

  const filteredVoiceLogs = voiceLogs.filter(log => {
    const matchesSearch = log.text.toLowerCase().includes(voiceSearch.toLowerCase()) || 
                          (log.wakeWordDetected && log.wakeWordDetected.toLowerCase().includes(voiceSearch.toLowerCase()));
    const matchesSource = voiceFilterSource === 'all' || log.source === voiceFilterSource;
    return matchesSearch && matchesSource;
  });

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-500';
      case 'warn': return 'text-amber-500';
      default: return isDarkMode ? 'text-blue-400' : 'text-blue-600';
    }
  };

  const getLevelBg = (level: string) => {
    switch (level) {
      case 'error': return isDarkMode ? 'bg-red-500/10' : 'bg-red-50';
      case 'warn': return isDarkMode ? 'bg-amber-500/10' : 'bg-amber-50';
      default: return 'transparent';
    }
  };

  const formatTimestamp = (ts: number) => {
    const d = new Date(ts);
    return {
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
    };
  };

  return (
    <div className={`flex flex-col h-full w-full ${isDarkMode ? 'text-white bg-[#0a0a0f]' : 'text-slate-900 bg-slate-50'}`}>
      
      {/* Top Header Bar with Mode Switcher Tabs */}
      <div className={`p-4 border-b ${getBorderClass()} flex flex-col md:flex-row md:items-center justify-between gap-4 bg-black/20 backdrop-blur-md`}>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/30 text-violet-400">
            {activeTab === 'voice-logs' ? <Mic size={22} className="animate-pulse" /> : <Terminal size={22} />}
          </div>
          <div>
            <h2 className="font-extrabold text-lg tracking-wide flex items-center gap-2">
              <span>{activeTab === 'voice-logs' ? 'Voice & Wake-Word Logs' : 'System Console Logs'}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30">
                Real-time Capture
              </span>
            </h2>
            <p className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-slate-500'}`}>
              {activeTab === 'voice-logs' 
                ? 'Visual history of captured wake-word voice commands with timestamp metadata'
                : 'Console output, system events, and application debugging logs'
              }
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-2xl bg-black/40 border border-white/10 flex items-center gap-1 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('voice-logs')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                activeTab === 'voice-logs'
                  ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-500/25 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Mic size={14} />
              <span>Wake-Word History</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 text-white">
                {voiceLogs.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('system-logs')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                activeTab === 'system-logs'
                  ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-500/25 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Terminal size={14} />
              <span>Console Logs</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 text-white">
                {logs.length}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: VISUAL WAKE-WORD VOICE COMMAND LOG VIEWER */}
      {activeTab === 'voice-logs' && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          
          {/* Sub-header Filter Bar */}
          <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-black/10 shrink-0">
            <div className="flex items-center gap-3 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search captured voice commands or wake-words..."
                  value={voiceSearch}
                  onChange={e => setVoiceSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-slate-400 outline-none focus:border-violet-500 transition-all"
                />
              </div>

              {/* Source Filter */}
              <select
                value={voiceFilterSource}
                onChange={(e) => setVoiceFilterSource(e.target.value as any)}
                className="bg-black/40 border border-white/10 text-white text-xs rounded-xl px-3 py-2 outline-none cursor-pointer"
              >
                <option value="all">All Trigger Sources</option>
                <option value="wake-word">Wake-Word ("Hey Omni", "Jarvis")</option>
                <option value="voice-mode">Voice AI Mode</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportJson}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300 border border-white/10 transition-colors cursor-pointer"
                title="Export voice logs as JSON file"
              >
                <Download size={14} />
                <span>Export JSON</span>
              </button>

              <button
                onClick={handleClearVoiceLogs}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-semibold border border-red-500/30 transition-colors cursor-pointer"
              >
                <Trash2 size={14} />
                <span>Clear History</span>
              </button>
            </div>
          </div>

          {/* Log Cards List */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
            {filteredVoiceLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center space-y-3 p-8 border-2 border-dashed border-white/10 rounded-3xl">
                <Mic size={48} className="text-violet-400/40 animate-pulse" />
                <div>
                  <h4 className="text-base font-bold text-white">No Captured Voice Commands Found</h4>
                  <p className="text-xs text-slate-500 mt-1">Say "Hey Omni" or "Jarvis" into your microphone to record wake-word commands live.</p>
                </div>
              </div>
            ) : (
              filteredVoiceLogs.map((item) => {
                const ts = formatTimestamp(item.timestamp);
                const isWakeWord = item.source === 'wake-word';

                return (
                  <div
                    key={item.id}
                    className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 hover:border-violet-500/40 backdrop-blur-md shadow-xl space-y-3 transition-all hover:scale-[1.005] group"
                  >
                    {/* Card Metadata Top Header */}
                    <div className="flex items-center justify-between text-xs gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-1 rounded-xl text-[10px] font-extrabold uppercase tracking-wider border flex items-center gap-1.5 ${
                          isWakeWord
                            ? 'bg-violet-500/20 text-violet-300 border-violet-500/40 shadow-sm'
                            : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                        }`}>
                          <Radio size={11} className="animate-pulse" />
                          <span>{isWakeWord ? 'Wake-Word Triggered' : 'Voice Command'}</span>
                        </span>

                        {item.wakeWordDetected && (
                          <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                            <Sparkles size={11} />
                            <span>Trigger: "{item.wakeWordDetected}"</span>
                          </span>
                        )}

                        {item.confidence && (
                          <span className="text-[11px] text-emerald-400 font-semibold">
                            {(item.confidence * 100).toFixed(0)}% match
                          </span>
                        )}
                      </div>

                      {/* Timestamp Metadata */}
                      <div className="flex items-center gap-2 text-slate-400 text-xs font-mono">
                        <Calendar size={13} className="text-violet-400" />
                        <span>{ts.date}</span>
                        <Clock size={13} className="text-violet-400 ml-1" />
                        <span className="text-white font-bold">{ts.time}</span>
                      </div>
                    </div>

                    {/* Command Audio Transcript Box */}
                    <div className="p-4 rounded-xl bg-black/50 border border-white/10 flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-violet-500/20 text-violet-400 mt-0.5 shrink-0">
                          <Volume2 size={16} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-100 leading-relaxed font-mono">
                            "{item.text}"
                          </p>
                          <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-400">
                            <span className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              Audio Transcribed
                            </span>
                            <span>•</span>
                            <span>Source: {item.source}</span>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleCopyText(item.id, item.text)}
                          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                          title="Copy transcript"
                        >
                          {copiedId === item.id ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                        </button>
                        <button
                          onClick={() => handleDeleteVoiceLog(item.id)}
                          className="p-2 rounded-xl bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                          title="Delete entry"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: SYSTEM CONSOLE LOGS */}
      {activeTab === 'system-logs' && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Controls Bar */}
          <div className="p-4 border-b border-white/10 flex items-center justify-between gap-3 bg-black/10 shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search logs..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 rounded-xl text-xs bg-black/50 border border-white/10 text-white placeholder-slate-400 outline-none focus:border-violet-500"
                />
              </div>

              <select
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value as any)}
                className="bg-black/50 border border-white/10 text-white text-xs rounded-xl px-3 py-2 outline-none cursor-pointer"
              >
                <option value="all">All Levels</option>
                <option value="info">Info</option>
                <option value="warn">Warnings</option>
                <option value="error">Errors</option>
              </select>
            </div>

            <button 
              onClick={handleClearSystemLogs}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
            >
              <Trash2 size={14} />
              Clear Console
            </button>
          </div>

          {/* Terminal Output */}
          <div className={`flex-1 overflow-y-auto p-4 font-mono text-xs ${isDarkMode ? 'bg-[#0d0d0d]' : 'bg-white'}`}>
            {filteredSystemLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full opacity-50 space-y-4">
                <Terminal size={48} />
                <p>No console logs recorded</p>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredSystemLogs.map((log) => (
                  <div 
                    key={log.id} 
                    className={`py-1.5 px-3 rounded flex items-start gap-4 border-l-2 ${getLevelBg(log.level)} ${
                      log.level === 'error' ? 'border-red-500' : 
                      log.level === 'warn' ? 'border-amber-500' : 
                      'border-transparent'
                    } hover:bg-white/5 transition-colors`}
                  >
                    <span className="shrink-0 opacity-50 text-[11px] mt-0.5">
                      {log.timestamp.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 })}
                    </span>
                    <span className={`shrink-0 w-12 font-bold text-[11px] uppercase mt-0.5 ${getLevelColor(log.level)}`}>
                      {log.level}
                    </span>
                    <span className="break-all whitespace-pre-wrap text-slate-300">
                      {log.message}
                    </span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
