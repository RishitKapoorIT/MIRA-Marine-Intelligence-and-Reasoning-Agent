import { useState, useEffect } from 'react';
import { GeoJSON } from 'react-leaflet';
import { getIndiaEEZ } from '../../../data/boundaries.js';

/**
 * Renders India's EEZ boundary as a dashed teal GeoJSON stroke.
 * Source: simplified polygon from marineregions.org (VLIZ), bundled as a static asset.
 */
export default function BoundariesLayer() {
  const [geoData, setGeoData] = useState(null);
  const [error, setError]     = useState(false);

  useEffect(() => {
    getIndiaEEZ().then(setGeoData).catch(() => setError(true));
  }, []);

  if (error || !geoData) return null;

  return (
    <GeoJSON
      key={JSON.stringify(geoData)}
      data={geoData}
      style={() => ({
        color: '#30E8B8',
        weight: 2,
        opacity: 0.7,
        fillOpacity: 0,
        dashArray: '8 5',
      })}
      onEachFeature={(feature, layer) => {
        layer.bindTooltip('India EEZ · marineregions.org (VLIZ)', {
          permanent: false,
          direction: 'top',
          className: 'text-xs',
        });
      }}
    />
  );
}
