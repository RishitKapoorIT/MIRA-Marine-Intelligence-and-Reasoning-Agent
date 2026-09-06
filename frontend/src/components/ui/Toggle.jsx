/**
 * Pill-shaped toggle switch.
 * Props:
 *   checked  {boolean}
 *   onChange {() => void}
 *   label    {string}  — used as aria-label
 */
export default function Toggle({ checked, onChange, label }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`
        relative inline-flex h-6 w-11 items-center rounded-full
        transition-colors duration-200 focus:outline-none focus-visible:ring-2
        focus-visible:ring-orca-teal focus-visible:ring-offset-2 focus-visible:ring-offset-orca-bg
        ${checked ? 'bg-orca-teal' : 'bg-orca-surface-2'}
      `}
    >
      <span
        className={`
          inline-block h-4 w-4 rounded-full bg-white shadow-sm
          transform transition-transform duration-200
          ${checked ? 'translate-x-6' : 'translate-x-1'}
        `}
      />
    </button>
  );
}
