import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Circle, CircleMarker, Popup, useMap } from 'react-leaflet';
import { useTranslation } from 'react-i18next';
import Header from '../layout/Header.jsx';
import { getHazardAlerts, SAMPLE_HAZARD_ZONES } from '../../data/hazards.js';
import { useLocationState } from '../../context/LocationContext.jsx';
import { TILE_URL, TILE_ATTRIBUTION, MANGALORE_FALLBACK } from '../../config/map.js';
import {
  AlertOctagon,
  AlertTriangle,
  Info,
  ShieldAlert,
  ChevronRight,
  Compass,
  ShieldCheck,
  MapPin,
  ChevronDown,
  ChevronUp,
  Map as MapIcon,
  List
} from 'lucide-react';

function MapController({ center, zoom = 8 }) {
  const map = useMap();
  useEffect(() => {
    if (
      center &&
      Array.isArray(center) &&
      center.length === 2 &&
      typeof center[0] === 'number' &&
      !isNaN(center[0]) &&
      typeof center[1] === 'number' &&
      !isNaN(center[1])
    ) {
      try {
        map.flyTo(center, zoom, { animate: true, duration: 1 });
        map.invalidateSize();
      } catch (err) {
        console.warn('Map flyTo skipped:', err);
      }
    }
  }, [center, zoom, map]);
  return null;
}

export default function HazardsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentLocation } = useLocationState();

  const [alerts, setAlerts] = useState(SAMPLE_HAZARD_ZONES);
  const [counts, setCounts] = useState({ critical: 1, warning: 1, advisory: 1 });
  const [selectedHazard, setSelectedHazard] = useState(SAMPLE_HAZARD_ZONES[0]);
  const [filterSeverity, setFilterSeverity] = useState('ALL');
  const [expandedId, setExpandedId] = useState(null);
  const [showInstructionModal, setShowInstructionModal] = useState(false);
  const [mobileView, setMobileView] = useState('alerts'); // 'alerts' | 'map'

  useEffect(() => {
    async function loadHazards() {
      try {
        const res = await getHazardAlerts();
        if (res && Array.isArray(res.alerts) && res.alerts.length > 0) {
          setAlerts(res.alerts);
          setCounts(res.counts || { critical: 0, warning: 0, advisory: 0 });
          setSelectedHazard(res.alerts[0]);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadHazards();
  }, []);

  const getValidCoordinate = (lat, lon, fallback = [13.200, 73.650]) => {
    const parsedLat = parseFloat(lat);
    const parsedLon = parseFloat(lon);
    if (!isNaN(parsedLat) && !isNaN(parsedLon) && isFinite(parsedLat) && isFinite(parsedLon)) {
      return [parsedLat, parsedLon];
    }
    return fallback;
  };

  const criticalHazard = alerts.find(a => (a.severity || '').toUpperCase() === 'CRITICAL');
  const filteredAlerts = filterSeverity === 'ALL'
    ? alerts
    : alerts.filter(a => (a.severity || '').toUpperCase() === filterSeverity);

  const mapCenter = selectedHazard && selectedHazard.lat !== undefined
    ? getValidCoordinate(selectedHazard.lat, selectedHazard.lon, [13.200, 73.650])
    : currentLocation && currentLocation.lat !== undefined
    ? getValidCoordinate(currentLocation.lat, currentLocation.lon, [13.200, 73.650])
    : [13.200, 73.650];


  return (
    <div className="h-screen bg-orca-bg flex flex-col overflow-hidden">
      <Header />

      {/* ── Top Critical Emergency Banner ── */}
      {criticalHazard && (
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white px-4 py-2.5 flex items-center justify-between shadow-lg z-20 flex-shrink-0 animate-fadeIn">
          <div className="flex items-center gap-2.5 max-w-4xl">
            <span className="p-1 rounded-lg bg-white/20 animate-pulse flex-shrink-0">
              <AlertOctagon size={18} className="text-white" />
            </span>
            <div className="text-xs">
              <strong className="uppercase font-extrabold tracking-wide mr-2 bg-black/20 px-1.5 py-0.5 rounded">
                {t('hazards.emergency_banner')}
              </strong>
              <span>{criticalHazard.title} — Artisanal craft avoid waters beyond 30nm.</span>
            </div>
          </div>

          <button
            onClick={() => setShowInstructionModal(true)}
            className="text-xs font-bold bg-white text-red-700 px-3 py-1.5 rounded-lg hover:bg-white/90 shadow transition-all flex-shrink-0"
          >
            {t('hazards.view_instruction')}
          </button>
        </div>
      )}

      {/* Mobile View Toggle Bar */}
      <div className="md:hidden flex items-center justify-between p-2.5 bg-orca-surface border-b border-orca-border flex-shrink-0 z-20">
        <div className="flex items-center gap-1.5 bg-orca-bg p-1 rounded-xl border border-orca-border w-full">
          <button
            onClick={() => setMobileView('alerts')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all touch-target ${
              mobileView === 'alerts'
                ? 'bg-orca-teal text-orca-bg shadow-sm'
                : 'text-orca-muted hover:text-white'
            }`}
          >
            <AlertTriangle size={14} />
            <span>Alerts ({filteredAlerts.length})</span>
          </button>
          <button
            onClick={() => setMobileView('map')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all touch-target ${
              mobileView === 'map'
                ? 'bg-orca-teal text-orca-bg shadow-sm'
                : 'text-orca-muted hover:text-white'
            }`}
          >
            <MapIcon size={14} />
            <span>Live Map</span>
          </button>
        </div>
      </div>

      {/* ── Main Layout: Sidebar & Full-Height Live Map ── */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden relative">
        
        {/* Left Hazard Cards Sidebar */}
        <div className={`w-full md:w-[420px] lg:w-[440px] bg-orca-surface border-r border-orca-border flex-col h-full z-10 flex-shrink-0 mb-14 md:mb-0 ${
          mobileView === 'map' ? 'hidden md:flex' : 'flex'
        }`}>

          
          {/* Summary Badges */}
          <div className="p-4 border-b border-orca-border space-y-3 bg-orca-surface-2/20 flex-shrink-0">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-orca-teal">
                Frame 07 · Maritime Safety
              </span>
              <h2 className="text-base font-extrabold text-white tracking-tight">
                {t('hazards.title')}
              </h2>
            </div>

            {/* Severity Pill Filters */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setFilterSeverity(filterSeverity === 'CRITICAL' ? 'ALL' : 'CRITICAL')}
                className={`p-2 rounded-xl border text-left transition-all ${
                  filterSeverity === 'CRITICAL'
                    ? 'bg-red-500/25 border-red-500 text-white shadow-sm'
                    : 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/15'
                }`}
              >
                <div className="text-[10px] uppercase font-bold tracking-wider">Critical</div>
                <div className="text-lg font-black font-mono">{counts.critical}</div>
              </button>

              <button
                onClick={() => setFilterSeverity(filterSeverity === 'WARNING' ? 'ALL' : 'WARNING')}
                className={`p-2 rounded-xl border text-left transition-all ${
                  filterSeverity === 'WARNING'
                    ? 'bg-amber-500/25 border-amber-500 text-white shadow-sm'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/15'
                }`}
              >
                <div className="text-[10px] uppercase font-bold tracking-wider">Warnings</div>
                <div className="text-lg font-black font-mono">{counts.warning}</div>
              </button>

              <button
                onClick={() => setFilterSeverity(filterSeverity === 'ADVISORY' ? 'ALL' : 'ADVISORY')}
                className={`p-2 rounded-xl border text-left transition-all ${
                  filterSeverity === 'ADVISORY'
                    ? 'bg-blue-500/25 border-blue-500 text-white shadow-sm'
                    : 'bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/15'
                }`}
              >
                <div className="text-[10px] uppercase font-bold tracking-wider">Advisories</div>
                <div className="text-lg font-black font-mono">{counts.advisory}</div>
              </button>
            </div>
          </div>

          {/* Alert Cards Scroll List */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
            {filteredAlerts.map(h => {
              const isSelected = selectedHazard?.id === h.id;
              const isExpanded = expandedId === h.id;
              const sev = (h.severity || 'advisory').toLowerCase();
              const badgeBg =
                sev === 'critical'
                  ? 'bg-red-500/20 text-red-400 border-red-500/30'
                  : sev === 'warning'
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                  : 'bg-blue-500/20 text-blue-400 border-blue-500/30';

              return (
                <div
                  key={h.id}
                  onClick={() => setSelectedHazard(h)}
                  className={`
                    p-3.5 rounded-xl border transition-all cursor-pointer space-y-2
                    ${
                      isSelected
                        ? 'bg-orca-surface-2 border-orca-teal shadow-lg shadow-orca-teal/10 ring-1 ring-orca-teal/30'
                        : 'bg-orca-surface border-orca-border hover:border-orca-teal/40'
                    }
                  `}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-orca-muted flex items-center gap-1 font-semibold">
                      <AlertTriangle size={12} className={sev === 'critical' ? 'text-red-500' : 'text-amber-400'} />
                      <span>{h.type}</span>
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase border ${badgeBg}`}>
                      {h.severity}
                    </span>
                  </div>

                  <h3 className="text-xs font-bold text-white leading-snug">
                    {h.title}
                  </h3>

                  <p className="text-xs text-orca-muted leading-relaxed">
                    {h.guidance}
                  </p>

                  {/* Toggle details */}
                  <div className="flex items-center justify-between text-[10px] text-orca-muted pt-1">
                    <span>Exclusion: <strong className="text-white">{h.radiusKm} km</strong></span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedId(isExpanded ? null : h.id);
                      }}
                      className="text-orca-teal hover:underline flex items-center gap-0.5"
                    >
                      <span>{isExpanded ? 'Less' : t('hazards.details')}</span>
                      {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="p-2.5 bg-orca-bg/80 rounded-lg border border-orca-border text-[10px] text-orca-muted space-y-1 animate-fadeIn">
                      <div>Area: <span className="text-white">{h.area}</span></div>
                      <div>Window: <span className="text-white">{h.window}</span></div>
                    </div>
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/route');
                    }}
                    className="w-full mt-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold bg-orca-bg border border-orca-border hover:border-orca-teal text-white transition-all"
                  >
                    <span>{t('hazards.route_around')}</span>
                    <ChevronRight size={12} />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="p-3 bg-orca-bg border-t border-orca-border text-[11px] text-orca-muted flex-shrink-0">
            <span className="text-white font-semibold">Safety Protocol:</span> All hazard exclusion zones feed real-time collision boundaries into ORCA's safe route solver.
          </div>
        </div>

        {/* ── Right Leaflet Map Panel (Full Height & Functional) ── */}
        <div className={`flex-1 min-h-0 h-full relative bg-orca-bg mb-14 md:mb-0 ${
          mobileView === 'alerts' ? 'hidden md:flex' : 'flex'
        }`}>

          <MapContainer
            center={mapCenter}
            zoom={8}
            className="w-full h-full"
            zoomControl={false}
          >
            <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
            <MapController center={mapCenter} zoom={selectedHazard ? 8 : 7} />

            {/* Base Harbor Reference */}
            <CircleMarker
              center={getValidCoordinate(currentLocation?.lat, currentLocation?.lon, [12.8698, 74.8431])}
              radius={7}
              pathOptions={{ color: '#00D8FF', fillColor: '#00D8FF', fillOpacity: 0.9, weight: 2 }}
            >
              <Popup>
                <div className="text-xs">
                  <strong>{currentLocation?.name || 'Base Harbor Node'}</strong>
                </div>
              </Popup>
            </CircleMarker>

            {/* Hazard Exclusion Circles */}
            {alerts.map(h => {
              const hLat = parseFloat(h.lat);
              const hLon = parseFloat(h.lon);
              if (isNaN(hLat) || isNaN(hLon) || !isFinite(hLat) || !isFinite(hLon)) return null;

              const isSelected = selectedHazard?.id === h.id;
              const radiusVal = (parseFloat(h.radiusKm) || 30) * 1000;

              return (
                <React.Fragment key={h.id}>
                  {isSelected && (
                    <Circle
                      center={[hLat, hLon]}
                      radius={radiusVal + 10000}
                      pathOptions={{
                        color: '#FFFFFF',
                        fillColor: h.fillColor || '#EF4444',
                        fillOpacity: 0.1,
                        dashArray: '4, 4',
                        weight: 2,
                      }}
                    />
                  )}

                  <Circle
                    center={[hLat, hLon]}
                    radius={radiusVal}
                    pathOptions={{
                      color: isSelected ? '#FFFFFF' : (h.color || '#EF4444'),
                      fillColor: h.fillColor || '#EF4444',
                      fillOpacity: isSelected ? 0.35 : (h.fillOpacity || 0.2),
                      weight: isSelected ? 3 : 2,
                      dashArray: '6, 6',
                    }}
                    eventHandlers={{
                      click: () => setSelectedHazard(h),
                    }}
                  >
                    <Popup>
                      <div className="text-xs p-1 space-y-1">
                        <strong className="text-red-500 font-bold block">{h.title}</strong>
                        <p>{h.guidance}</p>
                        <p className="text-[10px] text-gray-500 font-mono">Radius: {h.radiusKm || 30} km exclusion</p>
                      </div>
                    </Popup>
                  </Circle>

                  <CircleMarker
                    center={[hLat, hLon]}
                    radius={6}
                    pathOptions={{
                      color: h.color || '#EF4444',
                      fillColor: h.color || '#EF4444',
                      fillOpacity: 1,
                    }}
                  />
                </React.Fragment>
              );
            })}

          </MapContainer>

          {/* Floating Map Legend */}
          <div className="absolute top-4 right-4 bg-orca-surface/90 backdrop-blur border border-orca-border p-3 rounded-xl shadow-xl z-[400] text-xs space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-orca-muted block">Hazard Overlay Legend</span>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-white text-[11px]">Critical Danger / Cyclone Exclusion</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-white text-[11px]">Severe Swell Warning (&gt;2.5m)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-white text-[11px]">Restricted Boundary / Naval Sector</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
