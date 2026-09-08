import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Popup, Circle, useMap } from 'react-leaflet';
import { useTranslation } from 'react-i18next';
import Header from '../layout/Header.jsx';
import { getPfzLayer, sortZones } from '../../data/pfz.js';
import { SAMPLE_HAZARD_ZONES } from '../../data/hazards.js';
import { useLocationState } from '../../context/LocationContext.jsx';
import { TILE_URL, TILE_ATTRIBUTION, MANGALORE_FALLBACK } from '../../config/map.js';
import {
  Navigation,
  Sparkles,
  Compass,
  ShieldCheck,
  Thermometer,
  Leaf,
  ChevronDown,
  ChevronUp,
  MapPin
} from 'lucide-react';

function MapController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, zoom || 9, { animate: true });
      map.invalidateSize();
    }
  }, [center, zoom, map]);
  return null;
}

export default function PfzExplorationPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentLocation } = useLocationState();

  const activeLat = currentLocation?.lat || MANGALORE_FALLBACK[0];
  const activeLon = currentLocation?.lon || MANGALORE_FALLBACK[1];
  const activeName = currentLocation?.name || 'Mangalore Coastal Basin';
  const activeSector = currentLocation?.sector || 'Sector 7';

  const [filterType, setFilterType] = useState('yield'); // 'yield', 'nearest', 'safest'
  const [zones, setZones] = useState([]);
  const [selectedZone, setSelectedZone] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLiveBackend, setIsLiveBackend] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');
  const [expandedZoneId, setExpandedZoneId] = useState(null);

  useEffect(() => {
    async function loadPfz() {
      setIsLoading(true);
      try {
        const res = await getPfzLayer(activeLat, activeLon, { count: 12 });
        const sorted = sortZones(res.zones, filterType);
        setZones(sorted);
        setSelectedZone(sorted[0] || null);
        setIsLiveBackend(res.isLive);
        setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    loadPfz();
  }, [activeLat, activeLon]);

  const handleFilterChange = (type) => {
    setFilterType(type);
    const sorted = sortZones(zones, type);
    setZones(sorted);
    if (sorted.length > 0) {
      setSelectedZone(sorted[0]);
    }
  };

  const centerCoord = selectedZone ? [selectedZone.lat, selectedZone.lon] : [activeLat, activeLon];

  return (
    <div className="h-screen bg-orca-bg flex flex-col overflow-hidden">
      <Header />

      {/* Main layout with definite full-height parent (Fix A4.1) */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden relative">
        
        {/* ── Left Exploration Sidebar ── */}
        <div className="w-full md:w-[420px] lg:w-[440px] bg-orca-surface border-r border-orca-border flex flex-col h-full z-10 flex-shrink-0">
          
          {/* Header & Filter Pills */}
          <div className="p-4 border-b border-orca-border space-y-3 bg-orca-surface-2/20 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-orca-teal flex items-center gap-1">
                  <MapPin size={11} /> {activeSector} · {activeName.split(' ')[0]}
                </span>
                <h2 className="text-base font-extrabold text-white tracking-tight">
                  {t('pfz.title')}
                </h2>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${isLiveBackend ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'}`}>
                {isLiveBackend ? 'XGBoost Live ML' : 'Simulated Layer'}
              </span>
            </div>

            {/* Three Filter Pills: Nearest / Highest Yield / Safest */}
            <div className="flex items-center gap-1.5 bg-orca-bg/80 p-1 rounded-xl border border-orca-border">
              {[
                { type: 'yield', label: t('pfz.highest_yield'), icon: Sparkles },
                { type: 'nearest', label: t('pfz.nearest'), icon: Compass },
                { type: 'safest', label: t('pfz.safest'), icon: ShieldCheck },
              ].map(f => {
                const Icon = f.icon;
                const isActive = filterType === f.type;
                return (
                  <button
                    key={f.type}
                    onClick={() => handleFilterChange(f.type)}
                    className={`
                      flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold
                      transition-all duration-150
                      ${
                        isActive
                          ? 'bg-orca-teal text-orca-bg shadow-sm'
                          : 'text-orca-muted hover:text-white hover:bg-orca-surface'
                      }
                    `}
                  >
                    <Icon size={13} />
                    <span>{f.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Zones Scroll List */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
            {isLoading ? (
              <div className="py-20 text-center text-orca-muted text-xs">
                Synthesizing MODIS satellite telemetry & calculating ML predictions...
              </div>
            ) : zones.length === 0 ? (
              <div className="py-20 text-center text-orca-muted text-xs">
                No active fishing zones found in current sector.
              </div>
            ) : (
              zones.map((z, idx) => {
                const isSelected = selectedZone?.id === z.id;
                const isTop = idx === 0;
                const isExpanded = expandedZoneId === z.id;

                const gradeKey = z.predictedZone === 'BEST' ? 'best' : z.predictedZone === 'GOOD' ? 'good' : 'poor';
                const badgeClass =
                  z.predictedZone === 'BEST'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : z.predictedZone === 'GOOD'
                    ? 'bg-[#00D8FF]/20 text-[#00D8FF] border-[#00D8FF]/30'
                    : 'bg-amber-500/20 text-amber-400 border-amber-500/30';

                return (
                  <div
                    key={z.id}
                    onClick={() => setSelectedZone(z)}
                    className={`
                      p-3.5 rounded-xl border transition-all cursor-pointer relative space-y-2
                      ${
                        isSelected
                          ? 'bg-orca-surface-2 border-orca-teal shadow-lg shadow-orca-teal/10'
                          : 'bg-orca-surface border-orca-border hover:border-orca-teal/40'
                      }
                    `}
                  >
                    {isTop && (
                      <span className="absolute -top-2.5 right-4 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500 text-orca-bg shadow-sm">
                        Rank #1 Choice
                      </span>
                    )}

                    {/* Header Row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-white font-mono">{z.id}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeClass}`}>
                          {t(`badges.${gradeKey}`)}
                        </span>
                      </div>
                      <span className="text-[11px] font-bold text-orca-teal bg-orca-teal/10 px-2 py-0.5 rounded border border-orca-teal/20">
                        {z.sector || activeSector}
                      </span>
                    </div>

                    {/* Species & Distance */}
                    <div>
                      <p className="text-xs font-semibold text-white">
                        {z.expectedSpecies}
                      </p>
                      <p className="text-[11px] text-orca-muted mt-0.5">
                        <strong className="text-white">{z.sector}</strong> · {z.distanceNm} nm {z.bearing} ({z.distanceKm} km offshore)
                      </p>
                    </div>

                    {/* Expand Details Toggle (Part B) */}
                    <div className="flex items-center justify-between text-[11px] pt-1">
                      <span className="text-orca-muted flex items-center gap-2">
                        <span className="text-amber-400 font-medium">SST: {z.temperature}°C</span>
                        <span>•</span>
                        <span className="text-emerald-400 font-medium">Chl: {z.chlorophyll}</span>
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedZoneId(isExpanded ? null : z.id);
                        }}
                        className="text-orca-teal text-[10px] font-semibold hover:underline flex items-center gap-0.5"
                      >
                        <span>{isExpanded ? 'Less' : t('pfz.details')}</span>
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    </div>

                    {/* Expanded Technical Proof */}
                    {isExpanded && (
                      <div className="p-2.5 bg-orca-bg/80 rounded-lg border border-orca-border text-[10px] text-orca-muted space-y-1">
                        <div>Model Confidence: <strong className="text-white">{z.confidence}%</strong> ({z.predictedZone})</div>
                        <div>Coordinates: <strong className="text-white font-mono">{z.lat.toFixed(4)}°N, {z.lon.toFixed(4)}°E</strong></div>
                        <div>Current Velocity: <strong className="text-white">{z.currentSpeed} m/s</strong></div>
                      </div>
                    )}

                    {/* Route Choice on EVERY Card (Fix A4.2) */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/route?dest=${encodeURIComponent(z.id)}&lat=${z.lat}&lon=${z.lon}`);
                      }}
                      className="
                        w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold
                        bg-orca-teal text-orca-bg hover:bg-orca-teal/90 active:scale-[0.98]
                        transition-all shadow-sm
                      "
                    >
                      <Navigation size={12} />
                      <span>{t('pfz.plot_route')}</span>
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Bottom Advisory Bar */}
          <div className="p-3 bg-orca-bg border-t border-orca-border text-[11px] text-orca-muted flex-shrink-0">
            <span className="text-white font-semibold">ORCA Advisory:</span> {zones.length} zones identified for {activeName}.
            <div className="text-[10px] text-orca-teal/90 mt-0.5">
              Updated {lastUpdated} via ORCA XGBoost model (not INCOIS-certified).
            </div>
          </div>
        </div>

        {/* ── Right Live Leaflet Map Panel (Guaranteed Full Height & Visible) ── */}
        <div className="flex-1 min-h-0 h-full relative bg-orca-bg">
          <MapContainer
            center={centerCoord}
            zoom={9}
            className="w-full h-full"
            zoomControl={false}
          >
            <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
            <MapController center={centerCoord} zoom={selectedZone ? 10 : 9} />

            {/* Base Reference Marker */}
            <CircleMarker
              center={[activeLat, activeLon]}
              radius={8}
              pathOptions={{ color: '#00D8FF', fillColor: '#00D8FF', fillOpacity: 0.9, weight: 3 }}
            >
              <Popup>
                <div className="text-xs">
                  <strong>{activeName}</strong>
                  <p>Base Harbor Reference</p>
                </div>
              </Popup>
            </CircleMarker>

            {/* PFZ Zones */}
            {zones.map(z => {
              const isSelected = selectedZone?.id === z.id;
              const color = z.predictedZone === 'BEST' ? '#10B981' : z.predictedZone === 'GOOD' ? '#00D8FF' : '#F59E0B';

              return (
                <React.Fragment key={z.id}>
                  {isSelected && (
                    <Circle
                      center={[z.lat, z.lon]}
                      radius={10000}
                      pathOptions={{ color: '#00D8FF', fillColor: '#00D8FF', fillOpacity: 0.15, dashArray: '4, 4' }}
                    />
                  )}

                  <CircleMarker
                    center={[z.lat, z.lon]}
                    radius={isSelected ? 10 : 7}
                    pathOptions={{
                      color: isSelected ? '#FFFFFF' : color,
                      fillColor: color,
                      fillOpacity: 0.95,
                      weight: isSelected ? 3 : 2,
                    }}
                    eventHandlers={{
                      click: () => setSelectedZone(z),
                    }}
                  >
                    <Popup>
                      <div className="text-xs space-y-1">
                        <strong className="text-cyan-600 block font-bold">{z.id} · {z.sector}</strong>
                        <p>{z.expectedSpecies}</p>
                        <p className="text-gray-500 font-mono text-[10px]">
                          SST: {z.temperature}°C · Chl: {z.chlorophyll}
                        </p>
                        <button
                          onClick={() => navigate(`/route?dest=${encodeURIComponent(z.id)}&lat=${z.lat}&lon=${z.lon}`)}
                          className="mt-1 w-full bg-cyan-600 text-white text-[10px] font-bold py-1 px-2 rounded"
                        >
                          Plot Route to this Zone
                        </button>
                      </div>
                    </Popup>
                  </CircleMarker>
                </React.Fragment>
              );
            })}

            {/* Hazard Alert Overlays */}
            {SAMPLE_HAZARD_ZONES.map(h => (
              <Circle
                key={h.id}
                center={[h.lat, h.lon]}
                radius={(h.radiusKm || 30) * 1000}
                pathOptions={{
                  color: h.color,
                  fillColor: h.fillColor,
                  fillOpacity: h.fillOpacity,
                  weight: 1.5,
                  dashArray: '6, 6',
                }}
              >
                <Popup>
                  <div className="text-xs p-1">
                    <strong className="text-red-500">{h.type}</strong>
                    <p>{h.title}</p>
                  </div>
                </Popup>
              </Circle>
            ))}
          </MapContainer>

          {/* Floating Map Legend */}
          <div className="absolute top-4 right-4 bg-orca-surface/90 backdrop-blur border border-orca-border p-3 rounded-xl shadow-xl z-[400] text-xs space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-orca-muted block">Map Legend</span>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-white text-[11px]">{t('badges.best')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#00D8FF]" />
              <span className="text-white text-[11px]">{t('badges.good')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-white text-[11px]">{t('badges.poor')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500/40 border border-red-500" />
              <span className="text-white text-[11px]">{t('badges.critical')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
