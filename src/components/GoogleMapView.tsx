import React, { useState, useEffect, useRef } from 'react';
import { 
  APIProvider, 
  Map, 
  AdvancedMarker, 
  Pin, 
  InfoWindow, 
  useMap, 
  useMapsLibrary, 
  useAdvancedMarkerRef 
} from '@vis.gl/react-google-maps';
import { 
  MapPin, Navigation, Search, Star, ExternalLink, Phone, Clock, 
  Compass, Layers, Car, Footprints, Bus, Bike, RefreshCw, Key, 
  Check, Sparkles, X, Globe, DollarSign, MessageSquare
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export interface PlaceResult {
  id: string;
  name: string;
  formattedAddress?: string;
  location: { lat: number; lng: number };
  rating?: number;
  userRatingCount?: number;
  photoUrl?: string;
  websiteUri?: string;
  phone?: string;
  googleMapsUri?: string;
  types?: string[];
  isOpen?: boolean;
  priceLevel?: string;
  summary?: string;
}

interface GoogleMapViewProps {
  searchQuery?: string;
  onPlaceSelect?: (place: PlaceResult) => void;
  onAskAboutPlace?: (placeName: string, address?: string) => void;
  height?: string;
}

// Inner map handler component for search & routes
const MapContent: React.FC<{
  query: string;
  places: PlaceResult[];
  setPlaces: React.Dispatch<React.SetStateAction<PlaceResult[]>>;
  selectedPlace: PlaceResult | null;
  setSelectedPlace: (place: PlaceResult | null) => void;
  userLocation: { lat: number; lng: number } | null;
  routeDestination: PlaceResult | null;
  setRouteDestination: (place: PlaceResult | null) => void;
  travelMode: 'DRIVING' | 'WALKING' | 'TRANSIT' | 'BICYCLING';
  onAskAboutPlace?: (placeName: string, address?: string) => void;
}> = ({
  query,
  places,
  setPlaces,
  selectedPlace,
  setSelectedPlace,
  userLocation,
  routeDestination,
  setRouteDestination,
  travelMode,
  onAskAboutPlace
}) => {
  const map = useMap();
  const placesLib = useMapsLibrary('places');
  const routesLib = useMapsLibrary('routes');

  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  // Search places whenever query or placesLib changes
  useEffect(() => {
    if (!placesLib || !query.trim()) return;

    const performSearch = async () => {
      try {
        const center = map?.getCenter();
        const locationBias = center 
          ? { lat: center.lat(), lng: center.lng() } 
          : userLocation || { lat: 37.7749, lng: -122.4194 };

        const response = await placesLib.Place.searchByText({
          textQuery: query,
          fields: [
            'id',
            'displayName',
            'location',
            'formattedAddress',
            'rating',
            'userRatingCount',
            'photos',
            'websiteURI',
            'nationalPhoneNumber',
            'googleMapsURI',
            'regularOpeningHours',
            'priceLevel',
            'types',
            'editorialSummary'
          ],
          locationBias,
          maxResultCount: 12
        });

        if (response.places && response.places.length > 0) {
          const bounds = new google.maps.LatLngBounds();
          const mappedPlaces: PlaceResult[] = response.places.map((p) => {
            const loc = p.location 
              ? { lat: p.location.lat(), lng: p.location.lng() } 
              : { lat: 37.7749, lng: -122.4194 };
            bounds.extend(loc);

            let photoUrl: string | undefined;
            if (p.photos && p.photos.length > 0) {
              try {
                photoUrl = p.photos[0].getURI({ maxWidth: 400, maxHeight: 300 });
              } catch (e) {
                console.warn('Could not get photo URI:', e);
              }
            }

            return {
              id: p.id || Math.random().toString(),
              name: p.displayName || 'Unknown Place',
              formattedAddress: p.formattedAddress,
              location: loc,
              rating: p.rating,
              userRatingCount: p.userRatingCount,
              photoUrl,
              websiteUri: p.websiteURI,
              phone: p.nationalPhoneNumber,
              googleMapsUri: p.googleMapsURI,
              isOpen: (p.regularOpeningHours as any)?.isOpen !== undefined ? (typeof (p.regularOpeningHours as any).isOpen === 'function' ? (p.regularOpeningHours as any).isOpen() : (p.regularOpeningHours as any).isOpen) : undefined,
              types: p.types,
              summary: p.editorialSummary
            };
          });

          setPlaces(mappedPlaces);

          if (map) {
            if (mappedPlaces.length === 1) {
              map.panTo(mappedPlaces[0].location);
              map.setZoom(15);
            } else {
              map.fitBounds(bounds, { top: 60, bottom: 60, left: 60, right: 60 });
            }
          }
        }
      } catch (err) {
        console.error('Places API Search Error:', err);
      }
    };

    performSearch();
  }, [placesLib, query]);

  // Compute routes when routeDestination is active
  useEffect(() => {
    if (!routesLib || !map || !routeDestination || !userLocation) {
      polylinesRef.current.forEach(p => p.setMap(null));
      polylinesRef.current = [];
      setRouteInfo(null);
      return;
    }

    // Clear existing polylines
    polylinesRef.current.forEach(p => p.setMap(null));
    polylinesRef.current = [];

    routesLib.Route.computeRoutes({
      origin: userLocation,
      destination: routeDestination.location,
      travelMode: travelMode as any,
      fields: ['path', 'distanceMeters', 'durationMillis', 'viewport']
    }).then(({ routes }) => {
      if (routes && routes[0]) {
        const route = routes[0];
        const newPolylines = route.createPolylines();
        newPolylines.forEach(p => p.setMap(map));
        polylinesRef.current = newPolylines;

        if (route.viewport) {
          map.fitBounds(route.viewport, { top: 80, bottom: 80, left: 80, right: 80 });
        }

        // Format distance & duration
        const distKm = (route.distanceMeters ? route.distanceMeters / 1000 : 0).toFixed(1);
        const durMins = Math.round((route.durationMillis || 0) / 60000);
        setRouteInfo({
          distance: `${distKm} km`,
          duration: `${durMins} min`
        });
      }
    }).catch(err => {
      console.error('Route computation error:', err);
    });

    return () => {
      polylinesRef.current.forEach(p => p.setMap(null));
    };
  }, [routesLib, map, routeDestination, userLocation, travelMode]);

  return (
    <>
      {/* Route Info Badge Overlay */}
      {routeDestination && routeInfo && (
        <div className="absolute top-4 left-4 z-20 bg-slate-900/90 backdrop-blur-md text-white border border-cyan-500/30 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-4">
          <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400">
            <Navigation size={20} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-cyan-300">Route to {routeDestination.name}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400">
                {travelMode}
              </span>
            </div>
            <p className="text-xs text-slate-300 font-mono mt-0.5">
              ⏱️ <span className="text-white font-bold">{routeInfo.duration}</span> ({routeInfo.distance})
            </p>
          </div>
          <button
            onClick={() => setRouteDestination(null)}
            className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            title="Cancel Route"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* User Location Marker */}
      {userLocation && (
        <AdvancedMarker position={userLocation} title="Your Location">
          <div className="relative flex items-center justify-center">
            <div className="absolute w-8 h-8 bg-cyan-500/30 rounded-full animate-ping" />
            <div className="w-5 h-5 rounded-full bg-cyan-500 border-2 border-white shadow-lg flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-white" />
            </div>
          </div>
        </AdvancedMarker>
      )}

      {/* Place Markers */}
      {places.map((place) => {
        const isSelected = selectedPlace?.id === place.id;
        return (
          <MarkerWithInfoWindow
            key={place.id}
            place={place}
            isSelected={isSelected}
            onSelect={() => {
              setSelectedPlace(place);
              if (map) {
                map.panTo(place.location);
              }
            }}
            onClose={() => setSelectedPlace(null)}
            onGetDirections={() => {
              setRouteDestination(place);
              if (map && userLocation) {
                map.panTo(place.location);
              }
            }}
            onAskAboutPlace={onAskAboutPlace}
          />
        );
      })}
    </>
  );
};

// Marker + InfoWindow item
const MarkerWithInfoWindow: React.FC<{
  place: PlaceResult;
  isSelected: boolean;
  onSelect: () => void;
  onClose: () => void;
  onGetDirections: () => void;
  onAskAboutPlace?: (placeName: string, address?: string) => void;
}> = ({ place, isSelected, onSelect, onClose, onGetDirections, onAskAboutPlace }) => {
  const [markerRef, marker] = useAdvancedMarkerRef();

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={place.location}
        title={place.name}
        onClick={onSelect}
      >
        <Pin
          background={isSelected ? '#06b6d4' : '#ef4444'}
          glyphColor="#ffffff"
          borderColor={isSelected ? '#0891b2' : '#dc2626'}
          scale={isSelected ? 1.25 : 1.0}
        />
      </AdvancedMarker>

      {isSelected && marker && (
        <InfoWindow anchor={marker} onCloseClick={onClose}>
          <div className="p-1 max-w-xs text-slate-900 font-sans">
            {place.photoUrl && (
              <img
                src={place.photoUrl}
                alt={place.name}
                className="w-full h-28 object-cover rounded-lg mb-2"
                referrerPolicy="no-referrer"
              />
            )}
            
            <div className="flex items-start justify-between gap-2 mb-1">
              <h4 className="font-bold text-sm text-slate-900 leading-snug">{place.name}</h4>
              {place.rating !== undefined && (
                <div className="flex items-center gap-1 text-xs font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded shrink-0">
                  <Star size={12} className="fill-amber-500 text-amber-500" />
                  <span>{place.rating}</span>
                </div>
              )}
            </div>

            {place.formattedAddress && (
              <p className="text-[11px] text-slate-600 mb-2 leading-tight flex items-start gap-1">
                <MapPin size={12} className="shrink-0 text-slate-400 mt-0.5" />
                <span>{place.formattedAddress}</span>
              </p>
            )}

            <div className="flex flex-wrap gap-2 text-[11px] pt-2 border-t border-slate-100 mt-2">
              <button
                onClick={onGetDirections}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded-lg transition-colors cursor-pointer"
              >
                <Navigation size={12} />
                <span>Directions</span>
              </button>

              {onAskAboutPlace && (
                <button
                  onClick={() => onAskAboutPlace(place.name, place.formattedAddress)}
                  className="flex items-center justify-center gap-1 py-1.5 px-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors cursor-pointer"
                  title="Ask AI Chat about this place"
                >
                  <MessageSquare size={12} />
                  <span>Ask AI</span>
                </button>
              )}

              {place.googleMapsUri && (
                <a
                  href={place.googleMapsUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors flex items-center justify-center"
                  title="Open in Google Maps"
                >
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
};

export const GoogleMapView: React.FC<GoogleMapViewProps> = ({
  searchQuery = '',
  onPlaceSelect,
  onAskAboutPlace,
  height = '100%'
}) => {
  const { isDarkMode } = useTheme();

  // Retrieve API Key
  const [customKey, setCustomKey] = useState<string>(() => localStorage.getItem('omnichat_gmaps_key') || '');
  const API_KEY =
    process.env.GOOGLE_MAPS_PLATFORM_KEY ||
    (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
    (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
    customKey ||
    '';

  const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

  // Local state
  const [inputQuery, setInputQuery] = useState(searchQuery);
  const [activeSearchQuery, setActiveSearchQuery] = useState(searchQuery);
  const [places, setPlaces] = useState<PlaceResult[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [routeDestination, setRouteDestination] = useState<PlaceResult | null>(null);
  const [travelMode, setTravelMode] = useState<'DRIVING' | 'WALKING' | 'TRANSIT' | 'BICYCLING'>('DRIVING');
  const [mapType, setMapType] = useState<'roadmap' | 'satellite' | 'hybrid' | 'terrain'>('roadmap');

  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyInputValue, setKeyInputValue] = useState('');

  // Sync prop searchQuery
  useEffect(() => {
    if (searchQuery) {
      setInputQuery(searchQuery);
      setActiveSearchQuery(searchQuery);
    }
  }, [searchQuery]);

  // Request user current location on mount
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => {
          console.log('Location access denied, using default center.');
          setUserLocation({ lat: 37.7749, lng: -122.4194 }); // SF default
        }
      );
    } else {
      setUserLocation({ lat: 37.7749, lng: -122.4194 });
    }
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputQuery.trim()) {
      setActiveSearchQuery(inputQuery.trim());
    }
  };

  const categories = [
    { label: 'Restaurants', icon: '🍽️', query: 'Restaurants' },
    { label: 'Cafes', icon: '☕', query: 'Coffee shops' },
    { label: 'Hotels', icon: '🏨', query: 'Hotels' },
    { label: 'Gas', icon: '⛽', query: 'Gas stations' },
    { label: 'Parks', icon: '🏞️', query: 'Parks' },
    { label: 'Attractions', icon: '🎡', query: 'Tourist attractions' },
    { label: 'Hospitals', icon: '🏥', query: 'Hospitals' },
  ];

  // API Key missing splash banner / setup modal
  if (!hasValidKey) {
    return (
      <div className={`w-full h-full flex flex-col items-center justify-center p-6 text-center overflow-y-auto ${
        isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'
      }`}>
        <div className="max-w-lg w-full p-8 rounded-3xl border border-cyan-500/30 bg-black/40 backdrop-blur-xl shadow-2xl space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto border border-cyan-500/30">
            <Key size={32} />
          </div>

          <div>
            <h2 className="text-2xl font-bold tracking-tight">Google Maps API Key Required</h2>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              To render interactive vector maps, place markers, and directions routing, please provide a valid Google Maps Platform API key.
            </p>
          </div>

          {/* Quick Instant Key Tester Box */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3 text-left">
            <label className="text-xs font-bold text-cyan-300 block">Instant Key Setup (Persists in Browser)</label>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="AIzaSy..."
                value={keyInputValue}
                onChange={(e) => setKeyInputValue(e.target.value)}
                className="flex-1 p-2.5 rounded-xl border border-white/20 bg-black/50 text-xs text-white outline-none focus:border-cyan-400 font-mono"
              />
              <button
                onClick={() => {
                  if (keyInputValue.trim()) {
                    localStorage.setItem('omnichat_gmaps_key', keyInputValue.trim());
                    setCustomKey(keyInputValue.trim());
                  }
                }}
                className="px-4 py-2.5 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs hover:bg-cyan-400 transition-colors cursor-pointer shrink-0"
              >
                Save Key
              </button>
            </div>
          </div>

          <div className="text-left text-xs text-slate-300 space-y-2 border-t border-white/10 pt-4">
            <p className="font-bold text-white">To set up permanently via AI Studio Secrets:</p>
            <ol className="list-decimal list-inside space-y-1 text-slate-400">
              <li>Get a free key from <a href="https://console.cloud.google.com/google/maps-apis/start?utm_campaign=gmp-code-assist-ais" target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline font-semibold">Google Maps Platform Console</a></li>
              <li>Open <strong>Settings ⚙️</strong> in the top-right corner → <strong>Secrets</strong></li>
              <li>Add key name: <code className="bg-white/10 text-cyan-300 px-1.5 py-0.5 rounded">GOOGLE_MAPS_PLATFORM_KEY</code></li>
              <li>Paste your API key and press Enter.</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  const defaultCenter = userLocation || { lat: 37.7749, lng: -122.4194 };

  return (
    <APIProvider apiKey={API_KEY} version="weekly">
      <div className="relative w-full h-full flex flex-col overflow-hidden bg-slate-900" style={{ height }}>
        
        {/* Top Floating Search Bar & Controls */}
        <div className="absolute top-4 left-4 right-4 z-10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pointer-events-none">
          
          {/* Search Form */}
          <form
            onSubmit={handleSearchSubmit}
            className="flex-1 max-w-md flex items-center gap-2 bg-slate-900/90 backdrop-blur-md border border-white/15 p-1.5 rounded-2xl shadow-xl pointer-events-auto"
          >
            <Search size={18} className="ml-2 text-cyan-400 shrink-0" />
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Search places on Google Maps..."
              className="flex-1 bg-transparent text-xs text-white placeholder-slate-400 outline-none"
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer shrink-0"
            >
              Search
            </button>
          </form>

          {/* Map Controls */}
          <div className="flex items-center gap-2 pointer-events-auto self-end sm:self-auto">
            {/* Travel Mode Pills if routing */}
            {routeDestination && (
              <div className="flex items-center bg-slate-900/90 backdrop-blur-md border border-white/15 p-1 rounded-2xl shadow-xl text-white">
                <button
                  onClick={() => setTravelMode('DRIVING')}
                  className={`p-2 rounded-xl transition-colors ${travelMode === 'DRIVING' ? 'bg-cyan-500 text-slate-950' : 'hover:bg-white/10'}`}
                  title="Driving"
                >
                  <Car size={16} />
                </button>
                <button
                  onClick={() => setTravelMode('WALKING')}
                  className={`p-2 rounded-xl transition-colors ${travelMode === 'WALKING' ? 'bg-cyan-500 text-slate-950' : 'hover:bg-white/10'}`}
                  title="Walking"
                >
                  <Footprints size={16} />
                </button>
                <button
                  onClick={() => setTravelMode('TRANSIT')}
                  className={`p-2 rounded-xl transition-colors ${travelMode === 'TRANSIT' ? 'bg-cyan-500 text-slate-950' : 'hover:bg-white/10'}`}
                  title="Transit"
                >
                  <Bus size={16} />
                </button>
                <button
                  onClick={() => setTravelMode('BICYCLING')}
                  className={`p-2 rounded-xl transition-colors ${travelMode === 'BICYCLING' ? 'bg-cyan-500 text-slate-950' : 'hover:bg-white/10'}`}
                  title="Bicycling"
                >
                  <Bike size={16} />
                </button>
              </div>
            )}

            {/* Locate Me */}
            <button
              onClick={() => {
                if ('geolocation' in navigator) {
                  navigator.geolocation.getCurrentPosition((pos) => {
                    const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                    setUserLocation(loc);
                  });
                }
              }}
              className="p-2.5 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-white/15 text-cyan-400 hover:text-white hover:bg-white/10 shadow-xl transition-colors cursor-pointer"
              title="Recenter on My Location"
            >
              <Compass size={18} />
            </button>
          </div>
        </div>

        {/* Quick Category Pills Bar */}
        <div className="absolute top-20 left-4 right-4 z-10 flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar pointer-events-auto">
          {categories.map((cat) => (
            <button
              key={cat.label}
              onClick={() => {
                setInputQuery(cat.query);
                setActiveSearchQuery(cat.query);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shadow-lg backdrop-blur-md border ${
                activeSearchQuery === cat.query
                  ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-bold'
                  : 'bg-slate-900/80 text-slate-200 border-white/15 hover:bg-slate-800'
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Google Map Container */}
        <Map
          defaultCenter={defaultCenter}
          defaultZoom={13}
          mapId="DEMO_MAP_ID"
          mapTypeId={mapType}
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          style={{ width: '100%', height: '100%' }}
          gestureHandling="greedy"
          disableDefaultUI={false}
        >
          <MapContent
            query={activeSearchQuery}
            places={places}
            setPlaces={setPlaces}
            selectedPlace={selectedPlace}
            setSelectedPlace={(p) => {
              setSelectedPlace(p);
              if (p && onPlaceSelect) onPlaceSelect(p);
            }}
            userLocation={userLocation}
            routeDestination={routeDestination}
            setRouteDestination={setRouteDestination}
            travelMode={travelMode}
            onAskAboutPlace={onAskAboutPlace}
          />
        </Map>

        {/* Bottom Places Carousel / Drawer */}
        {places.length > 0 && (
          <div className="absolute bottom-4 left-4 right-4 z-10 flex items-center gap-3 overflow-x-auto pb-2 pt-2 px-1 hide-scrollbar">
            {places.map((place) => {
              const isSelected = selectedPlace?.id === place.id;
              return (
                <div
                  key={place.id}
                  onClick={() => setSelectedPlace(place)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer shrink-0 w-64 shadow-xl backdrop-blur-md ${
                    isSelected
                      ? 'bg-cyan-950/90 border-cyan-400 text-white shadow-cyan-500/20'
                      : 'bg-slate-900/90 border-white/15 text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h5 className="font-bold text-xs truncate flex-1">{place.name}</h5>
                    {place.rating && (
                      <span className="text-[10px] font-bold text-amber-400 flex items-center gap-0.5">
                        <Star size={10} className="fill-amber-400" />
                        {place.rating}
                      </span>
                    )}
                  </div>
                  {place.formattedAddress && (
                    <p className="text-[10px] text-slate-400 truncate mb-2">{place.formattedAddress}</p>
                  )}
                  <div className="flex items-center justify-between text-[10px] pt-1.5 border-t border-white/10">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setRouteDestination(place);
                      }}
                      className="text-cyan-400 font-bold hover:underline flex items-center gap-1"
                    >
                      <Navigation size={10} />
                      <span>Directions</span>
                    </button>
                    {onAskAboutPlace && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAskAboutPlace(place.name, place.formattedAddress);
                        }}
                        className="text-indigo-300 hover:underline flex items-center gap-1"
                      >
                        <MessageSquare size={10} />
                        <span>Chat</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </APIProvider>
  );
};
