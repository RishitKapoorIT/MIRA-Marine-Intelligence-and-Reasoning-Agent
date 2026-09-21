import React, { useState } from 'react';
import Toggle from '../ui/Toggle.jsx';
import { LAYER_NAMES } from '../../hooks/useLayerState.js';
import { Layers, Minus, ChevronDown, ChevronUp } from 'lucide-react';

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
 * Floating MAP LAYERS panel — right side of the map with minimize/expand controls.
 * Reads from and writes to the shared useLayerState hook.
 */
export default function LayersPanel({ layers, toggleLayer }) {
  const [isMinimized, setIsMinimized] = useState(false);
  const activeCount = LAYER_CONFIG.filter(l => layers[l.key]).length;

  if (isMinimized) {
    return (
      <div className="absolute top-4 right-4 z-[1000] animate-fadeIn">
        <button
          type="button"
          onClick={() => setIsMinimized(false)}
          className="
            flex items-center gap-2 px-3 py-2
            bg-orca-surface/95 backdrop-blur-md border border-orca-border rounded-xl
            shadow-xl text-xs font-bold text-white hover:border-orca-teal hover:bg-orca-surface-2
            transition-all touch-target
          "
          title="Expand Map Layers"
          aria-label="Expand Map Layers"
        >
          <Layers size={14} className="text-orca-teal" />
          <span>Layers</span>
          <span className="px-1.5 py-0.2 rounded-full bg-orca-teal/20 text-orca-teal text-[10px] font-mono">
            {activeCount}
          </span>
          <ChevronDown size={14} className="text-orca-muted" />
        </button>
      </div>
    );
  }

  return (
    <div
      className="
        absolute top-4 right-4 z-[1000]
        bg-orca-surface/95 backdrop-blur-md border border-orca-border rounded-xl
        shadow-2xl shadow-black/40 w-56 sm:w-60 overflow-hidden animate-fadeIn
      "
    >
      {/* Header with Minimize Toggle Button */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-orca-border bg-orca-surface-2/40">
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-orca-teal" />
          <span className="micro-label">Map Layers</span>
          <span className="text-[10px] text-orca-muted">({activeCount} on)</span>
        </div>
        <button
          type="button"
          onClick={() => setIsMinimized(true)}
          className="p-1 rounded-lg text-orca-muted hover:text-white hover:bg-orca-surface transition-colors"
          title="Minimize Map Layers"
          aria-label="Minimize Map Layers"
        >
          <Minus size={15} strokeWidth={2.5} />
        </button>
      </div>

      {/* Layer rows */}
      <div className="py-1.5 max-h-[60vh] overflow-y-auto">
        {LAYER_CONFIG.map(({ key, emoji, label }) => (
          <div
            key={key}
            className="flex items-center justify-between px-3.5 py-2 hover:bg-orca-surface-2 transition-colors duration-100"
          >
            <span className="flex items-center gap-2 text-xs sm:text-sm text-white">
              <span>{emoji}</span>
              <span className="truncate">{label}</span>
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

