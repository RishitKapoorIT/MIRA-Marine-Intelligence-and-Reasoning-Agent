import React from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { AlertTriangle, ShieldOff, WifiOff } from 'lucide-react';

/**
 * States the app cannot silently be in.
 *
 * Two conditions must always be visible on screen:
 *   1. Authentication is disabled on the backend (DEV_AUTH_BYPASS).
 *   2. The backend cannot be reached.
 *
 * Both were previously invisible: the old AuthContext invented a user on any
 * network failure, so a judge looking at the app had no way to tell whether
 * they were seeing live data or a fallback. Mount this once in App.jsx.
 */
export default function StatusBanner() {
  const { devBypassActive, isBackendUnreachable, backendError, appEnv } = useAuth();

  if (isBackendUnreachable) {
    return (
      <div className="w-full bg-red-500/15 border-b border-red-500/40 px-4 py-2 flex items-center gap-2.5 text-red-300">
        <WifiOff size={15} className="flex-shrink-0" />
        <div className="text-xs leading-tight">
          <span className="font-bold">ORCA backend unreachable.</span>{' '}
          <span className="text-red-300/80">
            {backendError || 'No response from the API.'} Nothing on screen is live —
            no data is being shown from cache or samples.
          </span>
        </div>
      </div>
    );
  }

  if (devBypassActive) {
    return (
      <div className="w-full bg-amber-500/15 border-b border-amber-500/40 px-4 py-2 flex items-center gap-2.5 text-amber-300">
        <ShieldOff size={15} className="flex-shrink-0" />
        <div className="text-xs leading-tight">
          <span className="font-bold">Developer bypass active.</span>{' '}
          <span className="text-amber-300/80">
            Authentication is disabled on the backend
            {appEnv ? ` (${appEnv})` : ''}; every request runs as the development
            user. Data is live. Do not use this build in a public demo.
          </span>
        </div>
      </div>
    );
  }

  return null;
}

/** Inline variant for placing inside a card rather than across the top. */
export function InlineWarning({ children, icon: Icon = AlertTriangle }) {
  return (
    <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
      <Icon size={14} className="flex-shrink-0 mt-0.5" />
      <div className="leading-snug">{children}</div>
    </div>
  );
}