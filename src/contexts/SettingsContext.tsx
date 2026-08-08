import React, { createContext, useContext, useState, useEffect } from 'react';

interface UserProfile {
  name: string;
  preferences: string;
  avatarUrl?: string;
}

export interface PromptPreset {
  id: string;
  title: string;
  category: string;
  prompt: string;
}

export interface LlmConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  customSystemPrompt: string;
  enableThinking: boolean;
  presetStyle: string;
  customEndpoint: string;
  customApiKey: string;
}

interface SettingsContextType {
  micId: string;
  setMicId: (id: string) => void;
  sensitivity: number;
  setSensitivity: (val: number) => void;
  ttsVoice: string;
  setTtsVoice: (voice: string) => void;
  availableMics: MediaDeviceInfo[];
  wakeWordSensitivity: number;
  setWakeWordSensitivity: (val: number) => void;
  userProfile: UserProfile;
  setUserProfile: (profile: UserProfile) => void;
  memory: string[];
  setMemory: (memory: string[] | ((prev: string[]) => string[])) => void;
  micPermissionError: boolean;
  setMicPermissionError: (val: boolean) => void;
  readAloud: boolean;
  setReadAloud: (val: boolean) => void;
  performanceMode: boolean;
  setPerformanceMode: (val: boolean) => void;
  
  // LLM Engine Settings
  llmConfig: LlmConfig;
  setLlmConfig: React.Dispatch<React.SetStateAction<LlmConfig>>;
  promptPresets: PromptPreset[];
  setPromptPresets: React.Dispatch<React.SetStateAction<PromptPreset[]>>;
  addMemoryItem: (item: string) => void;
  removeMemoryItem: (index: number) => void;
  clearAllMemory: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const DEFAULT_LLM_CONFIG: LlmConfig = {
  model: 'gemini-3.5-flash',
  temperature: 0.7,
  maxTokens: 4096,
  topP: 0.95,
  customSystemPrompt: 'You are the voice of a next-generation AI assistant. Maintain a calm, confident, deep, intelligent, and professional persona. Speak clearly, reassuringly, and naturally with subtle warmth and precision.',
  enableThinking: true,
  presetStyle: 'default',
  customEndpoint: '',
  customApiKey: '',
};

const DEFAULT_PROMPT_PRESETS: PromptPreset[] = [
  { id: '1', title: 'Code Architect & Reviewer', category: 'Coding', prompt: 'You are an expert Principal Software Engineer. Review code for bugs, edge cases, performance, security, and cleanliness.' },
  { id: '2', title: 'Socratic Tutor', category: 'Education', prompt: 'Guide me through concepts using the Socratic method. Ask thoughtful questions rather than just giving direct answers.' },
  { id: '3', title: 'Executive Summarizer', category: 'Productivity', prompt: 'Summarize the input concisely in 3 key bullet points, highlighting action items and core insights.' },
  { id: '4', title: 'Deep Research Assistant', category: 'Research', prompt: 'Perform a comprehensive analysis. Structure your output with clear headings, evidence citations, and balanced pros/cons.' },
];

export const SettingsProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [micId, setMicId] = useState<string>('default');
  const [sensitivity, setSensitivity] = useState<number>(50);
  const [wakeWordSensitivity, setWakeWordSensitivity] = useState<number>(50);
  const [ttsVoice, setTtsVoice] = useState<string>('Fenrir');
  const [availableMics, setAvailableMics] = useState<MediaDeviceInfo[]>([]);
  const [readAloud, setReadAloud] = useState<boolean>(() => {
    return localStorage.getItem('omnichat_read_aloud') === 'true';
  });
  const [performanceMode, setPerformanceMode] = useState<boolean>(() => {
    return localStorage.getItem('performance_mode') === 'true';
  });

  const [llmConfig, setLlmConfig] = useState<LlmConfig>(() => {
    const saved = localStorage.getItem('omnichat_llm_config');
    return saved ? { ...DEFAULT_LLM_CONFIG, ...JSON.parse(saved) } : DEFAULT_LLM_CONFIG;
  });

  const [promptPresets, setPromptPresets] = useState<PromptPreset[]>(() => {
    const saved = localStorage.getItem('omnichat_prompt_presets');
    return saved ? JSON.parse(saved) : DEFAULT_PROMPT_PRESETS;
  });

  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('omnichat_user_profile');
    return saved ? JSON.parse(saved) : { name: '', preferences: '' };
  });

  const [memory, setMemory] = useState<string[]>(() => {
    const saved = localStorage.getItem('omnichat_memory');
    return saved ? JSON.parse(saved) : [];
  });
  const [micPermissionError, setMicPermissionError] = useState<boolean>(false);

  useEffect(() => {
    localStorage.setItem('omnichat_llm_config', JSON.stringify(llmConfig));
  }, [llmConfig]);

  useEffect(() => {
    localStorage.setItem('omnichat_prompt_presets', JSON.stringify(promptPresets));
  }, [promptPresets]);

  useEffect(() => {
    localStorage.setItem('omnichat_user_profile', JSON.stringify(userProfile));
  }, [userProfile]);

  useEffect(() => {
    localStorage.setItem('omnichat_memory', JSON.stringify(memory));
  }, [memory]);

  const addMemoryItem = (item: string) => {
    if (!item.trim()) return;
    setMemory(prev => [item.trim(), ...prev]);
  };

  const removeMemoryItem = (index: number) => {
    setMemory(prev => prev.filter((_, i) => i !== index));
  };

  const clearAllMemory = () => {
    setMemory([]);
  };

  useEffect(() => {
    localStorage.setItem('omnichat_user_profile', JSON.stringify(userProfile));
  }, [userProfile]);

  useEffect(() => {
    localStorage.setItem('omnichat_memory', JSON.stringify(memory));
  }, [memory]);

  useEffect(() => {
    localStorage.setItem('omnichat_read_aloud', String(readAloud));
  }, [readAloud]);

  useEffect(() => {
    localStorage.setItem('performance_mode', String(performanceMode));
    if (performanceMode) {
      document.body.classList.add('perf-boost');
    } else {
      document.body.classList.remove('perf-boost');
    }
  }, [performanceMode]);

  useEffect(() => {
    const getMics = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(device => device.kind === 'audioinput');
        setAvailableMics(audioInputs);
      } catch (err) {
        console.error("Error accessing media devices.", err);
      }
    };
    getMics();
  }, []);

  return (
    <SettingsContext.Provider value={{ 
      micId, setMicId, 
      sensitivity, setSensitivity, 
      ttsVoice, setTtsVoice, 
      availableMics,
      wakeWordSensitivity, setWakeWordSensitivity,
      userProfile, setUserProfile,
      memory, setMemory,
      micPermissionError, setMicPermissionError,
      readAloud, setReadAloud,
      performanceMode, setPerformanceMode,
      llmConfig, setLlmConfig,
      promptPresets, setPromptPresets,
      addMemoryItem, removeMemoryItem, clearAllMemory
    }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error("useSettings must be used within SettingsProvider");
  return context;
};
