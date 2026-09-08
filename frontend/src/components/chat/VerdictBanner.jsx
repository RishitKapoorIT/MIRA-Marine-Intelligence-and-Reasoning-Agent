import React from 'react';
import { ShieldCheck, AlertTriangle, XOctagon, HelpCircle } from 'lucide-react';

/**
 * FR-E2 safety verdict.
 *
 * FOUR VISUAL STATES, NOT THREE. A CAUTION produced because a required input
 * was missing is not the same message as a CAUTION produced by rough seas,
 * and the backend distinguishes them with capped_by_missing_input. Rendering
 * both as one amber badge tells a fisherman "conditions are marginal" when
 * the truth is "we could not see the conditions" — a difference that decides
 * whether checking another source is worth the trip to the harbour office.
 */

const STYLES = {
  safe: {
    icon: ShieldCheck,
    label: 'SAFE',
    box: 'bg-emerald-500/10 border-emerald-500/40',
    text: 'text-emerald-400',
    body: 'text-emerald-300/80',
  },
  caution: {
    icon: AlertTriangle,
    label: 'CAUTION',
    box: 'bg-amber-500/10 border-amber-500/40',
    text: 'text-amber-400',
    body: 'text-amber-300/80',
  },
  unsafe: {
    icon: XOctagon,
    label: 'UNSAFE',
    box: 'bg-red-500/10 border-red-500/40',
    text: 'text-red-400',
    body: 'text-red-300/80',
  },
  unknown: {
    icon: HelpCircle,
    label: 'ASSESSMENT LIMITED',
    box: 'bg-slate-500/10 border-slate-500/40',
    text: 'text-slate-300',
    body: 'text-slate-400',
  },
};

export default function VerdictBanner({ verdict, cappedByMissingInput, reasons = [] }) {
  if (!verdict) return null;

  // A capped CAUTION is presented as a limited assessment, not a hazard call.
  const key = cappedByMissingInput ? 'unknown' : verdict;
  const style = STYLES[key] || STYLES.unknown;
  const Icon = style.icon;

  const explanation = cappedByMissingInput
    ? 'Required data was missing, so ORCA cannot give a full assessment. This is not a finding that conditions are dangerous, and not a confirmation that they are safe.'
    : reasons.length > 0
    ? reasons.map((r) => r.detail).join(' · ')
    : null;

  return (
    <div className={`p-3.5 rounded-2xl border ${style.box} space-y-1.5`}>
      <div className="flex items-center gap-2.5">
        <Icon size={20} className={`${style.text} flex-shrink-0`} />
        <span className={`text-sm font-black tracking-wide ${style.text}`}>
          {style.label}
        </span>
        {cappedByMissingInput && (
          <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border bg-slate-500/15 text-slate-300 border-slate-500/30">
            incomplete data
          </span>
        )}
      </div>
      {explanation && (
        <p className={`text-[11px] leading-snug ${style.body}`}>{explanation}</p>
      )}
    </div>
  );
}