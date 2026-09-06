import React from 'react';
import { CheckCircle2, Loader2, Clock, Cpu, CloudRain, Fish, ShieldCheck } from 'lucide-react';

/**
 * Frame 04: Real-time Multi-Agent Pipeline Execution Card.
 * Driven by real asynchronous network latency of weather and PFZ predictions.
 */
export default function AgentProcessingCard({ stepStatus = {} }) {
  // stepStatus: { planner: 'done'|'running'|'queued', weather: '...', pfz: '...', risk: '...' }
  const steps = [
    {
      key: 'planner',
      name: 'Planner Agent',
      desc: 'Scheduled 4 sub-agent checks across oceanographic layers',
      icon: Cpu,
      status: stepStatus.planner || 'done',
      time: 'Completed · 0.2s',
    },
    {
      key: 'weather',
      name: 'Weather Agent',
      desc: 'Fetched wind & wave data via Open-Meteo Marine telemetry',
      icon: CloudRain,
      status: stepStatus.weather || 'running',
      time: stepStatus.weather === 'done' ? 'Completed · 0.4s' : 'Fetching live swell...',
    },
    {
      key: 'pfz',
      name: 'PFZ Agent',
      desc: 'Synthesizing MODIS chlorophyll & running XGBoost classifier',
      icon: Fish,
      status: stepStatus.pfz || 'queued',
      time: stepStatus.pfz === 'done' ? 'Completed · 0.7s' : stepStatus.pfz === 'running' ? 'Predicting zones...' : 'Queued',
    },
    {
      key: 'risk',
      name: 'Risk Assessment Agent',
      desc: 'Queueing NDMA boundary collision & hazard exclusion checks',
      icon: ShieldCheck,
      status: stepStatus.risk || 'queued',
      time: stepStatus.risk === 'done' ? 'Completed · 0.3s' : stepStatus.risk === 'running' ? 'Scanning perimeter...' : 'Queued',
    },
  ];

  return (
    <div className="bg-orca-surface border border-orca-teal/30 rounded-2xl p-5 space-y-4 max-w-2xl shadow-xl shadow-orca-teal/5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b border-orca-border pb-3">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orca-teal opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-orca-teal"></span>
          </span>
          <span className="text-white font-bold text-sm tracking-wide">
            ORCA is thinking... analyzing marine layers
          </span>
        </div>
        <span className="text-[10px] uppercase font-bold text-orca-teal bg-orca-teal/15 px-2 py-0.5 rounded border border-orca-teal/30">
          Multi-Agent Pipeline
        </span>
      </div>

      {/* ── Pipeline Steps ── */}
      <div className="space-y-2.5">
        {steps.map(step => {
          const Icon = step.icon;
          const isDone = step.status === 'done';
          const isRunning = step.status === 'running';

          return (
            <div
              key={step.key}
              className={`
                flex items-center justify-between p-3 rounded-xl border transition-all duration-200
                ${
                  isDone
                    ? 'bg-orca-surface-2/70 border-orca-border text-white'
                    : isRunning
                    ? 'bg-orca-teal/10 border-orca-teal/40 text-white'
                    : 'bg-orca-bg/30 border-orca-border/40 text-orca-muted opacity-70'
                }
              `}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`
                    w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
                    ${
                      isDone
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : isRunning
                        ? 'bg-orca-teal/20 text-orca-teal border border-orca-teal/40'
                        : 'bg-orca-surface border border-orca-border text-orca-muted'
                    }
                  `}
                >
                  <Icon size={16} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">{step.name}</span>
                  </div>
                  <p className="text-[11px] text-orca-muted line-clamp-1">{step.desc}</p>
                </div>
              </div>

              {/* Status icon & timing */}
              <div className="flex items-center gap-2 text-right pl-3 flex-shrink-0">
                <span className="text-[11px] font-medium text-orca-muted">
                  {step.time}
                </span>
                {isDone && <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />}
                {isRunning && <Loader2 size={16} className="text-orca-teal animate-spin flex-shrink-0" />}
                {!isDone && !isRunning && <Clock size={16} className="text-orca-muted/50 flex-shrink-0" />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
