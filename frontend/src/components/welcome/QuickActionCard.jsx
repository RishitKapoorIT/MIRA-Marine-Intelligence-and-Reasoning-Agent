import { useNavigate } from 'react-router-dom';

/**
 * Single quick-action card on the Welcome screen.
 * Props: emoji {string}, label {string}, to {string}
 */
export default function QuickActionCard({ emoji, label, to = '/maps' }) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(to)}
      className="
        flex items-center gap-3 px-4 py-3 rounded-xl text-left w-full
        bg-orca-surface-2 border border-orca-border
        text-white text-sm font-medium
        hover:bg-orca-surface-2/80 hover:border-orca-teal/40
        hover:scale-[1.02] active:scale-[0.98]
        transition-all duration-150
        focus:outline-none focus-visible:ring-2 focus-visible:ring-orca-teal
      "
    >
      <span className="text-lg">{emoji}</span>
      <span className="text-xs font-semibold text-white">{label}</span>
    </button>
  );
}
