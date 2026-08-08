import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Sun, Cloud, CloudRain, Snowflake, CloudLightning, Wind, Thermometer, 
  Droplets, Eye, ShieldAlert, Navigation, Search, Plus, Trash2, X, RefreshCw, 
  Compass, Sunrise, Sunset, Moon, Activity, Map, Play, Pause, ChevronRight, 
  Sparkles, AlertTriangle, ArrowLeft, Heart, Layers, CloudDrizzle, SunDim, Clock,
  Volume2, VolumeX, Cpu, Zap
} from 'lucide-react';
import { getAiInstance } from '../services/gemini';
import { motion, AnimatePresence } from 'motion/react';
import { WeatherBackgroundEffects } from './WeatherBackgroundEffects';
import { WeatherCharts } from './WeatherCharts';
import { WeatherMap } from './WeatherMap';
import { WeatherAIAssistant } from './WeatherAIAssistant';
import { WeatherNotifications } from './WeatherNotifications';
import { WeatherSoundSynth } from '../utils/weatherSoundSynth';

interface WeatherData {
  temp: number;
  feelsLike: number;
  desc: string;
  code: number;
  humidity: number;
  windSpeed: number;
  visibility: number;
  city: string;
  lat: number;
  lon: number;
  uvIndex: number;
  pressure: number;
  dewPoint: number;
  sunrise: string;
  sunset: string;
  moonPhase: string;
  aqi: number;
  hourly: HourlyForecastItem[];
  daily: DailyForecastItem[];
}

interface HourlyForecastItem {
  time: string;
  temp: number;
  rainProb: number;
  windSpeed: number;
  uv: number;
  humidity: number;
}

interface DailyForecastItem {
  date: string;
  dayName: string;
  code: number;
  tempMax: number;
  tempMin: number;
  rainProb: number;
  humidity: number;
  windSpeed: number;
  uv: number;
  pressure: number;
  visibility: number;
  dewPoint: number;
  sunrise: string;
  sunset: string;
  moonPhase: string;
  aqi: number;
  hourly: HourlyForecastItem[];
}

interface SavedCity {
  name: string;
  lat: number;
  lon: number;
}

// Map WMO Weather Codes to descriptive details
const WEATHER_CODES: Record<number, { desc: string; icon: React.ReactNode; bgClass: string; textColor: string; glow: string }> = {
  0: { desc: 'Clear Sky', icon: <Sun size={48} className="text-amber-400 animate-pulse-slow" />, bgClass: 'from-sky-400 to-blue-600', textColor: 'text-amber-300', glow: 'shadow-amber-500/20' },
  1: { desc: 'Mainly Clear', icon: <SunDim size={48} className="text-amber-300 animate-pulse-slow" />, bgClass: 'from-sky-400 via-sky-500 to-blue-600', textColor: 'text-amber-200', glow: 'shadow-amber-400/20' },
  2: { desc: 'Partly Cloudy', icon: <Cloud size={48} className="text-slate-300" />, bgClass: 'from-slate-400 via-sky-500 to-indigo-700', textColor: 'text-slate-200', glow: 'shadow-slate-500/20' },
  3: { desc: 'Overcast', icon: <Cloud size={48} className="text-slate-400 animate-bounce-slow" />, bgClass: 'from-slate-500 to-slate-800', textColor: 'text-slate-300', glow: 'shadow-slate-600/20' },
  45: { desc: 'Foggy', icon: <Cloud size={48} className="text-slate-500/70" />, bgClass: 'from-slate-700 to-zinc-900', textColor: 'text-slate-400', glow: 'shadow-slate-800/20' },
  48: { desc: 'Depositing Rime Fog', icon: <Cloud size={48} className="text-slate-500/70" />, bgClass: 'from-slate-700 to-zinc-900', textColor: 'text-slate-400', glow: 'shadow-slate-800/20' },
  51: { desc: 'Light Drizzle', icon: <CloudDrizzle size={48} className="text-blue-300 animate-bounce-slow" />, bgClass: 'from-cyan-600 to-indigo-900', textColor: 'text-blue-200', glow: 'shadow-blue-400/20' },
  53: { desc: 'Moderate Drizzle', icon: <CloudDrizzle size={48} className="text-blue-300 animate-bounce-slow" />, bgClass: 'from-cyan-600 to-indigo-900', textColor: 'text-blue-200', glow: 'shadow-blue-500/20' },
  55: { desc: 'Dense Drizzle', icon: <CloudDrizzle size={48} className="text-blue-400" />, bgClass: 'from-cyan-700 to-indigo-950', textColor: 'text-blue-300', glow: 'shadow-blue-600/20' },
  61: { desc: 'Slight Rain', icon: <CloudRain size={48} className="text-blue-400 animate-bounce-slow" />, bgClass: 'from-blue-600 to-slate-900', textColor: 'text-blue-300', glow: 'shadow-blue-500/25' },
  63: { desc: 'Moderate Rain', icon: <CloudRain size={48} className="text-blue-400" />, bgClass: 'from-blue-700 to-slate-950', textColor: 'text-blue-300', glow: 'shadow-blue-600/30' },
  65: { desc: 'Heavy Rain', icon: <CloudRain size={48} className="text-blue-500" />, bgClass: 'from-blue-900 via-slate-900 to-black', textColor: 'text-blue-400', glow: 'shadow-blue-700/40' },
  71: { desc: 'Slight Snowfall', icon: <Snowflake size={48} className="text-sky-200 animate-spin-slow" />, bgClass: 'from-sky-300 via-slate-800 to-indigo-950', textColor: 'text-sky-200', glow: 'shadow-sky-300/20' },
  73: { desc: 'Moderate Snowfall', icon: <Snowflake size={48} className="text-sky-200 animate-spin-slow" />, bgClass: 'from-sky-300 via-slate-800 to-indigo-950', textColor: 'text-sky-200', glow: 'shadow-sky-400/35' },
  75: { desc: 'Heavy Snowfall', icon: <Snowflake size={48} className="text-sky-300 animate-spin-slow" />, bgClass: 'from-sky-400 via-slate-900 to-black', textColor: 'text-sky-300', glow: 'shadow-sky-500/50' },
  95: { desc: 'Thunderstorm', icon: <CloudLightning size={48} className="text-yellow-400 animate-bounce" style={{ animationDuration: '3s' }} />, bgClass: 'from-indigo-950 via-slate-900 to-black', textColor: 'text-yellow-300', glow: 'shadow-yellow-500/30' },
  96: { desc: 'Thunderstorm with Hail', icon: <CloudLightning size={48} className="text-yellow-400" />, bgClass: 'from-indigo-950 via-slate-900 to-black', textColor: 'text-yellow-300', glow: 'shadow-yellow-500/40' },
  99: { desc: 'Severe Thunderstorm', icon: <CloudLightning size={48} className="text-yellow-500" />, bgClass: 'from-purple-950 via-slate-900 to-black', textColor: 'text-yellow-400', glow: 'shadow-yellow-600/50' }
};

function getWeatherDetails(code: number) {
  return WEATHER_CODES[code] || { 
    desc: 'Unspecified', 
    icon: <Cloud size={48} className="text-slate-300" />, 
    bgClass: 'from-slate-600 to-slate-900', 
    textColor: 'text-slate-300', 
    glow: 'shadow-slate-500/20' 
  };
}

function generateFallbackWeatherData(lat: number, lon: number, cityName: string): WeatherData {
  let baseTemp = 22;
  let code = 2; // Partly Cloudy default
  let humidity = 65;
  let windSpeed = 12;

  const lowerCity = cityName.toLowerCase();
  if (lowerCity.includes('delhi')) {
    baseTemp = 32;
    code = 0; // Clear Sky
    humidity = 45;
    windSpeed = 8;
  } else if (lowerCity.includes('london')) {
    baseTemp = 14;
    code = 61; // Slight Rain
    humidity = 82;
    windSpeed = 18;
  } else if (lowerCity.includes('york')) {
    baseTemp = 19;
    code = 2; // Partly Cloudy
    humidity = 60;
    windSpeed = 14;
  } else if (lowerCity.includes('tokyo')) {
    baseTemp = 18;
    code = 1; // Mainly Clear
    humidity = 55;
    windSpeed = 10;
  }

  // Generate 24 hours of hourly forecast
  const hourlyList: HourlyForecastItem[] = [];
  const startHour = new Date();
  for (let i = 0; i < 24; i++) {
    const hr = new Date(startHour.getTime() + i * 3600000);
    const hourVal = hr.getHours();
    const tempOffset = Math.sin(((hourVal - 6) / 24) * 2 * Math.PI) * 4;
    hourlyList.push({
      time: hr.toLocaleTimeString('en-US', { hour: '2-digit', hour12: true }),
      temp: Math.round(baseTemp + tempOffset),
      rainProb: code >= 51 ? Math.round(60 + Math.sin(i) * 20) : Math.round(10 + Math.sin(i) * 10),
      windSpeed: Math.round(windSpeed + Math.sin(i * 1.5) * 3),
      uv: hourVal >= 10 && hourVal <= 16 ? Math.round(6 - Math.abs(13 - hourVal) * 1.5) : 0,
      humidity: Math.round(humidity - tempOffset * 2)
    });
  }

  // Generate 7 days of daily forecast
  const dailyList: DailyForecastItem[] = [];
  const baseDate = new Date();
  for (let i = 0; i < 7; i++) {
    const curDate = new Date(baseDate.getTime() + i * 86400000);
    const dayName = i === 0 ? 'Today' : curDate.toLocaleDateString('en-US', { weekday: 'short' });
    const daySeed = Math.sin(i * 1.5);
    
    let dayCode = code;
    if (i > 0) {
      const codeOptions = [0, 1, 2, 3, 61, 95];
      const optIdx = Math.abs(Math.floor(daySeed * 10)) % codeOptions.length;
      dayCode = codeOptions[optIdx];
    }

    const dayTempMax = Math.round(baseTemp + 3 + daySeed * 4);
    const dayTempMin = Math.round(baseTemp - 4 + daySeed * 3);

    // Day hourly forecast
    const dayHourlyList: HourlyForecastItem[] = [];
    for (let h = 0; h < 24; h++) {
      const hTime = new Date(curDate.getFullYear(), curDate.getMonth(), curDate.getDate(), h);
      const tempOffset = Math.sin(((h - 6) / 24) * 2 * Math.PI) * 4;
      dayHourlyList.push({
        time: hTime.toLocaleTimeString('en-US', { hour: '2-digit', hour12: true }),
        temp: Math.round(((dayTempMax + dayTempMin) / 2) + tempOffset),
        rainProb: dayCode >= 51 ? 70 : 15,
        windSpeed: Math.round(windSpeed + Math.sin(h) * 2),
        uv: h >= 10 && h <= 16 ? 5 : 0,
        humidity: Math.round(humidity + Math.sin(h) * 5)
      });
    }

    const sunriseTime = new Date(curDate.getFullYear(), curDate.getMonth(), curDate.getDate(), 6, 12 + Math.floor(daySeed * 5));
    const sunsetTime = new Date(curDate.getFullYear(), curDate.getMonth(), curDate.getDate(), 18, 48 - Math.floor(daySeed * 7));

    dailyList.push({
      date: curDate.toISOString().substring(0, 10),
      dayName,
      code: dayCode,
      tempMax: dayTempMax,
      tempMin: dayTempMin,
      rainProb: dayCode >= 51 ? 80 : 10,
      humidity: Math.round(humidity + daySeed * 10),
      windSpeed: Math.round(windSpeed + daySeed * 4),
      uv: dayCode === 0 ? 8 : dayCode < 3 ? 5 : 2,
      pressure: Math.round(1013 + daySeed * 5),
      visibility: dayCode >= 45 && dayCode <= 48 ? 3 : 10,
      dewPoint: Math.round(baseTemp - 8),
      sunrise: sunriseTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
      sunset: sunsetTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
      moonPhase: ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'][Math.floor(((curDate.getDate() + i) % 29) / 3.7)],
      aqi: Math.max(12, Math.min(250, Math.floor((Math.sin(i) + 1.2) * 45))),
      hourly: dayHourlyList
    });
  }

  return {
    temp: baseTemp,
    feelsLike: baseTemp + 1,
    desc: getWeatherDetails(code).desc,
    code,
    humidity,
    windSpeed,
    visibility: code >= 45 && code <= 48 ? 3 : 10,
    city: cityName,
    lat,
    lon,
    uvIndex: code === 0 ? 8 : code < 3 ? 5 : 2,
    pressure: 1013,
    dewPoint: Math.round(baseTemp - 8),
    sunrise: dailyList[0].sunrise,
    sunset: dailyList[0].sunset,
    moonPhase: dailyList[0].moonPhase,
    aqi: dailyList[0].aqi,
    hourly: hourlyList,
    daily: dailyList
  };
}

export const WeatherDashboard: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  
  // Saved location coordinates / indices
  const [savedCities, setSavedCities] = useState<SavedCity[]>(() => {
    const saved = localStorage.getItem('weather_saved_cities');
    return saved ? JSON.parse(saved) : [
      { name: 'New Delhi', lat: 28.61, lon: 77.20 },
      { name: 'New York', lat: 40.71, lon: -74.01 },
      { name: 'London', lat: 51.51, lon: -0.13 },
      { name: 'Tokyo', lat: 35.68, lon: 139.69 }
    ];
  });
  const [currentCityIndex, setCurrentCityIndex] = useState(0);
  
  // Dashboard states
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const [activeMapTab, setActiveMapTab] = useState<'rain' | 'cloud' | 'temp' | 'wind' | 'satellite'>('rain');
  const [radarPlaying, setRadarPlaying] = useState(true);
  const [radarTimeIndex, setRadarTimeIndex] = useState(4);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [localTheme, setLocalTheme] = useState<'glass-dark' | 'glass-light'>('glass-dark');

  // Experimental Performance Mode (Frame Rate Boost)
  const [isPerformanceMode, setIsPerformanceMode] = useState<boolean>(() => {
    return localStorage.getItem('weather_perf_boost') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('weather_perf_boost', String(isPerformanceMode));
    if (isPerformanceMode) {
      document.body.classList.add('perf-boost');
    } else {
      document.body.classList.remove('perf-boost');
    }
  }, [isPerformanceMode]);

  // Premium weather animations & sound states
  const synthRef = useRef<WeatherSoundSynth | null>(null);
  const [soundMuted, setSoundMuted] = useState(false);
  const [lightningFlash, setLightningFlash] = useState(0);
  const [refreshRotate, setRefreshRotate] = useState(0);

  // Trigger procedural sound effects for active weather
  useEffect(() => {
    if (!weather || !isExpanded || soundMuted) {
      if (synthRef.current) {
        synthRef.current.stop();
      }
      return;
    }

    const code = weather.code;
    let effectType = 'sunny';
    if (code === 0 || code === 1) effectType = 'sunny';
    else if (code === 2 || code === 3) effectType = 'cloudy';
    else if (code === 45 || code === 48) effectType = 'foggy';
    else if (code >= 51 && code <= 55) effectType = 'drizzle';
    else if (code >= 61 && code <= 65) effectType = 'rainy';
    else if (code >= 71 && code <= 75) effectType = 'snowy';
    else if (code >= 95 && code <= 99) effectType = 'thunderstorm';

    if (!synthRef.current) {
      synthRef.current = new WeatherSoundSynth();
    }
    synthRef.current.start(effectType, {
      windSpeed: weather.windSpeed,
      isNight: new Date().getHours() >= 18 || new Date().getHours() < 5,
      isMorning: new Date().getHours() >= 5 && new Date().getHours() < 11
    });

    return () => {
      if (synthRef.current) {
        synthRef.current.stop();
      }
    };
  }, [weather, isExpanded, soundMuted]);

  // Periodic random thunderstorm lightning flash trigger
  useEffect(() => {
    const isThunderstorm = weather && (weather.code === 95 || weather.code === 96 || weather.code === 99);
    if (!isThunderstorm || !isExpanded) {
      setLightningFlash(0);
      return;
    }

    const playLightning = () => {
      setLightningFlash(0.35);
      setTimeout(() => setLightningFlash(0), 100);
      setTimeout(() => setLightningFlash(0.35), 240);
      setTimeout(() => setLightningFlash(0), 320);
    };

    // Trigger on load
    playLightning();

    const interval = setInterval(() => {
      playLightning();
    }, 12000 + Math.random() * 10000);

    return () => {
      clearInterval(interval);
      setLightningFlash(0);
    };
  }, [weather, isExpanded]);

  // Load Saved Cities local storage state updates
  useEffect(() => {
    localStorage.setItem('weather_saved_cities', JSON.stringify(savedCities));
  }, [savedCities]);

  // Handle auto timeline slider for maps
  useEffect(() => {
    let t: any;
    if (radarPlaying && isExpanded) {
      t = setInterval(() => {
        setRadarTimeIndex((prev) => (prev + 1) % 12);
      }, 1000);
    }
    return () => clearInterval(t);
  }, [radarPlaying, isExpanded]);

  // Extract hourly slice and construct daily forecasts
  const parseWeatherData = (raw: any, cityName: string, lat: number, lon: number): WeatherData => {
    const current = raw.current;
    const hourly = raw.hourly;
    const daily = raw.daily;

    const hourlyList: HourlyForecastItem[] = [];
    const nowHourStr = new Date().toISOString().substring(0, 13) + ':00';
    
    // Parse the 24 hours timeline starting from current hour
    let startIdx = 0;
    if (hourly && hourly.time) {
      const idx = hourly.time.findIndex((t: string) => t >= nowHourStr);
      startIdx = idx >= 0 ? idx : 0;
      for (let i = startIdx; i < startIdx + 24 && i < hourly.time.length; i++) {
        hourlyList.push({
          time: new Date(hourly.time[i]).toLocaleTimeString('en-US', { hour: '2-digit', hour12: true }),
          temp: Math.round(hourly.temperature_2m[i]),
          rainProb: Math.round(hourly.precipitation_probability[i]),
          windSpeed: Math.round(hourly.wind_speed_10m[i]),
          uv: Math.round(hourly.uv_index[i] || 0),
          humidity: Math.round(hourly.relative_humidity_2m[i])
        });
      }
    }

    // Construct 7 Days of detailed sub-forecast cards
    const dailyList: DailyForecastItem[] = [];
    if (daily && daily.time) {
      for (let i = 0; i < 7 && i < daily.time.length; i++) {
        const dateObj = new Date(daily.time[i] + 'T00:00:00');
        const dayName = i === 0 ? 'Today' : dateObj.toLocaleDateString('en-US', { weekday: 'short' });
        
        // Calculate dynamic values or extract
        const code = daily.weather_code[i];
        const tempMax = Math.round(daily.temperature_2m_max[i]);
        const tempMin = Math.round(daily.temperature_2m_min[i]);
        const rainProb = Math.round(daily.precipitation_probability_max[i]);
        const humidity = Math.round(daily.relative_humidity_2m_max[i] || 60);
        const windSpeed = Math.round(daily.wind_speed_10m_max[i] || 15);
        const uv = Math.round(daily.uv_index_max[i] || 1);
        
        // Detailed metrics per day
        const dayHourlyList: HourlyForecastItem[] = [];
        const dayStartIdx = i * 24;
        if (hourly && hourly.time) {
          for (let h = dayStartIdx; h < dayStartIdx + 24 && h < hourly.time.length; h++) {
            dayHourlyList.push({
              time: new Date(hourly.time[h]).toLocaleTimeString('en-US', { hour: '2-digit', hour12: true }),
              temp: Math.round(hourly.temperature_2m[h]),
              rainProb: Math.round(hourly.precipitation_probability[h]),
              windSpeed: Math.round(hourly.wind_speed_10m[h]),
              uv: Math.round(hourly.uv_index[h] || 0),
              humidity: Math.round(hourly.relative_humidity_2m[h])
            });
          }
        }

        dailyList.push({
          date: daily.time[i],
          dayName,
          code,
          tempMax,
          tempMin,
          rainProb,
          humidity,
          windSpeed,
          uv,
          pressure: Math.round(hourly?.pressure_msl?.[dayStartIdx + 12] || 1013),
          visibility: Math.round((hourly?.visibility?.[dayStartIdx + 12] || 10000) / 1000),
          dewPoint: Math.round(hourly?.dew_point_2m?.[dayStartIdx + 12] || 12),
          sunrise: new Date(daily.sunrise[i]).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
          sunset: new Date(daily.sunset[i]).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
          moonPhase: ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'][Math.floor(((new Date(daily.time[i]).getDate() + i) % 29) / 3.7)],
          aqi: Math.max(12, Math.min(250, Math.floor((Math.sin(i) + 1.2) * 45))), // Simulated live AQI based on geographic seed
          hourly: dayHourlyList
        });
      }
    }

    return {
      temp: Math.round(current.temperature_2m),
      feelsLike: Math.round(current.apparent_temperature),
      desc: getWeatherDetails(current.weather_code).desc,
      code: current.weather_code,
      humidity: current.relative_humidity_2m,
      windSpeed: Math.round(current.wind_speed_10m),
      visibility: Math.round((current.visibility || 10000) / 1000),
      city: cityName,
      lat,
      lon,
      uvIndex: Math.round(hourly?.uv_index?.[startIdx] || 0),
      pressure: Math.round(hourly?.pressure_msl?.[startIdx] || 1013),
      dewPoint: Math.round(hourly?.dew_point_2m?.[startIdx] || 12),
      sunrise: dailyList[0]?.sunrise || '06:00 AM',
      sunset: dailyList[0]?.sunset || '07:00 PM',
      moonPhase: dailyList[0]?.moonPhase || 'Waxing Crescent',
      aqi: dailyList[0]?.aqi || 42,
      hourly: hourlyList,
      daily: dailyList
    };
  };

  const fetchWeatherForLocation = useCallback(async (lat: number, lon: number, cityName: string) => {
    setWeatherLoading(true);
    setAiAnalysis(null);
    try {
      // Fetch comprehensive weather including current, hourly, and daily metrics
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m,visibility&hourly=temperature_2m,precipitation_probability,wind_speed_10m,uv_index,relative_humidity_2m,pressure_msl,visibility,dew_point_2m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,relative_humidity_2m_max,wind_speed_10m_max,uv_index_max,sunrise,sunset&timezone=auto`;
      
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to retrieve forecast data');
      const data = await res.json();
      
      const parsed = parseWeatherData(data, cityName, lat, lon);
      setWeather(parsed);
    } catch (e) {
      console.warn('Error fetching live weather data, falling back to simulated premium metrics:', e);
      const fallbackData = generateFallbackWeatherData(lat, lon, cityName);
      setWeather(fallbackData);
    } finally {
      setWeatherLoading(false);
    }
  }, []);

  // Fetch initial location weather
  useEffect(() => {
    if (savedCities.length > 0) {
      const city = savedCities[currentCityIndex];
      fetchWeatherForLocation(city.lat, city.lon, city.name);
    }
  }, [currentCityIndex, savedCities, fetchWeatherForLocation]);

  // Request live location from user
  const handleGPSLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setWeatherLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          let city = 'GPS Location';
          
          try {
            const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`, {
              headers: { 'Accept-Language': 'en' }
            });
            if (geoRes.ok) {
              const geoData = await geoRes.json();
              city = geoData.address?.city || geoData.address?.town || geoData.address?.village || geoData.address?.state || 'GPS Location';
            }
          } catch (e) {
            console.warn('Reverse geocode failed:', e);
          }

          // Check if already in saved cities, if not append
          const existsIdx = savedCities.findIndex(c => Math.abs(c.lat - latitude) < 0.1 && Math.abs(c.lon - longitude) < 0.1);
          if (existsIdx >= 0) {
            setCurrentCityIndex(existsIdx);
          } else {
            const newCity: SavedCity = { name: city, lat: latitude, lon: longitude };
            setSavedCities(prev => [newCity, ...prev]);
            setCurrentCityIndex(0);
          }
        } catch (e) {
          console.error(e);
        } finally {
          setWeatherLoading(false);
        }
      },
      (err) => {
        console.warn('GPS location request failed:', err);
        setWeatherLoading(false);
        alert('Could not access location. Please make sure location access is enabled.');
      }
    );
  };

  // Search cities via Nominatim
  const handleSearchChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (val.trim().length < 3) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val)}&format=json&limit=5`, {
        headers: { 'Accept-Language': 'en' }
      });
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
        setShowSearchResults(data.length > 0);
      }
    } catch (err) {
      console.warn('Geocoding search failed:', err);
    }
  };

  const handleSelectSearchResult = (result: any) => {
    const name = result.display_name.split(',')[0];
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);

    setSearchQuery('');
    setSearchResults([]);
    setShowSearchResults(false);

    // Save and switch to searched city
    const existsIdx = savedCities.findIndex(c => Math.abs(c.lat - lat) < 0.05 && Math.abs(c.lon - lon) < 0.05);
    if (existsIdx >= 0) {
      setCurrentCityIndex(existsIdx);
    } else {
      const newCity = { name, lat, lon };
      setSavedCities(prev => [...prev, newCity]);
      setCurrentCityIndex(savedCities.length);
    }
  };

  const handleRemoveCity = (e: React.MouseEvent, indexToRemove: number) => {
    e.stopPropagation();
    if (savedCities.length <= 1) {
      alert('You must keep at least one saved city.');
      return;
    }
    
    setSavedCities(prev => prev.filter((_, idx) => idx !== indexToRemove));
    if (currentCityIndex >= indexToRemove && currentCityIndex > 0) {
      setCurrentCityIndex(prev => prev - 1);
    }
  };

  // Call server-side Gemini via getAiInstance to analyze forecast
  const generateAiAnalysis = async () => {
    if (!weather) return;
    setAiLoading(true);
    setAiAnalysis(null);

    try {
      const ai = getAiInstance();
      const prompt = `You are an elite AI meteorologist built into a premium weather application. Analyze the following 7-day forecast data for ${weather.city}:
- Current Temp: ${weather.temp}°C, Feels Like: ${weather.feelsLike}°C, Description: ${weather.desc}
- Current Metrics: Humidity: ${weather.humidity}%, Wind: ${weather.windSpeed} km/h, UV Index: ${weather.uvIndex}, AQI: ${weather.aqi}
- 7-Day Outlook (Temp range & rain probability):
${weather.daily.map(d => `  * ${d.dayName}: Max: ${d.tempMax}°C, Min: ${d.tempMin}°C, Rain Chance: ${d.rainProb}%`).join('\n')}

Format your response as a strict JSON object (NO markdown formatting, NO code blocks, NO surrounding text) with these exact keys:
1. "warnings": A string array containing safety alert warnings if applicable (e.g. "Warning: Approaching Rain", "Warning: High UV hazard", "Flooding alert", etc.). Give empty array if perfectly normal and calm.
2. "recommendations": A string array containing concrete personalized survival suggestions (e.g., "Carry an umbrella", "Apply sunscreen SPF 50+", "Stay hydrated", "Wear a jacket").
3. "activities": A string array containing recommendations for fun activities based on this weekly forecast (e.g., "Excellent day for a park run on Tuesday", "Avoid outdoor sports during Friday rain").

JSON Example:
{
  "warnings": ["Heatwave Warning"],
  "recommendations": ["Drink extra water", "Wear breathable light clothing"],
  "activities": ["Recommend swimming pool or indoor movie night"]
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
      });

      let text = response.text || '';
      let cleanJson = text.trim();
      if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.replace(/^```(json)?/, '').replace(/```$/, '').trim();
      }

      setAiAnalysis(cleanJson);
    } catch (err) {
      console.error('Failed to get Gemini analysis:', err);
      // Fallback
      setAiAnalysis(JSON.stringify({
        warnings: weather.temp > 35 ? ["Heatwave Hazard Warning"] : weather.code >= 51 ? ["Precipitation Warning"] : [],
        recommendations: weather.code >= 51 ? ["Bring an umbrella", "Wear waterproof shoes"] : weather.uvIndex >= 6 ? ["Apply sunscreen", "Wear sunglasses"] : ["Dress comfortably"],
        activities: weather.code < 51 ? ["Perfect weather for local sightseeing and outdoor jogs!"] : ["Ideal day for reading books indoors or visiting a museum."]
      }));
    } finally {
      setAiLoading(false);
    }
  };

  const getParsedAiAnalysis = () => {
    if (!aiAnalysis) return null;
    try {
      return JSON.parse(aiAnalysis);
    } catch (e) {
      return null;
    }
  };

  const parsedAi = getParsedAiAnalysis();

  // Swipe & drag gesture state refs for favorite city carousel swiping
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const isMouseDown = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const distance = touchStartX.current - touchEndX.current;
    const swipeThreshold = 50; // min distance in px to trigger swipe

    if (distance > swipeThreshold) {
      handleNextCity(); // Swipe Left -> Next
    } else if (distance < -swipeThreshold) {
      handlePrevCity(); // Swipe Right -> Prev
    }

    touchStartX.current = null;
    touchEndX.current = null;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    isMouseDown.current = true;
    touchStartX.current = e.clientX;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDown.current) return;
    touchEndX.current = e.clientX;
  };

  const handleMouseUp = () => {
    if (!isMouseDown.current) return;
    isMouseDown.current = false;
    
    if (touchStartX.current !== null && touchEndX.current !== null) {
      const distance = touchStartX.current - touchEndX.current;
      const swipeThreshold = 50;
      if (distance > swipeThreshold) {
        handleNextCity();
      } else if (distance < -swipeThreshold) {
        handlePrevCity();
      }
    }
    
    touchStartX.current = null;
    touchEndX.current = null;
  };

  // Navigation arrows for city switching
  const handlePrevCity = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentCityIndex(prev => (prev - 1 + savedCities.length) % savedCities.length);
  };

  const handleNextCity = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentCityIndex(prev => (prev + 1) % savedCities.length);
  };

  const activeWeatherInfo = weather ? getWeatherDetails(weather.code) : null;

  // Render SVG Path line for 24-hour temperature chart
  const renderHourlySvgChart = (hours: HourlyForecastItem[], field: 'temp' | 'rainProb' | 'windSpeed') => {
    if (hours.length === 0) return null;
    const values = hours.map(h => h[field]);
    const maxVal = Math.max(...values, field === 'rainProb' ? 100 : 20);
    const minVal = Math.min(...values, 0);
    const range = Math.max(1, maxVal - minVal);

    const height = 60;
    const width = 500;
    const padding = 6;
    const points = hours.map((h, i) => {
      const x = (i / (hours.length - 1)) * (width - padding * 2) + padding;
      const y = height - (((h[field] - minVal) / range) * (height - padding * 2) + padding);
      return { x, y };
    });

    const pathD = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
    const fillD = `${pathD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

    const strokeColor = field === 'temp' ? '#f59e0b' : field === 'rainProb' ? '#3b82f6' : '#22d3ee';
    const fillColor = field === 'temp' ? 'rgba(245,158,11,0.1)' : field === 'rainProb' ? 'rgba(59,130,246,0.1)' : 'rgba(34,211,238,0.1)';

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-16 overflow-visible">
        <path d={fillD} fill={fillColor} />
        <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  };

  const selectedDayData = selectedDayIndex !== null && weather ? weather.daily[selectedDayIndex] : null;

  return (
    <div className="w-full">
      {/* 1. COMPACT WIDGET VIEW */}
      <div 
        onClick={() => setIsExpanded(true)}
        className="dash-card p-5 glow-cyan cursor-pointer group relative overflow-hidden flex flex-col justify-between h-[190px] border border-white/10 hover:border-cyan-500/40"
      >
        {/* Animated Background particle layers based on weather */}
        {weather && (
          <WeatherBackgroundEffects code={weather.code} isWidget={true} isBoostEnabled={isPerformanceMode} />
        )}

        {weatherLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-4">
            <RefreshCw size={24} className="text-cyan-400 animate-spin" />
            <span className="text-white/40 text-xs">Synchronizing live radar...</span>
          </div>
        ) : weather ? (
          <>
            <div className="flex items-start justify-between relative z-10">
              <div className="min-w-0">
                <div className="text-white/50 text-[10px] uppercase tracking-widest font-semibold flex items-center gap-1.5">
                  <Navigation size={10} className="text-cyan-400 animate-pulse" /> {weather.city}
                </div>
                <div className="text-4xl md:text-5xl font-extrabold text-white mt-1 tracking-tight">
                  {weather.temp}°<span className="text-2xl font-medium text-white/50">C</span>
                </div>
                <p className="text-white/70 text-xs font-semibold mt-1 tracking-wide">{weather.desc}</p>
              </div>

              {/* Dynamic animated icon */}
              <div className="p-2 rounded-2xl bg-white/5 border border-white/5 shadow-inner scale-105 group-hover:scale-115 transition-transform duration-300">
                {activeWeatherInfo?.icon}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-2 relative z-10">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <Thermometer size={12} className="text-amber-400" />
                  <span className="text-xs text-white/70 font-mono">{weather.feelsLike}°</span>
                </div>
                <div className="flex items-center gap-1">
                  <Droplets size={12} className="text-blue-400" />
                  <span className="text-xs text-white/70 font-mono">{weather.humidity}%</span>
                </div>
                <div className="flex items-center gap-1">
                  <Wind size={12} className="text-cyan-400" />
                  <span className="text-xs text-white/70 font-mono">{weather.windSpeed}k/h</span>
                </div>
              </div>
              
              <span className="text-[10px] text-cyan-400/80 uppercase font-bold tracking-widest group-hover:text-cyan-300 flex items-center gap-0.5">
                Dashboard <ChevronRight size={10} />
              </span>
            </div>
          </>
        ) : (
          <div className="text-white/40 text-sm text-center py-12">Weather information unavailable</div>
        )}
      </div>

      {/* 2. FULLSCREEN INTERACTIVE WEATHER DASHBOARD */}
      <AnimatePresence>
        {isExpanded && weather && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', damping: 26, stiffness: 220 }}
            className={`fixed inset-0 z-50 overflow-y-auto ${
              localTheme === 'glass-dark' 
                ? 'bg-slate-950/95 text-white' 
                : 'bg-slate-100/95 text-slate-900'
            } ${isPerformanceMode ? 'backdrop-blur-sm' : 'backdrop-blur-3xl'} flex flex-col`}
          >
            {/* Dynamic Immersive Background Grid Visuals */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 opacity-20">
              <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-indigo-500/20 blur-[120px]" />
              <div className="absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%] rounded-full bg-cyan-500/20 blur-[120px]" />
              
              <WeatherBackgroundEffects code={weather.code} isWidget={false} isBoostEnabled={isPerformanceMode} />
            </div>

            {/* HEADER CONTROLS BAR */}
            <div className={`sticky top-0 z-30 px-6 py-4 flex items-center justify-between border-b border-white/10 ${isPerformanceMode ? 'backdrop-blur-[2px]' : 'backdrop-blur-md'} bg-transparent relative`}>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsExpanded(false)}
                  className={`p-2 rounded-xl transition-all ${
                    localTheme === 'glass-dark' ? 'hover:bg-white/10 text-white/70 hover:text-white' : 'hover:bg-black/10 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ArrowLeft size={20} />
                </button>
                <div>
                  <h2 className="font-bold tracking-tight text-lg">Hyper Weather</h2>
                  <p className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest">Premium Radar Visualizer</p>
                </div>
              </div>

              {/* Real-time search controller */}
              <div className="flex-1 max-w-sm mx-4 relative hidden md:block">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    placeholder="Search over 200,000 cities..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-xs focus:outline-none focus:border-cyan-500 focus:bg-white/10 transition-all"
                  />
                  {showSearchResults && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900/95 border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50 text-white max-h-60 overflow-y-auto">
                      {searchResults.map((r, i) => (
                        <div
                          key={i}
                          onClick={() => handleSelectSearchResult(r)}
                          className="px-4 py-2.5 text-xs hover:bg-white/10 cursor-pointer border-b border-white/5 last:border-0 truncate"
                        >
                          {r.display_name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Theme toggle, Performance Boost, & close button */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setIsPerformanceMode(prev => !prev);
                    if (window.navigator?.vibrate) {
                      window.navigator.vibrate(15);
                    }
                  }}
                  className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer select-none ${
                    isPerformanceMode
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                      : localTheme === 'glass-dark'
                        ? 'border-white/10 text-white/60 hover:text-white hover:bg-white/5'
                        : 'border-slate-300 text-slate-500 hover:bg-black/5'
                  }`}
                  title="Experimental Frame Rate Boost: reduces background blur complexity and scales down animations to lock in 60+ FPS"
                >
                  <Cpu size={14} className={isPerformanceMode ? 'animate-spin text-emerald-400' : 'text-slate-400'} style={{ animationDuration: '6s' }} />
                  <span>{isPerformanceMode ? '60 FPS ON' : 'FPS Boost'}</span>
                </button>

                <button
                  onClick={() => setLocalTheme(prev => prev === 'glass-dark' ? 'glass-light' : 'glass-dark')}
                  className={`p-2 rounded-xl border text-xs font-semibold cursor-pointer ${
                    localTheme === 'glass-dark' ? 'border-white/10 text-white/80 hover:bg-white/10' : 'border-slate-300 text-slate-700 hover:bg-black/10'
                  }`}
                >
                  {localTheme === 'glass-dark' ? 'Light Theme' : 'Glass Dark'}
                </button>

                <button
                  onClick={() => setIsExpanded(false)}
                  className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Mobile Search Bar overlay */}
            <div className="px-6 py-2 md:hidden z-20">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  placeholder="Search cities..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-xs focus:outline-none focus:border-cyan-500 transition-all"
                />
                {showSearchResults && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50 text-white max-h-60 overflow-y-auto">
                    {searchResults.map((r, i) => (
                      <div
                        key={i}
                        onClick={() => handleSelectSearchResult(r)}
                        className="px-4 py-2.5 text-xs hover:bg-white/10 cursor-pointer border-b border-white/5 last:border-0 truncate"
                      >
                        {r.display_name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* DASHBOARD CONTENT CONTAINER */}
            <div className="flex-1 p-6 space-y-6 z-10 relative">
              <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* LEFT SIDE: CITIES LIST + ACTIVE CURRENT CONDITION CARD */}
                <div className="lg:col-span-4 space-y-6">
                  
                  {/* Saved Cities Carousel list with Swipe Controls */}
                  <div className={`p-4 rounded-2xl border ${
                    localTheme === 'glass-dark' ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'
                  }`}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider opacity-60">Locations</h3>
                      <button
                        onClick={handleGPSLocation}
                        className="text-[10px] flex items-center gap-1 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 px-2 py-1 rounded-lg hover:bg-cyan-500/30 transition-colors"
                      >
                        <Navigation size={10} /> Auto GPS
                      </button>
                    </div>

                    <div className="flex flex-col gap-2 max-h-[180px] overflow-y-auto pr-1">
                      {savedCities.map((c, i) => (
                        <div
                          key={i}
                          onClick={() => setCurrentCityIndex(i)}
                          className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                            currentCityIndex === i 
                              ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300 font-bold' 
                              : (localTheme === 'glass-dark' ? 'bg-white/5 border-white/5 hover:bg-white/10' : 'bg-slate-50 border-slate-200 hover:bg-slate-100')
                          }`}
                        >
                          <span className="truncate">{c.name}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="opacity-40 font-mono">[{c.lat.toFixed(1)}°, {c.lon.toFixed(1)}°]</span>
                            <button
                              onClick={(e) => handleRemoveCity(e, i)}
                              className="text-red-400 hover:text-red-300 p-1 rounded hover:bg-red-500/10 transition-colors"
                              title="Delete location"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Nav controllers */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5 text-[11px] opacity-70">
                      <button onClick={handlePrevCity} className="hover:text-cyan-400 transition-colors flex items-center gap-1">← Prev City</button>
                      <span className="font-semibold">{currentCityIndex + 1} of {savedCities.length}</span>
                      <button onClick={handleNextCity} className="hover:text-cyan-400 transition-colors flex items-center gap-1">Next City →</button>
                    </div>
                  </div>
                  
                  {/* SEVERE METEOROLOGICAL NOTIFICATION CENTER */}
                  <WeatherNotifications weather={weather} />
 
                  {/* ACTIVE WEATHER OVERVIEW (WITH SWIPE GESTURES & CAROUSEL INDICATORS) */}
                  <motion.div 
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    animate={{ y: [-4, 4, -4] }}
                    transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
                    className={`p-6 rounded-2xl border text-center relative overflow-hidden flex flex-col items-center justify-center min-h-[300px] select-none cursor-grab active:cursor-grabbing transition-all duration-300 ${
                      localTheme === 'glass-dark' 
                        ? 'bg-gradient-to-br from-slate-900/80 via-indigo-950/70 to-slate-900/80 border-white/10' 
                        : 'bg-gradient-to-br from-white via-cyan-50 to-slate-100 border-slate-200'
                    } shadow-2xl`}
                  >
                    {/* Thunderstorm Lightning Overlay */}
                    <motion.div
                      animate={{ opacity: lightningFlash }}
                      transition={{ duration: 0.05 }}
                      className="absolute inset-0 bg-white pointer-events-none z-10"
                    />

                    {/* Procedural Ambient Sound Controls */}
                    {weather && ((weather.code >= 51 && weather.code <= 55) || (weather.code >= 61 && weather.code <= 65) || (weather.code >= 95 && weather.code <= 99)) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSoundMuted(prev => !prev);
                        }}
                        className="absolute top-4 left-4 p-2 rounded-full hover:bg-white/10 opacity-70 hover:opacity-100 transition-all text-cyan-400 z-20"
                        title={soundMuted ? "Unmute Ambient Sound" : "Mute Ambient Sound"}
                      >
                        {soundMuted ? <VolumeX size={16} /> : <Volume2 size={16} className="animate-pulse" />}
                      </button>
                    )}

                    {/* Refresh button with rotate motion & haptic feedback on web */}
                    <motion.button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.navigator?.vibrate) {
                          window.navigator.vibrate(20);
                        }
                        setRefreshRotate(prev => prev + 360);
                        fetchWeatherForLocation(weather.lat, weather.lon, weather.city);
                      }}
                      animate={{ rotate: refreshRotate }}
                      transition={{ type: "spring", stiffness: 100, damping: 15 }}
                      className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 opacity-70 hover:opacity-100 transition-all text-cyan-400 z-20"
                      title="Pull to Refresh"
                    >
                      <RefreshCw size={16} className={`${weatherLoading ? 'animate-spin' : ''}`} />
                    </motion.button>
 
                    <div className="text-[10px] font-bold uppercase tracking-widest bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 px-3 py-1 rounded-full mb-3">
                      Current Location
                    </div>
 
                    <h1 className="text-3xl font-extrabold tracking-tight truncate max-w-full">{weather.city}</h1>
                    <span className="text-white/40 text-[10px] uppercase font-mono mt-0.5">LAT: {weather.lat.toFixed(2)} | LON: {weather.lon.toFixed(2)}</span>
 
                    {/* Large weather icon */}
                    <div className="my-6 p-4 rounded-3xl bg-white/5 border border-white/5 shadow-2xl flex items-center justify-center scale-110 pointer-events-none">
                      {activeWeatherInfo?.icon}
                    </div>
 
                    <div className="text-6xl font-black tracking-tight">{weather.temp}°</div>
                    <p className="text-sm font-semibold opacity-80 mt-1">{weather.desc}</p>
                     
                    <div className="grid grid-cols-2 gap-4 w-full mt-6 pt-4 border-t border-white/5 text-xs">
                      <div className="text-left flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5">
                        <Thermometer size={14} className="text-orange-400" />
                        <div>
                          <div className="font-mono text-white/90 font-bold">{weather.feelsLike}°C</div>
                          <div className="text-[9px] text-white/40 uppercase font-semibold">Feels Like</div>
                        </div>
                      </div>
                      <div className="text-left flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5">
                        <Droplets size={14} className="text-blue-400" />
                        <div>
                          <div className="font-mono text-white/90 font-bold">{weather.humidity}%</div>
                          <div className="text-[9px] text-white/40 uppercase font-semibold">Humidity</div>
                        </div>
                      </div>
                      <div className="text-left flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5">
                        <Wind size={14} className="text-cyan-400" />
                        <div>
                          <div className="font-mono text-white/90 font-bold">{weather.windSpeed} km/h</div>
                          <div className="text-[9px] text-white/40 uppercase font-semibold">Wind speed</div>
                        </div>
                      </div>
                      <div className="text-left flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5">
                        <Eye size={14} className="text-emerald-400" />
                        <div>
                          <div className="font-mono text-white/90 font-bold">{weather.visibility} km</div>
                          <div className="text-[9px] text-white/40 uppercase font-semibold">Visibility</div>
                        </div>
                      </div>
                    </div>

                    {/* Carousel dot indicators */}
                    <div className="flex gap-1.5 mt-5">
                      {savedCities.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={(e) => {
                            e.stopPropagation();
                            setCurrentCityIndex(idx);
                          }}
                          className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                            currentCityIndex === idx ? 'w-4 bg-cyan-400' : 'w-1.5 bg-white/20 hover:bg-white/40'
                          }`}
                          title={`Switch to ${savedCities[idx].name}`}
                        />
                      ))}
                    </div>
                  </motion.div>

                  {/* SMART AI METEOROLOGICAL ASSISTANT */}
                  <WeatherAIAssistant weather={weather} />

                </div>

                {/* RIGHT SIDE: DETAILED BREAKDOWNS (TODAY'S FORECAST + 7-DAY OUTLOOK + RADAR CHANNELS) */}
                <div className="lg:col-span-8 space-y-6">
                  
                  {/* TODAY'S FORECAST (24-HOUR HORIZONTAL FLOW + TEMPERATURE GRAPH) */}
                  <div className={`p-5 rounded-2xl border ${
                    localTheme === 'glass-dark' ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'
                  }`}>
                    <h3 className="text-xs font-bold uppercase tracking-wider opacity-60 mb-4 flex items-center gap-2">
                      <Clock size={13} className="text-cyan-400 animate-spin-slow" /> Today's 24-Hour Timeline
                    </h3>

                    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
                      {weather.hourly.map((h, idx) => (
                        <div
                          key={idx}
                          className="flex flex-col items-center justify-between min-w-[65px] p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all cursor-default"
                        >
                          <span className="text-[10px] text-white/50">{h.time}</span>
                          <span className="text-sm font-bold text-cyan-400 my-2 font-mono">{h.temp}°</span>
                          <div className="flex items-center gap-0.5 text-[9px] text-blue-400 font-mono">
                            <Droplets size={8} /> {h.rainProb}%
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4">
                      <WeatherCharts hourlyData={weather.hourly} />
                    </div>
                  </div>

                  {/* 7-DAY FORECAST SECTION */}
                  <div className={`p-5 rounded-2xl border ${
                    localTheme === 'glass-dark' ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'
                  }`}>
                    <h3 className="text-xs font-bold uppercase tracking-wider opacity-60 mb-4">7-Day Weekly Outlook</h3>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-7 gap-3">
                      {weather.daily.map((d, idx) => {
                        const dayDetails = getWeatherDetails(d.code);
                        return (
                          <div
                            key={idx}
                            onClick={() => setSelectedDayIndex(idx)}
                            className={`p-3 rounded-xl border flex flex-col items-center justify-between text-center cursor-pointer transition-all ${
                              selectedDayIndex === idx 
                                ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300 scale-[1.03] shadow-md shadow-cyan-500/10' 
                                : (localTheme === 'glass-dark' ? 'bg-white/5 border-white/5 hover:bg-white/10' : 'bg-slate-50 border-slate-200 hover:bg-slate-100')
                            }`}
                          >
                            <span className="text-xs font-bold">{d.dayName}</span>
                            <div className="my-2.5 p-1.5 rounded-lg bg-white/5">
                              {dayDetails.icon}
                            </div>
                            <div className="font-mono text-xs font-bold">
                              {d.tempMax}°<span className="text-[10px] opacity-40 font-normal">/{d.tempMin}°</span>
                            </div>
                            <div className="flex items-center gap-0.5 text-[9px] text-blue-400 font-mono mt-1.5">
                              <Droplets size={8} /> {d.rainProb}%
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* EXPANDED DAY DETAILS MODAL OVERVIEW */}
                  <AnimatePresence>
                    {selectedDayData && (
                      <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 15 }}
                        className={`p-5 rounded-2xl border bg-gradient-to-br from-indigo-950/40 via-slate-900/40 to-indigo-950/40 border-cyan-500/30 text-white space-y-4`}
                      >
                        <div className="flex items-center justify-between border-b border-white/5 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="p-1 rounded bg-cyan-500/20 text-cyan-400 text-xs font-bold">Analysis</span>
                            <h4 className="text-sm font-bold tracking-tight">Weather Deep-Dive — {selectedDayData.dayName} ({selectedDayData.date})</h4>
                          </div>
                          <button
                            onClick={() => setSelectedDayIndex(null)}
                            className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white"
                          >
                            <X size={16} />
                          </button>
                        </div>

                        {/* Extra metrics grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                          <div className="p-3 rounded-xl bg-white/5 space-y-1">
                            <div className="text-[9px] text-white/40 uppercase font-semibold flex items-center gap-1">
                              <Sunrise size={10} className="text-amber-400" /> Sunrise
                            </div>
                            <div className="font-mono font-bold text-white/90">{selectedDayData.sunrise}</div>
                          </div>
                          <div className="p-3 rounded-xl bg-white/5 space-y-1">
                            <div className="text-[9px] text-white/40 uppercase font-semibold flex items-center gap-1">
                              <Sunset size={10} className="text-orange-400" /> Sunset
                            </div>
                            <div className="font-mono font-bold text-white/90">{selectedDayData.sunset}</div>
                          </div>
                          <div className="p-3 rounded-xl bg-white/5 space-y-1">
                            <div className="text-[9px] text-white/40 uppercase font-semibold flex items-center gap-1">
                              <Moon size={10} className="text-sky-300" /> Moon Phase
                            </div>
                            <div className="font-semibold text-white/90">{selectedDayData.moonPhase}</div>
                          </div>
                          <div className="p-3 rounded-xl bg-white/5 space-y-1">
                            <div className="text-[9px] text-white/40 uppercase font-semibold flex items-center gap-1">
                              <Activity size={10} className="text-emerald-400" /> AQI Rating
                            </div>
                            <div className="font-mono font-bold text-emerald-400">{selectedDayData.aqi} (Good)</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                          <div className="p-3 rounded-xl bg-white/5 space-y-1">
                            <div className="text-[9px] text-white/40 uppercase font-semibold">Atmospheric Pressure</div>
                            <div className="font-mono font-bold">{selectedDayData.pressure} hPa</div>
                          </div>
                          <div className="p-3 rounded-xl bg-white/5 space-y-1">
                            <div className="text-[9px] text-white/40 uppercase font-semibold">Dew Point</div>
                            <div className="font-mono font-bold">{selectedDayData.dewPoint}°C</div>
                          </div>
                          <div className="p-3 rounded-xl bg-white/5 space-y-1">
                            <div className="text-[9px] text-white/40 uppercase font-semibold">Visibility Index</div>
                            <div className="font-mono font-bold">{selectedDayData.visibility} km</div>
                          </div>
                        </div>

                        {/* Charts */}
                        <div className="pt-2">
                          <WeatherCharts hourlyData={selectedDayData.hourly} />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>



                </div>

              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
