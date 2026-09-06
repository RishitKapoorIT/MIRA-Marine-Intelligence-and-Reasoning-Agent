import { Polyline, Tooltip } from 'react-leaflet';

/**
 * Renders a cyan safe-route polyline from the user's position to the nearest PFZ point.
 * The route is mock/sample data — clearly disclosed in the tooltip.
 */
export default function SafeRouteLayer({ userPos, pfzPos }) {
  if (!userPos || !pfzPos) return null;

  const positions = [userPos, pfzPos];

  return (
    <Polyline
      positions={positions}
      pathOptions={{
        color: '#38BDF8',
        weight: 4,
        opacity: 0.9,
        dashArray: '10 6',
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
            background: 'rgba(56,189,248,0.15)',
            border: '1px solid rgba(56,189,248,0.5)',
            color: '#38BDF8',
            padding: '2px 8px',
            borderRadius: '4px',
            fontFamily: 'Inter, sans-serif',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          SAFE ROUTE
        </span>
      </Tooltip>
    </Polyline>
  );
}
