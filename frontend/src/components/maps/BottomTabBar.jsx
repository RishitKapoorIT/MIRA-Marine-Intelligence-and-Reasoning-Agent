import { LAYER_NAMES } from '../../hooks/useLayerState.js';

const TABS = [
  { key: LAYER_NAMES.PFZ,         emoji: '🎣', label: 'PFZ' },
  { key: LAYER_NAMES.WEATHER,     emoji: '🌦', label: 'Weather' },
  { key: LAYER_NAMES.HAZARDS,     emoji: '⚠',  label: 'Hazards' },
  { key: LAYER_NAMES.BOUNDARIES,  emoji: '🚫', label: 'Boundaries' },
  { key: LAYER_NAMES.SST,         emoji: '🌡', label: 'SST' },
  { key: LAYER_NAMES.CHLOROPHYLL, emoji: '🦠', label: 'Chlorophyll' },
  { key: LAYER_NAMES.SAFE_ROUTE,  emoji: '🧭', label: 'Route' },
];

/**
 * Bottom tab bar — 7 tabs synced with LayersPanel + the hazard count alert banner.
 */
export default function BottomTabBar({ layers, toggleLayer, hazardCount }) {
  return (
    <div className="flex items-center justify-between bg-orca-surface border-t border-orca-border px-4 py-2 gap-4 z-[999]">

      {/* Layer tabs */}
      <div className="flex items-center gap-1">
        {TABS.map(({ key, emoji, label }) => {
          const active = layers[key];
          return (
            <button
              key={key}
              onClick={() => toggleLayer(key)}
              className={`
                flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-xs
                transition-colors duration-150
                ${active
                  ? 'text-orca-teal bg-orca-teal/10 border border-orca-teal/30'
                  : 'text-orca-muted hover:text-white hover:bg-orca-surface-2 border border-transparent'}
              `}
            >
              <span className="text-base">{emoji}</span>
              <span className="font-medium">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Alert banner */}
      <div className="flex-shrink-0">
        {hazardCount > 0 ? (
          <div className="
            flex items-center gap-2 px-4 py-2 rounded-xl
            bg-orange-500/20 border border-orange-500/40
            text-orange-400 text-xs font-semibold whitespace-nowrap
          ">
            ⚠ ORCA · Caution: {hazardCount} hazard{hazardCount !== 1 ? 's' : ''} detected
          </div>
        ) : (
          <div className="
            flex items-center gap-2 px-4 py-2 rounded-xl
            bg-orca-teal/10 border border-orca-teal/30
            text-orca-teal text-xs font-semibold whitespace-nowrap
          ">
            ✓ ORCA · No active hazards
          </div>
        )}
      </div>
    </div>
  );
}
