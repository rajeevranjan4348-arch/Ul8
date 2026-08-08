import React, { useState } from 'react';
import { useTheme, ThemeColor, ThemeFont } from '../contexts/ThemeContext';
import { useSettings, PromptPreset, LlmConfig } from '../contexts/SettingsContext';
import { usePremiumEffects } from '../components/PremiumEffects';
import { 
  Palette, Sun, Moon, Mic, Volume2, Type, Sliders, Monitor, Zap, User, 
  Cpu, Brain, Sparkles, Key, Globe, Database, BookOpen, Plus, Trash2, 
  Download, Upload, Check, RotateCcw, HelpCircle, Code2, MessageSquare, 
  Terminal, ShieldCheck, Layers, FileText
} from 'lucide-react';

export const SettingsMode: React.FC = () => {
  const { color, font, isDarkMode, setColor, setFont, setIsDarkMode, getBgClass, getTextClass, getAccentClass, getBorderClass } = useTheme();
  const effects = usePremiumEffects();
  const { 
    micId, setMicId, 
    sensitivity, setSensitivity, 
    ttsVoice, setTtsVoice, 
    availableMics,
    wakeWordSensitivity, setWakeWordSensitivity,
    userProfile, setUserProfile,
    memory, setMemory,
    readAloud, setReadAloud,
    performanceMode, setPerformanceMode,
    llmConfig, setLlmConfig,
    promptPresets, setPromptPresets,
    addMemoryItem, removeMemoryItem, clearAllMemory
  } = useSettings();

  // Navigation tab state inside Settings
  const [activeTab, setActiveTab] = useState<'llm' | 'memory' | 'prompts' | 'appearance' | 'audio' | 'profile'>('llm');

  // Local state for new memory & new prompt preset
  const [newMemoryInput, setNewMemoryInput] = useState('');
  const [memorySearch, setMemorySearch] = useState('');
  
  const [newPresetTitle, setNewPresetTitle] = useState('');
  const [newPresetCategory, setNewPresetCategory] = useState('Coding');
  const [newPresetPrompt, setNewPresetPrompt] = useState('');
  const [showAddPresetModal, setShowAddPresetModal] = useState(false);

  // Status feedback
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const colors: { id: ThemeColor; label: string; class: string }[] = [
    { id: 'slate', label: 'Slate', class: 'bg-slate-500' },
    { id: 'emerald', label: 'Emerald', class: 'bg-emerald-500' },
    { id: 'indigo', label: 'Indigo', class: 'bg-indigo-500' },
    { id: 'rose', label: 'Rose', class: 'bg-rose-500' },
    { id: 'amber', label: 'Amber', class: 'bg-amber-500' },
    { id: 'cyan', label: 'Cyan', class: 'bg-cyan-500' },
    { id: 'fuchsia', label: 'Fuchsia', class: 'bg-fuchsia-500' },
    { id: 'orange', label: 'Orange', class: 'bg-orange-500' },
  ];

  const fonts: { id: ThemeFont; label: string; desc: string }[] = [
    { id: 'sans', label: 'Inter', desc: 'Clean, modern sans-serif' },
    { id: 'mono', label: 'JetBrains', desc: 'Technical, monospaced' },
    { id: 'serif', label: 'Playfair', desc: 'Elegant, editorial serif' },
    { id: 'display', label: 'Outfit', desc: 'Bold, geometric display' },
    { id: 'handwriting', label: 'Caveat', desc: 'Casual, handwritten style' },
  ];

  const voices = [
    { id: 'Fenrir', label: '🎙️ Fenrir — Deep Male Baritone' },
    { id: 'Charon', label: '🎙️ Charon — Deep Male Low Pitch' },
    { id: 'Orpheus', label: '🎙️ Orpheus — Deep Male Resonant' },
    { id: 'Enceladus', label: '🎙️ Enceladus — Deep Male Bass' },
    { id: 'Puck', label: '🎙️ Puck — Energetic Male' },
    { id: 'Zephyr', label: '🎙️ Zephyr — Smooth Female' },
    { id: 'Kore', label: '🎙️ Kore — Clear Female' },
  ];

  const modelOptions = [
    { 
      id: 'gemini-3.5-flash', 
      name: 'Gemini 3.5 Flash', 
      tag: 'Recommended', 
      desc: 'Multimodal Flagship. Fastest reasoning, coding & vision intelligence.',
      badgeBg: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30'
    },
    { 
      id: 'gemini-3.1-flash-lite', 
      name: 'Gemini 3.1 Flash-Lite', 
      tag: 'Ultra Fast', 
      desc: 'Lightweight model optimized for rapid response speeds and low latency.',
      badgeBg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
    },
    { 
      id: 'gemini-2.5-pro', 
      name: 'Gemini 2.5 Pro', 
      tag: 'Deep Reasoning', 
      desc: 'Complex problem solving, technical code generation & academic analysis.',
      badgeBg: 'bg-purple-500/15 text-purple-400 border-purple-500/30'
    },
    { 
      id: 'deepseek-r1-preset', 
      name: 'DeepSeek R1 Persona', 
      tag: 'Reasoning Mode', 
      desc: 'Emulates step-by-step chain-of-thought mathematical & logical rigor.',
      badgeBg: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
    },
    { 
      id: 'claude-3-5-sonnet-preset', 
      name: 'Claude 3.5 Style', 
      tag: 'Creative & Technical', 
      desc: 'Refined prose, humanlike tone, and structured document outputs.',
      badgeBg: 'bg-amber-500/15 text-amber-400 border-amber-500/30'
    },
  ];

  const handleExportConfig = () => {
    const fullConfig = {
      llmConfig,
      userProfile,
      memory,
      promptPresets,
      theme: { color, font, isDarkMode },
      audio: { ttsVoice, readAloud, sensitivity, wakeWordSensitivity }
    };
    const blob = new Blob([JSON.stringify(fullConfig, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `omnichat-ai-settings-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    triggerToast('Configuration exported as JSON file!');
  };

  const handleImportConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.llmConfig) setLlmConfig(parsed.llmConfig);
        if (parsed.userProfile) setUserProfile(parsed.userProfile);
        if (parsed.memory) setMemory(parsed.memory);
        if (parsed.promptPresets) setPromptPresets(parsed.promptPresets);
        if (parsed.theme?.color) setColor(parsed.theme.color);
        if (parsed.theme?.font) setFont(parsed.theme.font);
        if (parsed.theme?.isDarkMode !== undefined) setIsDarkMode(parsed.theme.isDarkMode);
        triggerToast('AI Configuration imported successfully!');
      } catch (err) {
        alert('Invalid JSON configuration file.');
      }
    };
    reader.readAsText(file);
  };

  const filteredMemories = memory.filter(m => m.toLowerCase().includes(memorySearch.toLowerCase()));

  return (
    <div className={`w-full h-full overflow-y-auto ${getBgClass()} ${getTextClass()}`}>
      <div className="max-w-5xl mx-auto p-4 sm:p-8 space-y-8 pb-32">
        
        {/* Toast alert */}
        {toastMsg && (
          <div className="fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl bg-cyan-500 text-slate-950 font-bold shadow-2xl animate-in slide-in-from-top duration-300">
            <Check size={18} />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Cpu size={24} className="text-cyan-400" />
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">AI & LLM Engine Settings</h1>
            </div>
            <p className={`text-sm ${isDarkMode ? 'text-white/60' : 'text-slate-500'}`}>
              Customize LLM hyperparameters, system instructions, AI memory bank, custom endpoints, and prompt templates.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportConfig}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold transition-all cursor-pointer"
              title="Export AI Config JSON"
            >
              <Download size={14} />
              <span>Export Config</span>
            </button>
            <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/30 text-xs font-semibold transition-all cursor-pointer">
              <Upload size={14} />
              <span>Import Config</span>
              <input type="file" accept=".json" onChange={handleImportConfig} className="hidden" />
            </label>
          </div>
        </header>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-white/10 text-xs sm:text-sm font-semibold">
          <button
            onClick={() => setActiveTab('llm')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer shrink-0 ${
              activeTab === 'llm'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Cpu size={16} />
            <span>LLM Engine & Hyperparameters</span>
          </button>

          <button
            onClick={() => setActiveTab('memory')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer shrink-0 ${
              activeTab === 'memory'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Brain size={16} />
            <span>AI Memory Bank ({memory.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('prompts')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer shrink-0 ${
              activeTab === 'prompts'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <BookOpen size={16} />
            <span>Prompt Library ({promptPresets.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('appearance')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer shrink-0 ${
              activeTab === 'appearance'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Palette size={16} />
            <span>Appearance & Theme</span>
          </button>

          <button
            onClick={() => setActiveTab('audio')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer shrink-0 ${
              activeTab === 'audio'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Volume2 size={16} />
            <span>Audio & Speech</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer shrink-0 ${
              activeTab === 'profile'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <User size={16} />
            <span>User Persona</span>
          </button>
        </div>

        {/* TAB 1: LLM ENGINE & HYPERPARAMETERS */}
        {activeTab === 'llm' && (
          <div className="space-y-8 animate-in fade-in-50 duration-200">
            
            {/* Primary Model Selection */}
            <section className={`p-6 rounded-2xl border ${getBorderClass()} ${isDarkMode ? 'bg-black/20' : 'bg-white shadow-sm'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-cyan-500/10' : 'bg-cyan-50'}`}>
                    <Cpu size={20} className="text-cyan-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Default AI Model Selection</h2>
                    <p className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-slate-500'}`}>Choose your primary model or persona preset</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {modelOptions.map((m) => {
                  const isSelected = llmConfig.model === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        setLlmConfig(prev => ({ ...prev, model: m.id }));
                        triggerToast(`Switched LLM Model to ${m.name}`);
                      }}
                      className={`p-4 rounded-2xl border text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                        isSelected 
                          ? 'border-cyan-500 bg-cyan-500/10 shadow-lg shadow-cyan-500/10' 
                          : `${getBorderClass()} hover:border-slate-500 ${isDarkMode ? 'bg-white/5' : 'bg-slate-50'}`
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="font-bold text-base flex items-center gap-2">
                            {m.name}
                            {isSelected && <Check size={16} className="text-cyan-400" />}
                          </span>
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${m.badgeBg}`}>
                            {m.tag}
                          </span>
                        </div>
                        <p className={`text-xs leading-relaxed ${isDarkMode ? 'text-white/60' : 'text-slate-600'}`}>
                          {m.desc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Hyperparameters Controls */}
            <section className={`p-6 rounded-2xl border ${getBorderClass()} ${isDarkMode ? 'bg-black/20' : 'bg-white shadow-sm'}`}>
              <div className="flex items-center gap-3 mb-6">
                <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-amber-500/10' : 'bg-amber-50'}`}>
                  <Sliders size={20} className="text-amber-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">LLM Hyperparameters</h2>
                  <p className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-slate-500'}`}>Fine-tune response creativity, output token budget, and probability bounds</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* Temperature Slider */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-sm flex items-center gap-2">
                      <Sparkles size={16} className="text-amber-400" />
                      Temperature (Randomness)
                    </label>
                    <span className="font-mono text-xs px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 font-bold">
                      {llmConfig.temperature} ({llmConfig.temperature < 0.3 ? 'Precise' : llmConfig.temperature < 0.8 ? 'Balanced' : 'Creative'})
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="1.0"
                    step="0.05"
                    value={llmConfig.temperature}
                    onChange={(e) => setLlmConfig(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                    className="w-full h-2 rounded-lg bg-white/10 appearance-none cursor-pointer accent-amber-500"
                  />
                  <p className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-slate-500'}`}>
                    Lower values produce factual & code-precise output. Higher values produce creative storytelling & brainstorming.
                  </p>
                </div>

                {/* Top-P Slider */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-sm flex items-center gap-2">
                      <Layers size={16} className="text-violet-400" />
                      Top-P Nucleus Sampling
                    </label>
                    <span className="font-mono text-xs px-2.5 py-1 rounded-lg bg-violet-500/20 text-violet-300 font-bold">
                      {llmConfig.topP}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={llmConfig.topP}
                    onChange={(e) => setLlmConfig(prev => ({ ...prev, topP: parseFloat(e.target.value) }))}
                    className="w-full h-2 rounded-lg bg-white/10 appearance-none cursor-pointer accent-violet-500"
                  />
                  <p className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-slate-500'}`}>
                    Limits token selection probability mass. Recommended default is 0.95.
                  </p>
                </div>

                {/* Max Tokens Budget */}
                <div className="space-y-3 md:col-span-2">
                  <label className="font-semibold text-sm flex items-center gap-2">
                    <Terminal size={16} className="text-emerald-400" />
                    Max Output Generation Budget
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[1024, 2048, 4096, 8192].map((token) => (
                      <button
                        key={token}
                        onClick={() => setLlmConfig(prev => ({ ...prev, maxTokens: token }))}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                          llmConfig.maxTokens === token
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-500/20'
                            : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        {token} Tokens (~{Math.round(token * 0.75)} words)
                      </button>
                    ))}
                  </div>
                </div>

                {/* Thinking / Reasoning Toggle */}
                <div className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-white/5 md:col-span-2">
                  <div>
                    <h3 className="font-bold text-sm flex items-center gap-2">
                      <Brain size={16} className="text-cyan-400" />
                      Chain of Thought & Thinking Reasoning
                    </h3>
                    <p className={`text-xs mt-1 ${isDarkMode ? 'text-white/50' : 'text-slate-500'}`}>
                      Display step-by-step logical reasoning before generating final responses
                    </p>
                  </div>
                  <button
                    onClick={() => setLlmConfig(prev => ({ ...prev, enableThinking: !prev.enableThinking }))}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      llmConfig.enableThinking ? 'bg-cyan-500' : isDarkMode ? 'bg-white/10' : 'bg-slate-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        llmConfig.enableThinking ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

              </div>
            </section>

            {/* Custom System Prompt Override */}
            <section className={`p-6 rounded-2xl border ${getBorderClass()} ${isDarkMode ? 'bg-black/20' : 'bg-white shadow-sm'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-indigo-500/10' : 'bg-indigo-50'}`}>
                    <FileText size={20} className="text-indigo-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Global System Instruction Override</h2>
                    <p className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-slate-500'}`}>Injected as high-priority developer system instructions for all AI chats</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="text-slate-400 font-semibold self-center">Quick Templates:</span>
                  <button
                    onClick={() => setLlmConfig(prev => ({ ...prev, customSystemPrompt: 'You are a Senior Principal Software Engineer. Provide concise, production-ready code with minimal fluff and explain potential performance pitfalls.' }))}
                    className="px-2.5 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/25 transition-all cursor-pointer"
                  >
                    Senior Software Architect
                  </button>
                  <button
                    onClick={() => setLlmConfig(prev => ({ ...prev, customSystemPrompt: 'You are an elite Executive Assistant. Be extremely concise, use clear bullet points, bold key terms, and always provide actionable summaries.' }))}
                    className="px-2.5 py-1 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25 transition-all cursor-pointer"
                  >
                    Executive Assistant
                  </button>
                  <button
                    onClick={() => setLlmConfig(prev => ({ ...prev, customSystemPrompt: 'You are a patient Socratic Professor. Teach concepts step-by-step, asking guiding questions that allow the user to discover the answers.' }))}
                    className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 transition-all cursor-pointer"
                  >
                    Socratic Professor
                  </button>
                  <button
                    onClick={() => setLlmConfig(prev => ({ ...prev, customSystemPrompt: '' }))}
                    className="px-2.5 py-1 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 hover:bg-red-500/25 transition-all cursor-pointer"
                  >
                    Clear Prompt
                  </button>
                </div>

                <textarea
                  value={llmConfig.customSystemPrompt}
                  onChange={(e) => setLlmConfig(prev => ({ ...prev, customSystemPrompt: e.target.value }))}
                  placeholder="e.g. Always respond in markdown format with code blocks. Prioritize clean, modern code examples and concise explanations."
                  rows={4}
                  className={`w-full p-3 rounded-xl border outline-none transition-colors font-mono text-xs ${
                    isDarkMode 
                      ? 'bg-black/40 border-white/10 focus:border-cyan-500/50 text-white' 
                      : 'bg-slate-50 border-slate-200 focus:border-slate-400 text-slate-900'
                  }`}
                />
              </div>
            </section>

            {/* Custom Provider / Endpoint Settings */}
            <section className={`p-6 rounded-2xl border ${getBorderClass()} ${isDarkMode ? 'bg-black/20' : 'bg-white shadow-sm'}`}>
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                  <Globe size={20} className="text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Custom API Endpoint / Proxy</h2>
                  <p className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-slate-500'}`}>Optionally route through custom local Ollama, OpenRouter, or OpenAI-compatible proxies</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">Custom Base API URL (Optional)</label>
                  <input
                    type="url"
                    value={llmConfig.customEndpoint}
                    onChange={(e) => setLlmConfig(prev => ({ ...prev, customEndpoint: e.target.value }))}
                    placeholder="https://openrouter.ai/api/v1 or http://localhost:11434"
                    className={`w-full p-2.5 rounded-xl border text-xs outline-none ${
                      isDarkMode ? 'bg-black/40 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Custom API Key Override (Optional)</label>
                  <input
                    type="password"
                    value={llmConfig.customApiKey}
                    onChange={(e) => setLlmConfig(prev => ({ ...prev, customApiKey: e.target.value }))}
                    placeholder="sk-or-v1-..."
                    className={`w-full p-2.5 rounded-xl border text-xs outline-none ${
                      isDarkMode ? 'bg-black/40 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />
                </div>
              </div>
            </section>

          </div>
        )}

        {/* TAB 2: AI MEMORY BANK */}
        {activeTab === 'memory' && (
          <div className="space-y-6 animate-in fade-in-50 duration-200">
            <section className={`p-6 rounded-2xl border ${getBorderClass()} ${isDarkMode ? 'bg-black/20' : 'bg-white shadow-sm'}`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-cyan-500/10' : 'bg-cyan-50'}`}>
                    <Brain size={22} className="text-cyan-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Long-Term Memory Bank</h2>
                    <p className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-slate-500'}`}>
                      Facts, preferences, and personal details remembered by the AI across sessions.
                    </p>
                  </div>
                </div>

                {memory.length > 0 && (
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to clear all stored memories?')) {
                        clearAllMemory();
                        triggerToast('All AI memories cleared.');
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 text-xs font-semibold transition-all cursor-pointer self-start md:self-auto"
                  >
                    <Trash2 size={14} />
                    <span>Clear All Memories</span>
                  </button>
                )}
              </div>

              {/* Add Memory Input */}
              <div className="flex gap-2 mb-6">
                <input
                  type="text"
                  value={newMemoryInput}
                  onChange={(e) => setNewMemoryInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newMemoryInput.trim()) {
                      addMemoryItem(newMemoryInput);
                      setNewMemoryInput('');
                      triggerToast('Memory added!');
                    }
                  }}
                  placeholder="Add a new fact (e.g. 'Prefers TypeScript over JavaScript', 'Working on a React Native app')..."
                  className={`flex-1 p-3 rounded-xl border text-xs outline-none ${
                    isDarkMode ? 'bg-black/40 border-white/10 text-white focus:border-cyan-500/50' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
                <button
                  onClick={() => {
                    if (newMemoryInput.trim()) {
                      addMemoryItem(newMemoryInput);
                      setNewMemoryInput('');
                      triggerToast('Memory added!');
                    }
                  }}
                  className="px-4 py-3 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs hover:bg-cyan-400 transition-all cursor-pointer flex items-center gap-1 shrink-0"
                >
                  <Plus size={16} />
                  <span>Remember Fact</span>
                </button>
              </div>

              {/* Search Memory */}
              {memory.length > 0 && (
                <div className="mb-4">
                  <input
                    type="text"
                    value={memorySearch}
                    onChange={(e) => setMemorySearch(e.target.value)}
                    placeholder="Search stored memories..."
                    className={`w-full p-2.5 rounded-xl border text-xs outline-none ${
                      isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-100 border-slate-200 text-slate-900'
                    }`}
                  />
                </div>
              )}

              {/* Memory Cards */}
              {filteredMemories.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-white/10 rounded-2xl">
                  <Brain size={36} className="mx-auto text-slate-500 mb-2" />
                  <p className="font-semibold text-sm">No memories recorded yet</p>
                  <p className={`text-xs mt-1 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>
                    Add key facts above or talk to the AI to let it build custom context automatically.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredMemories.map((mem, idx) => (
                    <div
                      key={idx}
                      className={`flex items-start justify-between gap-3 p-3.5 rounded-xl border text-xs transition-all ${
                        isDarkMode ? 'bg-white/5 border-white/10 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="w-2 h-2 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
                        <span className="leading-relaxed font-medium">{mem}</span>
                      </div>
                      <button
                        onClick={() => {
                          removeMemoryItem(idx);
                          triggerToast('Memory removed.');
                        }}
                        className="p-1 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors cursor-pointer shrink-0"
                        title="Delete memory"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* TAB 3: PROMPT LIBRARY */}
        {activeTab === 'prompts' && (
          <div className="space-y-6 animate-in fade-in-50 duration-200">
            <section className={`p-6 rounded-2xl border ${getBorderClass()} ${isDarkMode ? 'bg-black/20' : 'bg-white shadow-sm'}`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-violet-500/10' : 'bg-violet-50'}`}>
                    <BookOpen size={22} className="text-violet-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Custom Prompt Library</h2>
                    <p className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-slate-500'}`}>
                      Save reusable system prompts and persona templates for quick one-click chats.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowAddPresetModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-violet-500 text-white font-bold text-xs hover:bg-violet-400 transition-all cursor-pointer shadow-md shadow-violet-500/20 self-start md:self-auto"
                >
                  <Plus size={16} />
                  <span>Create New Prompt</span>
                </button>
              </div>

              {/* Add Preset Form */}
              {showAddPresetModal && (
                <div className="p-4 rounded-2xl border border-violet-500/30 bg-violet-500/10 mb-6 space-y-3 animate-in fade-in-50 duration-200">
                  <h3 className="font-bold text-sm text-violet-300">Add New Custom Prompt Preset</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Title (e.g., Code Refactorer)"
                      value={newPresetTitle}
                      onChange={(e) => setNewPresetTitle(e.target.value)}
                      className={`p-2.5 rounded-xl border text-xs outline-none ${
                        isDarkMode ? 'bg-black/40 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
                      }`}
                    />
                    <select
                      value={newPresetCategory}
                      onChange={(e) => setNewPresetCategory(e.target.value)}
                      className={`p-2.5 rounded-xl border text-xs outline-none ${
                        isDarkMode ? 'bg-black/40 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
                      }`}
                    >
                      <option value="Coding">Coding</option>
                      <option value="Education">Education</option>
                      <option value="Productivity">Productivity</option>
                      <option value="Research">Research</option>
                      <option value="Creative">Creative Writing</option>
                    </select>
                  </div>
                  <textarea
                    placeholder="Enter prompt template instructions..."
                    rows={3}
                    value={newPresetPrompt}
                    onChange={(e) => setNewPresetPrompt(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border text-xs outline-none font-mono ${
                      isDarkMode ? 'bg-black/40 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
                    }`}
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowAddPresetModal(false)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        if (!newPresetTitle || !newPresetPrompt) return;
                        setPromptPresets(prev => [
                          {
                            id: Date.now().toString(),
                            title: newPresetTitle,
                            category: newPresetCategory,
                            prompt: newPresetPrompt
                          },
                          ...prev
                        ]);
                        setNewPresetTitle('');
                        setNewPresetPrompt('');
                        setShowAddPresetModal(false);
                        triggerToast('Prompt Preset Saved!');
                      }}
                      className="px-4 py-1.5 rounded-xl bg-violet-500 text-white font-bold text-xs hover:bg-violet-400 transition-all cursor-pointer"
                    >
                      Save Prompt
                    </button>
                  </div>
                </div>
              )}

              {/* Prompt Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {promptPresets.map((p) => (
                  <div
                    key={p.id}
                    className={`p-4 rounded-2xl border text-xs transition-all relative flex flex-col justify-between ${
                      isDarkMode ? 'bg-white/5 border-white/10 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-bold text-sm text-violet-400 flex items-center gap-1.5">
                          <Code2 size={16} />
                          {p.title}
                        </span>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/30">
                          {p.category}
                        </span>
                      </div>
                      <p className={`font-mono text-[11px] leading-relaxed line-clamp-3 mb-3 p-2 rounded-lg ${isDarkMode ? 'bg-black/30 text-white/70' : 'bg-white text-slate-600'}`}>
                        {p.prompt}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/10">
                      <button
                        onClick={() => {
                          setLlmConfig(prev => ({ ...prev, customSystemPrompt: p.prompt }));
                          triggerToast(`Set active system prompt to "${p.title}"!`);
                        }}
                        className="flex items-center gap-1 text-[11px] font-semibold text-cyan-400 hover:underline cursor-pointer"
                      >
                        <Check size={12} />
                        <span>Use as System Prompt</span>
                      </button>

                      <button
                        onClick={() => {
                          setPromptPresets(prev => prev.filter(x => x.id !== p.id));
                          triggerToast('Prompt deleted.');
                        }}
                        className="p-1 text-red-400 hover:bg-red-500/10 rounded-md transition-colors cursor-pointer"
                        title="Delete Prompt"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* TAB 4: APPEARANCE & THEME */}
        {activeTab === 'appearance' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in-50 duration-200">
            <section className={`p-6 rounded-2xl border ${getBorderClass()} ${isDarkMode ? 'bg-black/20' : 'bg-white shadow-sm'}`}>
              <div className="flex items-center gap-3 mb-6">
                <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-white/10' : 'bg-slate-100'}`}>
                  <Palette size={20} className={getAccentClass()} />
                </div>
                <h2 className="text-xl font-semibold">Appearance</h2>
              </div>

              <div className="space-y-6">
                {/* Theme Mode */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Theme Mode</h3>
                    <p className={`text-xs mt-1 ${isDarkMode ? 'text-white/50' : 'text-slate-500'}`}>Toggle light or dark interface</p>
                  </div>
                  <div className={`flex p-1 rounded-lg border ${getBorderClass()} ${isDarkMode ? 'bg-black/40' : 'bg-slate-100'}`}>
                    <button
                      onClick={() => setIsDarkMode(false)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${!isDarkMode ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      <Sun size={14} /> Light
                    </button>
                    <button
                      onClick={() => setIsDarkMode(true)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${isDarkMode ? 'bg-slate-800 shadow-sm text-white' : 'text-slate-400 hover:text-slate-300'}`}
                    >
                      <Moon size={14} /> Dark
                    </button>
                  </div>
                </div>

                <div className={`h-px w-full ${isDarkMode ? 'bg-white/10' : 'bg-slate-100'}`} />

                {/* Performance / Graphics Mode */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Premium Animation Engine</h3>
                    <p className={`text-xs mt-1 ${isDarkMode ? 'text-white/50' : 'text-slate-500'}`}>
                      Toggle ultra-high frame rate physics, blurs, and global particle dynamics.
                    </p>
                  </div>
                  <div className={`flex p-1 rounded-lg border ${getBorderClass()} ${isDarkMode ? 'bg-black/40' : 'bg-slate-100'}`}>
                    <button
                      onClick={() => {
                        setPerformanceMode(false);
                        effects.setPerformanceMode('low-end');
                      }}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${effects.performanceMode === 'low-end' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
                    >
                      Standard
                    </button>
                    <button
                      onClick={() => {
                        setPerformanceMode(true);
                        effects.setPerformanceMode('ultra');
                      }}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${effects.performanceMode === 'ultra' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400'}`}
                    >
                      Ultra 120Hz
                    </button>
                  </div>
                </div>

                <div className={`h-px w-full ${isDarkMode ? 'bg-white/10' : 'bg-slate-100'}`} />

                {/* Sound Effects Toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Interface Audio Feedback</h3>
                    <p className={`text-xs mt-1 ${isDarkMode ? 'text-white/50' : 'text-slate-500'}`}>
                      Chimes & haptic auditory responses for key system events.
                    </p>
                  </div>
                  <button
                    onClick={() => effects.setSoundEnabled(!effects.soundEnabled)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      effects.soundEnabled ? 'bg-emerald-500' : isDarkMode ? 'bg-white/10' : 'bg-slate-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        effects.soundEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className={`h-px w-full ${isDarkMode ? 'bg-white/10' : 'bg-slate-100'}`} />

                {/* Accent Color */}
                <div>
                  <h3 className="font-medium mb-3">Accent Color</h3>
                  <div className="flex flex-wrap gap-3">
                    {colors.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setColor(c.id)}
                        className={`group relative w-10 h-10 rounded-full flex items-center justify-center transition-transform hover:scale-110 ${c.class}`}
                        title={c.label}
                      >
                        {color === c.id && (
                          <div className="absolute inset-0 rounded-full border-2 border-white dark:border-slate-900 scale-90" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* Typography Section */}
            <section className={`p-6 rounded-2xl border ${getBorderClass()} ${isDarkMode ? 'bg-black/20' : 'bg-white shadow-sm'}`}>
              <div className="flex items-center gap-3 mb-6">
                <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-white/10' : 'bg-slate-100'}`}>
                  <Type size={20} className={getAccentClass()} />
                </div>
                <h2 className="text-xl font-semibold">Typography Engine</h2>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {fonts.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFont(f.id)}
                    className={`flex flex-col items-start p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      font === f.id 
                        ? `border-${color}-500 ${isDarkMode ? 'bg-white/5' : 'bg-slate-50'}` 
                        : `${getBorderClass()} hover:border-slate-400 dark:hover:border-slate-600`
                    }`}
                  >
                    <span className={`font-semibold text-base ${f.id === 'sans' ? 'font-sans' : f.id === 'mono' ? 'font-mono' : f.id === 'serif' ? 'font-serif' : f.id === 'display' ? 'font-display' : 'font-handwriting'}`}>
                      {f.label}
                    </span>
                    <span className={`text-xs mt-1 ${isDarkMode ? 'text-white/50' : 'text-slate-500'}`}>
                      {f.desc}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* TAB 5: AUDIO & VOICE */}
        {activeTab === 'audio' && (
          <section className={`p-6 rounded-2xl border ${getBorderClass()} ${isDarkMode ? 'bg-black/20' : 'bg-white shadow-sm'} animate-in fade-in-50 duration-200`}>
            <div className="flex items-center gap-3 mb-6">
              <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-white/10' : 'bg-slate-100'}`}>
                <Volume2 size={20} className={getAccentClass()} />
              </div>
              <h2 className="text-xl font-semibold">Audio & Voice Integration</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Microphone Input */}
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Mic size={16} className={isDarkMode ? 'text-white/50' : 'text-slate-400'} />
                    <h3 className="font-medium">Microphone Input</h3>
                  </div>
                  <select 
                    value={micId} 
                    onChange={e => setMicId(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border text-xs outline-none transition-colors ${
                      isDarkMode 
                        ? 'bg-black/40 border-white/10 text-white' 
                        : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  >
                    <option value="default">Default Microphone</option>
                    {availableMics.map(mic => (
                      <option key={mic.deviceId} value={mic.deviceId}>
                        {mic.label || `Microphone ${mic.deviceId.substring(0,5)}...`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* TTS Voice */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Zap size={16} className={isDarkMode ? 'text-white/50' : 'text-slate-400'} />
                    <h3 className="font-medium">AI Voice Preset (TTS)</h3>
                  </div>
                  <select 
                    value={ttsVoice} 
                    onChange={e => setTtsVoice(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border text-xs outline-none transition-colors ${
                      isDarkMode 
                        ? 'bg-black/40 border-white/10 text-white' 
                        : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  >
                    {voices.map(v => (
                      <option key={v.id} value={v.id}>{v.label}</option>
                    ))}
                  </select>
                </div>

                {/* Read Aloud Toggle */}
                <div className="flex items-center justify-between p-3 rounded-xl border border-white/10 bg-white/5">
                  <div>
                    <h3 className="font-medium text-xs">Read Aloud Auto-Speech</h3>
                    <p className={`text-[11px] ${isDarkMode ? 'text-white/50' : 'text-slate-500'}`}>Automatically speak AI responses</p>
                  </div>
                  <button
                    onClick={() => setReadAloud(!readAloud)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      readAloud ? 'bg-emerald-500' : isDarkMode ? 'bg-white/10' : 'bg-slate-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        readAloud ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Sensitivities */}
              <div className="space-y-5">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-sm">Voice Detection Sensitivity</h3>
                    <span className={`text-xs font-mono px-2 py-0.5 rounded-md ${isDarkMode ? 'bg-white/10' : 'bg-slate-100'}`}>
                      {sensitivity}%
                    </span>
                  </div>
                  <input 
                    type="range" 
                    min="0" max="100" 
                    value={sensitivity} 
                    onChange={e => setSensitivity(Number(e.target.value))}
                    className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-white/10 accent-cyan-400"
                  />
                  <p className={`text-xs mt-2 ${isDarkMode ? 'text-white/50' : 'text-slate-500'}`}>
                    Adjust voice vs background noise detection threshold.
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-sm">Wake Word Trigger Sensitivity</h3>
                    <span className={`text-xs font-mono px-2 py-0.5 rounded-md ${isDarkMode ? 'bg-white/10' : 'bg-slate-100'}`}>
                      {wakeWordSensitivity}%
                    </span>
                  </div>
                  <input 
                    type="range" 
                    min="0" max="100" 
                    value={wakeWordSensitivity} 
                    onChange={e => setWakeWordSensitivity(Number(e.target.value))}
                    className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-white/10 accent-cyan-400"
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* TAB 6: USER PERSONA */}
        {activeTab === 'profile' && (
          <section className={`p-6 rounded-2xl border ${getBorderClass()} ${isDarkMode ? 'bg-black/20' : 'bg-white shadow-sm'} animate-in fade-in-50 duration-200`}>
            <div className="flex items-center gap-3 mb-6">
              <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-white/10' : 'bg-slate-100'}`}>
                <User size={20} className={getAccentClass()} />
              </div>
              <h2 className="text-xl font-semibold">User Profile & Custom Context</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block font-medium text-xs mb-2">Your Name / Title</label>
                <input 
                  type="text" 
                  value={userProfile.name}
                  onChange={e => setUserProfile({ ...userProfile, name: e.target.value })}
                  placeholder="How should the AI address you?"
                  className={`w-full p-2.5 rounded-xl border text-xs outline-none transition-colors mb-4 ${
                    isDarkMode 
                      ? 'bg-black/40 border-white/10 text-white' 
                      : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
                <label className="block font-medium text-xs mb-2">Avatar URL (Optional)</label>
                <input 
                  type="url" 
                  value={userProfile.avatarUrl || ''}
                  onChange={e => setUserProfile({ ...userProfile, avatarUrl: e.target.value })}
                  placeholder="https://example.com/avatar.png"
                  className={`w-full p-2.5 rounded-xl border text-xs outline-none transition-colors ${
                    isDarkMode 
                      ? 'bg-black/40 border-white/10 text-white' 
                      : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
              </div>
              <div>
                <label className="block font-medium text-xs mb-2">Personal Instructions & Background</label>
                <textarea 
                  value={userProfile.preferences}
                  onChange={e => setUserProfile({ ...userProfile, preferences: e.target.value })}
                  placeholder="e.g., I am a Full-Stack Engineer working with React, TypeScript, and Python. I prefer direct answers with code blocks rather than conversational introductory filler."
                  rows={6}
                  className={`w-full p-2.5 rounded-xl border text-xs outline-none transition-colors resize-none ${
                    isDarkMode 
                      ? 'bg-black/40 border-white/10 text-white' 
                      : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
              </div>
            </div>
          </section>
        )}

      </div>
    </div>
  );
};
