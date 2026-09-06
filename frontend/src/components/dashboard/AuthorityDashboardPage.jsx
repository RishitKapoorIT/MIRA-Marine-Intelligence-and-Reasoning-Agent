import React, { useState, useEffect } from 'react';
import Header from '../layout/Header.jsx';
import { getVesselsData } from '../../data/vessels.js';
import { Shield, Radio, AlertOctagon, Users, CheckCircle2, AlertTriangle, Ship, Activity, FileText, Search, Filter, Info } from 'lucide-react';

export default function AuthorityDashboardPage() {
  const [data, setData] = useState(null);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function loadData() {
      const res = await getVesselsData();
      setData(res);
    }
    loadData();
  }, []);

  if (!data) return null;

  const vessels = data.vessels || [];
  const metrics = data.metrics || {};
  const activityFeed = data.activityFeed || [];
  const districtCompliance = data.districtCompliance || [];

  const filteredVessels = vessels.filter(v => {
    const matchesStatus = filterStatus === 'ALL' || v.status === filterStatus;
    const matchesQuery = !searchQuery || 
      v.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.homePort.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesQuery;
  });

  return (
    <div className="min-h-screen bg-orca-bg flex flex-col overflow-y-auto">
      <Header />

      <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto space-y-6">
        {/* ── Header Strip ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-orca-border pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] uppercase tracking-wider font-bold text-orca-teal bg-orca-teal/15 px-2 py-0.5 rounded border border-orca-teal/30">
                Frame 10 · Persona 4: Coastal Authority
              </span>
              <span className="text-xs text-orca-muted">Karnataka Maritime Board Command</span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <Shield size={22} className="text-orca-teal" />
              <span>Regional Maritime Authority Dashboard</span>
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] px-3 py-1 rounded-full bg-orca-surface-2 border border-orca-border text-orca-muted flex items-center gap-1.5 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{metrics.lastTelemetrySync}</span>
            </span>
          </div>
        </div>

        {/* ── Top Stat Row: 4 Metric Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Stat 1: Fleet */}
          <div className="bg-orca-surface border border-orca-border rounded-2xl p-5 space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-orca-muted flex items-center gap-1.5">
              <Ship size={15} className="text-orca-teal" />
              <span>Monitored Vessel Fleet</span>
            </span>
            <div className="text-3xl font-black text-white tracking-tight">
              {metrics.activeFleetCount} <span className="text-xs font-semibold text-emerald-400">Active AIS</span>
            </div>
            <p className="text-[11px] text-orca-muted">
              Motorized & deep-sea commercial vessels broadcasting.
            </p>
          </div>

          {/* Stat 2: Emergency Beacons */}
          <div className="bg-orca-surface border border-red-500/30 bg-red-500/5 rounded-2xl p-5 space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-red-400 flex items-center gap-1.5">
              <Radio size={15} className="animate-pulse text-red-400" />
              <span>Emergency Beacons Active</span>
            </span>
            <div className="text-3xl font-black text-red-400 tracking-tight">
              {metrics.emergencyBeaconsActive} <span className="text-xs font-semibold text-red-300">EPIRB Alert</span>
            </div>
            <p className="text-[11px] text-orca-muted">
              ICGS Rajdoot SAR asset dispatched to sector.
            </p>
          </div>

          {/* Stat 3: Weather Warnings */}
          <div className="bg-orca-surface border border-orca-border rounded-2xl p-5 space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <AlertTriangle size={15} />
              <span>Active Warnings</span>
            </span>
            <div className="text-3xl font-black text-white tracking-tight">
              {metrics.issuedWeatherWarnings} <span className="text-xs font-semibold text-amber-400">Bulletins</span>
            </div>
            <p className="text-[11px] text-orca-muted">
              Cyclone Watch & Swell advisories broadcast to fleet.
            </p>
          </div>

          {/* Stat 4: Compliance Level */}
          <div className="bg-orca-surface border border-orca-border rounded-2xl p-5 space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 size={15} />
              <span>Fleet Compliance Rate</span>
            </span>
            <div className="text-3xl font-black text-emerald-400 tracking-tight">
              {metrics.fleetComplianceRate}%
            </div>
            <p className="text-[11px] text-orca-muted">
              Adherence to EEZ geofence & safety zones.
            </p>
          </div>
        </div>

        {/* ── Main Grid: Vessel Registry Table & Activity Feed ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Vessel Registry Table */}
          <div className="lg:col-span-2 bg-orca-surface border border-orca-border rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-orca-border pb-3">
              <div className="flex items-center gap-2">
                <Ship size={18} className="text-orca-teal" />
                <h3 className="text-sm font-extrabold text-white">
                  Regional Vessel Registry & Telemetry Feed
                </h3>
              </div>

              {/* Status Filters */}
              <div className="flex items-center gap-1 bg-orca-bg p-1 rounded-xl border border-orca-border text-xs">
                {['ALL', 'NORMAL', 'GEOFENCE_ALERT', 'DISTRESS_SOS'].map(st => (
                  <button
                    key={st}
                    onClick={() => setFilterStatus(st)}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[10px] uppercase transition-all ${filterStatus === st ? 'bg-orca-surface-2 text-white border border-orca-border' : 'text-orca-muted hover:text-white'}`}
                  >
                    {st.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-orca-border text-[10px] uppercase tracking-wider text-orca-muted bg-orca-bg/50">
                    <th className="py-2.5 px-3">Vessel ID</th>
                    <th className="py-2.5 px-3">Name & Class</th>
                    <th className="py-2.5 px-3">Home Harbor</th>
                    <th className="py-2.5 px-3">Position</th>
                    <th className="py-2.5 px-3">Course / Speed</th>
                    <th className="py-2.5 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-orca-border/50 text-white">
                  {filteredVessels.map(v => {
                    const isSos = v.status === 'DISTRESS_SOS';
                    const isAlert = v.status === 'GEOFENCE_ALERT';

                    return (
                      <tr 
                        key={v.id}
                        className={`hover:bg-orca-surface-2/40 transition-colors ${isSos ? 'bg-red-500/10' : isAlert ? 'bg-amber-500/5' : ''}`}
                      >
                        <td className="py-3 px-3 font-mono font-bold text-orca-teal">
                          {v.id}
                        </td>
                        <td className="py-3 px-3">
                          <strong className="block text-white">{v.name}</strong>
                          <span className="text-[10px] text-orca-muted">{v.type} ({v.crewCount} crew)</span>
                        </td>
                        <td className="py-3 px-3 text-orca-muted">
                          {v.homePort}
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px] text-orca-muted">
                          {v.lat.toFixed(3)}°N, {v.lon.toFixed(3)}°E
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-white font-semibold">{v.speedKnots} kts</span>
                          <span className="text-orca-muted text-[10px] block">{v.headingDeg}° course</span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${isSos ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse' : isAlert ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'}`}>
                            {v.status.replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right 1 Col: Recent Regional Log Feed */}
          <div className="bg-orca-surface border border-orca-border rounded-2xl p-5 space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 border-b border-orca-border pb-3 mb-3">
                <Activity size={18} className="text-orca-teal" />
                <h3 className="text-sm font-extrabold text-white">
                  Recent Regional Log Feed
                </h3>
              </div>

              <div className="space-y-3">
                {activityFeed.map(evt => (
                  <div key={evt.id} className="p-3 rounded-xl bg-orca-bg/60 border border-orca-border/70 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-orca-muted">{evt.timestamp}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${evt.color === 'red' ? 'bg-red-500/20 text-red-400' : evt.color === 'amber' ? 'bg-amber-500/20 text-amber-400' : 'bg-orca-teal/15 text-orca-teal'}`}>
                        {evt.badge}
                      </span>
                    </div>
                    <p className="text-white text-[11px] leading-relaxed">
                      {evt.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-orca-border text-[10px] text-orca-muted">
              <span className="text-white font-semibold">Automatic Dispatch Sync:</span> Connected to Indian Coast Guard District 03 Node.
            </div>
          </div>
        </div>

        {/* ── Bottom: Horizontal Bar-Chart Compliance View Per District ── */}
        <div className="bg-orca-surface border border-orca-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-orca-border pb-3">
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-emerald-400" />
              <h3 className="text-sm font-extrabold text-white">
                Fleet Boundary Compliance Rate per Coastal District (US-13/US-14)
              </h3>
            </div>
            <span className="text-xs text-orca-muted">
              Target: 95.0% Minimal Standard
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {districtCompliance.map(d => (
              <div key={d.district} className="bg-orca-bg/50 border border-orca-border/70 p-4 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <strong className="text-white truncate">{d.district}</strong>
                  <span className="text-emerald-400 font-bold font-mono">{d.rate}%</span>
                </div>

                {/* Progress bar meter */}
                <div className="w-full h-2.5 bg-orca-surface rounded-full overflow-hidden border border-orca-border">
                  <div
                    className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full"
                    style={{ width: `${d.rate}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] text-orca-muted">
                  <span>{d.fleetActive} registered craft</span>
                  <span className="text-emerald-400 font-semibold">{d.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Data Honesty Disclaimer (FR-C6 & Safety Principle) ── */}
        <div className="p-4 rounded-xl bg-orca-surface border border-orca-border text-xs text-orca-muted flex items-start gap-3">
          <Info size={16} className="text-orca-teal flex-shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong className="text-white">Authority Telemetry Notice (FR-C6):</strong> This authority dashboard operates on realistic simulated AIS telemetry per project Iteration 3 specifications. High-frequency satellite AIS feeds require paid coastal radar / vessel tracking subscriptions; the system is structured for immediate live adapter replacement upon API provisioning.
          </p>
        </div>
      </main>
    </div>
  );
}
