import React from 'react';
import { CheckCircle2, Loader2, Clock, Cpu, CloudRain, Fish, ShieldCheck, XCircle, Waves } from 'lucide-react';

/**
 * FR-B6.1 — live multi-agent pipeline, driven by real SSE events.
 *
 * The previous version hardcoded four agents with invented timings
 * ('Completed · 0.2s') and described work the backend does not do
 * ('Synthesizing MODIS chlorophyll'). Chlorophyll is not retrieved at all —
 * it is passed to the model as a null and recorded as unavailable — so that
 * caption was describing a capability we do not have, on the one screen whose
 * purpose is to show what actually ran.
 *
 * Everything here now comes from the stream: which agents the planner chose,
 * when each started and finished, and the real per-agent latency the backend
 * measured for NFR-A4.
 */

const AGENT_META = {
  weather_agent: { icon: CloudRain, name: 'Weather Agent', desc: 'Wind, gusts, waves, visibility from Open-Meteo' },
  ocean_agent: { icon: Fish, name: 'Ocean Agent', desc: 'Reads the published fishing-zone cache' },
  risk_agent: { icon: ShieldCheck, name: 'Risk Agent', desc: 'Explains the safety verdict' },
  geospatial_agent: { icon: Waves, name: 'Geospatial Agent', desc: 'Spatial queries' },
};

function metaFor(name) {
  return AGENT_META[name] || {
    icon: Cpu,
    name: name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    desc: 'Specialist agent',
  };
}

function StepRow({ icon: Icon, name, desc, status, detail }) {
  const done = status === 'ok' || status === 'done';
  const failed = status === 'failed' || status === 'timed_out';
  const running = status === 'running';

  const StatusIcon = failed ? XCircle : done ? CheckCircle2 : running ? Loader2 : Clock;

  return (
    <div
      className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-200 ${
        failed
          ? 'bg-red-500/5 border-red-500/30 text-white'
          : done
          ? 'bg-orca-surface-2/70 border-orca-border text-white'
          : running
          ? 'bg-orca-teal/10 border-orca-teal/40 text-white'
          : 'bg-orca-bg/30 border-orca-border/40 text-orca-muted opacity-70'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border ${
            failed
              ? 'bg-red-500/15 text-red-400 border-red-500/30'
              : done
              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
              : running
              ? 'bg-orca-teal/20 text-orca-teal border-orca-teal/40'
              : 'bg-orca-surface-2 text-orca-muted border-orca-border'
          }`}
        >
          <Icon size={15} />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-bold truncate">{name}</div>
          <div className="text-[10px] text-orca-muted truncate">{detail || desc}</div>
        </div>
      </div>
      <StatusIcon
        size={15}
        className={`flex-shrink-0 ml-2 ${
          failed ? 'text-red-400' : done ? 'text-emerald-400' : running ? 'text-orca-teal animate-spin' : 'text-orca-muted'
        }`}
      />
    </div>
  );
}

export default function AgentProcessingCard({ liveTurn }) {
  const plan = liveTurn?.plan;
  const agents = liveTurn?.agents || {};
  const order = liveTurn?.agentOrder || [];

  // Planned agents that have not started yet still appear, queued — so the
  // user sees the whole plan rather than it materialising one row at a time.
  const planned = (plan?.steps || []).map((s) => s.agent);
  const names = [...new Set([...order, ...planned])];

  return (
    <div className="bg-orca-surface border border-orca-teal/30 rounded-2xl p-5 space-y-4 max-w-2xl shadow-xl shadow-orca-teal/5">
      <div className="flex items-center justify-between border-b border-orca-border pb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="relative flex h-3 w-3 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orca-teal opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-orca-teal" />
          </span>
          <span className="text-white font-bold text-sm tracking-wide truncate">
            {plan?.interpretation || 'ORCA is planning…'}
          </span>
        </div>
        <span className="text-[10px] uppercase font-bold text-orca-teal bg-orca-teal/15 px-2 py-0.5 rounded border border-orca-teal/30 flex-shrink-0 ml-2">
          Live
        </span>
      </div>

      {/* FR-D1.3 — say which route produced the location, and FR-A4.2 flag an
          assumed time window rather than presenting it as stated. */}
      {liveTurn?.location && (
        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
          <span className="px-2 py-0.5 rounded border bg-orca-bg text-orca-muted border-orca-border">
            {liveTurn.location.label || `${liveTurn.location.latitude?.toFixed(3)}, ${liveTurn.location.longitude?.toFixed(3)}`}
            {' · '}
            {String(liveTurn.location.resolutionRoute || '').replace(/_/g, ' ')}
          </span>
          {liveTurn.window && (
            <span
              className={`px-2 py-0.5 rounded border ${
                liveTurn.window.assumed
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  : 'bg-orca-bg text-orca-muted border-orca-border'
              }`}
            >
              {liveTurn.window.description}
            </span>
          )}
        </div>
      )}

      <div className="space-y-2.5">
        <StepRow
          icon={Cpu}
          name="Planner"
          desc="Chooses which specialists to run"
          status={plan ? 'ok' : 'running'}
          detail={plan ? `Selected ${plan.steps?.length || 0} specialist(s)` : 'Interpreting the question…'}
        />

        {names.map((name) => {
          const meta = metaFor(name);
          const agent = agents[name];
          const status = agent?.status || 'queued';
          const detail =
            status === 'failed'
              ? agent?.error || 'Failed'
              : agent?.latencyMs != null
              ? `Completed · ${(agent.latencyMs / 1000).toFixed(1)}s`
              : status === 'running'
              ? 'Working…'
              : 'Queued';
          return (
            <StepRow key={name} icon={meta.icon} name={meta.name} desc={meta.desc} status={status} detail={detail} />
          );
        })}

        <StepRow
          icon={ShieldCheck}
          name="Safety verdict"
          desc="Deterministic threshold check — no model involved"
          status={liveTurn?.verdict ? 'ok' : 'queued'}
          detail={liveTurn?.verdict ? `Result: ${String(liveTurn.verdict).toUpperCase()}` : 'Awaiting agent data'}
        />
      </div>
    </div>
  );
}