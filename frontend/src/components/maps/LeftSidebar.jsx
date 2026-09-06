import { useBearingDistance } from '../../hooks/useBearingDistance.js';
import { INDIA_CENTER, WATER_BODIES } from '../../config/map.js';

/**
 * Left sidebar.
 * mapRef: forwarded Leaflet map instance ref — used for flyTo calls.
 * userPos: [lat, lon] from useGeolocation (always present).
 */
export default function LeftSidebar({ userPos, mapRef }) {
  const { km, bearing } = useBearingDistance(userPos, INDIA_CENTER);

  function flyTo(key) {
    const wb = WATER_BODIES[key];
    mapRef.current?.flyTo(wb.center, wb.zoom, { duration: 1.5 });
  }

  return (
    <aside className="w-64 flex-shrink-0 bg-orca-surface border-r border-orca-border p-4 flex flex-col overflow-y-auto">

      {/* Header chip */}
      <div className="flex items-center justify-between mb-4">
        <span className="micro-label">India • Maritime View</span>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-orca-teal/20 text-orca-teal border border-orca-teal/30">
          {km} km · {bearing}
        </span>
      </div>

      {/* Region card */}
      <div className="card p-4 mb-4">
        <h2 className="text-2xl font-bold text-white mb-1">INDIA</h2>
        <p className="text-orca-muted text-xs leading-relaxed">
          Regional coastline and labeled water bodies for marine intelligence planning.
        </p>
      </div>

      {/* Water body rows */}
      <div className="space-y-2 mb-4">
        {Object.entries(WATER_BODIES).map(([key, wb]) => (
          <button
            key={key}
            onClick={() => flyTo(key)}
            className="
              w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-white
              bg-orca-surface-2 border border-orca-border
              hover:border-orca-teal/40 hover:bg-orca-surface-2/80
              transition-all duration-150 text-left
            "
          >
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: wb.color }} />
            {wb.label}
          </button>
        ))}
      </div>

      {/* Regional focus note */}
      <div className="card p-4 mt-auto">
        <div className="micro-label mb-2">Regional Focus</div>
        <p className="text-orca-muted text-xs leading-relaxed">
          Use the map layers panel to toggle PFZ, weather, hazards, boundaries and route guidance.
        </p>
      </div>
    </aside>
  );
}
