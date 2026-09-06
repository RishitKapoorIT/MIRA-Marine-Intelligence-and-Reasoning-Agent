import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Popup, Circle, useMap } from 'react-leaflet';
import Header from '../layout/Header.jsx';
import { getPfzLayer, sortZones } from '../../data/pfz.js';
import { SAMPLE_HAZARD_ZONES } from '../../data/hazards.js';
import { TILE_URL, TILE_ATTRIBUTION, MANGALORE_FALLBACK } from '../../config/map.js';
import { Navigation, Filter, Sparkles, MapPin, Compass, AlertTriangle, ShieldCheck, Thermometer, Leaf, ExternalLink } from 'lucide-react';

function MapController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, zoom || 9, { animate: true });
    }
  }, [center, zoom, map]);
  return null;
}

export default function PfzExplorationPage() {
  const navigate = useNavigate();
  const [filterType, setFilterType] = useState('yield'); // 'yield', 'nearest', 'safest'
  const [zones, setZones] = useState([]);
  const [selectedZone, setSelectedZone] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLiveBackend, setIsLiveBackend] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');

  useEffect(() => {
    async function loadPfz() {
      setIsLoading(true);
      try {
        const res = await getPfzLayer(MANGALORE_FALLBACK[0], MANGALORE_FALLBACK[1], { count: 12 });
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
  }, []);

  // Handle client-side filter changes
  const handleFilterChange = (type) => {
    setFilterType(type);
    const sorted = sortZones(zones, type);
    setZones(sorted);
    if (sorted.length > 0) {
      setSelectedZone(sorted[0]);
    }
  };

  const centerCoord = selectedZone ? [selectedZone.lat, selectedZone.lon] : MANGALORE_FALLBACK;

  return (
    <div className="min-h-screen bg-orca-bg flex flex-col overflow-hidden">
      <Header />

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* ── Left Exploration Panel ── */}
        <div className="w-full md:w-[420px] lg:w-[460px] bg-orca-surface border-r border-orca-border flex flex-col h-full z-10 flex-shrink-0">
          {/* Header & Filter Pills */}
          <div className="p-4 border-b border-orca-border space-y-3 bg-orca-surface-2/20">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-orca-teal">
                  Frame 06 · Zone Discovery
                </span>
                <h2 className="text-base font-extrabold text-white tracking-tight">
                  IDENTIFIED PFZ ZONES (Mangalore)
                </h2>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${isLiveBackend ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'}`}>
                {isLiveBackend ? 'XGBoost Live ML' : 'Simulated Layer'}
              </span>
            </div>

            {/* Three Filter Pills: Nearest / Highest Yield / Safest */}
            <div className="flex items-center gap-1.5 bg-orca-bg/80 p-1 rounded-xl border border-orca-border">
              {[
                { type: 'yield', label: 'Highest Yield', icon: Sparkles },
                { type: 'nearest', label: 'Nearest', icon: Compass },
                { type: 'safest', label: 'Safest', icon: ShieldCheck },
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
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {isLoading ? (
              <div className="py-20 text-center text-orca-muted text-xs">
                Analyzing MODIS chlorophyll and running XGBoost model...
              </div>
            ) : zones.length === 0 ? (
              <div className="py-20 text-center text-orca-muted text-xs">
                No active zones found in current sector.
              </div>
            ) : (
              zones.map((z, idx) => {
                const isSelected = selectedZone?.id === z.id;
                const isTop = idx === 0;

                return (
                  <div
                    key={z.id}
                    onClick={() => setSelectedZone(z)}
                    className={`
                      p-4 rounded-xl border transition-all cursor-pointer relative
                      ${
                        isSelected
                          ? 'bg-orca-surface-2 border-orca-teal shadow-lg shadow-orca-teal/10'
                          : 'bg-orca-surface border-orca-border hover:border-orca-teal/40'
                      }
                    `}
                  >
                    {/* Top card badge */}
                    {isTop && (
                      <span className="absolute -top-2.5 right-4 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500 text-orca-bg shadow-sm">
                        Rank #1 Choice
                      </span>
                    )}

                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-base">🐟</span>
                        <span className="font-extrabold text-sm text-white">{z.id}</span>
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-orca-bg border border-orca-border text-orca-teal">
                          {z.predictedZone}
                        </span>
                      </div>
                      <span className="text-xs font-extrabold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/25">
                        {z.confidence}% Conf.
                      </span>
                    </div>

                    <p className="text-xs font-medium text-white mb-2">
                      {z.expectedSpecies}
                    </p>

                    {/* Metadata strip */}
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-orca-muted bg-orca-bg/50 p-2 rounded-lg border border-orca-border/60 mb-3">
                      <div>
                        <span>Distance: </span>
                        <strong className="text-white">{z.distanceNm} nm</strong> ({z.bearing})
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-0.5 text-amber-400 font-medium">
                          <Thermometer size={12} /> {z.temperature}°C
                        </span>
                        <span className="flex items-center gap-0.5 text-emerald-400 font-medium">
                          <Leaf size={12} /> {z.chlorophyll}
                        </span>
                      </div>
                    </div>

                    {/* "Navigate to Zone" CTA on Top Card matching Figma */}
                    {isTop && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/route?dest=${z.id}&lat=${z.lat}&lon=${z.lon}`);
                        }}
                        className="
                          w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold
                          bg-orca-teal text-orca-bg hover:bg-orca-teal/90 active:scale-[0.98]
                          transition-all shadow-sm shadow-orca-teal/20
                        "
                      >
                        <Navigation size={13} />
                        <span>Navigate to Zone (Plot Safe Route)</span>
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Bottom attribution / advisory bar per Section 10.2 */}
          <div className="p-3.5 bg-orca-bg border-t border-orca-border text-[11px] text-orca-muted leading-tight">
            <span className="text-white font-semibold">ORCA Advisory:</span> {zones.length} potential fishing zones identified within Mangalore Sector.
            <div className="text-[10px] text-orca-teal/90 mt-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-orca-teal" />
              <span>Updated {lastUpdated} via ORCA's own PFZ model over public satellite data (not INCOIS-certified).</span>
            </div>
          </div>
        </div>

        {/* ── Right Live Leaflet Map Panel ── */}
        <div className="flex-1 h-full relative">
          <MapContainer
            center={MANGALORE_FALLBACK}
            zoom={9}
            className="w-full h-full"
            zoomControl={false}
          >
            <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
            <MapController center={centerCoord} zoom={selectedZone ? 10 : 9} />

            {/* Base "You" / Mangalore Port Marker */}
            <CircleMarker
              center={MANGALORE_FALLBACK}
              radius={8}
              pathOptions={{ color: '#00D8FF', fillColor: '#00D8FF', fillOpacity: 0.9, weight: 3 }}
            >
              <Popup>
                <div className="text-xs">
                  <strong>You Are Here</strong>
                  <p>Mangalore Harbor Base</p>
                </div>
              </Popup>
            </CircleMarker>

            {/* PFZ Zones */}
            {zones.map(z => {
              const isSelected = selectedZone?.id === z.id;
              const color = z.predictedZone === 'BEST' ? '#10B981' : z.predictedZone === 'GOOD' ? '#00D8FF' : '#F59E0B';

              return (
                <React.Fragment key={z.id}>
                  {/* Selected halo */}
                  {isSelected && (
                    <Circle
                      center={[z.lat, z.lon]}
                      radius={12000}
                      pathOptions={{ color: '#00D8FF', fillColor: '#00D8FF', fillOpacity: 0.15, dashArray: '4, 4' }}
                    />
                  )}

                  <CircleMarker
                    center={[z.lat, z.lon]}
                    radius={isSelected ? 10 : 6}
                    pathOptions={{ color: isSelected ? '#FFFFFF' : color, fillColor: color, fillOpacity: 0.9, weight: isSelected ? 3 : 1.5 }}
                    eventHandlers={{
                      click: () => setSelectedZone(z),
                    }}
                  >
                    <Popup>
                      <div className="text-xs space-y-1 p-1">
                        <strong className="text-orca-teal">{z.id} ({z.predictedZone})</strong>
                        <p>{z.expectedSpecies}</p>
                        <p>Confidence: {z.confidence}%</p>
                        <p>Distance: {z.distanceNm} nm ({z.bearing})</p>
                        <p>SST: {z.temperature}°C · Chl: {z.chlorophyll} mg/m³</p>
                      </div>
                    </Popup>
                  </CircleMarker>
                </React.Fragment>
              );
            })}

            {/* Hazard Alert Circle Overlays */}
            {SAMPLE_HAZARD_ZONES.map(h => (
              <Circle
                key={h.id}
                center={[h.lat, h.lon]}
                radius={(h.radiusKm || 30) * 1000}
                pathOptions={{
                  color: h.color,
                  fillColor: h.fillColor,
                  fillOpacity: h.fillOpacity,
                  weight: 2,
                  dashArray: '6, 6',
                }}
              >
                <Popup>
                  <div className="text-xs p-1">
                    <strong className="text-red-500">{h.type}</strong>
                    <p>{h.title}</p>
                    <p className="text-[10px] text-gray-500">{h.guidance}</p>
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
              <span className="text-white text-[11px]">BEST Yield Zone</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#00D8FF]" />
              <span className="text-white text-[11px]">GOOD Yield Zone</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-white text-[11px]">POOR Yield Zone</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500/40 border border-red-500" />
              <span className="text-white text-[11px]">Cyclone / Hazard Zone</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
