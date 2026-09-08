import React from 'react';
import { Database, Clock, AlertTriangle, XCircle, Info } from 'lucide-react';

/**
 * FR-G1.1 / FR-G1.2 — the evidence panel.
 *
 * Renders the evidence array exactly as the backend produced it: source,
 * value, the timestamp the data DESCRIBES, and whether it is an observation
 * or a forecast. Visible without user action, never behind a disclosure
 * control.
 *
 * TWO THINGS THIS DELIBERATELY DOES NOT DO:
 *
 * 1. It never omits an unavailable source. A source that failed is rendered
 *    as failed, with its reason. Dropping it would leave an answer looking
 *    fully evidenced when part of the picture was missing.
 *
 * 2. It never renders a null value as 0 or blank. Chlorophyll comes back null
 *    with provenance kind 'unavailable' because NASA OB.DAAC needs Earthdata
 *    credentials we do not have; showing "0 mg/m3" would be a fabricated
 *    measurement, and a blank cell reads as an oversight rather than a known
 *    gap.
 */

const SOURCE_LABELS = {
  open_meteo_marine: 'Open-Meteo Marine',
  open_meteo_forecast: 'Open-Meteo Forecast',
  sachet_cap: 'NDMA SACHET',
  nasa_obdaac: 'NASA Ocean Color',
  pfz_model: 'ORCA PFZ model',
  salinity_climatology: 'Salinity climatology',
};

/** label + unit for the value keys the backend emits. */
const FIELD_META = {
  max_wave_height_m: ['Max wave height', 'm'],
  max_swell_height_m: ['Max swell', 'm'],
  max_current_velocity_ms: ['Max current', 'm/s'],
  mean_wave_height_m: ['Mean wave height', 'm'],
  mean_wave_period_s: ['Mean wave period', 's'],
  mean_sst_c: ['Sea surface temp', '°C'],
  max_wind_speed_ms: ['Max wind', 'm/s'],
  max_wind_gust_ms: ['Max gust', 'm/s'],
  total_precipitation_mm: ['Precipitation', 'mm'],
  min_visibility_m: ['Min visibility', 'm'],
  mean_temperature_c: ['Air temp', '°C'],
  hours_covered: ['Hours covered', ''],
};

const HIDDEN_FIELDS = new Set(['window_start', 'window_end']);

function formatWhen(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function KindBadge({ kind }) {
  const styles = {
    observation: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    forecast: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    climatology: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    derived: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
    unavailable: 'bg-red-500/15 text-red-400 border-red-500/30',
  };
  return (
    <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border ${styles[kind] || styles.derived}`}>
      {kind}
    </span>
  );
}

function SourceCard({ item }) {
  const label = SOURCE_LABELS[item.source_id] || item.source_id;

  if (!item.available) {
    return (
      <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/30 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white flex items-center gap-1.5">
            <XCircle size={13} className="text-red-400" />
            {label}
          </span>
          <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border bg-red-500/15 text-red-400 border-red-500/30">
            unavailable
          </span>
        </div>
        <p className="text-[11px] text-red-300/80 leading-snug">
          {item.unavailable_reason || 'This source could not be reached.'}
        </p>
      </div>
    );
  }

  const fields = Object.entries(item.values || {}).filter(
    ([key, value]) => !HIDDEN_FIELDS.has(key) && value !== null && value !== undefined,
  );
  const when = formatWhen(item.valid_at);

  return (
    <div className="p-3 rounded-xl bg-orca-bg border border-orca-border space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
          <Database size={13} className="text-orca-teal flex-shrink-0" />
          <span className="truncate">{label}</span>
        </span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {item.is_stale && (
            <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border bg-amber-500/15 text-amber-400 border-amber-500/30">
              stale
            </span>
          )}
          <KindBadge kind={item.kind} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {fields.map(([key, value]) => {
          const [label_, unit] = FIELD_META[key] || [key.replace(/_/g, ' '), ''];
          return (
            <div key={key} className="flex items-baseline justify-between gap-2">
              <span className="text-[10px] text-orca-muted truncate">{label_}</span>
              <span className="text-[11px] font-mono font-semibold text-white flex-shrink-0">
                {typeof value === 'number' ? value : String(value)}{unit}
              </span>
            </div>
          );
        })}
      </div>

      {when && (
        <div className="flex items-center gap-1.5 pt-1.5 border-t border-orca-border/60">
          <Clock size={11} className="text-orca-muted flex-shrink-0" />
          <span className="text-[10px] text-orca-muted">
            {item.kind === 'forecast' ? 'Valid for' : 'Observed'} {when}
            {typeof item.age_hours === 'number' && item.age_hours > 0
              ? ` · ${item.age_hours.toFixed(1)}h old`
              : ''}
          </span>
        </div>
      )}

      {item.attribution && (
        <p className="text-[9px] text-orca-muted/70 leading-snug">{item.attribution}</p>
      )}
    </div>
  );
}

export default function EvidenceTrace({
  evidence = [],
  disclosures = [],
  verdictReasons = [],
  missingInputs = [],
}) {
  const hasAnything =
    evidence.length || disclosures.length || verdictReasons.length || missingInputs.length;
  if (!hasAnything) return null;

  return (
    <div className="bg-orca-surface border border-orca-border rounded-2xl overflow-hidden shadow-sm">
      <div className="px-4 py-2.5 border-b border-orca-border bg-orca-surface-2/40 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
          <Database size={13} className="text-orca-teal" />
          Evidence
        </span>
        <span className="text-[10px] text-orca-muted">
          {evidence.length} source{evidence.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="p-4 space-y-3">
        {evidence.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {evidence.map((item, i) => (
              <SourceCard key={`${item.source_id}-${i}`} item={item} />
            ))}
          </div>
        )}

        {/* FR-E2.3 — which threshold was crossed, by which observed value. */}
        {verdictReasons.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <span className="text-[10px] uppercase font-bold text-orca-muted tracking-wider">
              Thresholds applied
            </span>
            {verdictReasons.map((r, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-[11px] text-orca-muted p-2 rounded-lg bg-orca-bg/60 border border-orca-border/60"
              >
                <AlertTriangle size={12} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <span className="leading-snug">
                  {r.detail}
                  {r.source && <span className="text-orca-muted/60"> · {SOURCE_LABELS[r.source] || r.source}</span>}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* FR-B4.3 — what could not be obtained, named. */}
        {missingInputs.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <span className="text-[10px] uppercase font-bold text-orca-muted tracking-wider">
              Missing data
            </span>
            {missingInputs.map((m, i) => (
              <div key={i} className="flex items-start gap-2 text-[11px] text-red-300/90 p-2 rounded-lg bg-red-500/5 border border-red-500/25">
                <XCircle size={12} className="text-red-400 flex-shrink-0 mt-0.5" />
                <span className="leading-snug">{m}</span>
              </div>
            ))}
          </div>
        )}

        {/* FR-I — safety disclosures, from the backend's single registry. */}
        {disclosures.length > 0 && (
          <div className="space-y-1.5 pt-2 border-t border-orca-border">
            {disclosures.map((d, i) => (
              <div key={d.key || i} className="flex items-start gap-2 text-[11px] text-orca-muted">
                <Info size={12} className="text-orca-teal flex-shrink-0 mt-0.5" />
                <span className="leading-snug">{d.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}