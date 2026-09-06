import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Circle, CircleMarker, Popup, useMap } from 'react-leaflet';
import Header from '../layout/Header.jsx';
import { getHazardAlerts, SAMPLE_HAZARD_ZONES } from '../../data/hazards.js';
import { TILE_URL, TILE_ATTRIBUTION, MANGALORE_FALLBACK } from '../../config/map.js';
import { AlertOctagon, AlertTriangle, Info, ShieldAlert, ChevronRight, Compass, ShieldCheck, MapPin } from 'lucide-react';

function MapController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, zoom || 8, { animate: true });
    }
  }, [center, zoom, map]);
  return null;
}

export default function HazardsPage() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState(SAMPLE_HAZARD_ZONES);
  const [counts, setCounts] = useState({ critical: 1, warning: 1, advisory: 1 });
  const [isLive, setIsLive] = useState(false);
  const [selectedHazard, setSelectedHazard] = useState(SAMPLE_HAZARD_ZONES[0]);
  const [filterSeverity, setFilterSeverity] = useState('ALL');
  const [showInstructionModal, setShowInstructionModal] = useState(false);

  useEffect(() => {
    async function loadHazards() {
      try {
        const res = await getHazardAlerts();
        setAlerts(res.alerts);
        setCounts(res.counts);
        setIsLive(res.isLive);
        if (res.alerts.length > 0) {
          setSelectedHazard(res.alerts[0]);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadHazards();
  }, []);

  const criticalHazard = alerts.find(a => (a.severity || '').toUpperCase() === 'CRITICAL');
  const filteredAlerts = filterSeverity === 'ALL'
    ? alerts
    : alerts.filter(a => (a.severity || '').toUpperCase() === filterSeverity);

  const mapCenter = selectedHazard && selectedHazard.lat
    ? [selectedHazard.lat, selectedHazard.lon]
    : [13.2, 73.8];

  return (
    <div className="min-h-screen bg-orca-bg flex flex-col overflow-hidden">
      <Header />

      {/* ── Top Critical Emergency Banner (Rendered when Critical Hazard Active) ── */}
      {criticalHazard && (
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white px-4 py-2.5 flex items-center justify-between shadow-lg z-20 flex-shrink-0 animate-fadeIn">
          <div className="flex items-center gap-2.5 max-w-4xl">
            <span className="p-1 rounded-lg bg-white/20 animate-pulse flex-shrink-0">
              <AlertOctagon size={18} className="text-white" />
            </span>
            <div className="text-xs">
              <strong className="uppercase font-extrabold tracking-wide mr-2 bg-black/20 px-1.5 py-0.5 rounded">
                ORCA Emergency Alert
              </strong>
              <span>{criticalHazard.title} — Artisanal craft avoid waters beyond 30nm.</span>
            </div>
          </div>

          <button
            onClick={() => setShowInstructionModal(true)}
            className="
              text-xs font-bold px-3 py-1 rounded-lg bg-white text-red-700
              hover:bg-white/90 active:scale-95 transition-all shadow-sm flex-shrink-0
            "
          >
            VIEW INSTRUCTION
          </button>
        </div>
      )}

      {/* ── Main Layout: Sidebar & Map ── */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Left Hazards Sidebar */}
        <div className="w-full md:w-[420px] lg:w-[460px] bg-orca-surface border-r border-orca-border flex flex-col h-full z-10 flex-shrink-0">
          {/* Header & 3-Number Summary Strip */}
          <div className="p-4 border-b border-orca-border space-y-3 bg-orca-surface-2/20">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-orca-teal">
                  Frame 07 · Maritime Safety
                </span>
                <h2 className="text-base font-extrabold text-white tracking-tight">
                  SAFETY & HAZARDS VIEW
                </h2>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${isLive ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'}`}>
                {isLive ? 'NDMA SACHET Live' : 'Showing Sample Data'}
              </span>
            </div>

            {/* 3-Number Severity Summary Strip */}
            <div className="grid grid-cols-3 gap-2">
              <div 
                onClick={() => setFilterSeverity(filterSeverity === 'CRITICAL' ? 'ALL' : 'CRITICAL')}
                className={`p-2.5 rounded-xl border cursor-pointer transition-all ${filterSeverity === 'CRITICAL' ? 'bg-red-500/20 border-red-500' : 'bg-red-500/10 border-red-500/20 hover:bg-red-500/15'}`}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-red-400 block">Critical</span>
                <span className="text-2xl font-black text-white">{counts.critical}</span>
              </div>

              <div 
                onClick={() => setFilterSeverity(filterSeverity === 'WARNING' ? 'ALL' : 'WARNING')}
                className={`p-2.5 rounded-xl border cursor-pointer transition-all ${filterSeverity === 'WARNING' ? 'bg-amber-500/20 border-amber-500' : 'bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/15'}`}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">Warnings</span>
                <span className="text-2xl font-black text-white">{counts.warning}</span>
              </div>

              <div 
                onClick={() => setFilterSeverity(filterSeverity === 'ADVISORY' ? 'ALL' : 'ADVISORY')}
                className={`p-2.5 rounded-xl border cursor-pointer transition-all ${filterSeverity === 'ADVISORY' ? 'bg-blue-500/20 border-blue-500' : 'bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/15'}`}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 block">Advisories</span>
                <span className="text-2xl font-black text-white">{counts.advisory}</span>
              </div>
            </div>
          </div>

          {/* Hazards Cards List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {filteredAlerts.map(h => {
              const isSelected = selectedHazard?.id === h.id;
              const sev = (h.severity || '').toUpperCase();
              const isCrit = sev === 'CRITICAL' || sev === 'SEVERE' || sev === 'EXTREME';
              const isWarn = sev === 'WARNING' || sev === 'MODERATE';

              const badgeColor = isCrit
                ? 'bg-red-500/20 text-red-400 border-red-500/30'
                : isWarn
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                : 'bg-blue-500/20 text-blue-400 border-blue-500/30';

              return (
                <div
                  key={h.id}
                  onClick={() => setSelectedHazard(h)}
                  className={`
                    p-4 rounded-xl border transition-all cursor-pointer space-y-2
                    ${
                      isSelected
                        ? 'bg-orca-surface-2 border-orca-teal shadow-lg shadow-orca-teal/10'
                        : 'bg-orca-surface border-orca-border hover:border-orca-teal/40'
                    }
                  `}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      {isCrit && <AlertOctagon size={15} className="text-red-400" />}
                      {isWarn && <AlertTriangle size={15} className="text-amber-400" />}
                      {!isCrit && !isWarn && <Info size={15} className="text-blue-400" />}
                      <span>{h.type}</span>
                    </span>
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${badgeColor}`}>
                      {h.severity}
                    </span>
                  </div>

                  <h3 className="text-sm font-extrabold text-white leading-snug">
                    {h.title}
                  </h3>

                  <div className="text-[11px] text-orca-muted space-y-0.5 bg-orca-bg/50 p-2.5 rounded-lg border border-orca-border/60">
                    <div>
                      <strong className="text-white">Area:</strong> {h.area}
                    </div>
                    <div>
                      <strong className="text-white">Window:</strong> {h.validity}
                    </div>
                  </div>

                  <p className="text-xs text-orca-muted leading-relaxed">
                    <strong className="text-white font-medium">Guidance: </strong>
                    {h.guidance}
                  </p>

                  <div className="pt-2 flex items-center justify-between text-[11px]">
                    <span className="text-orca-teal font-semibold">Exclusion Radius: {h.radiusKm} km</span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('/route');
                      }}
                      className="text-white hover:text-orca-teal flex items-center gap-1 font-medium"
                    >
                      <span>Route around hazard</span>
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Standalone Advice Note */}
          <div className="p-3.5 bg-orca-bg border-t border-orca-border text-[11px] text-orca-muted">
            <span className="text-white font-semibold">Safety Protocol:</span> All hazard coordinates feed real-time collision boundaries into ORCA's safe route solver.
          </div>
        </div>

        {/* Right Leaflet Map with Exclusion Circles & Floating Legend */}
        <div className="flex-1 h-full relative">
          <MapContainer
            center={mapCenter}
            zoom={8}
            className="w-full h-full"
            zoomControl={false}
          >
            <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
            <MapController center={mapCenter} zoom={selectedHazard ? 8 : 7} />

            {/* Base Harbor Marker */}
            <CircleMarker
              center={MANGALORE_FALLBACK}
              radius={7}
              pathOptions={{ color: '#00D8FF', fillColor: '#00D8FF', fillOpacity: 0.9, weight: 2 }}
            >
              <Popup>
                <div className="text-xs">
                  <strong>Mangalore Harbor Node</strong>
                </div>
              </Popup>
            </CircleMarker>

            {/* Hazard Exclusion Zone Circles */}
            {alerts.map(h => {
              if (!h.lat || !h.lon) return null;
              const isSelected = selectedHazard?.id === h.id;
              const color = h.color || '#EF4444';

              return (
                <React.Fragment key={h.id}>
                  <Circle
                    center={[h.lat, h.lon]}
                    radius={(h.radiusKm || 30) * 1000}
                    pathOptions={{
                      color: isSelected ? '#FFFFFF' : color,
                      fillColor: color,
                      fillOpacity: isSelected ? 0.35 : (h.fillOpacity || 0.2),
                      weight: isSelected ? 3 : 2,
                      dashArray: '6, 6',
                    }}
                    eventHandlers={{
                      click: () => setSelectedHazard(h),
                    }}
                  >
                    <Popup>
                      <div className="text-xs p-1 max-w-xs space-y-1">
                        <strong className="text-red-500">{h.title}</strong>
                        <p className="text-[11px]">{h.area}</p>
                        <p className="text-[10px] text-gray-600">{h.guidance}</p>
                      </div>
                    </Popup>
                  </Circle>

                  <CircleMarker
                    center={[h.lat, h.lon]}
                    radius={5}
                    pathOptions={{ color: '#FFFFFF', fillColor: color, fillOpacity: 1, weight: 2 }}
                  />
                </React.Fragment>
              );
            })}
          </MapContainer>

          {/* Floating Map Legend Card matching Figma */}
          <div className="absolute top-4 right-4 bg-orca-surface/90 backdrop-blur border border-orca-border p-3.5 rounded-xl shadow-xl z-[400] text-xs space-y-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-orca-muted block">
              Hazard Overlay Legend
            </span>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500 shadow-sm shadow-red-500/50" />
              <span className="text-white text-[11px] font-medium">Critical Danger / Cyclone Exclusion</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50" />
              <span className="text-white text-[11px] font-medium">Severe Swell Warning (High Wave)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50" />
              <span className="text-white text-[11px] font-medium">Restricted Boundary / Naval Sector</span>
            </div>
          </div>
        </div>
      </div>

      {/* Instruction Modal */}
      {showInstructionModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[1000] animate-fadeIn">
          <div className="bg-orca-surface border border-red-500/40 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-red-400 border-b border-orca-border pb-3">
              <AlertOctagon size={24} />
              <h3 className="text-base font-extrabold text-white">
                Emergency Instruction Protocol
              </h3>
            </div>
            <p className="text-xs text-orca-muted leading-relaxed">
              Coastal authorities have declared a Critical Cyclone Watch across the Arabian Sea sector. All artisanal craft are mandated to adhere to the following emergency guidance:
            </p>
            <ul className="text-xs text-white space-y-2 list-disc list-inside bg-orca-bg p-3.5 rounded-xl border border-orca-border">
              <li>Do not venture beyond the 12nm territorial baseline.</li>
              <li>Vessels currently beyond 30nm must steer eastward toward Mangalore or Malpe.</li>
              <li>Switch VHF Channel 16 to active monitoring for Coast Guard bulletins.</li>
              <li>Verify emergency beacon battery and GPS sync.</li>
            </ul>
            <button
              onClick={() => setShowInstructionModal(false)}
              className="w-full py-2.5 rounded-xl bg-orca-teal text-orca-bg font-bold text-xs hover:bg-orca-teal/90 transition-all"
            >
              Acknowledge & Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
