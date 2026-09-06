import { useState, useCallback } from 'react';

// Layer names — must match the keys used across LayersPanel and BottomTabBar
export const LAYER_NAMES = {
  PFZ:         'pfz',
  WEATHER:     'weather',
  HAZARDS:     'hazards',
  BOUNDARIES:  'boundaries',
  SST:         'sst',
  CHLOROPHYLL: 'chlorophyll',
  SAFE_ROUTE:  'safeRoute',
};

// Default state matches Figma Frame 02: PFZ, Weather, Hazards, Safe Route = ON
const DEFAULT_LAYERS = {
  pfz:         true,
  weather:     true,
  hazards:     true,
  boundaries:  false,
  sst:         false,
  chlorophyll: false,
  safeRoute:   true,
};

/**
 * Single shared layer toggle state for both LayersPanel and BottomTabBar.
 * Components must call toggleLayer() — never maintain their own layer state.
 *
 * @returns {{ layers: object, toggleLayer: (name: string) => void }}
 */
export function useLayerState() {
  const [layers, setLayers] = useState(DEFAULT_LAYERS);

  const toggleLayer = useCallback((name) => {
    setLayers((prev) => ({ ...prev, [name]: !prev[name] }));
  }, []);

  return { layers, toggleLayer };
}
