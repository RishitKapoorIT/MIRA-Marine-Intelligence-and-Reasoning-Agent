import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

import { TILE_URL, TILE_ATTRIBUTION, INDIA_CENTER, INDIA_ZOOM } from '../../config/map.js';
import { getPfzZones } from '../../data/pfz.js';

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

/** Tracks map center for WeatherLayer and exposes the map instance via the forwarded ref */
function MapEventHandler({ onCenterChange, mapRef }) {
  const map = useMapEvents({
    moveend: (e) => {
      const c = e.target.getCenter();
      onCenterChange([c.lat, c.lng]);
    },
  });
  // Store map instance in the forwarded ref so the parent can call flyTo
  useEffect(() => {
    if (mapRef) mapRef.current = map;
  }, [map, mapRef]);
  return null;
}

/**
 * Main map canvas.
 * Props:
 *   userPos       {[number,number]}  Always present (real GPS or Mangalore fallback)
 *   isRealPos     {boolean}
 *   layers        {object}
 *   toggleLayer   {(name) => void}
 *   onHazardCount {(n) => void}
 *   mapRef        {React.MutableRefObject}  Forwarded to parent so TopNav/Sidebar can flyTo
 */
export default function MapArea({ userPos, isRealPos, layers, toggleLayer, onHazardCount, mapRef }) {
  const [mapCenter, setMapCenter] = useState(INDIA_CENTER);
  const [pfzPos, setPfzPos]       = useState(null);

  // Resolve PFZ position for SafeRouteLayer polyline endpoint
  useEffect(() => {
    if (!userPos) return;
    getPfzZones(userPos[0], userPos[1]).then((zones) => {
      if (zones[0]) setPfzPos([zones[0].lat, zones[0].lon]);
    });
  }, [userPos?.[0], userPos?.[1]]);

  return (
    <div className="relative flex-1 overflow-hidden">
      {/* Floating layers panel — rendered OUTSIDE MapContainer so it doesn't need useMap() */}
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

        {/* "You" marker — ALWAYS rendered */}
        {userPos && (
          <CircleMarker
            center={userPos}
            radius={10}
            pathOptions={{ color: '#FBBF24', fillColor: '#FCD34D', fillOpacity: 1, weight: 3 }}
          >
            <Tooltip permanent direction="top" offset={[0, -12]}>
              <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 11, fontWeight: 700 }}>
                You{!isRealPos ? ' (Mangalore)' : ''}
              </span>
            </Tooltip>
          </CircleMarker>
        )}

        {/* Conditional data layers */}
        {layers.pfz         && <PfzLayer userPos={userPos} />}
        {layers.weather     && <WeatherLayer mapCenter={mapCenter} />}
        {layers.hazards     && <HazardsLayer onHazardCount={onHazardCount} />}
        {layers.boundaries  && <BoundariesLayer />}
        {layers.sst         && <SstLayer />}
        {layers.chlorophyll && <ChlorophyllLayer />}
        {layers.safeRoute   && <SafeRouteLayer userPos={userPos} pfzPos={pfzPos} />}
      </MapContainer>
    </div>
  );
}
