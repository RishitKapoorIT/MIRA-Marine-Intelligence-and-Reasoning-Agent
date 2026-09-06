import { Rectangle, Tooltip } from 'react-leaflet';

const INDIA_OCEAN_BOUNDS = [[5, 65], [25, 97]];

/**
 * Chlorophyll concentration placeholder layer.
 * Shows a green-tinted overlay with a "sample data" badge.
 * Real implementation: swap body of getChlorophyllLayer() in data/chlorophyll.js.
 * This component requires NO changes when the live feed is connected.
 */
export default function ChlorophyllLayer() {
  return (
    <Rectangle
      bounds={INDIA_OCEAN_BOUNDS}
      pathOptions={{
        color: '#10b981',
        fillColor: '#10b981',
        fillOpacity: 0.08,
        weight: 1,
        dashArray: '4 4',
        opacity: 0.4,
      }}
    >
      <Tooltip permanent direction="center" className="text-xs">
        🦠 Chlorophyll — Sample data · Live satellite feed coming in a later iteration
      </Tooltip>
    </Rectangle>
  );
}
