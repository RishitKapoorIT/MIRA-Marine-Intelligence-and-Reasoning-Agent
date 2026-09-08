import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLocationState, KNOWN_COASTAL_LOCATIONS } from '../../context/LocationContext.jsx';
import { INDIAN_PORTS } from '../../data/routing.js';
import Header from '../layout/Header.jsx';
import { changeLanguage } from '../../i18n/i18n.js';
import {
  Anchor, User, Phone, Shield, Route, Globe, Save, CheckCircle2,
  LogOut, MapPin, Navigation, Trash2, Info,
} from 'lucide-react';

/**
 * Captain profile.
 *
 * TWO CHANGES OF SUBSTANCE:
 *
 * 1. AADHAAR IS GONE. It was collected as an "optional identity badge" and
 *    described as stored encrypted for disaster relief. Aadhaar numbers are
 *    government identity numbers whose storage is legally restricted, a
 *    weather and fishing-zone app has no functional need for one, and the
 *    backend has no column to put it in. The field is removed rather than
 *    hidden.
 *
 * 2. SAFE HOUSE IS THE REAL BASE LOCATION. It used to be saved through a
 *    profile blob to a SQLite service; it now writes to the backend with
 *    explicit consent (FR-H3.2, enforced by a database CHECK constraint) and
 *    can be deleted (FR-H5.1).
 *
 * Safe Route stays browser-local and is labelled as such: FR-E5 route planning
 * is Iteration 3 and the backend has no concept of a saved route. Presenting
 * it as synced would be a claim the server cannot honour.
 */
export default function ProfilePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const {
    user, isAuthenticated, isBackendUnreachable, devBypassActive,
    updateProfile, setBaseLocation, deleteBaseLocation, logout, loginAsDemo,
    safeRoute, setSafeRoute,
  } = useAuth();
  const { setCurrentLocation } = useLocationState();

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [language, setLanguage] = useState(user?.preferredLanguage || i18n.language || 'en');

  const [safeHousePortKey, setSafeHousePortKey] = useState('mangalore');
  const [baseConsent, setBaseConsent] = useState(false);

  const [originPortId, setOriginPortId] = useState(safeRoute?.origin?.id || 'port-mangalore');
  const [destPortId, setDestPortId] = useState(safeRoute?.destination?.id || 'port-malpe');

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const currentBase = user?.baseLocation || null;

  useEffect(() => {
    if (!user) return;
    setName(user.name || '');
    setPhone(user.phone || '');
    setLanguage(user.preferredLanguage || i18n.language || 'en');

    if (user.baseLocation) {
      const found = KNOWN_COASTAL_LOCATIONS.find(
        (l) => Math.abs(l.lat - user.baseLocation.lat) < 0.1
            && Math.abs(l.lon - user.baseLocation.lon) < 0.1,
      );
      if (found) setSafeHousePortKey(found.key);
      // Already consented once; re-saving the same field does not re-ask.
      setBaseConsent(true);
    }
  }, [user, i18n.language]);

  const handleLanguageChange = (lng) => {
    setLanguage(lng);
    changeLanguage(lng);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setIsSaving(true);
    setSavedSuccess(false);

    const chosenPort = KNOWN_COASTAL_LOCATIONS.find((p) => p.key === safeHousePortKey);
    const baseChanged =
      chosenPort && (!currentBase
        || Math.abs(currentBase.lat - chosenPort.lat) > 0.001
        || Math.abs(currentBase.lon - chosenPort.lon) > 0.001);

    if (baseChanged && !baseConsent) {
      setError('Please confirm you agree to store your home port before saving.');
      setIsSaving(false);
      return;
    }

    try {
      // PUT /profile accepts display_name and preferred_language only.
      await updateProfile({ name: name.trim(), preferredLanguage: language });

      // Base location is a separate endpoint because consent travels with it.
      if (baseChanged) {
        await setBaseLocation({
          lat: chosenPort.lat, lon: chosenPort.lon, label: chosenPort.name, consent: true,
        });
        setCurrentLocation(chosenPort);
      }

      // Browser-local only.
      const originP = INDIAN_PORTS.find((p) => p.id === originPortId) || INDIAN_PORTS[0];
      const destP = INDIAN_PORTS.find((p) => p.id === destPortId) || INDIAN_PORTS[2];
      setSafeRoute({ origin: originP, destination: destP, waypoint: null });

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err) {
      setError(err.message || 'Could not save your profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteBaseLocation = async () => {
    setError('');
    setIsSaving(true);
    try {
      await deleteBaseLocation();
      setBaseConsent(false);
    } catch (err) {
      setError(err.message || 'Could not delete your home port.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const selectedPort = KNOWN_COASTAL_LOCATIONS.find((l) => l.key === safeHousePortKey);

  return (
    <div className="min-h-screen bg-orca-bg flex flex-col">
      <Header />

      <main className="flex-1 p-4 md:p-8 max-w-4xl w-full mx-auto space-y-6">
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
            <p className="text-xs text-orca-muted mt-1">{t('profile.subtitle')}</p>
          </div>

          {isAuthenticated ? (
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border border-red-500/30 text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-all self-start md:self-auto"
            >
              <LogOut size={14} />
              <span>{t('nav.logout')}</span>
            </button>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-orca-teal text-orca-bg hover:bg-orca-teal/90 shadow-sm transition-all self-start md:self-auto"
            >
              <User size={14} />
              <span>{t('nav.login')}</span>
            </button>
          )}
        </div>

        {savedSuccess && (
          <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs rounded-xl flex items-center gap-2.5">
            <CheckCircle2 size={18} className="text-emerald-400 flex-shrink-0" />
            <span className="font-semibold">{t('profile.saved_success')}</span>
          </div>
        )}

        {error && (
          <div className="p-3.5 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl">
            {error}
          </div>
        )}

        {!isAuthenticated ? (
          <div className="bg-orca-surface border border-orca-border rounded-2xl p-8 shadow-xl text-center space-y-6 max-w-lg mx-auto my-8">
            <div className="w-16 h-16 rounded-2xl bg-orca-teal/15 text-orca-teal flex items-center justify-center border border-orca-teal/30 mx-auto">
              <Shield size={32} />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-extrabold text-white tracking-tight">
                {isBackendUnreachable ? 'Backend unreachable' : 'Sign in required'}
              </h2>
              <p className="text-xs text-orca-muted leading-relaxed">
                {isBackendUnreachable
                  ? 'ORCA cannot reach its backend, so your profile cannot be loaded. Nothing is being shown from cache.'
                  : 'Sign in to set your home port and language preference.'}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                onClick={() => navigate('/login')}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs bg-orca-teal hover:bg-orca-teal/90 text-orca-bg flex items-center justify-center gap-2 shadow-lg transition-all"
              >
                <User size={14} />
                <span>Go to sign in</span>
              </button>
              {devBypassActive && (
                <button
                  onClick={async () => {
                    try { await loginAsDemo(); } catch (err) { setError(err.message); }
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl font-semibold text-xs bg-orca-surface-2 border border-orca-border text-white hover:border-orca-teal/40 transition-all"
                >
                  Continue as development user
                </button>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            {/* Identity */}
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
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-orca-bg border border-orca-border text-white text-xs p-2.5 rounded-xl focus:outline-none focus:border-orca-teal"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-orca-muted block mb-1">
                    {t('profile.phone')} (Read-Only Identity)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-orca-muted"><Phone size={14} /></span>
                    <input
                      type="text"
                      value={phone}
                      readOnly
                      className="w-full bg-orca-bg/50 border border-orca-border text-orca-muted text-xs pl-9 pr-3 py-2.5 rounded-xl cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-orca-border/60 flex items-start gap-2">
                <Info size={13} className="text-orca-teal flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-orca-muted leading-relaxed">
                  ORCA stores only your mobile number, name, language and home port. It does
                  not collect government identity numbers, and keeps no history of where you
                  have been.
                </p>
              </div>
            </div>

            {/* Home port / base location */}
            <div className="bg-orca-surface border border-orca-border rounded-2xl p-5 md:p-6 shadow-xl space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <MapPin size={16} className="text-emerald-400" />
                    <span>{t('profile.safe_house')}</span>
                  </h2>
                  <p className="text-xs text-orca-muted mt-0.5">{t('profile.safe_house_desc')}</p>
                </div>
                <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-bold">
                  Saved on server
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-orca-muted block mb-1">
                    Select Base Coastal Harbor
                  </label>
                  <select
                    value={safeHousePortKey}
                    onChange={(e) => setSafeHousePortKey(e.target.value)}
                    className="w-full bg-orca-bg border border-orca-border text-white text-xs p-2.5 rounded-xl focus:outline-none focus:border-orca-teal"
                  >
                    {KNOWN_COASTAL_LOCATIONS.map((loc) => (
                      <option key={loc.key} value={loc.key}>
                        {loc.name} ({loc.region} · {loc.sector})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-3 bg-orca-bg/60 border border-orca-border rounded-xl flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                    <Navigation size={16} />
                  </div>
                  <div className="text-xs min-w-0">
                    <span className="text-orca-muted block text-[10px]">
                      {currentBase ? 'Stored home port' : 'Not set'}
                    </span>
                    <strong className="text-white font-mono truncate block">
                      {currentBase
                        ? `${currentBase.lat.toFixed(3)}°N, ${currentBase.lon.toFixed(3)}°E`
                        : `${selectedPort?.lat.toFixed(3)}°N, ${selectedPort?.lon.toFixed(3)}°E (unsaved)`}
                    </strong>
                  </div>
                </div>
              </div>

              {/* FR-H3.2 — consent recorded with the location. */}
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={baseConsent}
                  onChange={(e) => setBaseConsent(e.target.checked)}
                  className="mt-0.5 accent-orca-teal"
                />
                <span className="text-[11px] text-orca-muted leading-snug">
                  I agree to ORCA storing this port as my default location. It is stored once —
                  ORCA keeps no record of my movements.
                </span>
              </label>

              {currentBase && (
                <button
                  type="button"
                  onClick={handleDeleteBaseLocation}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-red-500/30 text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-all"
                >
                  <Trash2 size={12} />
                  <span>Delete stored home port</span>
                </button>
              )}
            </div>

            {/* Safe route — browser-local */}
            <div className="bg-orca-surface border border-orca-border rounded-2xl p-5 md:p-6 shadow-xl space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <Route size={16} className="text-cyan-400" />
                    <span>{t('profile.safe_route')}</span>
                  </h2>
                  <p className="text-xs text-orca-muted mt-0.5">{t('profile.safe_route_desc')}</p>
                </div>
                <span className="text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded font-bold">
                  This browser only
                </span>
              </div>

              <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/25">
                <Info size={12} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-300/80 leading-snug">
                  Route planning is a later iteration. This preference is saved in this
                  browser and is not sent to the server, so it will not follow you to
                  another device.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-orca-muted block mb-1">Default Origin Port</label>
                  <select
                    value={originPortId}
                    onChange={(e) => setOriginPortId(e.target.value)}
                    className="w-full bg-orca-bg border border-orca-border text-white text-xs p-2.5 rounded-xl focus:outline-none focus:border-orca-teal"
                  >
                    {INDIAN_PORTS.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.region})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-orca-muted block mb-1">Default Destination</label>
                  <select
                    value={destPortId}
                    onChange={(e) => setDestPortId(e.target.value)}
                    className="w-full bg-orca-bg border border-orca-border text-white text-xs p-2.5 rounded-xl focus:outline-none focus:border-orca-teal"
                  >
                    {INDIAN_PORTS.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.region})</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Language */}
            <div className="bg-orca-surface border border-orca-border rounded-2xl p-5 md:p-6 shadow-xl space-y-4">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Globe size={16} className="text-amber-400" />
                <span>{t('profile.language')}</span>
              </h2>
              <div className="flex items-center gap-3 flex-wrap">
                {[
                  { code: 'en', label: 'English' },
                  { code: 'hi', label: 'हिन्दी (Hindi)' },
                  { code: 'kn', label: 'ಕನ್ನಡ (Kannada)' },
                ].map((lng) => (
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

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-3 rounded-xl font-bold text-xs bg-orca-teal hover:bg-orca-teal/90 text-orca-bg flex items-center gap-2 shadow-xl transition-all disabled:opacity-60"
              >
                <Save size={16} />
                <span>{isSaving ? 'Saving...' : t('profile.save')}</span>
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}