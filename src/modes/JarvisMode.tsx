import React, { useState, useRef, useEffect } from 'react';
import { Mic, Send, Square, Loader2, Cloud, Sun, CloudRain, CloudLightning, Snowflake, Globe, Cpu, HardDrive, Wifi, Activity, Monitor } from 'lucide-react';
import { getAiInstance, generateSpeech, transcribeAudio } from '../services/gemini';
import { stopSpeech } from '../utils/speech';
import { useSettings } from '../contexts/SettingsContext';
import { ScreenStreamModal } from '../components/ScreenStreamModal';
import { useAutoSaveDraft } from '../hooks/useAutoSaveDraft';
import { usePeriodicAutoSave } from '../hooks/usePeriodicAutoSave';

interface JarvisModeProps {
  wakeWordTriggered?: boolean;
}

export const JarvisMode: React.FC<JarvisModeProps> = ({ wakeWordTriggered }) => {
  const { ttsVoice, setMicPermissionError, readAloud } = useSettings();
  const [messages, setMessages] = useState<{role: string, text: string, chunks?: any[]}[]>(() => {
    const saved = localStorage.getItem('omnichat_jarvis_messages');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return [{role: 'model', text: 'J.A.R.V.I.S. system online. Awaiting command.'}];
  });
  const [input, setInput, clearInputDraft] = useAutoSaveDraft('omnichat_draft_jarvis');
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState<'ONLINE' | 'LISTENING' | 'PROCESSING' | 'SPEAKING'>('ONLINE');
  const [weather, setWeather] = useState<{ temp: number, desc: string, code: number } | null>(null);
  const [weatherLocation, setWeatherLocation] = useState('New Delhi');
  const [language, setLanguage] = useState('English');
  const [tone, setTone] = useState('Witty');
  const [expertise, setExpertise] = useState('General');
  const [indiaTime, setIndiaTime] = useState('');
  const [isScreenStreamOpen, setIsScreenStreamOpen] = useState(false);
  
  const [cpuUsage, setCpuUsage] = useState(0);
  const [memoryUsage, setMemoryUsage] = useState(0);
  const [networkStatus, setNetworkStatus] = useState('Online');
  const [ping, setPing] = useState(0);
  
  const chatRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    const getToneInstruction = () => {
      switch(tone) {
        case 'Friendly': return "Act warm, friendly, and approachable. Keep responses conversational and encouraging.";
        case 'Sarcastic': return "Act witty, sarcastic, and slightly condescending like a stereotypical sci-fi AI. Keep responses sharp and humorous.";
        case 'Witty': return "Act incredibly witty, charming, and highly engaging. You are a brilliant conversationalist who enjoys clever wordplay, sharp observations, and a good pun. You have a background as a digital polymath. You are deeply helpful, but always add a touch of sparkling wit or a smart, engaging remark.";
        case 'Verbose': return "Act highly detailed and comprehensive. Provide thorough explanations and elaborate on topics.";
        case 'Humorous': return "Act funny and lighthearted. Include jokes and witty remarks.";
        case 'Cynical': return "Act slightly pessimistic and cynical, but still helpful. Question the necessity of things.";
        case 'Empathetic': return "Act highly empathetic, understanding, and supportive. Focus on emotional intelligence.";
        case 'Direct': return "Act extremely direct and to the point. No fluff, just facts and immediate answers.";
        case 'Poetic': return "Speak in a poetic, elegant, and slightly dramatic manner.";
        case 'Pirate': return "Your tone is that of a swashbuckling pirate captain. You use pirate slang (arrr, matey, shiver me timbers), talk about the high seas, and frame your helpful answers as if you are sharing buried treasure or navigating a ship.";
        default: return "Act highly advanced, professional, and efficient. Keep responses concise, analytical, and helpful.";
      }
    };

    const getExpertiseInstruction = () => {
      switch(expertise) {
        case 'Developer': return "You are an expert software engineer. Focus on technical accuracy, code structure, and best practices.";
        case 'Scientist': return "You are an expert scientist. Focus on empirical evidence, physics, chemistry, and biology.";
        case 'Historian': return "You are an expert historian. Focus on historical context, dates, and societal impacts.";
        case 'Doctor': return "You are a medical expert. Focus on biology, health, and medical science (with appropriate disclaimers).";
        case 'Engineer': return "You are an expert engineer. Focus on mechanics, physics, and structural integrity.";
        case 'Artist': return "You are an expert artist and designer. Focus on aesthetics, color theory, and creative expression.";
        case 'Chef': return "You are an expert chef. Focus on culinary arts, recipes, and flavor profiles.";
        case 'Financial Advisor': return "You are a financial expert. Focus on economics, markets, and financial principles.";
        default: return "You have general knowledge and handle complex conversational inputs.";
      }
    };

    const instructionText = `You are J.A.R.V.I.S., an AI assistant. ${getToneInstruction()} ${getExpertiseInstruction()} You have access to real-time information via Google Search. Do not use markdown formatting, just plain text as it will be spoken. You must communicate and respond in ${language}.`;

    const ai = getAiInstance();
    chatRef.current = ai.chats.create({
      model: 'gemini-3.1-pro-preview',
      config: {
        systemInstruction: { parts: [{ text: instructionText }] },
        tools: [{ googleSearch: {} }]
      }
    });
  }, [language, tone, expertise]);

  const fetchWeather = async (city: string) => {
    try {
      const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`);
      const geoData = await geoRes.json();
      if (!geoData.results || geoData.results.length === 0) {
        console.error('City not found');
        setWeather({ temp: 24, desc: 'CLOUDY', code: 2 });
        return;
      }
      const { latitude, longitude, name } = geoData.results[0];
      setWeatherLocation(name);

      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code`);
      const data = await res.json();
      const code = data.current.weather_code;
      let desc = 'CLEAR';
      if (code >= 1 && code <= 3) desc = 'CLOUDY';
      if (code >= 51 && code <= 67) desc = 'RAIN';
      if (code >= 71 && code <= 77) desc = 'SNOW';
      if (code >= 95) desc = 'STORM';
      setWeather({ temp: Math.round(data.current.temperature_2m), desc, code });
    } catch (e) {
      console.warn('Weather fetch failed, falling back to mock weather data:', e);
      setWeather({ temp: 24, desc: 'CLOUDY', code: 2 });
    }
  };

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      };
      setIndiaTime(now.toLocaleTimeString('en-US', options));
    };
    
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const updateStats = () => {
      setCpuUsage(Math.floor(Math.random() * 30) + 5);
      setPing(Math.floor(Math.random() * 20) + 10);

      const memory = (performance as any).memory;
      if (memory) {
        const used = Math.round(memory.usedJSHeapSize / 1024 / 1024);
        const total = Math.round(memory.jsHeapSizeLimit / 1024 / 1024);
        setMemoryUsage(Math.round((used / total) * 100));
      } else {
        setMemoryUsage(Math.floor(Math.random() * 10) + 40);
      }

      if (navigator.onLine) {
        const connection = (navigator as any).connection;
        if (connection) {
          setNetworkStatus(`${connection.effectiveType.toUpperCase()} (${connection.downlink}Mbps)`);
        } else {
          setNetworkStatus('Online');
        }
      } else {
        setNetworkStatus('Offline');
      }
    };

    updateStats();
    const interval = setInterval(updateStats, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchWeather(weatherLocation);
  }, []);

  const handleChangeLocation = () => {
    const newCity = prompt('Enter city name for weather:', weatherLocation);
    if (newCity && newCity.trim() !== '') {
      fetchWeather(newCity.trim());
    }
  };

  // Periodic and unload auto-save for Jarvis messages
  usePeriodicAutoSave('omnichat_jarvis_messages', messages, {
    intervalMs: 1500
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    return () => {
      stopSpeech();
      if (audioRef.current) {
        try {
          audioRef.current.pause();
        } catch (e) {}
      }
    };
  }, []);

  const playTTS = async (text: string) => {
    if (!readAloud) return;
    try {
      if (!text || text.trim() === '') return;
      
      // Clean up text for TTS (remove markdown, special chars that break TTS)
      const cleanText = text.replace(/[*_~`#]/g, '').trim();
      if (!cleanText) return;

      setStatus('SPEAKING');
      const response = await generateSpeech(cleanText, ttsVoice);
      const inlineData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      
      if (inlineData && inlineData.data) {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        
        const binaryString = window.atob(inlineData.data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        const pcm16 = new Int16Array(bytes.buffer);
        const float32 = new Float32Array(pcm16.length);
        for (let i = 0; i < pcm16.length; i++) {
          float32[i] = pcm16[i] / 32768.0;
        }
        
        const audioBuffer = audioCtx.createBuffer(1, float32.length, 24000);
        audioBuffer.getChannelData(0).set(float32);
        
        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioCtx.destination);
        source.onended = () => setStatus('ONLINE');
        source.start(0);
        
        audioRef.current = { pause: () => { source.stop(); audioCtx.close(); } } as any;
      } else {
        setStatus('ONLINE');
      }
    } catch (e) {
      console.error('TTS error:', e);
      setStatus('ONLINE');
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || !chatRef.current) return;

    stopSpeech();
    if (audioRef.current) {
      audioRef.current.pause();
    }

    // Check for "open [app]" command
    const openAppMatch = text.match(/^(?:open|launch)\s+(.+)$/i);
    if (openAppMatch) {
      let appName = openAppMatch[1].trim().toLowerCase();
      // Remove trailing words like "please"
      appName = appName.replace(/\s+(please|now)$/i, '');
      
      const appMap: Record<string, string> = {
        'youtube': 'https://youtube.com',
        'google': 'https://google.com',
        'gmail': 'https://mail.google.com',
        'maps': 'https://maps.google.com',
        'spotify': 'https://open.spotify.com',
        'twitter': 'https://twitter.com',
        'x': 'https://x.com',
        'facebook': 'https://facebook.com',
        'instagram': 'https://instagram.com',
        'reddit': 'https://reddit.com',
        'github': 'https://github.com',
        'chatgpt': 'https://chat.openai.com',
        'netflix': 'https://netflix.com',
        'amazon': 'https://amazon.com',
        'linkedin': 'https://linkedin.com',
        'twitch': 'https://twitch.tv',
        'discord': 'https://discord.com/app',
      };

      let url = '';
      if (appMap[appName]) {
        url = appMap[appName];
      } else {
        // Fallback to trying a .com domain
        url = `https://${appName.replace(/\s+/g, '')}.com`;
      }

      setMessages(prev => [...prev, { role: 'user', text }]);
      clearInputDraft();
      
      const replyText = `Opening ${appName}...`;
      setMessages(prev => [...prev, { role: 'model', text: replyText }]);
      
      window.open(url, '_blank');
      await playTTS(replyText);
      return;
    }

    setMessages(prev => [...prev, { role: 'user', text }]);
    clearInputDraft();
    setStatus('PROCESSING');

    try {
      const response = await chatRef.current.sendMessage({ message: text });
      const replyText = response.text;
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      
      setMessages(prev => [...prev, { role: 'model', text: replyText, chunks }]);
      await playTTS(replyText);
    } catch (error: any) {
      console.error('Jarvis error:', error);
      
      let errorMsg = 'System error encountered during processing.';
      
      // Handle 429 Resource Exhausted gracefully
      if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED')) {
        errorMsg = 'API rate limit exceeded. Please wait a moment and try again.';
      }
      
      setMessages(prev => [...prev, { role: 'model', text: errorMsg }]);
      await playTTS(errorMsg);
    }
  };

  useEffect(() => {
    if (wakeWordTriggered && !isRecording) {
      startRecording();
    }
  }, [wakeWordTriggered]);

  const startRecording = async () => {
    try {
      if (audioRef.current) audioRef.current.pause();
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setStatus('PROCESSING');
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
        
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64data = reader.result as string;
          const base64Audio = base64data.split(',')[1];
          
          try {
            const response = await transcribeAudio(base64Audio, audioBlob.type || 'audio/webm');
            if (response.text) {
              setInput(response.text);
              handleSendMessage(response.text);
            } else {
              setStatus('ONLINE');
            }
          } catch (error) {
            console.error('Transcription error:', error);
            setStatus('ONLINE');
          }
        };
        
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setStatus('LISTENING');
    } catch (error) {
      console.warn('Error accessing microphone:', error);
      setMicPermissionError(true);
      setStatus('ONLINE');
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const renderWeatherIcon = () => {
    if (!weather) return null;
    if (weather.desc === 'CLEAR') return <Sun size={14} className="text-yellow-400" />;
    if (weather.desc === 'CLOUDY') return <Cloud size={14} className="text-gray-300" />;
    if (weather.desc === 'RAIN') return <CloudRain size={14} className="text-blue-400" />;
    if (weather.desc === 'SNOW') return <Snowflake size={14} className="text-white" />;
    if (weather.desc === 'STORM') return <CloudLightning size={14} className="text-yellow-500" />;
    return <Sun size={14} />;
  };

  return (
    <div className="flex flex-col h-full bg-black text-[#00f7ff] font-mono relative overflow-hidden">
      <style>{`
        .jarvis-core {
          position: relative;
          width: 80px; height: 80px; border-radius: 50%;
          background: radial-gradient(circle at 30% 30%, #ffffff, #00f7ff 20%, #003d4a 80%);
          box-shadow: inset 0 0 20px rgba(255,255,255,0.5);
          z-index: 10;
          will-change: transform;
        }
        .jarvis-glow {
          position: absolute;
          width: 80px; height: 80px; border-radius: 50%;
          background: #00f7ff;
          filter: blur(20px);
          z-index: 5;
          will-change: transform, opacity;
        }

        /* Glow Animations (Hardware Accelerated) */
        .jarvis-glow.ONLINE { animation: glow-idle 3s infinite ease-in-out; }
        .jarvis-glow.PROCESSING { animation: glow-processing 1s infinite ease-in-out; }
        .jarvis-glow.LISTENING { animation: glow-listening 0.5s infinite alternate ease-in-out; background: #ffffff; }
        .jarvis-glow.SPEAKING { animation: glow-speaking 0.3s infinite alternate ease-in-out; background: #ffffff; }

        @keyframes glow-idle { 
          0%, 100% { transform: scale(1.2) translateZ(0); opacity: 0.4; } 
          50% { transform: scale(1.6) translateZ(0); opacity: 0.7; } 
        }
        @keyframes glow-processing { 
          0%, 100% { transform: scale(1.3) translateZ(0); opacity: 0.5; } 
          50% { transform: scale(1.9) translateZ(0); opacity: 0.9; } 
        }
        @keyframes glow-listening { 
          0% { transform: scale(1.4) translateZ(0); opacity: 0.6; } 
          100% { transform: scale(2.2) translateZ(0); opacity: 1; } 
        }
        @keyframes glow-speaking { 
          0% { transform: scale(1.5) translateZ(0); opacity: 0.7; } 
          100% { transform: scale(2.5) translateZ(0); opacity: 1; } 
        }

        /* Core Animations (Hardware Accelerated) */
        .jarvis-core.ONLINE { animation: core-idle 3s infinite ease-in-out; }
        .jarvis-core.PROCESSING { animation: core-processing 1s infinite ease-in-out; }
        .jarvis-core.LISTENING { 
          animation: core-listening 0.5s infinite alternate ease-in-out; 
          background: radial-gradient(circle at 50% 50%, #ffffff, #00f7ff 40%, #003d4a 90%);
        }
        .jarvis-core.SPEAKING { 
          animation: core-speaking 0.3s infinite alternate ease-in-out; 
          background: radial-gradient(circle at 50% 50%, #ffffff, #00f7ff 50%, #003d4a 100%);
        }

        @keyframes core-idle { 
          0%, 100% { transform: scale(0.95) translateZ(0); } 
          50% { transform: scale(1.05) translateZ(0); } 
        }
        @keyframes core-processing { 
          0%, 100% { transform: scale(0.95) rotate(0deg) translateZ(0); } 
          50% { transform: scale(1.1) rotate(180deg) translateZ(0); } 
        }
        @keyframes core-listening { 
          0% { transform: scale(1.1) translateZ(0); } 
          100% { transform: scale(1.25) translateZ(0); } 
        }
        @keyframes core-speaking { 
          0% { transform: scale(1.15) translateZ(0); } 
          100% { transform: scale(1.35) translateZ(0); } 
        }
        
        /* Ring Animations (Hardware Accelerated) */
        .jarvis-ring { 
          position: absolute; border-radius: 50%; border: 1px solid rgba(0,247,255,0.3); 
          will-change: transform;
          mix-blend-mode: screen;
          top: 50%; left: 50%;
        }
        .jarvis-ring1 { width: 140px; height: 140px; animation: spin1 8s linear infinite; border-top: 2px solid #00f7ff; border-bottom: 2px solid #00f7ff; }
        .jarvis-ring2 { width: 190px; height: 190px; animation: spin2 12s linear infinite reverse; border-style: dashed; border-width: 2px; border-color: rgba(0,247,255,0.5); }
        .jarvis-ring3 { width: 240px; height: 240px; animation: spin1 20s linear infinite; border-left: 2px solid #00f7ff; border-right: 2px solid #00f7ff; opacity: 0.4; }
        
        @keyframes spin1 { 
          from { transform: translate(-50%, -50%) rotate(0deg) translateZ(0); } 
          to { transform: translate(-50%, -50%) rotate(360deg) translateZ(0); } 
        }
        @keyframes spin2 { 
          from { transform: translate(-50%, -50%) rotate(0deg) translateZ(0); } 
          to { transform: translate(-50%, -50%) rotate(360deg) translateZ(0); } 
        }
        
        .jarvis-panel {
          border: 1px solid #00f7ff; background: rgba(0, 255, 255, 0.05);
          backdrop-filter: blur(6px); box-shadow: 0 0 10px #00f7ff inset;
        }
        
        .jarvis-scrollbar::-webkit-scrollbar { width: 4px; }
        .jarvis-scrollbar::-webkit-scrollbar-track { background: rgba(0,255,255,0.05); }
        .jarvis-scrollbar::-webkit-scrollbar-thumb { background: #00f7ff; }
      `}</style>

      {/* System Status Bar */}
      <div className="absolute top-0 left-0 right-0 h-6 sm:h-8 bg-[#00f7ff]/10 border-b border-[#00f7ff]/30 flex items-center justify-between px-2 sm:px-4 text-[8px] sm:text-[10px] z-20 backdrop-blur-sm">
        <div className="flex items-center gap-3 sm:gap-6">
          <div className="flex items-center gap-1 sm:gap-1.5" title="CPU Usage">
            <Cpu size={12} className={cpuUsage > 80 ? 'text-red-500 animate-pulse' : 'text-[#00f7ff]'} />
            <span className="opacity-80">CPU: {cpuUsage}%</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-1.5" title="Memory Usage">
            <HardDrive size={12} className={memoryUsage > 80 ? 'text-red-500 animate-pulse' : 'text-[#00f7ff]'} />
            <span className="opacity-80">MEM: {memoryUsage}%</span>
          </div>
        </div>
        <div className="flex items-center gap-3 sm:gap-6">
          <div className="flex items-center gap-1 sm:gap-1.5" title="Network Status">
            <Wifi size={12} className={networkStatus === 'Offline' ? 'text-red-500 animate-pulse' : 'text-[#00f7ff]'} />
            <span className="opacity-80 hidden sm:inline">NET: {networkStatus}</span>
            <span className="opacity-80 sm:hidden">{networkStatus === 'Offline' ? 'OFFLINE' : 'ONLINE'}</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-1.5" title="Latency">
            <Activity size={12} className={ping > 100 ? 'text-yellow-500' : 'text-[#00f7ff]'} />
            <span className="opacity-80">PING: {ping}ms</span>
          </div>
        </div>
      </div>

      {/* Top HUD */}
      <div className="pt-8 pb-2 px-2 sm:pt-10 sm:pb-4 sm:px-4 grid grid-cols-3 gap-2 z-10 shrink-0">
        <div className="jarvis-panel p-2 sm:p-3 rounded-lg text-[10px] sm:text-xs flex flex-col items-center justify-center text-center">
          <h3 className="font-bold mb-1 border-b border-[#00f7ff]/30 pb-1 w-full">SYSTEM</h3>
          <div className="opacity-90 font-bold text-xs sm:text-sm truncate w-full">{indiaTime}</div>
          <div className="opacity-60 text-[8px] sm:text-[10px] mb-1">IND TIME</div>
          <div className="opacity-80 truncate w-full">AI: {status}</div>
          <div className="opacity-80 truncate w-full flex items-center justify-center gap-1 mt-1">
            <Globe size={10} />
            <select 
              value={language} 
              onChange={(e) => setLanguage(e.target.value)}
              className="bg-transparent border-none outline-none text-[#00f7ff] cursor-pointer"
            >
              <option value="English" className="bg-black">EN</option>
              <option value="Spanish" className="bg-black">ES</option>
              <option value="French" className="bg-black">FR</option>
              <option value="German" className="bg-black">DE</option>
              <option value="Japanese" className="bg-black">JA</option>
              <option value="Chinese" className="bg-black">ZH</option>
              <option value="Hindi" className="bg-black">HI</option>
              <option value="Arabic" className="bg-black">AR</option>
              <option value="Portuguese" className="bg-black">PT</option>
              <option value="Russian" className="bg-black">RU</option>
              <option value="Korean" className="bg-black">KO</option>
              <option value="Italian" className="bg-black">IT</option>
            </select>
          </div>
        </div>
        
        {weather ? (
          <div 
            className="jarvis-panel p-2 sm:p-3 rounded-lg text-[10px] sm:text-xs flex flex-col items-center justify-center text-center cursor-pointer hover:bg-[#00f7ff]/10 transition-colors"
            onClick={handleChangeLocation}
            title="Click to change location"
          >
            <h3 className="font-bold mb-1 border-b border-[#00f7ff]/30 pb-1 w-full truncate">WTH ({weatherLocation.substring(0, 3).toUpperCase()})</h3>
            <div className="flex items-center justify-center gap-1 sm:gap-2 opacity-90">
              {renderWeatherIcon()}
              <span className="text-sm sm:text-lg font-bold">{weather.temp}°C</span>
            </div>
            <div className="opacity-80 text-[8px] sm:text-[10px] mt-1 truncate w-full">{weather.desc}</div>
          </div>
        ) : (
          <div className="jarvis-panel p-2 sm:p-3 rounded-lg text-[10px] sm:text-xs flex flex-col items-center justify-center text-center">
            <h3 className="font-bold mb-1 border-b border-[#00f7ff]/30 pb-1 w-full">WEATHER</h3>
            <Loader2 size={14} className="animate-spin my-1 opacity-50" />
          </div>
        )}

        <div className="jarvis-panel p-2 sm:p-3 rounded-lg text-[10px] sm:text-xs flex flex-col items-center justify-center text-center">
          <h3 className="font-bold mb-1 border-b border-[#00f7ff]/30 pb-1 w-full">PERSONA</h3>
          <div className="w-full flex flex-col gap-1 mt-1">
            <select value={tone} onChange={e => setTone(e.target.value)} className="bg-transparent border-none outline-none text-[#00f7ff] cursor-pointer text-[8px] sm:text-[10px] w-full text-center">
              <option value="Professional" className="bg-black">Professional</option>
              <option value="Friendly" className="bg-black">Friendly</option>
              <option value="Witty" className="bg-black">Witty</option>
              <option value="Sarcastic" className="bg-black">Sarcastic</option>
              <option value="Verbose" className="bg-black">Verbose</option>
              <option value="Humorous" className="bg-black">Humorous</option>
              <option value="Cynical" className="bg-black">Cynical</option>
              <option value="Empathetic" className="bg-black">Empathetic</option>
              <option value="Direct" className="bg-black">Direct</option>
              <option value="Poetic" className="bg-black">Poetic</option>
              <option value="Pirate" className="bg-black">Pirate</option>
            </select>
            <select value={expertise} onChange={e => setExpertise(e.target.value)} className="bg-transparent border-none outline-none text-[#00f7ff] cursor-pointer text-[8px] sm:text-[10px] w-full text-center">
              <option value="General" className="bg-black">General</option>
              <option value="Developer" className="bg-black">Developer</option>
              <option value="Scientist" className="bg-black">Scientist</option>
              <option value="Historian" className="bg-black">Historian</option>
              <option value="Doctor" className="bg-black">Doctor</option>
              <option value="Engineer" className="bg-black">Engineer</option>
              <option value="Artist" className="bg-black">Artist</option>
              <option value="Chef" className="bg-black">Chef</option>
              <option value="Financial Advisor" className="bg-black">Financial Advisor</option>
            </select>
          </div>
        </div>
      </div>

      {/* Center Animation */}
      <div className="flex-1 flex items-center justify-center relative min-h-[180px] sm:min-h-[220px] overflow-hidden">
        <div className="jarvis-ring jarvis-ring1"></div>
        <div className="jarvis-ring jarvis-ring2"></div>
        <div className="jarvis-ring jarvis-ring3"></div>
        <div className={`jarvis-glow ${status}`}></div>
        <div className={`jarvis-core ${status}`}></div>
      </div>

      {/* Bottom Chat & Input */}
      <div className="h-[50%] sm:h-[45%] min-h-[200px] sm:min-h-[250px] flex flex-col z-10 p-2 sm:p-4 gap-2 sm:gap-4 shrink-0">
        <div className="flex-1 jarvis-panel rounded-lg p-3 sm:p-4 overflow-y-auto jarvis-scrollbar flex flex-col gap-3">
          {messages.map((msg, idx) => (
            <div key={idx} className={`text-xs sm:text-sm ${msg.role === 'user' ? 'text-white text-right' : 'text-[#00f7ff] text-left'}`}>
              <span className="opacity-50 text-[10px] sm:text-xs mr-2">{msg.role === 'user' ? 'USR' : 'SYS'}</span>
              {msg.text}
              {msg.chunks && msg.chunks.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2 justify-start">
                  {msg.chunks.map((chunk, i) => chunk.web?.uri ? (
                    <a key={i} href={chunk.web.uri} target="_blank" rel="noreferrer" className="text-[10px] text-emerald-400 underline opacity-80 hover:opacity-100 flex items-center gap-1">
                      <Globe size={10} /> {chunk.web.title || 'Source'}
                    </a>
                  ) : null)}
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <form 
          onSubmit={(e) => { e.preventDefault(); handleSendMessage(input); }}
          className="flex gap-2 shrink-0"
        >
          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            className={`jarvis-panel p-2 sm:p-3 rounded-lg flex items-center justify-center transition-all ${isRecording ? 'bg-red-500/20 border-red-500 text-red-500' : 'hover:bg-[#00f7ff]/20'}`}
          >
            {isRecording ? <Square size={18} className="fill-current sm:w-5 sm:h-5" /> : <Mic size={18} className="sm:w-5 sm:h-5" />}
          </button>
          <button
            type="button"
            onClick={() => setIsScreenStreamOpen(true)}
            className="jarvis-panel p-2 sm:p-3 rounded-lg flex items-center justify-center hover:bg-[#00f7ff]/20 text-[#00f7ff]"
            title="Screen Capture & AI HUD Stream (10-15 FPS)"
          >
            <Monitor size={18} className="sm:w-5 sm:h-5" />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter command..."
            className="flex-1 jarvis-panel rounded-lg px-3 sm:px-4 text-xs sm:text-sm outline-none focus:bg-[#00f7ff]/10 transition-all placeholder-[#00f7ff]/30 bg-transparent"
            disabled={status === 'PROCESSING'}
          />
          <button
            type="submit"
            disabled={!input.trim() || status === 'PROCESSING'}
            className="jarvis-panel p-2 sm:p-3 rounded-lg flex items-center justify-center hover:bg-[#00f7ff]/20 disabled:opacity-50"
          >
            {status === 'PROCESSING' ? <Loader2 size={18} className="animate-spin sm:w-5 sm:h-5" /> : <Send size={18} className="sm:w-5 sm:h-5" />}
          </button>
        </form>
      </div>

      <ScreenStreamModal
        isOpen={isScreenStreamOpen}
        onClose={() => setIsScreenStreamOpen(false)}
        onSendToChat={(text) => {
          handleSendMessage(`[Screen Capture Analysis] ${text}`);
        }}
      />
    </div>
  );
};
