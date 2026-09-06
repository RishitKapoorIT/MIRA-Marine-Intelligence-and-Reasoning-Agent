import { Rectangle, Tooltip } from 'react-leaflet';

// Approximate bounding box covering Indian Ocean waters
const INDIA_OCEAN_BOUNDS = [[5, 65], [25, 97]];

/**
 * SST (Sea Surface Temperature) placeholder layer.
 * Shows a warm-tinted overlay with a "sample data" badge.
 * Real implementation: swap body of getSstLayer() in data/sst.js
 * to return a tile URL — this component requires NO changes.
 */
export default function SstLayer() {
  return (
    <Rectangle
      bounds={INDIA_OCEAN_BOUNDS}
      pathOptions={{
        color: '#f97316',
        fillColor: '#f97316',
        fillOpacity: 0.08,
        weight: 1,
        dashArray: '4 4',
        opacity: 0.4,
      }}
    >
      <Tooltip permanent direction="center" className="text-xs">
        🌡 SST — Sample data · Live satellite feed coming in a later iteration
      </Tooltip>
    </Rectangle>
  );
}
