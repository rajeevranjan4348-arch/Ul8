import React, { useState, useEffect } from 'react';
import { Activity, Wifi, HardDrive, Cpu } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export const SystemStatus: React.FC = () => {
  const { isDarkMode, getBorderClass } = useTheme();
  const [cpuUsage, setCpuUsage] = useState(0);
  const [memoryUsage, setMemoryUsage] = useState(0);
  const [networkStatus, setNetworkStatus] = useState('Online');
  const [ping, setPing] = useState(0);

  useEffect(() => {
    const updateStats = () => {
      // Mock CPU usage (fluctuates between 5% and 35%)
      setCpuUsage(Math.floor(Math.random() * 30) + 5);
      
      // Mock Ping
      setPing(Math.floor(Math.random() * 20) + 10);

      // Get real memory if available (Chrome only)
      const memory = (performance as any).memory;
      if (memory) {
        const used = Math.round(memory.usedJSHeapSize / 1024 / 1024);
        const total = Math.round(memory.jsHeapSizeLimit / 1024 / 1024);
        setMemoryUsage(Math.round((used / total) * 100));
      } else {
        // Mock memory usage
        setMemoryUsage(Math.floor(Math.random() * 10) + 40);
      }

      // Get real network status
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

  return (
    <div className={`flex items-center gap-4 px-4 py-2 border-b text-xs font-mono ${isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
      <div className="flex items-center gap-1.5" title="CPU Usage">
        <Cpu size={14} className={cpuUsage > 80 ? 'text-red-500' : isDarkMode ? 'text-emerald-400' : 'text-emerald-600'} />
        <span>CPU: {cpuUsage}%</span>
      </div>
      <div className="flex items-center gap-1.5" title="Memory Usage">
        <HardDrive size={14} className={memoryUsage > 80 ? 'text-red-500' : isDarkMode ? 'text-blue-400' : 'text-blue-600'} />
        <span>MEM: {memoryUsage}%</span>
      </div>
      <div className="flex items-center gap-1.5" title="Network Status">
        <Wifi size={14} className={networkStatus === 'Offline' ? 'text-red-500' : isDarkMode ? 'text-indigo-400' : 'text-indigo-600'} />
        <span>NET: {networkStatus}</span>
      </div>
      <div className="flex items-center gap-1.5" title="Latency">
        <Activity size={14} className={ping > 100 ? 'text-yellow-500' : isDarkMode ? 'text-purple-400' : 'text-purple-600'} />
        <span>PING: {ping}ms</span>
      </div>
    </div>
  );
};
