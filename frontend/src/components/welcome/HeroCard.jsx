import { useNavigate } from 'react-router-dom';
import QuickActionCard from './QuickActionCard.jsx';

const QUICK_ACTIONS = [
  { emoji: '🎣', label: 'Find fishing zones', to: '/chat?q=Identify best fishing zones near Mangalore' },
  { emoji: '🌦', label: 'Check sea safety', to: '/chat?q=Check sea safety and swell conditions' },
  { emoji: '⚠️', label: 'View active hazards', to: '/hazards' },
  { emoji: '🧭', label: 'Plan a safe route', to: '/route' },
];

export default function HeroCard() {
  const navigate = useNavigate();

  return (
    <div className="bg-orca-surface border border-orca-border rounded-2xl p-8 md:p-12 space-y-8 shadow-xl">

      {/* Headline */}
      <div>
        <h1 className="text-4xl md:text-5xl font-extrabold leading-tight text-white">
          Understand the ocean.
        </h1>
        <h2 className="text-4xl md:text-5xl font-extrabold leading-tight text-orca-teal">
          Make safer decisions.
        </h2>
      </div>

      {/* Subtext */}
      <p className="text-orca-muted text-sm md:text-base max-w-xl leading-relaxed">
        Ask ORCA about potential fishing zones, satellite telemetry, sea conditions, hazard exclusion alerts and optimal safe routes.
      </p>

      {/* CTA button — navigates to Chat workspace */}
      <button
        onClick={() => navigate('/chat')}
        className="
          inline-flex items-center gap-2 px-6 py-3.5 rounded-xl
          bg-orca-teal text-orca-bg font-bold text-sm
          hover:bg-orca-teal/90 active:scale-[0.98]
          transition-all duration-150 shadow-lg shadow-orca-teal/20
          focus:outline-none focus-visible:ring-2 focus-visible:ring-orca-teal
        "
      >
        <span>What would you like to do?</span>
        <span>→</span>
      </button>

      {/* Quick action grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {QUICK_ACTIONS.map((action) => (
          <QuickActionCard key={action.label} emoji={action.emoji} label={action.label} to={action.to} />
        ))}
      </div>
    </div>
  );
}
