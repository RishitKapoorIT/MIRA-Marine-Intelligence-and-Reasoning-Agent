import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLocationState } from '../../context/LocationContext.jsx';
import { changeLanguage } from '../../i18n/i18n.js';
import { 
  MessageSquare, 
  Map, 
  BarChart3, 
  Shield, 
  Compass, 
  AlertTriangle, 
  Fish, 
  User, 
  Menu, 
  X, 
  ChevronRight,
  Sparkles
} from 'lucide-react';

export default function Header() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { currentLocation } = useLocationState();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { to: '/chat', label: t('nav.chat', 'Chat'), icon: MessageSquare },
    { to: '/maps', label: t('nav.maps', 'Maps'), icon: Map },
    { to: '/analytics', label: t('nav.analytics', 'Analytics'), icon: BarChart3 },
    { to: '/dashboard', label: t('nav.dashboard', 'Authority'), icon: Shield },
  ];

  const subViews = [
    { to: '/pfz', label: t('nav.pfz', 'PFZ Predictions'), icon: Fish },
    { to: '/hazards', label: t('nav.hazards', 'Safety & Hazards'), icon: AlertTriangle },
    { to: '/route', label: t('nav.route', 'Route Planner'), icon: Compass },
  ];

  const activeLat = currentLocation?.lat || 12.914;
  const activeLon = currentLocation?.lon || 74.856;
  const activeName = currentLocation?.name?.split(' ')[0] || 'Mangalore';

  const userInitials = user?.name
    ? user.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : 'RK';

  return (
    <>
      <header className="h-16 bg-orca-surface border-b border-orca-border px-3 md:px-6 flex items-center justify-between z-40 select-none flex-shrink-0 relative">
        {/* ── Left: Wordmark ── */}
        <div 
          onClick={() => navigate('/')}
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-gradient-to-br from-orca-teal to-teal-700 flex items-center justify-center shadow-lg shadow-orca-teal/20 group-hover:scale-105 transition-transform">
            <span className="text-orca-bg font-extrabold text-base md:text-lg leading-none">O</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-white font-extrabold text-base md:text-lg tracking-tight group-hover:text-orca-teal transition-colors">
                ORCA
              </span>
              <span className="text-[9px] md:text-[10px] uppercase tracking-wider px-1.5 py-0.2 rounded bg-orca-teal/15 text-orca-teal font-bold border border-orca-teal/30">
                v2.0
              </span>
            </div>
            <p className="text-orca-muted text-[10px] md:text-[11px] font-medium leading-none hidden sm:block">
              Marine Intelligence Platform
            </p>
          </div>
        </div>

        {/* ── Center: Main Navigation Tabs (Desktop) ── */}
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

        {/* ── Right Controls ── */}
        <div className="flex items-center gap-2 md:gap-2.5">
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
            className="flex items-center gap-1.5 md:gap-2 px-2.5 md:px-3 py-1.5 rounded-full bg-orca-surface-2 border border-orca-border text-xs font-medium text-white cursor-pointer hover:border-orca-teal/50 transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
            <span className="font-semibold tracking-wide text-orca-teal text-[11px] uppercase">
              {activeName}
            </span>
            <span className="text-orca-muted text-[10px] hidden sm:inline">
              {activeLat.toFixed(2)}°N, {activeLon.toFixed(2)}°E
            </span>
          </div>

          {/* User Profile Avatar / Login */}
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
              className="flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 rounded-xl text-xs font-bold bg-orca-teal text-orca-bg hover:bg-orca-teal/90 shadow-sm transition-all flex-shrink-0"
            >
              <User size={13} />
              <span className="hidden sm:inline">{t('nav.login')}</span>
            </button>
          )}

          {/* Mobile Menu Hamburger (Visible on lg- screens) */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
            className="lg:hidden p-2 rounded-xl bg-orca-surface-2 border border-orca-border text-slate-200 hover:text-orca-teal transition-all flex-shrink-0"
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      {/* ── Slide-Out Mobile Navigation Drawer ── */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden flex justify-end animate-fadeIn"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div 
            className="w-4/5 max-w-sm h-full bg-[#0d1424] border-l border-orca-border p-5 flex flex-col justify-between shadow-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-6">
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-orca-teal flex items-center justify-center text-orca-bg font-extrabold text-sm">
                    O
                  </div>
                  <span className="font-bold text-white text-base">Navigation Menu</span>
                </div>
                <button 
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg bg-white/5 text-slate-400 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Main Nav Links */}
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-orca-muted tracking-wider px-2">Primary Modules</span>
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname.startsWith(item.to);
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center justify-between p-3 rounded-xl text-sm font-semibold transition-all ${
                        isActive
                          ? 'bg-orca-teal text-orca-bg font-bold shadow-md shadow-orca-teal/20'
                          : 'text-slate-300 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={16} />
                        <span>{item.label}</span>
                      </div>
                      <ChevronRight size={14} className={isActive ? 'text-orca-bg' : 'text-slate-500'} />
                    </NavLink>
                  );
                })}
              </div>

              {/* Subview Tools */}
              <div className="space-y-1.5 pt-2">
                <span className="text-[10px] uppercase font-bold text-orca-muted tracking-wider px-2">Mission Tools</span>
                {subViews.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname.startsWith(item.to);
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center justify-between p-3 rounded-xl text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-orca-surface-2 text-orca-teal border border-orca-teal/40'
                          : 'text-slate-400 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={15} />
                        <span>{item.label}</span>
                      </div>
                      <ChevronRight size={13} className="text-slate-600" />
                    </NavLink>
                  );
                })}
              </div>
            </div>

            {/* Bottom Status in Drawer */}
            <div className="pt-4 border-t border-white/10 space-y-3">
              <div className="p-3 bg-orca-surface-2/40 border border-white/5 rounded-xl flex items-center gap-2 text-xs text-orca-muted">
                <Sparkles size={14} className="text-orca-teal flex-shrink-0" />
                <span>Sector Focus: <strong className="text-white">{activeName}</strong></span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

