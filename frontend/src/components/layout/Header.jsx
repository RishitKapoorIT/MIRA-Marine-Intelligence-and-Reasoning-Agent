import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLocationState } from '../../context/LocationContext.jsx';
import { changeLanguage } from '../../i18n/i18n.js';
import { MessageSquare, Map, BarChart3, Shield, Compass, AlertTriangle, Fish, User, Globe } from 'lucide-react';

export default function Header() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { currentLocation } = useLocationState();

  const navItems = [
    { to: '/chat', label: t('nav.chat'), icon: MessageSquare },
    { to: '/maps', label: t('nav.maps'), icon: Map },
    { to: '/analytics', label: t('nav.analytics'), icon: BarChart3 },
    { to: '/dashboard', label: t('nav.dashboard'), icon: Shield },
  ];

  const subViews = [
    { to: '/pfz', label: t('nav.pfz'), icon: Fish },
    { to: '/hazards', label: t('nav.hazards'), icon: AlertTriangle },
    { to: '/route', label: t('nav.route'), icon: Compass },
  ];

  const activeLat = currentLocation?.lat || 12.914;
  const activeLon = currentLocation?.lon || 74.856;
  const activeName = currentLocation?.name?.split(' ')[0] || 'Mangalore';

  const userInitials = user?.name
    ? user.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : 'RK';

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
      <nav className="hidden lg:flex items-center gap-1 bg-orca-bg/60 p-1 rounded-xl border border-orca-border">
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

      {/* ── Right: Language, Dynamic Region Chip & Profile ── */}
      <div className="flex items-center gap-2.5">
        {/* Language Switcher */}
        <div className="flex items-center bg-orca-bg border border-orca-border rounded-lg p-0.5 text-[10px] font-bold">
          <button
            onClick={() => changeLanguage('en')}
            className={`px-1.5 py-0.5 rounded transition-all ${
              i18n.language === 'en' ? 'bg-orca-teal text-orca-bg shadow-sm' : 'text-orca-muted hover:text-white'
            }`}
          >
            EN
          </button>
          <button
            onClick={() => changeLanguage('hi')}
            className={`px-1.5 py-0.5 rounded transition-all ${
              i18n.language === 'hi' ? 'bg-orca-teal text-orca-bg shadow-sm' : 'text-orca-muted hover:text-white'
            }`}
          >
            HI
          </button>
          <button
            onClick={() => changeLanguage('kn')}
            className={`px-1.5 py-0.5 rounded transition-all ${
              i18n.language === 'kn' ? 'bg-orca-teal text-orca-bg shadow-sm' : 'text-orca-muted hover:text-white'
            }`}
          >
            KN
          </button>
        </div>

        {/* Active Focus Location Chip */}
        <div 
          onClick={() => navigate('/profile')}
          title="Click to view/edit Safe House & Region Profile"
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-orca-surface-2 border border-orca-border text-xs font-medium text-white cursor-pointer hover:border-orca-teal/50 transition-colors"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
          <span className="font-semibold tracking-wide text-orca-teal text-[11px] uppercase">
            {activeName}
          </span>
          <span className="text-orca-muted text-[10px] hidden sm:inline">
            {activeLat.toFixed(2)}°N, {activeLon.toFixed(2)}°E
          </span>
        </div>

        {/* User Profile Avatar or Login Button */}
        {isAuthenticated ? (
          <button
            onClick={() => navigate('/profile')}
            title={`Logged in: ${user?.name || user?.phone}`}
            className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-600 to-orca-teal flex items-center justify-center text-xs font-bold text-white border border-white/20 shadow-sm hover:ring-2 hover:ring-orca-teal/40 transition-all flex-shrink-0"
          >
            {userInitials}
          </button>
        ) : (
          <button
            onClick={() => navigate('/login')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-orca-teal text-orca-bg hover:bg-orca-teal/90 shadow-sm transition-all flex-shrink-0"
          >
            <User size={13} />
            <span>{t('nav.login')}</span>
          </button>
        )}
      </div>
    </header>
  );
}
