import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLocationState } from '../../context/LocationContext.jsx';
import QuickActionCard from './QuickActionCard.jsx';
import { ArrowRight, Compass, Fish, AlertTriangle, Route } from 'lucide-react';

export default function HeroCard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentLocation } = useLocationState();

  const activeCity = currentLocation?.name?.split(' ')[0] || 'Mangalore';

  const QUICK_ACTIONS = [
    { emoji: '🎣', label: 'Find fishing zones', to: `/chat?q=Identify best fishing zones near ${activeCity}` },
    { emoji: '🌦', label: 'Check sea safety', to: `/chat?q=Check sea swell and weather safety near ${activeCity}` },
    { emoji: '⚠️', label: 'View active hazards', to: '/hazards' },
    { emoji: '🧭', label: 'Plan a safe route', to: '/route' },
  ];

  return (
    <div className="bg-orca-surface border border-orca-border rounded-2xl p-8 md:p-12 space-y-8 shadow-2xl relative overflow-hidden">
      
      {/* ── Part E: Dim India Coastline Silhouette in empty dark space (~6% opacity, decorative, pointer-events-none) ── */}
      <div className="absolute right-0 top-0 bottom-0 w-1/2 opacity-[0.06] pointer-events-none select-none flex items-center justify-end pr-6">
        <svg viewBox="0 0 400 500" className="h-full max-h-[460px] w-auto text-orca-teal fill-current">
          <path d="M150,20 L190,40 L230,60 L240,110 L280,140 L310,180 L300,210 L280,240 L260,280 L230,330 L200,380 L180,440 L160,470 L155,440 L140,390 L125,340 L115,290 L110,240 L90,200 L70,180 L60,150 L90,140 L120,130 L140,80 Z" />
        </svg>
      </div>

      {/* Headline */}
      <div className="relative z-10 space-y-1">
        <h1 className="text-4xl md:text-5xl font-extrabold leading-tight text-white tracking-tight">
          Understand the ocean.
        </h1>
        <h2 className="text-4xl md:text-5xl font-extrabold leading-tight text-orca-teal tracking-tight">
          Make safer decisions.
        </h2>
      </div>

      {/* Subtext */}
      <p className="text-orca-muted text-sm md:text-base max-w-xl leading-relaxed relative z-10">
        {t('welcome.tagline')}
      </p>

      {/* Primary CTA */}
      <div className="relative z-10">
        <button
          onClick={() => navigate('/chat')}
          className="
            inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl
            bg-orca-teal text-orca-bg font-bold text-sm
            hover:bg-orca-teal/90 active:scale-[0.98]
            transition-all duration-150 shadow-lg shadow-orca-teal/20
            focus:outline-none focus-visible:ring-2 focus-visible:ring-orca-teal
          "
        >
          <span>What would you like to do?</span>
          <ArrowRight size={16} />
        </button>
      </div>

      {/* Quick action grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 relative z-10 pt-2">
        {QUICK_ACTIONS.map((action) => (
          <QuickActionCard key={action.label} emoji={action.emoji} label={action.label} to={action.to} />
        ))}
      </div>
    </div>
  );
}
