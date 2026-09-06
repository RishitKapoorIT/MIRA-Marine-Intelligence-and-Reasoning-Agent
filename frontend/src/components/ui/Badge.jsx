const VARIANT_CLASSES = {
  danger:  'bg-red-500/20 text-red-400 border border-red-500/30',
  warning: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
  success: 'bg-orca-teal/20 text-orca-teal border border-orca-teal/30',
  muted:   'bg-orca-surface-2 text-orca-muted border border-orca-border',
  info:    'bg-blue-500/20 text-blue-400 border border-blue-500/30',
};

/**
 * Colored status badge.
 * Props:
 *   variant {string} — 'danger' | 'warning' | 'success' | 'muted' | 'info'
 *   children
 */
export default function Badge({ variant = 'muted', children, className = '' }) {
  return (
    <span
      className={`
        inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
        ${VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.muted}
        ${className}
      `}
    >
      {children}
    </span>
  );
}
