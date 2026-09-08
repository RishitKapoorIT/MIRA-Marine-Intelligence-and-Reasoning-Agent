import { useState, useEffect } from 'react';
import { TileLayer, CircleMarker, Tooltip, Popup } from 'react-leaflet';
import { getSstTileUrl, fetchSstObservations } from '../../../data/sst.js';

function getSstColor(temp) {
  if (temp >= 30.0) return '#EF4444'; // Hot red
  if (temp >= 28.5) return '#F97316'; // Warm orange
  if (temp >= 27.5) return '#F59E0B'; // Amber
  return '#06B6D4'; // Cool cyan
}

/**
 * Real SST Layer:
 * 1. NASA GIBS Satellite WMTS TileLayer (MODIS/MUR)
 * 2. Real observation points with exact °C readings and popups
 * 3. On-map floating temperature gradient legend
 */
export default function SstLayer({ mapCenter = [13.0, 74.5] }) {
  const [obsData, setObsData] = useState({ points: [], isLive: false, source: '' });
  const [loading, setLoading] = useState(true);

  const centerLat = mapCenter[0] || 13.0;
  const centerLon = mapCenter[1] || 74.5;

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchSstObservations(centerLat, centerLon)
      .then((data) => {
        if (active) {
          setObsData(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [Math.round(centerLat * 10) / 10, Math.round(centerLon * 10) / 10]);

  return (
    <>
      {/* 1. NASA GIBS Global Satellite SST TileLayer */}
      <TileLayer
        url={getSstTileUrl()}
        opacity={0.5}
        maxZoom={9}
        attribution="NASA GIBS / EOSDIS Sea Surface Temperature"
      />

      {/* 2. Interactive Coastal Observation Circles */}
      {obsData.points.map((pt) => {
        const color = getSstColor(pt.temperature);
        return (
          <CircleMarker
            key={pt.id}
            center={[pt.lat, pt.lon]}
            radius={8}
            pathOptions={{
              color: '#FFFFFF',
              weight: 2,
              fillColor: color,
              fillOpacity: 0.9,
            }}
          >
            <Tooltip direction="top" offset={[0, -6]}>
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', fontWeight: 700 }}>
                🌡 {pt.temperature}°C SST
              </span>
            </Tooltip>
            <Popup>
              <div className="text-xs p-1 space-y-1 min-w-[180px]">
                <div className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                  <span>SST: {pt.temperature}°C</span>
                </div>
                <div className="text-gray-600">
                  Thermal Status: <strong className="capitalize text-gray-800">{pt.status}</strong>
                </div>
                {pt.salinity && (
                  <div className="text-gray-600">Salinity: {pt.salinity} PSU</div>
                )}
                <div className="text-[10px] text-gray-400 border-t pt-1 mt-1">
                  Source: {obsData.source || 'NASA GIBS & PFZ Synthesis'}
                </div>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}

      {/* 3. On-Map Legend for SST Scale */}
      <div className="leaflet-bottom leaflet-left !pointer-events-auto" style={{ zIndex: 1000, marginBottom: '28px', marginLeft: '12px' }}>
        <div className="bg-orca-surface/95 backdrop-blur-md border border-orca-border rounded-xl p-3 shadow-xl text-white max-w-[240px]">
          <div className="flex items-center justify-between text-xs font-bold mb-1.5">
            <span className="flex items-center gap-1">
              <span>🌡</span>
              <span>Sea Surface Temp (SST)</span>
            </span>
            <span className="text-[10px] text-orca-teal font-mono">°C</span>
          </div>
          {/* Gradient Scale Bar */}
          <div className="h-2.5 rounded-full w-full mb-1" style={{
            background: 'linear-gradient(to right, #06B6D4, #F59E0B, #F97316, #EF4444)'
          }} />
          <div className="flex justify-between text-[10px] text-orca-muted font-semibold">
            <span>&lt;27°C Cool</span>
            <span>28.5°C Optimal</span>
            <span>&gt;30°C Warm</span>
          </div>
          <div className="mt-2 text-[9px] text-orca-muted/80 border-t border-orca-border/50 pt-1 leading-tight">
            NASA GIBS satellite tiles + {obsData.isLive ? 'Live PFZ telemetry' : 'Regional marine baseline'}
          </div>
        </div>
      </div>
    </>
  );
}
