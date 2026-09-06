import { useState } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { INDIA_CENTER, INDIA_ZOOM, NOMINATIM_URL, NOMINATIM_UA } from '../../config/map.js';
import { MessageSquare, Map, BarChart3, Shield, Search } from 'lucide-react';

/**
 * Top navigation bar for the /maps route.
 * mapRef is a ref to the Leaflet map instance, forwarded from MapArea.
 * This component does NOT use any react-leaflet hooks — it lives outside MapContainer.
 */
export default function MapsTopNav({ mapRef }) {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  function handleHome() {
    mapRef.current?.flyTo(INDIA_CENTER, INDIA_ZOOM, { duration: 1.2 });
  }

  async function handleSearch(e) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    try {
      const url = `${NOMINATIM_URL}?format=json&q=${encodeURIComponent(searchQuery)}&limit=1&countrycodes=in`;
      const res = await fetch(url, { headers: { 'User-Agent': NOMINATIM_UA } });
      const data = await res.json();
      if (data.length > 0) {
        const { lat, lon } = data[0];
        mapRef.current?.flyTo([parseFloat(lat), parseFloat(lon)], 9, { duration: 1.5 });
      }
    } catch {
      console.warn('Nominatim search failed');
    }
  }

  return (
    <div className="flex items-center justify-between px-4 py-2.5 bg-orca-surface border-b border-orca-border flex-shrink-0 z-50">
      {/* Wordmark + breadcrumb */}
      <div 
        onClick={() => navigate('/')} 
        className="flex items-center gap-2 cursor-pointer"
      >
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orca-teal to-teal-700 flex items-center justify-center shadow-md">
          <span className="text-orca-bg font-extrabold text-sm leading-none">O</span>
        </div>
        <span className="text-white font-extrabold text-base tracking-tight">ORCA</span>
        <span className="text-orca-muted text-xs hidden sm:inline">/ Marine Maps</span>
      </div>

      {/* Center Nav Tabs */}
      <div className="hidden md:flex items-center gap-1 bg-orca-bg/80 p-1 rounded-xl border border-orca-border">
        <NavLink
          to="/chat"
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold text-orca-muted hover:text-white hover:bg-orca-surface transition-all"
        >
          <MessageSquare size={13} />
          <span>Chat</span>
        </NavLink>
        <NavLink
          to="/maps"
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-orca-teal text-orca-bg shadow-sm"
        >
          <Map size={13} />
          <span>Maps</span>
        </NavLink>
        <NavLink
          to="/analytics"
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold text-orca-muted hover:text-white hover:bg-orca-surface transition-all"
        >
          <BarChart3 size={13} />
          <span>Analytics</span>
        </NavLink>
        <NavLink
          to="/dashboard"
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold text-orca-muted hover:text-white hover:bg-orca-surface transition-all"
        >
          <Shield size={13} />
          <span>Dashboard</span>
        </NavLink>
      </div>

      {/* Right side controls */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <form onSubmit={handleSearch} className="flex items-center">
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-orca-muted select-none">
              <Search size={13} />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ports/places..."
              className="
                pl-7 pr-3 py-1.5 rounded-xl text-xs w-44 sm:w-52
                bg-orca-bg border border-orca-border text-white placeholder-orca-muted
                focus:outline-none focus:border-orca-teal/50 focus:ring-1 focus:ring-orca-teal/30
                transition-colors duration-150
              "
            />
          </div>
        </form>

        {/* Reset View */}
        <button
          onClick={handleHome}
          className="
            px-3 py-1.5 rounded-xl text-xs font-medium
            bg-orca-bg border border-orca-border text-white
            hover:bg-orca-surface hover:border-orca-teal/40 transition-all duration-150
          "
        >
          Reset View
        </button>
      </div>
    </div>
  );
}
