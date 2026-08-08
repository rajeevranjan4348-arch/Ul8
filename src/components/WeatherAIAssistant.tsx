import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, RefreshCw, HelpCircle, Compass, Shield, Footprints, AlertTriangle } from 'lucide-react';
import { getAiInstance } from '../services/gemini';

interface HourlyForecastItem {
  time: string;
  temp: number;
  rainProb: number;
  windSpeed: number;
}

interface WeatherData {
  temp: number;
  feelsLike: number;
  desc: string;
  code: number;
  humidity: number;
  windSpeed: number;
  visibility: number;
  city: string;
  uvIndex: number;
  sunrise: string;
  sunset: string;
  hourly: HourlyForecastItem[];
}

interface WeatherAIAssistantProps {
  weather: WeatherData;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export const WeatherAIAssistant: React.FC<WeatherAIAssistantProps> = ({ weather }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `Hello! I'm **Nimbus**, your meteorological AI companion. 

I've analyzed the local conditions in **${weather.city}** (${weather.temp}°C, ${weather.desc}). How can I help you plan your day?`
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to latest message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessageToGemini = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    const userMsg: Message = { role: 'user', content: textToSend };
    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setLoading(true);

    try {
      const ai = getAiInstance();
      if (!ai) {
        throw new Error('Gemini client not initialized');
      }

      // Feed weather context to Gemini so it has the absolute source of truth
      const hourlyContext = weather.hourly
        .slice(0, 8)
        .map((h) => `${h.time}: ${h.temp}°C (${h.rainProb}% rain prob)`)
        .join(', ');

      const systemPrompt = `You are Nimbus, a premium AI weather companion integrated into a Weather Dashboard.
The user is asking a question about current weather conditions.
Current location: ${weather.city}
Temperature: ${weather.temp}°C (feels like ${weather.feelsLike}°C)
Current condition: ${weather.desc} (weather code: ${weather.code})
Humidity: ${weather.humidity}%
Wind speed: ${weather.windSpeed} km/h
UV Index: ${weather.uvIndex}
Hourly outlook (next 8 hours): ${hourlyContext}

Provide highly personalized, engaging, clear suggestions.
Specifically address practical clothing and items, such as:
- Carrying an umbrella (especially if rain probability is high or code matches drizzle/rain).
- Wearing a jacket/layers (especially if temperature is cool < 15°C).
- Applying sunscreen, wearing sunglasses, or a hat (especially if UV Index is moderate-to-high >= 3).
- Safe outdoor fitness, driving risks, or general daily routines.

Respond in clear, friendly markdown. Do not hallucinate. Be extremely scannable with bullet points.`;

      // Call the standard gemini models
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          { role: 'user', parts: [{ text: `${systemPrompt}\n\nUser Question: ${textToSend}` }] }
        ]
      });

      const responseText = response.text || "I couldn't analyze the atmospheric matrices. Please try again.";
      setMessages((prev) => [...prev, { role: 'assistant', content: responseText }]);
    } catch (err: any) {
      console.error('Gemini assistant error:', err);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `⚠️ **System Link Offline**: I was unable to reach the Gemini API core. Please verify your environment configurations.\n\n*Error details: ${err?.message || 'Unknown network interrupt'}*`
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggest = (promptType: 'umbrella' | 'sunscreen' | 'jacket' | 'workout') => {
    let query = '';
    switch (promptType) {
      case 'umbrella':
        query = "Should I carry an umbrella today? Detail the rain risk timeline.";
        break;
      case 'sunscreen':
        query = "What is the UV index danger today? Do I need sunscreen, sunglasses, or extra protective layers?";
        break;
      case 'jacket':
        query = "Is it cold or windy enough that I'll need a jacket or double-layered coat? Review the feels-like profile.";
        break;
      case 'workout':
        query = "Can I do an outdoor workout or running session safely today under these atmospheric conditions?";
        break;
    }
    sendMessageToGemini(query);
  };

  return (
    <div className="flex flex-col h-[340px] bg-slate-900/50 rounded-2xl border border-white/10 overflow-hidden relative">
      {/* Header banner */}
      <div className="px-4 py-2.5 bg-gradient-to-r from-violet-600/20 via-indigo-600/10 to-transparent border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-violet-400 animate-pulse" />
          <span className="text-xs font-extrabold uppercase tracking-wider text-violet-300">Nimbus AI Co-Pilot</span>
        </div>
        <div className="text-[9px] font-mono font-bold bg-violet-500/20 text-violet-400 border border-violet-500/30 px-2 py-0.5 rounded-full uppercase">
          Online
        </div>
      </div>

      {/* Messages Scroll Panel */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin text-xs">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex flex-col max-w-[85%] rounded-2xl p-3 ${
              m.role === 'user'
                ? 'bg-violet-600/20 border border-violet-500/30 text-white ml-auto'
                : 'bg-white/5 border border-white/5 text-white/90'
            }`}
          >
            {/* Formatted body */}
            <div className="prose prose-invert prose-xs leading-relaxed break-words space-y-1 select-text">
              {m.content.split('\n').map((line, lIdx) => {
                let formatted = line;
                // Highlight strong markdown
                if (formatted.startsWith('**') && formatted.endsWith('**')) {
                  return <p key={lIdx} className="font-bold text-violet-300">{formatted.replace(/\*\*/g, '')}</p>;
                }
                // Handle simple bullets
                if (formatted.trim().startsWith('-') || formatted.trim().startsWith('*')) {
                  return (
                    <li key={lIdx} className="list-none pl-3 border-l-2 border-violet-500/40 my-0.5 text-white/80">
                      {formatted.replace(/^[-*]\s*/, '')}
                    </li>
                  );
                }
                return <p key={lIdx}>{formatted}</p>;
              })}
            </div>
          </div>
        ))}

        {loading && (
          <div className="bg-white/5 border border-white/5 rounded-2xl p-3 max-w-[85%] flex items-center gap-2">
            <RefreshCw size={12} className="text-violet-400 animate-spin" />
            <span className="text-[10px] text-violet-300">Nimbus is consulting atmospheric layers...</span>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Quick Prompts Panel */}
      <div className="px-4 py-2 border-t border-white/5 bg-slate-950/40 flex flex-wrap gap-1.5 shrink-0">
        <button
          onClick={() => handleSuggest('umbrella')}
          className="text-[9px] px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all flex items-center gap-1 cursor-pointer"
        >
          ☔ Umbrella?
        </button>
        <button
          onClick={() => handleSuggest('sunscreen')}
          className="text-[9px] px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all flex items-center gap-1 cursor-pointer"
        >
          ☀️ Sunscreen?
        </button>
        <button
          onClick={() => handleSuggest('jacket')}
          className="text-[9px] px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all flex items-center gap-1 cursor-pointer"
        >
          🧥 Jacket?
        </button>
        <button
          onClick={() => handleSuggest('workout')}
          className="text-[9px] px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all flex items-center gap-1 cursor-pointer"
        >
          🏃 Workout?
        </button>
      </div>

      {/* Input panel */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessageToGemini(inputText);
        }}
        className="p-2 bg-slate-950 border-t border-white/10 flex items-center gap-2 shrink-0"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={`Ask Nimbus about conditions in ${weather.city}...`}
          className="flex-1 bg-white/5 border border-white/5 rounded-xl px-3 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-violet-500"
          disabled={loading}
        />
        <button
          type="submit"
          className="p-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white transition-all disabled:opacity-40 cursor-pointer"
          disabled={loading || !inputText.trim()}
        >
          <Send size={12} />
        </button>
      </form>
    </div>
  );
};
