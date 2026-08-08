import React, { useState } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts';

interface HourlyForecastItem {
  time: string;
  temp: number;
  rainProb: number;
  windSpeed: number;
  uv: number;
  humidity: number;
}

interface WeatherChartsProps {
  hourlyData: HourlyForecastItem[];
}

export const WeatherCharts: React.FC<WeatherChartsProps> = ({ hourlyData }) => {
  const [activeMetric, setActiveMetric] = useState<'temp' | 'windSpeed' | 'humidity'>('temp');

  const chartData = hourlyData.slice(0, 24); // Show the next 24 hours

  const metricConfig = {
    temp: {
      color: '#f59e0b',
      label: 'Temperature',
      unit: '°C',
      stroke: 'rgba(245, 158, 11, 1)',
      fill: 'rgba(245, 158, 11, 0.15)',
    },
    windSpeed: {
      color: '#06b6d4',
      label: 'Wind Speed',
      unit: ' km/h',
      stroke: 'rgba(6, 182, 212, 1)',
      fill: 'rgba(6, 182, 212, 0.15)',
    },
    humidity: {
      color: '#3b82f6',
      label: 'Humidity',
      unit: '%',
      stroke: 'rgba(59, 130, 246, 1)',
      fill: 'rgba(59, 130, 246, 0.15)',
    }
  };

  const activeConf = metricConfig[activeMetric];

  // Custom tooltips to fit our glassmorphic premium UI
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900/90 border border-white/10 p-3 rounded-xl shadow-2xl backdrop-blur-md text-xs">
          <p className="text-white/50 font-semibold mb-1">{label}</p>
          <p className="font-mono font-bold text-sm" style={{ color: activeConf.color }}>
            {payload[0].value}
            <span className="text-xs font-normal text-white/70">{activeConf.unit}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Metric Selector Tabs */}
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <span className="text-[10px] text-white/40 uppercase font-bold tracking-widest">
          Chronological Forecast Trends
        </span>
        <div className="flex bg-white/5 p-0.5 rounded-lg border border-white/5 shrink-0 text-[10px] font-bold">
          {(['temp', 'windSpeed', 'humidity'] as const).map((metric) => (
            <button
              key={metric}
              onClick={() => setActiveMetric(metric)}
              className={`px-2.5 py-1 uppercase rounded-md transition-all cursor-pointer ${
                activeMetric === metric
                  ? 'bg-cyan-500 text-white shadow-sm shadow-cyan-500/20'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              {metric === 'temp' ? 'Temperature' : metric === 'windSpeed' ? 'Wind Speed' : 'Humidity'}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-48 w-full bg-slate-950/20 rounded-xl p-2 border border-white/5">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id={`gradient-${activeMetric}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={activeConf.color} stopOpacity={0.35} />
                <stop offset="95%" stopColor={activeConf.color} stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis 
              dataKey="time" 
              stroke="rgba(255,255,255,0.4)" 
              fontSize={9} 
              tickLine={false} 
              axisLine={false}
              dy={5}
            />
            <YAxis 
              stroke="rgba(255,255,255,0.4)" 
              fontSize={9} 
              tickLine={false} 
              axisLine={false}
              domain={activeMetric === 'humidity' ? [0, 100] : ['auto', 'auto']}
              dx={-5}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area 
              type="monotone" 
              dataKey={activeMetric} 
              stroke={activeConf.stroke} 
              strokeWidth={2}
              fillOpacity={1} 
              fill={`url(#gradient-${activeMetric})`} 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
