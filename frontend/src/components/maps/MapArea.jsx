import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

import { TILE_URL, TILE_ATTRIBUTION, INDIA_CENTER, INDIA_ZOOM } from '../../config/map.js';
import { getPfzZones } from '../../data/pfz.js';
import { useAuth } from '../../context/AuthContext.jsx';

import PfzLayer         from './layers/PfzLayer.jsx';
import WeatherLayer     from './layers/WeatherLayer.jsx';
import HazardsLayer     from './layers/HazardsLayer.jsx';
import BoundariesLayer  from './layers/BoundariesLayer.jsx';
import SstLayer         from './layers/SstLayer.jsx';
import ChlorophyllLayer from './layers/ChlorophyllLayer.jsx';
import SafeRouteLayer   from './layers/SafeRouteLayer.jsx';
import LayersPanel      from './LayersPanel.jsx';

// Fix Leaflet default icon paths broken by Vite bundling
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

/** Tracks map center for WeatherLayer/SST/Chlorophyll and exposes the map instance via forwarded ref */
function MapEventHandler({ onCenterChange, mapRef }) {
  const map = useMapEvents({
    moveend: (e) => {
      const c = e.target.getCenter();
      onCenterChange([c.lat, c.lng]);
    },
  });
  useEffect(() => {
    if (mapRef) mapRef.current = map;
  }, [map, mapRef]);
  return null;
}

/**
 * Main marine map canvas.
 * Handles:
 *   - "You" live GPS/dev marker (Gold/Amber)
 *   - "Safe House" profile-backed marker (Solid Violet)
 *   - Sensible coastal safe routing
 *   - Satellite & environmental layers
 */
export default function MapArea({ userPos, isRealPos, layers, toggleLayer, onHazardCount, mapRef }) {
  const { user } = useAuth();
  const [mapCenter, setMapCenter] = useState(INDIA_CENTER);
  const [pfzPos, setPfzPos]       = useState(null);

  // Safe House must come strictly from the authenticated user profile, NEVER browser geolocation
  const safeHouse = user?.safe_house || {
    label: 'Mangalore Old Port (Default Safe House)',
    lat: 12.9141,
    lon: 74.8560,
  };

  // Determine sensible route origin:
  // If userPos is landlocked/inland (dev environment in Rajasthan/UP), anchor route to coastal Safe House
  const isUserInland = userPos && (userPos[0] > 18 && userPos[1] > 74.5 && userPos[1] < 84);
  const routeOrigin = isUserInland
    ? [safeHouse.lat, safeHouse.lon]
    : (userPos || [safeHouse.lat, safeHouse.lon]);

  // Resolve nearest PFZ position for SafeRouteLayer polyline endpoint
  useEffect(() => {
    if (!routeOrigin) return;
    getPfzZones(routeOrigin[0], routeOrigin[1]).then((zones) => {
      if (zones[0]) setPfzPos([zones[0].lat, zones[0].lon]);
    });
  }, [routeOrigin[0], routeOrigin[1]]);

  return (
    <div className="relative flex-1 overflow-hidden">
      {/* Floating layers panel */}
      <div className="absolute top-4 right-4 z-[1000] pointer-events-auto">
        <LayersPanel layers={layers} toggleLayer={toggleLayer} />
      </div>

      <MapContainer
        center={INDIA_CENTER}
        zoom={INDIA_ZOOM}
        className="h-full w-full"
        zoomControl={true}
        attributionControl={true}
        style={{ zIndex: 0 }}
      >
        {/* Base tiles */}
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />

        {/* Map event wiring + ref forwarding */}
        <MapEventHandler onCenterChange={setMapCenter} mapRef={mapRef} />

        {/* 1. "Safe House" Marker — SOLID VIOLET PIN (Sourced strictly from Profile, never browser GPS) */}
        {safeHouse?.lat != null && safeHouse?.lon != null && (
          <CircleMarker
            center={[safeHouse.lat, safeHouse.lon]}
            radius={11}
            pathOptions={{
              color: '#6D28D9',     // Violet dark border
              fillColor: '#8B5CF6', // Solid Purple/Violet fill
              fillOpacity: 1,
              weight: 3,
            }}
          >
            <Tooltip permanent direction="top" offset={[0, -14]}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: '#6D28D9',
                  color: '#FFFFFF',
                  border: '1px solid #A78BFA',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '11px',
                  fontWeight: 700,
                  boxShadow: '0 2px 10px rgba(109, 40, 217, 0.5)',
                  whiteSpace: 'nowrap',
                }}
              >
                <span>🏠</span>
                <span>Safe House: {safeHouse.label || 'Home Base'}</span>
              </div>
            </Tooltip>
            <Popup>
              <div className="text-xs p-1.5 space-y-1.5 min-w-[200px]">
                <div className="font-bold text-purple-700 text-sm flex items-center gap-1.5">
                  <span className="text-base">🏠</span>
                  <span>Safe House Harbor</span>
                </div>
                <div className="text-gray-700 font-semibold">{safeHouse.label}</div>
                <div className="text-gray-500 font-mono text-[11px]">
                  Coordinates: {safeHouse.lat.toFixed(4)}°N, {safeHouse.lon.toFixed(4)}°E
                </div>
                <div className="text-[10px] text-gray-500 bg-purple-50 border border-purple-200 rounded p-1.5 leading-relaxed">
                  Profile-Anchored Safe House: Serves as primary emergency retreat harbor, fallback GPS datum, and routing origin.
                </div>
              </div>
            </Popup>
          </CircleMarker>
        )}

        {/* 2. "You" Marker — GOLD / AMBER PIN (Live Geolocation or vessel fallback) */}
        {userPos && (
          <CircleMarker
            center={userPos}
            radius={9}
            pathOptions={{
              color: '#B45309',     // Deep amber border
              fillColor: '#FBBF24', // Gold / yellow fill
              fillOpacity: 1,
              weight: 3,
            }}
          >
            <Tooltip permanent direction="bottom" offset={[0, 12]}>
              <span
                style={{
                  background: 'rgba(15, 23, 42, 0.85)',
                  color: '#FBBF24',
                  border: '1px solid rgba(251, 191, 36, 0.6)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '10px',
                  fontWeight: 700,
                }}
              >
                📍 You {isRealPos ? '(Live GPS)' : '(Default)'}
              </span>
            </Tooltip>
          </CircleMarker>
        )}

        {/* Conditional data layers */}
        {layers.pfz         && <PfzLayer userPos={routeOrigin} />}
        {layers.weather     && <WeatherLayer mapCenter={mapCenter} />}
        {layers.hazards     && <HazardsLayer onHazardCount={onHazardCount} />}
        {layers.boundaries  && <BoundariesLayer />}
        {layers.sst         && <SstLayer mapCenter={mapCenter} />}
        {layers.chlorophyll && <ChlorophyllLayer mapCenter={mapCenter} />}
        {layers.safeRoute   && (
          <SafeRouteLayer
            origin={routeOrigin}
            pfzPos={pfzPos}
            originLabel={isUserInland ? `${safeHouse.label} (Safe House)` : 'Current Vessel Position'}
          />
        )}
      </MapContainer>
    </div>
  );
}
