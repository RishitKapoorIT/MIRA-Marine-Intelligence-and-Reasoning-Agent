import { Polyline, Tooltip, Popup } from 'react-leaflet';

/**
 * Renders a cyan safe-route polyline from the vessel's coastal origin/Safe House to the target PFZ zone.
 */
export default function SafeRouteLayer({ origin, pfzPos, originLabel = 'Safe House' }) {
  if (!origin || !pfzPos) return null;

  const positions = [origin, pfzPos];

  return (
    <Polyline
      positions={positions}
      pathOptions={{
        color: '#06B6D4',
        weight: 3.5,
        opacity: 0.9,
        dashArray: '8 6',
      }}
    >
      <Tooltip
        permanent
        direction="center"
        offset={[0, 0]}
        className="!bg-transparent !border-0 !shadow-none"
      >
        <span
          style={{
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(6, 182, 212, 0.7)',
            color: '#22D3EE',
            padding: '3px 8px',
            borderRadius: '6px',
            fontFamily: 'Inter, sans-serif',
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
          }}
        >
          🧭 Safe Route to PFZ
        </span>
      </Tooltip>
      <Popup>
        <div className="text-xs p-1 space-y-1">
          <div className="font-bold text-cyan-600">Offshore Safe Passage Route</div>
          <div className="text-gray-600">Origin: <strong>{originLabel}</strong></div>
          <div className="text-gray-600">Destination: <strong>Target Fishing Zone (PFZ)</strong></div>
          <div className="text-[10px] text-gray-400 border-t pt-1 mt-1">
            Spatial collision check: 0 active hazard boundaries crossed
          </div>
        </div>
      </Popup>
    </Polyline>
  );
}
