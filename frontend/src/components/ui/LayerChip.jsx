/**
 * Compact layer indicator pill shown in the map header strip.
 * Props:
 *   label    {string}
 *   variant  {string} — 'teal' | 'warning'
 */
export default function LayerChip({ label, variant = 'teal' }) {
  const cls =
    variant === 'warning'
      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
      : 'bg-orca-teal/20 text-orca-teal border border-orca-teal/40';

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
}
