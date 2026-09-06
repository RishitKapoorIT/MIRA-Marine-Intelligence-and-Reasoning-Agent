import { useState, useRef } from 'react';
import { useGeolocation } from '../../hooks/useGeolocation.js';
import { useLayerState }  from '../../hooks/useLayerState.js';

import MapsTopNav     from './MapsTopNav.jsx';
import LeftSidebar    from './LeftSidebar.jsx';
import MapArea        from './MapArea.jsx';
import MapHeaderStrip from './MapHeaderStrip.jsx';
import BottomTabBar   from './BottomTabBar.jsx';

/**
 * Route "/maps" — Marine Maps (India).
 *
 * mapRef is created here and forwarded to MapArea (which sets it to the Leaflet map instance
 * via MapEventHandler), then passed to MapsTopNav and LeftSidebar so they can call flyTo
 * without being mounted inside <MapContainer>.
 */
export default function MapsPage() {
  const mapRef = useRef(null);

  const { position, isReal, loading } = useGeolocation();
  const { layers, toggleLayer }       = useLayerState();
  const [hazardCount, setHazardCount] = useState(2);

  return (
    <div className="h-screen flex flex-col bg-orca-bg overflow-hidden">

      {/* Top nav — receives mapRef for search/home flyTo */}
      <MapsTopNav mapRef={mapRef} />

      {/* Content row */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left sidebar */}
        {!loading && (
          <LeftSidebar userPos={position} mapRef={mapRef} />
        )}

        {/* Map column */}
        <div className="flex flex-col flex-1 overflow-hidden relative">
          <MapHeaderStrip layers={layers} />

          {loading ? (
            <div className="flex-1 flex items-center justify-center text-orca-muted text-sm">
              Acquiring location…
            </div>
          ) : (
            <MapArea
              userPos={position}
              isRealPos={isReal}
              layers={layers}
              toggleLayer={toggleLayer}
              onHazardCount={setHazardCount}
              mapRef={mapRef}
            />
          )}
        </div>
      </div>

      {/* Bottom tab bar */}
      <BottomTabBar
        layers={layers}
        toggleLayer={toggleLayer}
        hazardCount={hazardCount}
      />
    </div>
  );
}
