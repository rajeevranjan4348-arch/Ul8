import React, { useState, useEffect, useCallback } from 'react';
import {
  Bot, Code, Mic, MapPin, FileAudio, Volume2, VolumeX, Sparkles, MessageSquare,
  Zap, Sun, Cloud, CloudRain, Snowflake, CloudLightning, Wind,
  Clock, Cpu, Globe, TrendingUp, Activity, Search, ArrowRight,
  Calendar, Thermometer, Eye, Droplets, Newspaper, Image, RefreshCw,
  ExternalLink, ThumbsUp, Flame, Filter, Tag
} from 'lucide-react';
import { getAiInstance } from '../services/gemini';
import { motion } from 'motion/react';
import { useSettings } from '../contexts/SettingsContext';
import { WeatherDashboard } from '../components/WeatherDashboard';
import { PremiumCard, PremiumButton, ShimmerLoading } from '../components/PremiumEffects';
import { DashboardClockWidget } from '../components/DashboardClockWidget';
import { SecretVaultModal } from '../components/SecretVaultModal';
import { FrequentVoiceCommandsModal } from '../components/FrequentVoiceCommandsModal';
import { KRISHNA_BACKGROUND_IMAGE } from '../assets/krishnaBgData';

interface DashboardProps {
  onModeChange: (mode: string) => void;
}

interface NewsItem {
  id?: string;
  title: string;
  source: string;
  url?: string;
  time?: string;
  snippet?: string;
  category?: 'AI & ML' | 'Breakthrough' | 'Products' | 'Research' | 'Industry';
  likes?: number;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 15, scale: 0.985 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 380,
      damping: 32
    }
  }
} as const;

const QUICK_ACTIONS = [
  { id: 'omni-chat', label: 'Omni Chat', desc: 'Chat with Gemini AI', icon: Bot, color: 'from-violet-500 to-purple-600' },
  { id: 'chat-pro', label: 'Grok Workbench', desc: 'Deep reasoning & artifacts', icon: Sparkles, color: 'from-violet-500 to-indigo-600' },
  { id: 'coder', label: 'AI Coder', desc: 'Code generation IDE', icon: Code, color: 'from-emerald-500 to-green-600' },
  { id: 'voice-live', label: 'Voice AI', desc: 'Live voice interaction', icon: Mic, color: 'from-rose-500 to-red-600' },
  { id: 'image-gen', label: 'Image Gen', desc: 'Generate high-res artwork', icon: Image, color: 'from-rose-400 to-pink-500' },
];

const AI_MODELS = [
  { name: 'Gemini 2.5 Flash', badge: 'Fast', color: 'text-cyan-400', bg: 'bg-cyan-400/10 border-cyan-400/30', dot: 'bg-cyan-400' },
  { name: 'Gemini 2.5 Pro', badge: 'Smart', color: 'text-violet-400', bg: 'bg-violet-400/10 border-violet-400/30', dot: 'bg-violet-400' },
  { name: 'Gemini 2.5 Flash TTS', badge: 'Voice', color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/30', dot: 'bg-emerald-400' },
  { name: 'Gemini 2.0 Flash Img', badge: 'Image', color: 'text-rose-400', bg: 'bg-rose-400/10 border-rose-400/30', dot: 'bg-rose-400' },
];

const formatTimeAgo = (date: Date) => {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export const DashboardMode: React.FC<DashboardProps> = ({ onModeChange }) => {
  const { userProfile } = useSettings();
  const [now, setNow] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [aiTip, setAiTip] = useState('');
  const [aiTipLoading, setAiTipLoading] = useState(false);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [speakingNewsIndex, setSpeakingNewsIndex] = useState<number | null>(null);

  // Modals for Secret Vault and Frequent Voice Commands
  const [isVaultOpen, setIsVaultOpen] = useState(false);
  const [isVoiceCommandsOpen, setIsVoiceCommandsOpen] = useState(false);

  // Stop speech synthesis when Dashboard component unmounts
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);
  const [sessionStats] = useState({
    messagesTotal: parseInt(localStorage.getItem('dash_msg_count') || '0'),
    modesUsed: 8,
    uptime: Math.floor(Math.random() * 120) + 30,
  });

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchAiTip = useCallback(async () => {
    // Try to load from localStorage cache first (15-minute validity)
    const CACHE_KEY = 'dash_ai_tip';
    const TIME_KEY = 'dash_ai_tip_time';
    const cachedTip = localStorage.getItem(CACHE_KEY);
    const cachedTime = localStorage.getItem(TIME_KEY);
    const nowTimestamp = Date.now();

    if (cachedTip && cachedTime && (nowTimestamp - parseInt(cachedTime)) < 15 * 60 * 1000) {
      setAiTip(cachedTip);
      setAiTipLoading(false);
      return;
    }

    setAiTipLoading(true);
    try {
      const ai = getAiInstance();
      const res = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: 'Give me one short, fascinating AI or tech insight for today. Max 2 sentences. No markdown.',
      });
      const text = res.text || '';
      if (text) {
        setAiTip(text);
        localStorage.setItem(CACHE_KEY, text);
        localStorage.setItem(TIME_KEY, nowTimestamp.toString());
      } else {
        throw new Error('Empty response');
      }
    } catch {
      if (cachedTip) {
        setAiTip(cachedTip);
      } else {
        setAiTip('AI is ready to assist — try asking anything across any mode!');
      }
    } finally {
      setAiTipLoading(false);
    }
  }, []);

  useEffect(() => { fetchAiTip(); }, [fetchAiTip]);

  const [newsCategory, setNewsCategory] = useState<string>('All');
  const [newsSearchText, setNewsSearchText] = useState<string>('');
  const [likedNewsIds, setLikedNewsIds] = useState<Record<string, boolean>>({});

  const toggleLikeNews = (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setLikedNewsIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const fetchNews = useCallback(async (forceRefresh = false) => {
    const CACHE_KEY = 'dash_ai_news_v3';
    const TIME_KEY = 'dash_ai_news_time_v3';
    const cachedNews = localStorage.getItem(CACHE_KEY);
    const cachedTime = localStorage.getItem(TIME_KEY);
    const nowTimestamp = Date.now();

    if (!forceRefresh && cachedNews && cachedTime && (nowTimestamp - parseInt(cachedTime)) < 10 * 60 * 1000) {
      try {
        const parsed = JSON.parse(cachedNews);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setNews(parsed);
          setNewsLoading(false);
          return;
        }
      } catch (err) {
        console.warn('Failed to parse cached news, will re-fetch', err);
      }
    }

    setNewsLoading(true);
    let items: NewsItem[] = [];

    // Attempt 1: Fetch real live AI/Tech stories from HackerNews Algolia live feed
    try {
      const res = await fetch('https://hn.algolia.com/api/v1/search?query=AI%20OR%20LLM%20OR%20Gemini%20OR%20ChatGPT%20OR%20DeepSeek&tags=story&hitsPerPage=12');
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.hits) && data.hits.length > 0) {
          items = data.hits.map((hit: any, i: number) => {
            let domain = 'HackerNews';
            if (hit.url) {
              try {
                domain = new URL(hit.url).hostname.replace('www.', '');
              } catch (e) {
                domain = 'Tech News';
              }
            }
            const timeAgo = hit.created_at ? formatTimeAgo(new Date(hit.created_at)) : 'Recently';
            let cat: 'AI & ML' | 'Breakthrough' | 'Products' | 'Research' | 'Industry' = 'AI & ML';
            const t = (hit.title || '').toLowerCase();
            if (t.includes('paper') || t.includes('research') || t.includes('study') || t.includes('arxiv')) cat = 'Research';
            else if (t.includes('release') || t.includes('launch') || t.includes('v2') || t.includes('v3') || t.includes('app')) cat = 'Products';
            else if (t.includes('breakthrough') || t.includes('benchmark') || t.includes('quantum') || t.includes('sota')) cat = 'Breakthrough';
            else if (t.includes('startup') || t.includes('nvidia') || t.includes('google') || t.includes('openai') || t.includes('billion')) cat = 'Industry';

            return {
              id: hit.objectID || `hn-${i}-${Date.now()}`,
              title: hit.title || 'Live Tech Update',
              source: domain,
              url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
              time: timeAgo,
              snippet: hit.story_text ? hit.story_text.slice(0, 130) + '...' : `Live tech story on Hacker News (${hit.points || 0} points, ${hit.num_comments || 0} comments).`,
              category: cat,
              likes: hit.points || Math.floor(Math.random() * 90) + 15
            };
          });
        }
      }
    } catch (err) {
      console.warn('Live Algolia news fetch failed, falling back to Gemini AI synthesis', err);
    }

    // Attempt 2: If live feed returned fewer than 4 items, synthesize top headlines using Gemini AI
    if (items.length < 4) {
      try {
        const ai = getAiInstance();
        const prompt = `Generate exactly 8 cutting-edge, realistic, top AI and tech headlines for today.
Provide output as a strict JSON array (no markdown code blocks, no text outside JSON) with fields:
- "id": unique string
- "title": Compelling headline
- "source": Publisher (e.g., "TechCrunch", "Google AI Blog", "Wired", "MIT Tech Review", "Ars Technica", "VentureBeat")
- "url": Plausible search or article link
- "time": "12m ago", "1h ago", etc.
- "snippet": 1-2 sentence executive summary
- "category": One of "AI & ML", "Breakthrough", "Products", "Research", "Industry"
- "likes": number between 30 and 450`;

        const res = await ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: prompt,
        });

        let cleanJson = (res.text || '').trim();
        if (cleanJson.startsWith('```')) {
          cleanJson = cleanJson.replace(/^```(json)?/, '').replace(/```$/, '').trim();
        }

        const parsed = JSON.parse(cleanJson);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const aiItems = parsed.map((item: any, idx: number) => ({
            id: item.id || `ai-news-${Date.now()}-${idx}`,
            title: item.title || 'Latest AI Tech Update',
            source: item.source || 'AI News Feed',
            url: item.url || `https://www.google.com/search?q=${encodeURIComponent(item.title)}`,
            time: item.time || 'Recently',
            snippet: item.snippet || 'Key developments in artificial intelligence and machine learning.',
            category: item.category || 'AI & ML',
            likes: item.likes || 120
          }));
          items = [...items, ...aiItems];
        }
      } catch (e) {
        console.error('Gemini news synthesis error:', e);
      }
    }

    // Fallback static list if all attempts failed
    if (items.length === 0) {
      items = [
        {
          id: 'fb-1',
          title: 'Google DeepMind details Gemini 2.5 Flash multimodal real-time reasoning architecture',
          source: 'Google AI Blog',
          url: 'https://ai.google.dev',
          time: '15m ago',
          snippet: 'Architectural breakdown of sub-100ms visual and audio streaming models with native tool calling.',
          category: 'AI & ML',
          likes: 342
        },
        {
          id: 'fb-2',
          title: 'DeepSeek R1 open-weights model achieves benchmark parity in complex mathematical proofs',
          source: 'MIT Tech Review',
          url: 'https://technologyreview.com',
          time: '45m ago',
          snippet: 'Open source reasoning algorithms demonstrate dramatic efficiency increases on competitive coding evaluations.',
          category: 'Breakthrough',
          likes: 512
        },
        {
          id: 'fb-3',
          title: 'Claude 3.5 Sonnet introduces interactive live artifact collaboration tools for developers',
          source: 'TechCrunch',
          url: 'https://techcrunch.com',
          time: '2h ago',
          snippet: 'New multi-file code execution canvas enables real-time pair programming and browser sandboxing.',
          category: 'Products',
          likes: 219
        },
        {
          id: 'fb-4',
          title: 'Google Workspace integrates native Gemini context memory across Gmail, Drive, and Sheets',
          source: 'Wired',
          url: 'https://wired.com',
          time: '3h ago',
          snippet: 'Seamless cross-product document context synchronization allows automated task extraction and briefing notes.',
          category: 'Industry',
          likes: 184
        },
        {
          id: 'fb-5',
          title: 'Next-generation neural speech synthesizers achieve sub-100ms real-time conversational latency',
          source: 'VentureBeat',
          url: 'https://venturebeat.com',
          time: '5h ago',
          snippet: 'Streaming audio synthesis techniques enable fluid human-like speech turn-taking without awkward pauses.',
          category: 'Research',
          likes: 290
        }
      ];
    }

    setNews(items);
    localStorage.setItem(CACHE_KEY, JSON.stringify(items));
    localStorage.setItem(TIME_KEY, nowTimestamp.toString());
    setNewsLoading(false);
  }, []);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  const handleSpeak = (e: React.MouseEvent, index: number, title: string, source: string) => {
    e.preventDefault();
    e.stopPropagation();

    if ('speechSynthesis' in window) {
      if (speakingNewsIndex === index) {
        window.speechSynthesis.cancel();
        setSpeakingNewsIndex(null);
      } else {
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(`${title}. Published by ${source}.`);
        utterance.onend = () => {
          setSpeakingNewsIndex(null);
        };
        utterance.onerror = () => {
          setSpeakingNewsIndex(null);
        };
        
        setSpeakingNewsIndex(index);
        window.speechSynthesis.speak(utterance);
      }
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    onModeChange('omni-chat');
  };

  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="h-full overflow-y-auto bg-[#0a0a0f] text-white relative">
      {/* Lord Krishna Divine Background Image Layer */}
      <div 
        className="fixed inset-0 pointer-events-none z-0 bg-cover bg-center bg-no-repeat transition-opacity duration-700 opacity-35"
        style={{ backgroundImage: `url(${KRISHNA_BACKGROUND_IMAGE})` }}
      />
      {/* Dark Gradient Overlay for High Contrast Legibility */}
      <div className="fixed inset-0 pointer-events-none z-0 bg-gradient-to-b from-[#0a0a0f]/85 via-[#0a0a0f]/65 to-[#0a0a0f]/90 backdrop-blur-[2px]" />

      <style>{`
        .dash-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          backdrop-filter: blur(12px);
          transition: all 0.25s ease;
        }
        .dash-card:hover {
          background: rgba(255,255,255,0.07);
          border-color: rgba(255,255,255,0.15);
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        }
        .action-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px;
          transition: all 0.2s ease;
          cursor: pointer;
        }
        .action-card:hover {
          background: rgba(255,255,255,0.08);
          border-color: rgba(255,255,255,0.2);
          transform: translateY(-3px);
          box-shadow: 0 12px 40px rgba(0,0,0,0.5);
        }
        .glow-purple { box-shadow: 0 0 40px rgba(139,92,246,0.15); }
        .glow-cyan { box-shadow: 0 0 40px rgba(6,182,212,0.15); }
        .news-item { border-bottom: 1px solid rgba(255,255,255,0.06); }
        .news-item:last-child { border-bottom: none; }
        @keyframes pulse-soft {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        .pulse-soft { animation: pulse-soft 2s ease-in-out infinite; }
      `}</style>

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-7xl mx-auto p-4 md:p-6 space-y-5 relative z-10"
      >

        {/* Header */}
        <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-violet-400 via-purple-300 to-cyan-400 bg-clip-text text-transparent animate-pulse-slow">
              Welcome back, {userProfile.name || 'User'} 👋
            </h1>
            <p className="text-white/50 text-sm mt-1 flex items-center gap-2">
              <Calendar size={13} />
              {dateStr}
            </p>
          </div>
          
          {/* Top Right Corner Dashboard Clock Widget */}
          <div className="flex items-center gap-2">
            <DashboardClockWidget
              onOpenVault={() => setIsVaultOpen(true)}
            />
          </div>
        </motion.div>

        {/* Search Bar */}
        <motion.div variants={itemVariants}>
          <form onSubmit={handleSearch}>
            <div className="relative">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search the web or ask AI anything..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-11 pr-14 text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet-500/60 focus:bg-white/8 transition-all"
              />
              <button
                type="submit"
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1"
              >
                Search <ArrowRight size={12} />
              </button>
            </div>
          </form>
        </motion.div>

        {/* Top Row: Weather + AI Tip + Stats */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Weather Card */}
          <div className="md:col-span-1">
            <WeatherDashboard />
          </div>
          {/* AI Insight Card */}
          <PremiumCard glowColor="rgba(139, 92, 246, 0.15)" className="p-5 md:col-span-2 flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-violet-500/20 flex items-center justify-center">
                <Sparkles size={14} className="text-violet-400" />
              </div>
              <span className="text-white/50 text-xs uppercase tracking-wider">AI Insight of the Day</span>
              <button
                onClick={fetchAiTip}
                disabled={aiTipLoading}
                className="ml-auto text-[10px] text-violet-400 hover:text-violet-300 border border-violet-500/30 rounded-lg px-2 py-0.5 transition-colors disabled:opacity-40 cursor-pointer"
              >
                {aiTipLoading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
            {aiTipLoading ? (
              <div className="flex items-center gap-3 py-4">
                <div className="flex gap-1">
                  {[0,1,2].map(i => (
                    <div key={i} className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
                <span className="text-white/40 text-sm">Generating insight...</span>
              </div>
            ) : (
              <p className="text-white/80 text-sm leading-relaxed">{aiTip}</p>
            )}
            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/8">
              <div className="text-center">
                <div className="text-lg font-bold text-white">{sessionStats.modesUsed}</div>
                <div className="text-[10px] text-white/40">AI Modes</div>
              </div>
              <div className="h-6 w-px bg-white/10" />
              <div className="text-center">
                <div className="text-lg font-bold text-white">{sessionStats.uptime}m</div>
                <div className="text-[10px] text-white/40">Session</div>
              </div>
              <div className="h-6 w-px bg-white/10" />
              <div className="text-center">
                <div className="text-lg font-bold text-white flex items-center gap-1">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full pulse-soft inline-block" />
                  Live
                </div>
                <div className="text-[10px] text-white/40">Status</div>
              </div>
              <div className="h-6 w-px bg-white/10" />
              <div className="text-center">
                <div className="text-lg font-bold text-white">4</div>
                <div className="text-[10px] text-white/40">Models</div>
              </div>
            </div>
          </PremiumCard>
        </motion.div>
 
        {/* Quick Actions Grid */}
        <motion.div variants={itemVariants}>
          <h2 className="text-sm font-semibold text-white/40 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Zap size={13} className="text-violet-400" /> Quick Actions
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <PremiumCard
                  key={action.id}
                  interactive={true}
                  onClick={() => onModeChange(action.id)}
                  glowColor="rgba(129, 140, 248, 0.15)"
                  className="p-4 text-left cursor-pointer group"
                >
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center mb-3 shadow-lg group-hover:scale-110 transition-transform`}>
                    <Icon size={18} className="text-white" />
                  </div>
                  <div className="text-sm font-semibold text-white">{action.label}</div>
                  <div className="text-[11px] text-white/40 mt-0.5 leading-tight">{action.desc}</div>
                </PremiumCard>
              );
            })}
          </div>
        </motion.div>

        {/* Bottom Row: AI News Scrollable Glass-Card Feed */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 gap-4 pb-6">
          <div className="dash-card p-5 md:p-6 space-y-4">
            
            {/* Header with Title, Live Badge, Search & Refresh */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-violet-500/15 text-violet-400 border border-violet-500/20">
                  <Newspaper size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white tracking-wide">AI & Tech Live Feed</h3>
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      Live Feed
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">Real-time public news API & AI-curated technology headlines</p>
                </div>
              </div>

              {/* Controls: Search & Refresh */}
              <div className="flex items-center gap-2.5">
                <div className="relative flex-1 sm:w-56">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={newsSearchText}
                    onChange={(e) => setNewsSearchText(e.target.value)}
                    placeholder="Search headlines..."
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none transition-all"
                  />
                </div>

                <button
                  onClick={() => fetchNews(true)}
                  disabled={newsLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600/80 hover:bg-violet-500 text-white font-semibold rounded-xl text-xs transition-all cursor-pointer shadow-lg shadow-violet-500/10 disabled:opacity-40 shrink-0"
                >
                  <RefreshCw size={12} className={`${newsLoading ? 'animate-spin' : ''}`} />
                  <span>{newsLoading ? 'Fetching...' : 'Fetch Latest'}</span>
                </button>
              </div>
            </div>

            {/* Category Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 hide-scrollbar text-xs">
              <span className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1 mr-1 shrink-0">
                <Filter size={11} className="text-violet-400" /> Category:
              </span>
              {['All', 'AI & ML', 'Products', 'Breakthrough', 'Research', 'Industry'].map(cat => (
                <button
                  key={cat}
                  onClick={() => setNewsCategory(cat)}
                  className={`px-3 py-1 rounded-xl text-xs font-medium transition-all shrink-0 cursor-pointer ${
                    newsCategory === cat
                      ? 'bg-violet-500 text-white shadow-md shadow-violet-500/25 font-semibold'
                      : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white border border-white/5'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Scrollable Glass Cards Feed Container */}
            <div className="max-h-[500px] overflow-y-auto pr-1 space-y-3 custom-scrollbar">
              {newsLoading ? (
                <div className="space-y-3 py-2">
                  {[1, 2, 3].map(n => (
                    <div key={n} className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2 animate-pulse">
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-16 bg-white/10 rounded-md" />
                        <div className="h-4 w-24 bg-white/10 rounded-md" />
                      </div>
                      <div className="h-5 w-3/4 bg-white/10 rounded-md" />
                      <div className="h-4 w-1/2 bg-white/10 rounded-md" />
                    </div>
                  ))}
                </div>
              ) : news.filter(item => {
                  const matchesCat = newsCategory === 'All' || item.category === newsCategory;
                  const matchesSearch = !newsSearchText || item.title.toLowerCase().includes(newsSearchText.toLowerCase()) || item.source.toLowerCase().includes(newsSearchText.toLowerCase());
                  return matchesCat && matchesSearch;
                }).length === 0 ? (
                <div className="text-slate-400 text-xs text-center py-12 border border-dashed border-slate-800 rounded-2xl space-y-2">
                  <Globe size={24} className="mx-auto text-slate-600 animate-pulse" />
                  <div>No headlines match your current filters.</div>
                  <button
                    onClick={() => { setNewsCategory('All'); setNewsSearchText(''); }}
                    className="text-violet-400 font-semibold underline hover:text-violet-300 cursor-pointer text-xs"
                  >
                    Reset filters
                  </button>
                </div>
              ) : (
                news
                  .filter(item => {
                    const matchesCat = newsCategory === 'All' || item.category === newsCategory;
                    const matchesSearch = !newsSearchText || item.title.toLowerCase().includes(newsSearchText.toLowerCase()) || item.source.toLowerCase().includes(newsSearchText.toLowerCase());
                    return matchesCat && matchesSearch;
                  })
                  .map((item, i) => {
                    const id = item.id || `news-${i}`;
                    const isLiked = !!likedNewsIds[id];
                    const categoryColors: Record<string, string> = {
                      'AI & ML': 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
                      'Breakthrough': 'bg-rose-500/20 text-rose-300 border-rose-500/30',
                      'Products': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
                      'Research': 'bg-violet-500/20 text-violet-300 border-violet-500/30',
                      'Industry': 'bg-amber-500/20 text-amber-300 border-amber-500/30',
                    };
                    const catBadgeStyle = categoryColors[item.category || 'AI & ML'] || 'bg-slate-800 text-slate-300 border-slate-700';

                    return (
                      <motion.div
                        key={id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: i * 0.03 }}
                        className="p-4 rounded-2xl bg-slate-900/40 hover:bg-slate-900/80 border border-white/10 hover:border-violet-500/40 backdrop-blur-md shadow-lg transition-all hover:scale-[1.005] group space-y-2.5 relative"
                      >
                        {/* Top Metadata Row */}
                        <div className="flex items-center justify-between text-[11px] gap-2">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider ${catBadgeStyle}`}>
                              {item.category || 'AI & ML'}
                            </span>
                            <span className="text-slate-300 font-semibold">{item.source}</span>
                          </div>

                          <div className="flex items-center gap-1 text-slate-400 text-[10px]">
                            <Clock size={11} className="text-violet-400" />
                            <span>{item.time || 'Recently'}</span>
                          </div>
                        </div>

                        {/* Article Headline */}
                        <a
                          href={item.url || `https://www.google.com/search?q=${encodeURIComponent(item.title)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-sm font-bold text-slate-100 hover:text-violet-300 leading-snug transition-colors group-hover:underline"
                        >
                          {item.title}
                        </a>

                        {/* Article Snippet */}
                        {item.snippet && (
                          <p className="text-xs text-slate-300/80 line-clamp-2 leading-relaxed">
                            {item.snippet}
                          </p>
                        )}

                        {/* Actions Footer */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
                          <a
                            href={item.url || `https://www.google.com/search?q=${encodeURIComponent(item.title)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[11px] text-violet-400 hover:text-violet-300 font-semibold transition-colors cursor-pointer"
                          >
                            <span>Read Article</span>
                            <ExternalLink size={11} />
                          </a>

                          <div className="flex items-center gap-2">
                            {/* Upvote / Like Button */}
                            <button
                              onClick={(e) => toggleLikeNews(id, e)}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all cursor-pointer ${
                                isLiked
                                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-sm'
                                  : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10 hover:text-slate-200'
                              }`}
                              title="Bookmark / Like headline"
                            >
                              <ThumbsUp size={11} className={isLiked ? 'fill-rose-300 text-rose-300' : ''} />
                              <span>{(item.likes || 42) + (isLiked ? 1 : 0)}</span>
                            </button>

                            {/* TTS Button */}
                            <button
                              onClick={(e) => handleSpeak(e, i, item.title, item.source)}
                              title={speakingNewsIndex === i ? "Stop speaking" : "Read aloud with AI TTS"}
                              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                speakingNewsIndex === i
                                  ? 'bg-violet-500/25 text-violet-300 border-violet-500/40 scale-105 shadow-md shadow-violet-500/10'
                                  : 'bg-white/5 text-slate-400 border-transparent hover:bg-violet-500/15 hover:text-violet-300 hover:border-violet-500/20'
                              }`}
                            >
                              {speakingNewsIndex === i ? (
                                <VolumeX size={13} className="animate-pulse text-violet-400" />
                              ) : (
                                <Volume2 size={13} />
                              )}
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Secret Vault Modal */}
      <SecretVaultModal
        isOpen={isVaultOpen}
        onClose={() => setIsVaultOpen(false)}
      />

      {/* Frequent Voice Commands & Status Modal */}
      <FrequentVoiceCommandsModal
        isOpen={isVoiceCommandsOpen}
        onClose={() => setIsVoiceCommandsOpen(false)}
        onExecuteCommand={(cmd) => {
          const lower = cmd.toLowerCase();
          if (lower.includes('code') || lower.includes('component') || lower.includes('react')) {
            onModeChange('coder');
          } else if (lower.includes('map') || lower.includes('restaurant') || lower.includes('navigate') || lower.includes('location')) {
            onModeChange('search');
          } else if (lower.includes('news')) {
            onModeChange('search');
          } else if (lower.includes('vault') || lower.includes('secret')) {
            setIsVaultOpen(true);
          }
        }}
      />
    </div>
  );
};
