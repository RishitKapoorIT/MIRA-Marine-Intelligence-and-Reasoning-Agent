import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLocationState, KNOWN_COASTAL_LOCATIONS } from '../../context/LocationContext.jsx';
import { INDIAN_PORTS } from '../../data/routing.js';
import Header from '../layout/Header.jsx';
import { changeLanguage } from '../../i18n/i18n.js';
import {
  Anchor,
  User,
  Phone,
  Shield,
  Route,
  Globe,
  Save,
  CheckCircle2,
  AlertCircle,
  LogOut,
  MapPin,
  Navigation
} from 'lucide-react';

export default function ProfilePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, updateProfile, logout, safeHouse, safeRoute } = useAuth();
  const { setCurrentLocation } = useLocationState();

  const [name, setName] = useState(user?.name || 'Captain Ramanath K.');
  const [phone] = useState(user?.phone || '+91 98450 12345');
  const [aadhaar, setAadhaar] = useState(user?.aadhaar || '');
  const [language, setLanguage] = useState(user?.preferred_language || i18n.language || 'en');

  // Safe House state
  const [safeHousePortKey, setSafeHousePortKey] = useState('mangalore');

  // Safe Route state
  const [originPortId, setOriginPortId] = useState(safeRoute?.origin?.id || 'port-mangalore');
  const [destPortId, setDestPortId] = useState(safeRoute?.destination?.id || 'port-malpe');

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || 'Captain Ramanath K.');
      setAadhaar(user.aadhaar || '');
      setLanguage(user.preferred_language || i18n.language || 'en');
      if (user.safe_house) {
        const found = KNOWN_COASTAL_LOCATIONS.find(
          l => Math.abs(l.lat - user.safe_house.lat) < 0.1 && Math.abs(l.lon - user.safe_house.lon) < 0.1
        );
        if (found) setSafeHousePortKey(found.key);
      }
      if (user.safe_route) {
        if (user.safe_route.origin?.id) setOriginPortId(user.safe_route.origin.id);
        if (user.safe_route.destination?.id) setDestPortId(user.safe_route.destination.id);
      }
    }
  }, [user]);

  const handleLanguageChange = (lng) => {
    setLanguage(lng);
    changeLanguage(lng);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setSavedSuccess(false);

    const chosenPort = KNOWN_COASTAL_LOCATIONS.find(p => p.key === safeHousePortKey) || KNOWN_COASTAL_LOCATIONS[7];
    const newSafeHouse = {
      lat: chosenPort.lat,
      lon: chosenPort.lon,
      label: chosenPort.name,
    };

    const originP = INDIAN_PORTS.find(p => p.id === originPortId) || INDIAN_PORTS[0];
    const destP = INDIAN_PORTS.find(p => p.id === destPortId) || INDIAN_PORTS[2];

    const newSafeRoute = {
      origin: originP,
      destination: destP,
      waypoint: null,
    };

    try {
      await updateProfile({
        name: name.trim(),
        safe_house: newSafeHouse,
        safe_route: newSafeRoute,
        aadhaar: aadhaar.trim(),
        preferred_language: language,
      });

      // Update app-wide focus location
      setCurrentLocation(chosenPort);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err) {
      console.error('Save profile failed', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-orca-bg flex flex-col">
      <Header />

      <main className="flex-1 p-4 md:p-8 max-w-4xl w-full mx-auto space-y-6">
        {/* Title Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-orca-border pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] uppercase tracking-wider font-bold text-orca-teal bg-orca-teal/15 px-2 py-0.5 rounded border border-orca-teal/30">
                Captain Profile & Identity
              </span>
              <span className="text-xs text-orca-muted">FR-H User Profile Settings</span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
              <Anchor className="text-orca-teal" size={26} />
              <span>{t('profile.title')}</span>
            </h1>
            <p className="text-xs text-orca-muted mt-1">
              {t('profile.subtitle')}
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border border-red-500/30 text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-all self-start md:self-auto"
          >
            <LogOut size={14} />
            <span>{t('nav.logout')}</span>
          </button>
        </div>

        {savedSuccess && (
          <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs rounded-xl flex items-center gap-2.5 animate-fadeIn">
            <CheckCircle2 size={18} className="text-emerald-400 flex-shrink-0" />
            <span className="font-semibold">{t('profile.saved_success')}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {/* Identity Card */}
          <div className="bg-orca-surface border border-orca-border rounded-2xl p-5 md:p-6 shadow-xl space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <User size={16} className="text-orca-teal" />
              <span>Vessel Master Identity</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-orca-muted block mb-1">
                  {t('profile.name')}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-orca-bg border border-orca-border text-white text-xs p-2.5 rounded-xl focus:outline-none focus:border-orca-teal"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-orca-muted block mb-1">
                  {t('profile.phone')} (Read-Only Identity)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-orca-muted">
                    <Phone size={14} />
                  </span>
                  <input
                    type="text"
                    value={phone}
                    readOnly
                    className="w-full bg-orca-bg/50 border border-orca-border text-orca-muted text-xs pl-9 pr-3 py-2.5 rounded-xl cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            {/* Optional Aadhaar */}
            <div className="pt-2 border-t border-orca-border/60">
              <label className="text-xs font-semibold text-orca-muted flex items-center gap-1.5 mb-1">
                <Shield size={14} className="text-orca-teal" />
                <span>{t('profile.aadhaar')}</span>
              </label>
              <input
                type="text"
                value={aadhaar}
                onChange={e => setAadhaar(e.target.value)}
                placeholder="XXXX-XXXX-XXXX (Optional for government scheme subsidies)"
                maxLength={14}
                className="w-full md:w-1/2 bg-orca-bg border border-orca-border text-white text-xs p-2.5 rounded-xl focus:outline-none focus:border-orca-teal font-mono"
              />
              <p className="text-[10px] text-orca-muted mt-1.5 leading-relaxed">
                {t('profile.aadhaar_desc')} <span className="text-amber-400">Notice:</span> Stored encrypted in local secure SQLite storage for identity verification during disaster relief.
              </p>
            </div>
          </div>

          {/* Safe House Card */}
          <div className="bg-orca-surface border border-orca-border rounded-2xl p-5 md:p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <MapPin size={16} className="text-emerald-400" />
                  <span>{t('profile.safe_house')}</span>
                </h2>
                <p className="text-xs text-orca-muted mt-0.5">
                  {t('profile.safe_house_desc')}
                </p>
              </div>
              <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-bold">
                Default GPS Anchor
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-orca-muted block mb-1">
                  Select Base Coastal Harbor
                </label>
                <select
                  value={safeHousePortKey}
                  onChange={e => setSafeHousePortKey(e.target.value)}
                  className="w-full bg-orca-bg border border-orca-border text-white text-xs p-2.5 rounded-xl focus:outline-none focus:border-orca-teal"
                >
                  {KNOWN_COASTAL_LOCATIONS.map(loc => (
                    <option key={loc.key} value={loc.key}>
                      {loc.name} ({loc.region} · {loc.sector})
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 bg-orca-bg/60 border border-orca-border rounded-xl flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Navigation size={16} />
                </div>
                <div className="text-xs">
                  <span className="text-orca-muted block text-[10px]">Active Anchor Coordinates</span>
                  <strong className="text-white font-mono">
                    {KNOWN_COASTAL_LOCATIONS.find(l => l.key === safeHousePortKey)?.lat.toFixed(3)}°N,{' '}
                    {KNOWN_COASTAL_LOCATIONS.find(l => l.key === safeHousePortKey)?.lon.toFixed(3)}°E
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* Safe Route Card */}
          <div className="bg-orca-surface border border-orca-border rounded-2xl p-5 md:p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Route size={16} className="text-cyan-400" />
                  <span>{t('profile.safe_route')}</span>
                </h2>
                <p className="text-xs text-orca-muted mt-0.5">
                  {t('profile.safe_route_desc')}
                </p>
              </div>
              <span className="text-[10px] bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded font-bold">
                Route Pre-fill
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-orca-muted block mb-1">
                  Default Origin Port
                </label>
                <select
                  value={originPortId}
                  onChange={e => setOriginPortId(e.target.value)}
                  className="w-full bg-orca-bg border border-orca-border text-white text-xs p-2.5 rounded-xl focus:outline-none focus:border-orca-teal"
                >
                  {INDIAN_PORTS.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.region})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-orca-muted block mb-1">
                  Default Destination
                </label>
                <select
                  value={destPortId}
                  onChange={e => setDestPortId(e.target.value)}
                  className="w-full bg-orca-bg border border-orca-border text-white text-xs p-2.5 rounded-xl focus:outline-none focus:border-orca-teal"
                >
                  {INDIAN_PORTS.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.region})</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Language Preference Card */}
          <div className="bg-orca-surface border border-orca-border rounded-2xl p-5 md:p-6 shadow-xl space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Globe size={16} className="text-amber-400" />
              <span>{t('profile.language')}</span>
            </h2>

            <div className="flex items-center gap-3">
              {[
                { code: 'en', label: 'English' },
                { code: 'hi', label: 'हिन्दी (Hindi)' },
                { code: 'kn', label: 'ಕನ್ನಡ (Kannada)' },
              ].map(lng => (
                <button
                  type="button"
                  key={lng.code}
                  onClick={() => handleLanguageChange(lng.code)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                    language === lng.code
                      ? 'bg-orca-teal text-orca-bg border-orca-teal shadow-lg'
                      : 'bg-orca-bg text-orca-muted border-orca-border hover:border-orca-teal/50'
                  }`}
                >
                  {lng.label}
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-3 rounded-xl font-bold text-xs bg-orca-teal hover:bg-orca-teal/90 text-orca-bg flex items-center gap-2 shadow-xl transition-all"
            >
              <Save size={16} />
              <span>{isSaving ? 'Saving...' : t('profile.save')}</span>
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
