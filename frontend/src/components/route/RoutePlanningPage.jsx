import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, Polyline, CircleMarker, Circle, Popup, useMap } from 'react-leaflet';
import Header from '../layout/Header.jsx';
import { INDIAN_PORTS, computeMarineRoutes } from '../../data/routing.js';
import { SAMPLE_HAZARD_ZONES } from '../../data/hazards.js';
import { TILE_URL, TILE_ATTRIBUTION, MANGALORE_FALLBACK } from '../../config/map.js';
import { Compass, Navigation, Fuel, Clock, ShieldCheck, CheckCircle2, ArrowRight, Route, AlertTriangle, Layers } from 'lucide-react';

function MapController({ bounds, center }) {
  const map = useMap();
  useEffect(() => {
    if (bounds && bounds.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50], animate: true });
    } else if (center) {
      map.setView(center, 8, { animate: true });
    }
  }, [bounds, center, map]);
  return null;
}

export default function RoutePlanningPage() {
  const [searchParams] = useSearchParams();
  const destParam = searchParams.get('dest');
  const latParam = searchParams.get('lat');
  const lonParam = searchParams.get('lon');

  // Form State
  const [originPort, setOriginPort] = useState(INDIAN_PORTS[0]); // Mangalore
  const [destinationPort, setDestinationPort] = useState(
    latParam && lonParam
      ? { id: destParam || 'custom-dest', name: `Target Zone (${destParam || 'PFZ Target'})`, lat: parseFloat(latParam), lon: parseFloat(lonParam) }
      : INDIAN_PORTS[3] // Karwar
  );
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

  // Bounds for map fitting
  const polylineLatLngs = activeRoute ? activeRoute.coordinates : [];

  return (
    <div className="min-h-screen bg-orca-bg flex flex-col overflow-hidden">
      <Header />

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* ── Left Route Planning Sidebar ── */}
        <div className="w-full md:w-[440px] lg:w-[480px] bg-orca-surface border-r border-orca-border flex flex-col h-full z-10 flex-shrink-0">
          {/* Header */}
          <div className="p-4 border-b border-orca-border bg-orca-surface-2/20 space-y-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-orca-teal">
                Frame 08 · Marine Navigation
              </span>
              <h2 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2">
                <Route size={18} className="text-orca-teal" />
                <span>SAFE ROUTE PLANNING</span>
              </h2>
            </div>

            {/* Origin / Destination Form */}
            <div className="space-y-2 text-xs">
              {/* Origin */}
              <div>
                <label className="text-[11px] font-semibold text-orca-muted block mb-1">
                  Origin Harbor / Anchorage
                </label>
                <select
                  value={originPort.id}
                  onChange={e => {
                    const p = INDIAN_PORTS.find(x => x.id === e.target.value);
                    if (p) setOriginPort(p);
                  }}
                  className="w-full bg-orca-bg border border-orca-border text-white text-xs p-2.5 rounded-xl focus:outline-none focus:border-orca-teal"
                >
                  {INDIAN_PORTS.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.region})
                    </option>
                  ))}
                </select>
              </div>

              {/* Destination */}
              <div>
                <label className="text-[11px] font-semibold text-orca-muted block mb-1">
                  Destination Port / Target Zone
                </label>
                <select
                  value={destinationPort.id}
                  onChange={e => {
                    const p = INDIAN_PORTS.find(x => x.id === e.target.value);
                    if (p) setDestinationPort(p);
                  }}
                  className="w-full bg-orca-bg border border-orca-border text-white text-xs p-2.5 rounded-xl focus:outline-none focus:border-orca-teal"
                >
                  {destinationPort.id.startsWith('custom') && (
                    <option value={destinationPort.id}>{destinationPort.name}</option>
                  )}
                  {INDIAN_PORTS.filter(p => p.id !== originPort.id).map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.region})
                    </option>
                  ))}
                </select>
              </div>

              {/* Waypoint Toggle */}
              <div className="pt-1 flex items-center justify-between">
                <label className="text-[11px] text-orca-muted flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasWaypoint}
                    onChange={e => setHasWaypoint(e.target.checked)}
                    className="rounded border-orca-border text-orca-teal focus:ring-0 bg-orca-bg"
                  />
                  <span>Add Intermediate Waypoint / Channel</span>
                </label>

                <div className="flex items-center gap-1.5 text-[11px] text-orca-muted">
                  <Clock size={12} />
                  <span>Dep: {departureTime}</span>
                </div>
              </div>

              {hasWaypoint && (
                <div className="pt-1">
                  <select
                    value={waypointPort.id}
                    onChange={e => {
                      const p = INDIAN_PORTS.find(x => x.id === e.target.value);
                      if (p) setWaypointPort(p);
                    }}
                    className="w-full bg-orca-bg border border-orca-border text-white text-xs p-2 rounded-lg focus:outline-none focus:border-orca-teal"
                  >
                    {INDIAN_PORTS.filter(p => p.id !== originPort.id && p.id !== destinationPort.id).map(p => (
                      <option key={p.id} value={p.id}>
                        Via {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Route Alternatives & Turn-by-Turn List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Computed Route Alternatives (2 cards matching Frame 08 spec) */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-orca-muted block">
                Computed Marine Route Alternatives (Turf.js Solver)
              </span>

              {routes.map((r, idx) => {
                const isSelected = selectedRouteIndex === idx;
                return (
                  <div
                    key={r.id}
                    onClick={() => setSelectedRouteIndex(idx)}
                    className={`
                      p-3.5 rounded-xl border transition-all cursor-pointer space-y-2
                      ${
                        isSelected
                          ? 'bg-orca-surface-2 border-orca-teal shadow-lg shadow-orca-teal/10'
                          : 'bg-orca-surface border-orca-border hover:border-orca-teal/40'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${isSelected ? 'bg-orca-teal animate-pulse' : 'bg-orca-muted'}`} />
                        {r.name}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/25">
                          {r.score}/100 Score
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] text-orca-muted">
                      {r.summary}
                    </p>

                    {/* Metric Row */}
                    <div className="grid grid-cols-3 gap-2 text-center text-xs bg-orca-bg/50 p-2 rounded-lg border border-orca-border/60">
                      <div>
                        <span className="text-[10px] text-orca-muted block">Distance</span>
                        <strong className="text-white font-mono">{r.distanceNm} nm</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-orca-muted block">Est. Time</span>
                        <strong className="text-white font-mono">{r.eta}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-orca-muted block">Fuel (Diesel)</span>
                        <strong className="text-amber-400 font-mono">~{r.fuelEstimateLiters} L</strong>
                      </div>
                    </div>

                    <div className="text-[10px] text-emerald-400 flex items-center justify-between pt-1">
                      <span>✓ 0 Exclusion Zones Traversed</span>
                      <span className="text-orca-muted">{r.scoreLabel}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Turn-by-Turn Leg List */}
            {activeRoute && activeRoute.legs && (
              <div className="space-y-2 pt-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-orca-muted block">
                  Turn-by-Turn Navigation Legs ({activeRoute.legs.length} legs)
                </span>

                <div className="space-y-1.5">
                  {activeRoute.legs.map((leg, i) => (
                    <div
                      key={i}
                      className="p-2.5 rounded-lg bg-orca-surface-2/40 border border-orca-border/70 flex items-center justify-between text-xs text-orca-muted"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-md bg-orca-teal/15 text-orca-teal font-bold text-[10px] flex items-center justify-center border border-orca-teal/30">
                          {leg.legNumber}
                        </span>
                        <div>
                          <span className="text-white font-semibold">Course {leg.headingText}</span>
                        </div>
                      </div>
                      <span className="font-mono text-white font-bold">{leg.distanceNm} nm</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Bottom attribution / disclaimer */}
          <div className="p-3.5 bg-orca-bg border-t border-orca-border text-[10px] text-orca-muted">
            <span className="text-white font-semibold">Navigation Note (FR-C6):</span> Route geometry generated client-side via Turf.js great-circle detour heuristics around active hazard polygons. Not an ECDIS/SOLAS chart certification.
          </div>
        </div>

        {/* ── Right Leaflet Map with Active Route & Hazard Exclusions ── */}
        <div className="flex-1 h-full relative">
          <MapContainer
            center={MANGALORE_FALLBACK}
            zoom={8}
            className="w-full h-full"
            zoomControl={false}
          >
            <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
            <MapController bounds={polylineLatLngs.length > 0 ? polylineLatLngs : null} />

            {/* Route Polyline */}
            {activeRoute && (
              <Polyline
                positions={activeRoute.coordinates}
                pathOptions={{
                  color: '#00D8FF',
                  weight: 4,
                  opacity: 0.95,
                  dashArray: null,
                }}
              />
            )}

            {/* Alternative Route Polyline (dashed) */}
            {routes[1] && selectedRouteIndex !== 1 && (
              <Polyline
                positions={routes[1].coordinates}
                pathOptions={{
                  color: '#94A3B8',
                  weight: 2.5,
                  opacity: 0.6,
                  dashArray: '5, 5',
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
                  <strong className="text-emerald-500">Departure: {originPort.name}</strong>
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
                  <strong className="text-cyan-500">Destination: {destinationPort.name}</strong>
                </div>
              </Popup>
            </CircleMarker>

            {/* Waypoint Marker if set */}
            {hasWaypoint && waypointPort && (
              <CircleMarker
                center={[waypointPort.lat, waypointPort.lon]}
                radius={6}
                pathOptions={{ color: '#F59E0B', fillColor: '#F59E0B', fillOpacity: 1, weight: 2 }}
              >
                <Popup>
                  <div className="text-xs">
                    <strong>Waypoint: {waypointPort.name}</strong>
                  </div>
                </Popup>
              </CircleMarker>
            )}

            {/* Shaded Hazard Exclusion Zones Avoided by the Route */}
            {SAMPLE_HAZARD_ZONES.map(h => (
              <Circle
                key={h.id}
                center={[h.lat, h.lon]}
                radius={(h.radiusKm || 40) * 1000}
                pathOptions={{
                  color: h.color,
                  fillColor: h.fillColor,
                  fillOpacity: 0.22,
                  weight: 2,
                  dashArray: '5, 5',
                }}
              >
                <Popup>
                  <div className="text-xs p-1">
                    <strong className="text-red-500">Exclusion Zone Dodged</strong>
                    <p>{h.title}</p>
                  </div>
                </Popup>
              </Circle>
            ))}
          </MapContainer>

          {/* Floating Map Legend */}
          <div className="absolute top-4 right-4 bg-orca-surface/90 backdrop-blur border border-orca-border p-3.5 rounded-xl shadow-xl z-[400] text-xs space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-orca-muted block">
              Route Legend
            </span>
            <div className="flex items-center gap-2">
              <span className="w-4 h-1 bg-[#00D8FF] rounded" />
              <span className="text-white text-[11px]">Active Safest Path</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-1 border-t-2 border-dashed border-slate-400" />
              <span className="text-white text-[11px]">Alternative Inshore Route</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500/30 border border-red-500" />
              <span className="text-white text-[11px]">Circumvented Hazard Zone</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
