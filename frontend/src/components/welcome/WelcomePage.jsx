import { useNavigate } from 'react-router-dom';
import HeroCard from './HeroCard.jsx';
import { MessageSquare, Map, BarChart3, Shield } from 'lucide-react';

export default function WelcomePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-orca-bg flex flex-col">

      {/* ── Top navigation bar ── */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-orca-border/50 bg-orca-surface/60 backdrop-blur">
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
            <span>Chat</span>
          </button>
          <button
            onClick={() => navigate('/maps')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-orca-surface border border-orca-border text-white hover:bg-orca-surface-2 transition-all"
          >
            <Map size={13} />
            <span>Maps</span>
          </button>
          <button
            onClick={() => navigate('/analytics')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-orca-surface border border-orca-border text-white hover:bg-orca-surface-2 transition-all"
          >
            <BarChart3 size={13} />
            <span>Analytics</span>
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-orca-surface border border-orca-border text-white hover:bg-orca-surface-2 transition-all"
          >
            <Shield size={13} />
            <span>Dashboard</span>
          </button>
        </div>
      </header>

      {/* ── Main hero content ── */}
      <main className="flex-1 flex items-center px-6 py-8">
        <div className="w-full max-w-5xl mx-auto">
          <HeroCard />
        </div>
      </main>

      {/* ── Footer — multilingual indicator ── */}
      <footer className="px-6 py-4 border-t border-orca-border/40 flex items-center justify-between text-orca-muted text-xs">
        <p>
          English · Hindi · Kannada (Multilingual Ready)
        </p>
        <p className="text-[11px] font-mono">
          Powered by XGBoost PFZ & Open Ocean Telemetry
        </p>
      </footer>
    </div>
  );
}
