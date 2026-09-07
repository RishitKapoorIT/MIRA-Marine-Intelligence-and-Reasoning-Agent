import React from 'react';
import { useLocationState } from '../../context/LocationContext.jsx';
import { MapPin } from 'lucide-react';

/**
 * Clean title strip above the map canvas — displays map title and active focus region.
 * Redundant layer pills removed per Brief Part A2.
 */
export default function MapHeaderStrip() {
  const { currentLocation } = useLocationState();

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-orca-surface border-b border-orca-border">
      <span className="micro-label text-orca-muted uppercase tracking-wider font-bold text-[11px]">
        India Marine Map · Satellite Telemetry Canvas
      </span>
      <div className="flex items-center gap-2 text-xs text-white">
        <MapPin size={13} className="text-orca-teal" />
        <span className="font-semibold">{currentLocation?.name || 'Mangalore Coastal Basin'}</span>
        <span className="text-orca-muted text-[10px]">
          ({currentLocation?.lat?.toFixed(2)}°N, {currentLocation?.lon?.toFixed(2)}°E)
        </span>
      </div>
    </div>
  );
}
