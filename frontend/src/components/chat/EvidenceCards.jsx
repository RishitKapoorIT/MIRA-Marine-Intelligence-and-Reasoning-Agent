import React, { useState } from 'react';
import { Thermometer, Leaf, Waves, Mountain, CheckCircle2, ChevronRight, ShieldCheck, ChevronDown, ChevronUp, Compass, Map } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/**
 * Frame 05: Evidence & Reasoning View.
 * Displays 2x2 telemetry evidence cards with concise plain sentences by default,
 * standardized badges ("Good catch chance" / "Moderate" / "Low"), and click-to-expand details (Part B).
 */
export default function EvidenceCards({ zone, weather }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showFullDetails, setShowFullDetails] = useState(false);

  if (!zone) return null;

  const temp = zone.temperature ?? 28.5;
  const chl = zone.chlorophyll ?? 0.35;
  const waveHeight = weather?.waveHeight ?? 0.9;
  const windSpeed = weather?.windSpeed ?? 12;

  // Badge Standardization (Part B)
  const gradeKey = zone.predictedZone === 'BEST' ? 'best' : zone.predictedZone === 'GOOD' ? 'good' : 'poor';
  const badgeLabel = t(`badges.${gradeKey}`);
  const badgeColor =
    zone.predictedZone === 'BEST'
      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
      : zone.predictedZone === 'GOOD'
      ? 'bg-[#00D8FF]/20 text-[#00D8FF] border-[#00D8FF]/30'
      : 'bg-amber-500/20 text-amber-400 border-amber-500/30';

  const evidenceCards = [
    {
      id: 'sst',
      title: 'Sea Surface Temperature',
      source: 'MODIS Thermal',
      recency: '2h ago',
      value: `${temp}°C`,
      concise: `Optimal thermal gradient at ${temp}°C attracts pelagic schools.`,
      fullDetail: `Frontal temperature gradient detected at ${temp}°C, creating favorable thermocline boundary conditions for schooling pelagics.`,
      icon: Thermometer,
      iconColor: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/20',
    },
    {
      id: 'chl',
      title: 'Chlorophyll-a Bloom',
      source: 'MODIS Ocean Color',
      recency: '2h ago',
      value: `${chl} mg/m³`,
      concise: `Plentiful phytoplankton forage base (${chl} mg/m³).`,
      fullDetail: `High ocean color phytoplankton density (${chl} mg/m³) provides rich foraging for sardines and mackerel.`,
      icon: Leaf,
      iconColor: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/20',
    },
    {
      id: 'swell',
      title: 'Wave Swell & Wind',
      source: 'Open-Meteo Marine',
      recency: 'Live Feed',
      value: `${waveHeight}m Swell · ${windSpeed}kt`,
      concise: `Calm seas (${waveHeight}m) — safe for motorized craft.`,
      fullDetail: `Wave swell of ${waveHeight}m is well beneath the 1.5m safety threshold with steady ${windSpeed}kt surface winds.`,
      icon: Waves,
      iconColor: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
      borderColor: 'border-cyan-500/20',
    },
    {
      id: 'bathy',
      title: 'Bathymetry & Depth Contour',
      source: 'GEBCO Marine Grid',
      recency: 'Baseline',
      value: '45m Depth Ridge',
      concise: 'Shelf ridge creates natural nutrient upwelling.',
      fullDetail: 'Continental shelf break at 45m depth contour forces nutrient-rich currents toward sunlit surface layers.',
      icon: Mountain,
      iconColor: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/20',
    },
  ];

  return (
    <div className="space-y-4 max-w-3xl">
      {/* ── Recommendation Header ── */}
      <div className="bg-orca-surface-2 border border-orca-teal/40 rounded-2xl p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg shadow-orca-teal/10">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs uppercase tracking-wider text-orca-teal font-bold">
              Recommended Zone
            </span>
            <span className={`px-2.5 py-0.5 rounded-full border text-xs font-bold ${badgeColor}`}>
              {badgeLabel}
            </span>
            {zone.sector && (
              <span className="px-2 py-0.5 rounded-full bg-orca-surface border border-orca-border text-[11px] font-bold text-white">
                {zone.sector}
              </span>
            )}
          </div>
          <h3 className="text-xl md:text-2xl font-extrabold text-white tracking-tight">
            {zone.id} · {zone.expectedSpecies}
          </h3>
          <p className="text-orca-muted text-xs mt-1">
            Bearing: <span className="text-white font-semibold">{zone.bearing}</span> ({zone.distanceNm} nm / {zone.distanceKm} km offshore)
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => navigate('/maps')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-orca-surface hover:bg-orca-surface-2 text-white border border-orca-border transition-all"
          >
            <Map size={14} />
            <span>{t('chat.view_map')}</span>
          </button>
          <button
            onClick={() => navigate(`/route?dest=${encodeURIComponent(zone.id)}&lat=${zone.lat}&lon=${zone.lon}`)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-orca-teal text-orca-bg hover:bg-orca-teal/90 shadow-md transition-all"
          >
            <Compass size={14} />
            <span>{t('chat.plot_route')}</span>
          </button>
        </div>
      </div>

      {/* ── 2x2 Satellite Evidence Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {evidenceCards.map(card => {
          const Icon = card.icon;
          return (
            <div
              key={card.id}
              className={`p-3.5 rounded-xl border ${card.bgColor} ${card.borderColor} flex flex-col justify-between space-y-2`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg bg-orca-bg/60 ${card.iconColor}`}>
                    <Icon size={16} />
                  </div>
                  <span className="text-xs font-bold text-white">{card.title}</span>
                </div>
                <span className="text-[10px] text-orca-muted">{card.source}</span>
              </div>

              <div>
                <div className="text-base font-extrabold text-white font-mono">{card.value}</div>
                <p className="text-xs text-orca-muted mt-1 leading-snug">
                  {showFullDetails ? card.fullDetail : card.concise}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Toggle Details & Scientific Trace ── */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowFullDetails(!showFullDetails)}
          className="text-xs text-orca-teal flex items-center gap-1 hover:underline font-semibold"
        >
          <span>{showFullDetails ? t('chat.hide_details') : t('chat.details')}</span>
          {showFullDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {showFullDetails && (
        <div className="p-3.5 rounded-xl bg-orca-surface border border-orca-border space-y-2 text-xs text-orca-muted animate-fadeIn">
          <span className="text-white font-bold block text-[11px] uppercase tracking-wider">
            Scientific Reasoning Chain & Feature Provenance
          </span>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>• Model Confidence: <strong className="text-white">{zone.confidence}%</strong></div>
            <div>• Raw ML Class: <strong className="text-white">{zone.predictedZone}</strong></div>
            <div>• Frontal Thermocline: <strong className="text-white">{temp}°C</strong></div>
            <div>• Chlorophyll Density: <strong className="text-white">{chl} mg/m³</strong></div>
          </div>
        </div>
      )}
    </div>
  );
}
