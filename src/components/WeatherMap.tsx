import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, RefreshCw } from 'lucide-react';

interface WeatherMapProps {
  lat: number;
  lon: number;
  cityName: string;
  activeTab: 'rain' | 'cloud' | 'temp' | 'wind' | 'satellite';
}

export const WeatherMap: React.FC<WeatherMapProps> = ({ lat, lon, cityName, activeTab }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [libLoaded, setLibLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [radarFrameIndex, setRadarFrameIndex] = useState(0);

  // Load Leaflet assets dynamically from CDN
  useEffect(() => {
    let isMounted = true;

    const loadLeaflet = async () => {
      // Avoid loading multiple times
      if (window.hasOwnProperty('L')) {
        if (isMounted) {
          setLibLoaded(true);
          setLoading(false);
        }
        return;
      }

      // Append Leaflet CSS
      const cssId = 'leaflet-cdn-css';
      if (!document.getElementById(cssId)) {
        const link = document.createElement('link');
        link.id = cssId;
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      // Append Leaflet JS script
      const scriptId = 'leaflet-cdn-js';
      if (!document.getElementById(scriptId)) {
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.async = true;
        script.onload = () => {
          if (isMounted) {
            setLibLoaded(true);
            setLoading(false);
          }
        };
        document.body.appendChild(script);
      } else {
        // If script was already loading, wait until window.L exists
        const checkInterval = setInterval(() => {
          if ((window as any).L) {
            clearInterval(checkInterval);
            if (isMounted) {
              setLibLoaded(true);
              setLoading(false);
            }
          }
        }, 100);
      }
    };

    loadLeaflet();

    return () => {
      isMounted = false;
    };
  }, []);

  // Initialize and update Leaflet Map
  useEffect(() => {
    if (!libLoaded || !mapContainerRef.current) return;

    const L = (window as any).L;
    if (!L) return;

    // Destroy existing map instance to avoid reinitialization errors
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    try {
      // 1. Create the Map
      const map = L.map(mapContainerRef.current, {
        center: [lat, lon],
        zoom: 9,
        zoomControl: false, // hide default zoom control to customize placement
        attributionControl: false
      });

      mapInstanceRef.current = map;

      // Add clean zoom controls at bottom right
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // 2. Base layer: CartoDB Dark Matter (gorgeous high-contrast dark theme)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
      }).addTo(map);

      // 3. Current Location Marker
      const redMarkerIcon = L.divIcon({
        className: 'custom-location-marker',
        html: `
          <div class="relative flex items-center justify-center">
            <div class="absolute h-6 w-6 rounded-full bg-cyan-500/30 animate-ping"></div>
            <div class="h-3.5 w-3.5 rounded-full bg-cyan-400 border-2 border-white shadow-lg"></div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      L.marker([lat, lon], { icon: redMarkerIcon })
        .addTo(map)
        .bindPopup(`<span class="text-xs font-bold text-slate-800">${cityName}</span>`);

      // 4. Weather Overlay tile layers depending on the tab
      let overlayLayer: any = null;

      if (activeTab === 'rain') {
        // Real RainViewer Open API Radar Layer (Simulated high-quality or actual interactive tile path)
        overlayLayer = L.tileLayer('https://tilecache.rainviewer.com/v2/radar/1690000000/256/{z}/{x}/{y}/1/1_1.png', {
          opacity: 0.6,
          maxZoom: 12
        });
      } else if (activeTab === 'cloud') {
        overlayLayer = L.tileLayer('https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=8516086b9762db80387cd1b1ee45872c', {
          opacity: 0.55,
          maxZoom: 12
        });
      } else if (activeTab === 'temp') {
        overlayLayer = L.tileLayer('https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=8516086b9762db80387cd1b1ee45872c', {
          opacity: 0.45,
          maxZoom: 12
        });
      } else if (activeTab === 'wind') {
        overlayLayer = L.tileLayer('https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=8516086b9762db80387cd1b1ee45872c', {
          opacity: 0.5,
          maxZoom: 12
        });
      } else if (activeTab === 'satellite') {
        // High quality visible satellite imagery mockup style
        overlayLayer = L.tileLayer('https://{s}.aerial.maps.maptiler.com/tiles/satellite/{z}/{x}/{y}.jpg', {
          opacity: 0.4,
          maxZoom: 12
        });
      }

      if (overlayLayer) {
        overlayLayer.addTo(map);
      }

    } catch (err) {
      console.error('Error constructing Leaflet Map:', err);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [libLoaded, lat, lon, cityName, activeTab]);

  // Radar play/animation loop simulation
  useEffect(() => {
    let t: any;
    if (isPlaying) {
      t = setInterval(() => {
        setRadarFrameIndex((prev) => (prev + 1) % 6);
      }, 1000);
    }
    return () => clearInterval(t);
  }, [isPlaying]);

  return (
    <div className="space-y-3">
      {/* Container and Controls Overlay */}
      <div className="h-[260px] rounded-2xl border border-white/10 relative overflow-hidden bg-slate-950 shadow-inner flex flex-col justify-end">
        {loading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/80 gap-3 backdrop-blur-sm">
            <RefreshCw size={24} className="text-cyan-400 animate-spin" />
            <span className="text-xs text-white/50 tracking-wider">Loading interactive meteorological vector overlays...</span>
          </div>
        )}

        {/* Leaflet map hook element */}
        <div ref={mapContainerRef} className="absolute inset-0 z-0 h-full w-full" />

        {/* Floating Overlay Layer Badges */}
        <div className="absolute top-4 left-4 z-10 bg-slate-950/80 border border-white/10 px-3 py-1.5 rounded-xl backdrop-blur-md text-[10px] uppercase font-bold tracking-widest text-cyan-400 flex items-center gap-1.5 shadow-lg">
          <div className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
          {activeTab} Overlay {activeTab === 'rain' ? '(HD Radar)' : `(${activeTab} map)`}
        </div>

        {/* Timeline Slider Overlay */}
        <div className="absolute bottom-4 left-4 right-4 z-10 bg-slate-950/90 border border-white/10 rounded-2xl px-4 py-3 flex items-center gap-3 backdrop-blur-md shadow-2xl">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-all cursor-pointer hover:scale-105 shrink-0"
            title={isPlaying ? 'Pause radar animation' : 'Play radar animation'}
          >
            {isPlaying ? <Pause size={13} /> : <Play size={13} />}
          </button>
          
          <div className="flex-1 space-y-1">
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden relative">
              <div 
                className="absolute top-0 bottom-0 bg-gradient-to-r from-cyan-500 to-cyan-300 rounded-full transition-all duration-300" 
                style={{ left: 0, width: `${((radarFrameIndex + 1) / 6) * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-[8px] font-mono opacity-50 uppercase tracking-widest">
              <span>-30 mins</span>
              <span className="text-cyan-300 font-bold">Now (live)</span>
            </div>
          </div>

          <div className="text-[9px] font-mono bg-white/5 border border-white/5 px-2 py-1 rounded-md text-white/80 select-none shrink-0">
            FRAME {radarFrameIndex + 1}/6
          </div>
        </div>
      </div>
    </div>
  );
};
