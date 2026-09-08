import React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

/**
 * Bottom status bar: Displays hazard warning banner without duplicate layer controls (Part A2).
 */
export default function BottomTabBar({ hazardCount }) {
  return (
    <div className="flex items-center justify-between bg-orca-surface border-t border-orca-border px-4 py-2 text-xs z-10">
      <div className="text-orca-muted text-[11px] flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-400" />
        <span>Use the floating <strong>Map Layers</strong> panel to toggle oceanographic data.</span>
      </div>

      <div className="flex-shrink-0">
        {hazardCount > 0 ? (
          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs font-semibold whitespace-nowrap">
            <AlertTriangle size={14} />
            <span>ORCA Caution: {hazardCount} active hazard{hazardCount !== 1 ? 's' : ''} detected</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-orca-teal/10 border border-orca-teal/30 text-orca-teal text-xs font-semibold whitespace-nowrap">
            <CheckCircle2 size={14} />
            <span>ORCA · No active maritime exclusion hazards</span>
          </div>
        )}
      </div>
    </div>
  );
}
