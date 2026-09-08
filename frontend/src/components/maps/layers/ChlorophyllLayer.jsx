import { useState, useEffect } from 'react';
import { TileLayer, CircleMarker, Tooltip, Popup } from 'react-leaflet';
import { getChlorophyllTileUrl, fetchChlorophyllObservations } from '../../../data/chlorophyll.js';

function getChlorophyllColor(val) {
  if (val >= 0.40) return '#047857'; // Deep phytoplankton bloom
  if (val >= 0.20) return '#10B981'; // Optimal ocean concentration
  if (val >= 0.10) return '#34D399'; // Moderate
  return '#6EE7B7'; // Oligotrophic / low
}

/**
 * Real Chlorophyll-a Layer:
 * 1. NASA GIBS Satellite WMTS TileLayer (MODIS Aqua L3)
 * 2. Real observation points with exact mg/m³ readings and popups
 * 3. On-map floating chlorophyll concentration legend
 */
export default function ChlorophyllLayer({ mapCenter = [13.0, 74.5] }) {
  const [obsData, setObsData] = useState({ points: [], isLive: false, source: '' });
  const [loading, setLoading] = useState(true);

  const centerLat = mapCenter[0] || 13.0;
  const centerLon = mapCenter[1] || 74.5;

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchChlorophyllObservations(centerLat, centerLon)
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
      {/* 1. NASA GIBS Global Satellite Chlorophyll-a TileLayer */}
      <TileLayer
        url={getChlorophyllTileUrl()}
        opacity={0.5}
        maxZoom={7}
        attribution="NASA GIBS / MODIS Aqua Chlorophyll-a"
      />

      {/* 2. Interactive Coastal Observation Circles */}
      {obsData.points.map((pt) => {
        const color = getChlorophyllColor(pt.chlorophyll);
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
                🦠 {pt.chlorophyll} mg/m³
              </span>
            </Tooltip>
            <Popup>
              <div className="text-xs p-1 space-y-1 min-w-[180px]">
                <div className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                  <span>Chlorophyll-a: {pt.chlorophyll} mg/m³</span>
                </div>
                <div className="text-gray-600">
                  Productivity: <strong className="capitalize text-gray-800">{pt.status}</strong>
                </div>
                <div className="text-gray-500 text-[11px]">
                  Indicator of primary marine food web & fish aggregation potential.
                </div>
                <div className="text-[10px] text-gray-400 border-t pt-1 mt-1">
                  Source: {obsData.source || 'NASA MODIS & PFZ Synthesis'}
                </div>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}

      {/* 3. On-Map Legend for Chlorophyll Scale */}
      <div className="leaflet-bottom leaflet-left !pointer-events-auto" style={{ zIndex: 1000, marginBottom: '28px', marginLeft: '12px' }}>
        <div className="bg-orca-surface/95 backdrop-blur-md border border-orca-border rounded-xl p-3 shadow-xl text-white max-w-[240px]">
          <div className="flex items-center justify-between text-xs font-bold mb-1.5">
            <span className="flex items-center gap-1">
              <span>🦠</span>
              <span>Chlorophyll-a Concentration</span>
            </span>
            <span className="text-[10px] text-emerald-400 font-mono">mg/m³</span>
          </div>
          {/* Gradient Scale Bar */}
          <div className="h-2.5 rounded-full w-full mb-1" style={{
            background: 'linear-gradient(to right, #6EE7B7, #34D399, #10B981, #047857)'
          }} />
          <div className="flex justify-between text-[10px] text-orca-muted font-semibold">
            <span>&lt;0.1 Low</span>
            <span>0.25 Optimal</span>
            <span>&gt;0.5 Bloom</span>
          </div>
          <div className="mt-2 text-[9px] text-orca-muted/80 border-t border-orca-border/50 pt-1 leading-tight">
            NASA GIBS satellite tiles + {obsData.isLive ? 'Live PFZ telemetry' : 'Regional marine baseline'}
          </div>
        </div>
      </div>
    </>
  );
}
