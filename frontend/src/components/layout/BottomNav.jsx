import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MessageSquare, Map, Fish, AlertTriangle, User } from 'lucide-react';

export default function BottomNav() {
  const { t } = useTranslation();
  const location = useLocation();

  const navItems = [
    { to: '/chat', label: t('nav.chat', 'Chat'), icon: MessageSquare },
    { to: '/maps', label: t('nav.maps', 'Maps'), icon: Map },
    { to: '/pfz', label: t('nav.pfz', 'PFZ'), icon: Fish },
    { to: '/hazards', label: t('nav.hazards', 'Hazards'), icon: AlertTriangle },
    { to: '/profile', label: t('nav.profile', 'Profile'), icon: User },
  ];

  return (
    <nav 
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0c121e]/95 backdrop-blur-xl border-t border-orca-border/80 px-2 py-1.5 flex items-center justify-around shadow-2xl"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname.startsWith(item.to);

        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={`
              flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all duration-150 touch-target relative
              ${
                isActive
                  ? 'text-orca-teal font-bold'
                  : 'text-orca-muted hover:text-slate-200'
              }
            `}
          >
            {/* Active Pill Glow */}
            {isActive && (
              <span className="absolute -top-1 w-8 h-1 bg-orca-teal rounded-full shadow-lg shadow-orca-teal/50 animate-fadeIn" />
            )}

            <div className={`p-1 rounded-lg transition-transform ${isActive ? 'scale-110 bg-orca-teal/15' : ''}`}>
              <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
            </div>

            <span className="text-[10px] tracking-tight mt-0.5 leading-none">
              {item.label}
            </span>
          </NavLink>
        );
      })}
    </nav>
  );
}
