import Toggle from '../ui/Toggle.jsx';
import { LAYER_NAMES } from '../../hooks/useLayerState.js';

const LAYER_CONFIG = [
  { key: LAYER_NAMES.PFZ,         emoji: '🎣', label: 'PFZ' },
  { key: LAYER_NAMES.WEATHER,     emoji: '🌦', label: 'Weather / Waves' },
  { key: LAYER_NAMES.HAZARDS,     emoji: '⚠',  label: 'Hazards' },
  { key: LAYER_NAMES.BOUNDARIES,  emoji: '🚫', label: 'Boundaries / MPAs' },
  { key: LAYER_NAMES.SST,         emoji: '🌡', label: 'SST' },
  { key: LAYER_NAMES.CHLOROPHYLL, emoji: '🦠', label: 'Chlorophyll' },
  { key: LAYER_NAMES.SAFE_ROUTE,  emoji: '🧭', label: 'Safe Route' },
];

/**
 * Floating MAP LAYERS panel — right side of the map.
 * Reads from and writes to the shared useLayerState hook.
 */
export default function LayersPanel({ layers, toggleLayer }) {
  return (
    <div
      className="
        absolute top-4 right-4 z-[1000]
        bg-orca-surface border border-orca-border rounded-xl
        shadow-2xl shadow-black/40 w-56 overflow-hidden
      "
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-orca-border">
        <span className="micro-label">Map Layers</span>
      </div>

      {/* Layer rows */}
      <div className="py-2">
        {LAYER_CONFIG.map(({ key, emoji, label }) => (
          <div
            key={key}
            className="flex items-center justify-between px-4 py-2.5 hover:bg-orca-surface-2 transition-colors duration-100"
          >
            <span className="flex items-center gap-2.5 text-sm text-white">
              <span>{emoji}</span>
              <span>{label}</span>
            </span>
            <Toggle
              checked={layers[key]}
              onChange={() => toggleLayer(key)}
              label={`Toggle ${label}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
