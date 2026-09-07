import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext.jsx';
import HeroCard from './HeroCard.jsx';
import { changeLanguage } from '../../i18n/i18n.js';
import { MessageSquare, Map, BarChart3, Shield, User, Globe, Compass, Fish, AlertTriangle } from 'lucide-react';

export default function WelcomePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-orca-bg flex flex-col relative overflow-hidden">
      {/* ── Top navigation bar ── */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-orca-border/50 bg-orca-surface/60 backdrop-blur z-20">
        {/* Wordmark */}
        <div 
          onClick={() => navigate('/')} 
          className="flex items-center gap-2.5 cursor-pointer"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orca-teal to-teal-700 flex items-center justify-center shadow-md shadow-orca-teal/20">
            <span className="text-orca-bg font-extrabold text-base leading-none">O</span>
          </div>
          <div>
            <span className="text-white text-lg font-extrabold tracking-tight">ORCA</span>
            <p className="text-orca-muted text-[10px] font-medium leading-none">
              Marine Intelligence
            </p>
          </div>
        </div>

        {/* Center/Right Nav links */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/chat')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-orca-teal text-orca-bg hover:bg-orca-teal/90 transition-all shadow-sm shadow-orca-teal/15"
          >
            <MessageSquare size={13} />
            <span>{t('nav.chat')}</span>
          </button>
          <button
            onClick={() => navigate('/maps')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-orca-surface border border-orca-border text-white hover:bg-orca-surface-2 transition-all"
          >
            <Map size={13} />
            <span>{t('nav.maps')}</span>
          </button>
          <button
            onClick={() => navigate('/analytics')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-orca-surface border border-orca-border text-white hover:bg-orca-surface-2 transition-all"
          >
            <BarChart3 size={13} />
            <span>{t('nav.analytics')}</span>
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-orca-surface border border-orca-border text-white hover:bg-orca-surface-2 transition-all"
          >
            <Shield size={13} />
            <span>{t('nav.dashboard')}</span>
          </button>

          {/* Profile / Login */}
          <button
            onClick={() => navigate('/profile')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-orca-surface-2 border border-orca-teal/40 text-orca-teal hover:bg-orca-teal hover:text-orca-bg transition-all"
          >
            <User size={13} />
            <span>{isAuthenticated ? (user?.name?.split(' ')[0] || t('nav.profile')) : t('nav.login')}</span>
          </button>
        </div>
      </header>

      {/* ── Main hero content ── */}
      <main className="flex-1 flex items-center px-6 py-8 relative z-10">
        <div className="w-full max-w-5xl mx-auto">
          <HeroCard />
        </div>
      </main>

      {/* ── Footer with Functional Language Switching (Part D) ── */}
      <footer className="px-6 py-4 border-t border-orca-border/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-orca-muted text-xs z-20 bg-orca-surface/30">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 font-semibold text-white">
            <Globe size={14} className="text-orca-teal" />
            <span>{t('welcome.languages')}:</span>
          </span>
          <div className="flex items-center gap-1 bg-orca-surface border border-orca-border rounded-lg p-1 text-xs font-bold">
            <button
              onClick={() => changeLanguage('en')}
              className={`px-2.5 py-1 rounded transition-all ${
                i18n.language === 'en'
                  ? 'bg-orca-teal text-orca-bg shadow-sm'
                  : 'text-orca-muted hover:text-white'
              }`}
            >
              English
            </button>
            <button
              onClick={() => changeLanguage('hi')}
              className={`px-2.5 py-1 rounded transition-all ${
                i18n.language === 'hi'
                  ? 'bg-orca-teal text-orca-bg shadow-sm'
                  : 'text-orca-muted hover:text-white'
              }`}
            >
              हिन्दी (Hindi)
            </button>
            <button
              onClick={() => changeLanguage('kn')}
              className={`px-2.5 py-1 rounded transition-all ${
                i18n.language === 'kn'
                  ? 'bg-orca-teal text-orca-bg shadow-sm'
                  : 'text-orca-muted hover:text-white'
              }`}
            >
              ಕನ್ನಡ (Kannada)
            </button>
          </div>
        </div>

        <p className="text-[11px] font-mono text-orca-muted">
          Powered by XGBoost PFZ & Open-Meteo Telemetry
        </p>
      </footer>
    </div>
  );
}
