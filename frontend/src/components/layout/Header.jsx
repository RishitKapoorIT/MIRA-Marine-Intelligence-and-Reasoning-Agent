import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { MessageSquare, Map, BarChart3, Shield, Compass, AlertTriangle, Fish } from 'lucide-react';

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { to: '/chat', label: 'Chat', icon: MessageSquare },
    { to: '/maps', label: 'Maps', icon: Map },
    { to: '/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/dashboard', label: 'Dashboard', icon: Shield },
  ];

  // Secondary sub-views for quick jumping
  const subViews = [
    { to: '/pfz', label: 'PFZ Zones', icon: Fish },
    { to: '/hazards', label: 'Hazards', icon: AlertTriangle },
    { to: '/route', label: 'Safe Routes', icon: Compass },
  ];

  return (
    <header className="h-16 bg-orca-surface border-b border-orca-border px-4 md:px-6 flex items-center justify-between z-50 select-none flex-shrink-0">
      {/* ── Left: Wordmark ── */}
      <div 
        onClick={() => navigate('/')}
        className="flex items-center gap-3 cursor-pointer group"
      >
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orca-teal to-teal-700 flex items-center justify-center shadow-lg shadow-orca-teal/20 group-hover:scale-105 transition-transform">
          <span className="text-orca-bg font-extrabold text-lg leading-none">O</span>
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-white font-extrabold text-lg tracking-tight group-hover:text-orca-teal transition-colors">
              ORCA
            </span>
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-orca-teal/15 text-orca-teal font-bold border border-orca-teal/30">
              v2.0
            </span>
          </div>
          <p className="text-orca-muted text-[11px] font-medium leading-none">
            Marine Intelligence Platform
          </p>
        </div>
      </div>

      {/* ── Center: Main Navigation Tabs ── */}
      <nav className="hidden sm:flex items-center gap-1 bg-orca-bg/60 p-1 rounded-xl border border-orca-border">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = location.pathname.startsWith(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`
                flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold
                transition-all duration-150
                ${
                  isActive
                    ? 'bg-orca-teal text-orca-bg shadow-sm font-bold'
                    : 'text-orca-muted hover:text-white hover:bg-orca-surface'
                }
              `}
            >
              <Icon size={14} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}

        {/* Separator */}
        <div className="h-4 w-px bg-orca-border mx-1" />

        {/* Secondary Quick Tools */}
        {subViews.map(item => {
          const Icon = item.icon;
          const isActive = location.pathname.startsWith(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`
                flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
                transition-all duration-150
                ${
                  isActive
                    ? 'bg-orca-surface-2 text-orca-teal border border-orca-teal/40'
                    : 'text-orca-muted/80 hover:text-white hover:bg-orca-surface'
                }
              `}
            >
              <Icon size={13} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* ── Right: Region Chip & Profile ── */}
      <div className="flex items-center gap-3">
        {/* Region Chip */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-orca-surface-2 border border-orca-border text-xs font-medium text-white">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-semibold tracking-wide text-orca-teal text-[11px] uppercase">
            Mangalore Region
          </span>
          <span className="text-orca-muted text-[10px] hidden md:inline">12.91°N, 74.85°E</span>
        </div>

        {/* User Profile Avatar */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-600 to-orca-teal flex items-center justify-center text-xs font-bold text-white border border-white/20 shadow-sm cursor-pointer hover:ring-2 hover:ring-orca-teal/40 transition-all">
          RK
        </div>
      </div>
    </header>
  );
}
