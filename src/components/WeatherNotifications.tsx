import React, { useEffect, useMemo } from 'react';
import { AlertTriangle, Info, Bell, ShieldCheck, Waves, Flame, Snowflake, Wind } from 'lucide-react';
import { toast } from 'sonner';

interface WeatherData {
  temp: number;
  feelsLike: number;
  desc: string;
  code: number;
  humidity: number;
  windSpeed: number;
  city: string;
}

interface WeatherNotificationsProps {
  weather: WeatherData;
}

export interface SevereAlert {
  id: string;
  type: 'danger' | 'warning' | 'info';
  title: string;
  description: string;
  icon: React.ReactNode;
}

export const WeatherNotifications: React.FC<WeatherNotificationsProps> = ({ weather }) => {
  // Compute active severe alerts based on actual meteorological metrics
  const activeAlerts = useMemo((): SevereAlert[] => {
    const alerts: SevereAlert[] = [];

    // 1. Storm Hazard Check (WMO Code 95, 96, 99)
    if (weather.code >= 95) {
      alerts.push({
        id: 'storm',
        type: 'danger',
        title: 'Severe Thunderstorm Warning',
        description: 'Atmospheric lightning strikes and hail. Stay indoors and unplug expensive appliances.',
        icon: <AlertTriangle className="text-red-400 animate-bounce" size={16} />
      });
    }

    // 2. Flooding / Torrential Rainfall Hazard (WMO Code 65 Heavy Rain or high humidity/precipitation)
    if (weather.code === 65 || (weather.humidity >= 92 && weather.code >= 61)) {
      alerts.push({
        id: 'flood',
        type: 'danger',
        title: 'Heavy Flooding Risk',
        description: 'High accumulation rate detected. Avoid crossing low-lying streets and drainage channels.',
        icon: <Waves className="text-cyan-400 animate-pulse" size={16} />
      });
    }

    // 3. Heatwave Warning (temp >= 35°C)
    if (weather.temp >= 35) {
      alerts.push({
        id: 'heatwave',
        type: 'danger',
        title: 'Extreme Heat Advisory',
        description: `Ambient temperature at ${weather.temp}°C. Dangerous dehydration risk. Avoid direct noon sun exposure.`,
        icon: <Flame className="text-orange-400 animate-pulse" size={16} />
      });
    }

    // 4. Freeze warning (temp <= 0°C)
    if (weather.temp <= 0) {
      alerts.push({
        id: 'freeze',
        type: 'warning',
        title: 'Freeze / Frost Warning',
        description: `Sub-zero temperature (${weather.temp}°C). Black ice and plant frost risks. Wear insulated winter coats.`,
        icon: <Snowflake className="text-sky-300" size={16} />
      });
    }

    // 5. High Wind / Gale Warning (windSpeed >= 35 km/h)
    if (weather.windSpeed >= 35) {
      alerts.push({
        id: 'gale',
        type: 'warning',
        title: 'High Velocity Gale Warning',
        description: `Sustained winds exceeding ${weather.windSpeed} km/h. Secure loose outdoor structural items.`,
        icon: <Wind className="text-blue-300" size={16} />
      });
    }

    return alerts;
  }, [weather]);

  // Trigger real-time push toast alerts using sonner on city change or alert detection
  useEffect(() => {
    if (activeAlerts.length > 0) {
      activeAlerts.forEach((alert) => {
        if (alert.type === 'danger') {
          toast.error(alert.title, {
            description: `${weather.city}: ${alert.description}`,
            duration: 6000,
            position: 'top-right',
            icon: alert.icon
          });
        } else {
          toast.warning(alert.title, {
            description: `${weather.city}: ${alert.description}`,
            duration: 5000,
            position: 'top-right',
            icon: alert.icon
          });
        }
      });
    } else {
      // Trigger safe weather message
      toast.success('Clear Safety Rating', {
        description: `No severe meteorological hazards in ${weather.city}. Enjoy your day!`,
        duration: 3000,
        position: 'top-right',
        icon: <ShieldCheck className="text-emerald-400" size={16} />
      });
    }
  }, [activeAlerts, weather.city]);

  return (
    <div className="space-y-3">
      {/* Alert Center Module */}
      <div className="p-4 rounded-2xl border border-white/10 bg-slate-900/40 relative overflow-hidden">
        <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
          <div className="flex items-center gap-2">
            <Bell size={13} className="text-cyan-400 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-white/70">
              Live Severe Hazard Room
            </span>
          </div>
          <span className="font-mono text-[9px] text-white/40 uppercase">
            {activeAlerts.length} Active Alerts
          </span>
        </div>

        {activeAlerts.length === 0 ? (
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <ShieldCheck size={16} className="shrink-0" />
            <div className="text-xs">
              <span className="font-bold">Atmosphere Secure:</span> All severe checks green. No flooding, storm, heatwave, or freezing warnings are currently active for {weather.city}.
            </div>
          </div>
        ) : (
          <div className="space-y-2.5 max-h-[160px] overflow-y-auto pr-1">
            {activeAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                  alert.type === 'danger'
                    ? 'bg-red-500/10 border-red-500/20 text-red-200'
                    : 'bg-amber-500/10 border-amber-500/20 text-amber-200'
                }`}
              >
                <div className="p-1 rounded bg-white/5 shrink-0">
                  {alert.icon}
                </div>
                <div className="text-xs space-y-0.5">
                  <div className="font-extrabold uppercase tracking-wide text-[10px] text-white">
                    {alert.title}
                  </div>
                  <p className="opacity-85 text-[11px] leading-relaxed">{alert.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
