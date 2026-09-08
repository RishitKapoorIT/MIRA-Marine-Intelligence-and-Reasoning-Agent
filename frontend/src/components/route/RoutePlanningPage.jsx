import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, Polyline, CircleMarker, Circle, Popup, useMap } from 'react-leaflet';
import { useTranslation } from 'react-i18next';
import Header from '../layout/Header.jsx';
import { INDIAN_PORTS, computeMarineRoutes } from '../../data/routing.js';
import { SAMPLE_HAZARD_ZONES } from '../../data/hazards.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { TILE_URL, TILE_ATTRIBUTION, MANGALORE_FALLBACK } from '../../config/map.js';
import {
  Compass,
  Navigation,
  Fuel,
  Clock,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Route,
  AlertTriangle,
  Layers,
  MapPin
} from 'lucide-react';

function MapController({ bounds, center }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    if (bounds && bounds.length > 1) {
      map.fitBounds(bounds, { padding: [50, 50], animate: true, maxZoom: 11 });
    } else if (center) {
      map.setView(center, 8, { animate: true });
    }
  }, [bounds, center, map]);
  return null;
}

export default function RoutePlanningPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const destParam = searchParams.get('dest');
  const latParam = searchParams.get('lat');
  const lonParam = searchParams.get('lon');

  const { safeRoute, safeHouse } = useAuth();

  // Form State with Safe Route prefill
  const [originPort, setOriginPort] = useState(() => {
    if (safeRoute?.origin?.lat) return safeRoute.origin;
    return INDIAN_PORTS[0]; // Mangalore
  });

  const [destinationPort, setDestinationPort] = useState(() => {
    if (latParam && lonParam) {
      return {
        id: destParam || 'custom-target',
        name: destParam ? `Target Zone (${destParam})` : 'Target Coordinate',
        lat: parseFloat(latParam),
        lon: parseFloat(lonParam),
        region: 'Target Offshore',
      };
    }
    if (safeRoute?.destination?.lat) return safeRoute.destination;
    return INDIAN_PORTS[3]; // Karwar
  });

  const [hasWaypoint, setHasWaypoint] = useState(false);
  const [waypointPort, setWaypointPort] = useState(INDIAN_PORTS[2]); // Malpe
  const [departureTime, setDepartureTime] = useState('06:00 IST');

  // Computed routes
  const [routes, setRoutes] = useState([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);

  useEffect(() => {
    calculateRoutes();
  }, [originPort, destinationPort, hasWaypoint, waypointPort]);

  const calculateRoutes = () => {
    const wp = hasWaypoint ? waypointPort : null;
    const computed = computeMarineRoutes(originPort, destinationPort, wp, SAMPLE_HAZARD_ZONES);
    setRoutes(computed);
    setSelectedRouteIndex(0);
  };

  const activeRoute = routes[selectedRouteIndex] || routes[0];
  const alternateRoute = routes[selectedRouteIndex === 0 ? 1 : 0];

  // Coordinates array for map polyline and bounds
  const polylineLatLngs = activeRoute ? activeRoute.coordinates : [];

  return (
    <div className="h-screen bg-orca-bg flex flex-col overflow-hidden">
      <Header />

      {/* Main Layout: Sidebar & Full-Height Live Route Map (Fix A6) */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden relative">
        
        {/* Left Route Planning Sidebar */}
        <div className="w-full md:w-[440px] lg:w-[460px] bg-orca-surface border-r border-orca-border flex flex-col h-full z-10 flex-shrink-0">
          
          {/* Form Header */}
          <div className="p-4 border-b border-orca-border bg-orca-surface-2/20 space-y-3 flex-shrink-0">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-orca-teal flex items-center gap-1">
                <Route size={12} /> Frame 08 · Marine Navigation
              </span>
              <h2 className="text-base font-extrabold text-white tracking-tight">
                {t('route.title')}
              </h2>
            </div>

            {/* Origin & Destination Inputs */}
            <div className="space-y-2 text-xs">
              <div>
                <label className="text-[11px] font-semibold text-orca-muted block mb-1">
                  {t('route.origin')}
                </label>
                <select
                  value={originPort.id}
                  onChange={e => {
                    const p = INDIAN_PORTS.find(x => x.id === e.target.value);
                    if (p) setOriginPort(p);
                  }}
                  className="w-full bg-orca-bg border border-orca-border text-white text-xs p-2.5 rounded-xl focus:outline-none focus:border-orca-teal cursor-pointer"
                >
                  {INDIAN_PORTS.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.region})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-orca-muted block mb-1">
                  {t('route.destination')}
                </label>
                <select
                  value={destinationPort.id}
                  onChange={e => {
                    const p = INDIAN_PORTS.find(x => x.id === e.target.value);
                    if (p) setDestinationPort(p);
                  }}
                  className="w-full bg-orca-bg border border-orca-border text-white text-xs p-2.5 rounded-xl focus:outline-none focus:border-orca-teal cursor-pointer"
                >
                  {destinationPort.id.startsWith('custom-') || destinationPort.id.startsWith('PFZ-') ? (
                    <option value={destinationPort.id}>{destinationPort.name}</option>
                  ) : null}
                  {INDIAN_PORTS.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.region})
                    </option>
                  ))}
                </select>
              </div>

              {/* Waypoint Toggle */}
              <div className="pt-1 flex items-center justify-between">
                <label className="text-[11px] text-orca-muted flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={hasWaypoint}
                    onChange={e => setHasWaypoint(e.target.checked)}
                    className="accent-orca-teal rounded"
                  />
                  <span>Add Mid-Course Waypoint</span>
                </label>
                <span className="text-[10px] text-orca-teal">Turf.js Detour Engine</span>
              </div>

              {hasWaypoint && (
                <div className="pt-1">
                  <select
                    value={waypointPort.id}
                    onChange={e => {
                      const p = INDIAN_PORTS.find(x => x.id === e.target.value);
                      if (p) setWaypointPort(p);
                    }}
                    className="w-full bg-orca-bg border border-orca-border text-white text-xs p-2 rounded-xl focus:outline-none focus:border-orca-teal"
                  >
                    {INDIAN_PORTS.map(p => (
                      <option key={p.id} value={p.id}>
                        Waypoint: {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Route Alternatives & Turn-by-Turn List */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
            {/* Route Cards: Click switches active route and redraws map */}
            <div className="space-y-2.5">
              <span className="text-[10px] uppercase font-bold text-orca-muted tracking-wider block">
                Route Alternatives (Click to Preview)
              </span>

              {routes.map((rt, idx) => {
                const isSelected = selectedRouteIndex === idx;
                return (
                  <div
                    key={rt.name}
                    onClick={() => setSelectedRouteIndex(idx)}
                    className={`
                      p-3.5 rounded-xl border transition-all cursor-pointer space-y-2
                      ${
                        isSelected
                          ? 'bg-orca-surface-2 border-orca-teal shadow-md shadow-orca-teal/10 ring-1 ring-orca-teal/40'
                          : 'bg-orca-surface border-orca-border hover:border-orca-teal/40'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Route size={14} className={isSelected ? 'text-orca-teal' : 'text-orca-muted'} />
                        <span>{rt.name}</span>
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {rt.safetyScore}% Safe
                      </span>
                    </div>

                    <p className="text-xs text-orca-muted leading-relaxed">
                      {rt.summary}
                    </p>

                    <div className="grid grid-cols-3 gap-2 text-[11px] bg-orca-bg/60 p-2 rounded-lg border border-orca-border font-mono">
                      <div>
                        <span className="text-orca-muted block text-[9px] uppercase">Dist</span>
                        <strong className="text-white">{rt.totalDistanceNm} nm</strong>
                      </div>
                      <div>
                        <span className="text-orca-muted block text-[9px] uppercase">ETA</span>
                        <strong className="text-white">{rt.estimatedHours} hrs</strong>
                      </div>
                      <div>
                        <span className="text-orca-muted block text-[9px] uppercase">Speed</span>
                        <strong className="text-cyan-400">{rt.avgSpeedKnots} kts</strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Turn-by-Turn Leg Schedule */}
            {activeRoute && (
              <div className="bg-orca-surface border border-orca-border rounded-xl p-3.5 space-y-2.5 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-orca-muted tracking-wider block">
                  Waypoint Navigation Plan ({activeRoute.legs?.length || 0} legs)
                </span>

                <div className="space-y-2">
                  {activeRoute.legs?.slice(0, 5).map(leg => (
                    <div key={leg.legNumber} className="flex items-center justify-between text-xs p-2 rounded-lg bg-orca-bg/50 border border-orca-border/50">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-orca-surface-2 text-orca-teal font-bold flex items-center justify-center text-[10px]">
                          {leg.legNumber}
                        </span>
                        <div>
                          <div className="text-white font-medium">Heading {leg.bearingFormatted}</div>
                          <div className="text-[10px] text-orca-muted">{leg.distanceNm} nm transit</div>
                        </div>
                      </div>
                      <span className="text-[11px] text-orca-muted font-mono">{leg.steerInstruction}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Bottom Departure Action */}
          <div className="p-3.5 bg-orca-bg border-t border-orca-border flex items-center justify-between flex-shrink-0">
            <div className="text-xs">
              <span className="text-orca-muted block text-[10px]">Selected Route Distance</span>
              <strong className="text-white font-mono text-sm">{activeRoute?.totalDistanceNm || 0} nm</strong>
            </div>

            <button
              onClick={() => alert(`Active Route coordinates exported for onboard navigation (${activeRoute?.totalDistanceNm} nm). Safe passage!`)}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-orca-teal hover:bg-orca-teal/90 text-orca-bg shadow-md transition-all flex items-center gap-1.5"
            >
              <Navigation size={13} />
              <span>Engage Passage Plan</span>
            </button>
          </div>
        </div>

        {/* ── Right Leaflet Map Panel (Draws Selected Polyline & Avoidance Arcs) ── */}
        <div className="flex-1 min-h-0 h-full relative bg-orca-bg">
          <MapContainer
            center={MANGALORE_FALLBACK}
            zoom={8}
            className="w-full h-full"
            zoomControl={false}
          >
            <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
            <MapController
              bounds={polylineLatLngs.length > 1 ? polylineLatLngs : null}
              center={[originPort.lat, originPort.lon]}
            />

            {/* Active Selected Route Polyline (Bold Cyan) */}
            {activeRoute && (
              <Polyline
                positions={activeRoute.coordinates}
                pathOptions={{
                  color: '#00D8FF',
                  weight: 5,
                  opacity: 0.95,
                }}
              />
            )}

            {/* Alternate Route Polyline (Dashed Muted) */}
            {alternateRoute && (
              <Polyline
                positions={alternateRoute.coordinates}
                pathOptions={{
                  color: '#94A3B8',
                  weight: 3,
                  opacity: 0.6,
                  dashArray: '6, 6',
                }}
              />
            )}

            {/* Origin Marker */}
            <CircleMarker
              center={[originPort.lat, originPort.lon]}
              radius={8}
              pathOptions={{ color: '#10B981', fillColor: '#10B981', fillOpacity: 1, weight: 3 }}
            >
              <Popup>
                <div className="text-xs">
                  <strong className="text-emerald-500 block">Departure: {originPort.name}</strong>
                  <span>Lat: {originPort.lat.toFixed(3)}°, Lon: {originPort.lon.toFixed(3)}°</span>
                </div>
              </Popup>
            </CircleMarker>

            {/* Destination Marker */}
            <CircleMarker
              center={[destinationPort.lat, destinationPort.lon]}
              radius={8}
              pathOptions={{ color: '#00D8FF', fillColor: '#00D8FF', fillOpacity: 1, weight: 3 }}
            >
              <Popup>
                <div className="text-xs">
                  <strong className="text-cyan-500 block">Destination: {destinationPort.name}</strong>
                  <span>Lat: {destinationPort.lat.toFixed(3)}°, Lon: {destinationPort.lon.toFixed(3)}°</span>
                </div>
              </Popup>
            </CircleMarker>

            {/* Waypoint Marker */}
            {hasWaypoint && waypointPort && (
              <CircleMarker
                center={[waypointPort.lat, waypointPort.lon]}
                radius={7}
                pathOptions={{ color: '#F59E0B', fillColor: '#F59E0B', fillOpacity: 1, weight: 2 }}
              >
                <Popup>
                  <div className="text-xs">
                    <strong className="text-amber-500">Waypoint: {waypointPort.name}</strong>
                  </div>
                </Popup>
              </CircleMarker>
            )}

            {/* Hazard Alert Overlays with Collision Avoidance Radii */}
            {SAMPLE_HAZARD_ZONES.map(h => (
              <Circle
                key={h.id}
                center={[h.lat, h.lon]}
                radius={(h.radiusKm || 30) * 1000}
                pathOptions={{
                  color: h.color,
                  fillColor: h.fillColor,
                  fillOpacity: 0.2,
                  weight: 1.5,
                  dashArray: '5, 5',
                }}
              >
                <Popup>
                  <div className="text-xs">
                    <strong className="text-red-500">{h.title}</strong>
                    <p>Radius: {h.radiusKm} km avoidance zone</p>
                  </div>
                </Popup>
              </Circle>
            ))}
          </MapContainer>

          {/* Floating Map Legend */}
          <div className="absolute top-4 right-4 bg-orca-surface/90 backdrop-blur border border-orca-border p-3 rounded-xl shadow-xl z-[400] text-xs space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-orca-muted block">Marine Route Overlay</span>
            <div className="flex items-center gap-2">
              <span className="w-4 h-1 bg-[#00D8FF] rounded" />
              <span className="text-white text-[11px]">Selected Passage ({activeRoute?.name?.split(' ')[0]})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-1 bg-slate-400 border border-dashed rounded" />
              <span className="text-white text-[11px]">Alternative Path</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-white text-[11px]">Origin Harbor</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#00D8FF]" />
              <span className="text-white text-[11px]">Target Destination</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500/40 border border-red-500" />
              <span className="text-white text-[11px]">Hazard Exclusion Buffer</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
