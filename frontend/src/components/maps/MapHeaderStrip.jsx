import LayerChip from '../ui/LayerChip.jsx';

/**
 * Thin strip above the map canvas — "INDIA MARINE MAP" label + active layer chips.
 */
export default function MapHeaderStrip({ layers }) {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-orca-surface border-b border-orca-border">
      <span className="micro-label text-orca-muted">India Marine Map</span>
      <div className="flex items-center gap-2">
        {layers.pfz     && <LayerChip label="PFZ"            variant="teal" />}
        {layers.hazards && <LayerChip label="⚠ Cyclone Watch" variant="warning" />}
        {layers.weather && <LayerChip label="Weather"         variant="teal" />}
        {layers.boundaries && <LayerChip label="Boundaries"  variant="teal" />}
        {layers.sst        && <LayerChip label="SST"         variant="teal" />}
        {layers.chlorophyll && <LayerChip label="Chlorophyll" variant="teal" />}
        {layers.safeRoute   && <LayerChip label="Safe Route"  variant="teal" />}
      </div>
    </div>
  );
}
