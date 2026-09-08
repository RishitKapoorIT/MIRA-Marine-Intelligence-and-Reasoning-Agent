import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLocationState, KNOWN_COASTAL_LOCATIONS } from '../../context/LocationContext.jsx';
import Header from '../layout/Header.jsx';
import {
  ShieldCheck, ShieldOff, ArrowRight, Anchor, CheckCircle2, MapPin, WifiOff, Phone,
} from 'lucide-react';

/**
 * Login.
 *
 * The OTP form is gone. It called services/auth-api (now deleted) and accepted
 * "123456" for any number, so it was theatre — a form that looked like
 * authentication while performing none. Showing it to judges would invite a
 * question with no good answer.
 *
 * Three honest states instead:
 *   backend unreachable  -> say so, offer retry
 *   dev bypass active    -> say so, continue
 *   otherwise            -> phone sign-in is not wired yet, and say why
 *
 * Aadhaar is not collected. A weather and fishing-zone app has no need for a
 * government identity number, and the backend has no column for one.
 */
export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    user, isAuthenticated, isBackendUnreachable, backendError,
    devBypassActive, refresh, setBaseLocation,
  } = useAuth();
  const { setCurrentLocation } = useLocationState();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState('entry'); // 'entry' | 'onboarding'
  const [name, setName] = useState('');
  const [selectedPortKey, setSelectedPortKey] = useState('mangalore');
  const [consent, setConsent] = useState(false);

  const needsOnboarding = isAuthenticated && !user?.baseLocation;

  const handleContinue = async () => {
    setBusy(true);
    setError('');
    try {
      const session = await refresh();
      if (!session) {
        setError('The backend did not return a session. Is DEV_AUTH_BYPASS enabled?');
        return;
      }
      if (!session.baseLocation) setStep('onboarding');
      else navigate('/chat');
    } catch (err) {
      setError(err.message || 'Could not establish a session.');
    } finally {
      setBusy(false);
    }
  };

  const handleCompleteOnboarding = async (e) => {
    e.preventDefault();
    setError('');

    // FR-H3.2 — the backend rejects a base location without consent, and a
    // CHECK constraint enforces the pairing in the database. Blocking here
    // gives a clearer message than a 400.
    if (!consent) {
      setError('Please confirm you agree to store your home port before continuing.');
      return;
    }

    // KNOWN_COASTAL_LOCATIONS is an ARRAY of {key, name, lat, lon, region, sector}.
    const port = (KNOWN_COASTAL_LOCATIONS || []).find((l) => l.key === selectedPortKey);
    if (!port) {
      setError('Please choose your home port.');
      return;
    }

    setBusy(true);
    try {
      await setBaseLocation({
        lat: port.lat, lon: port.lon, label: port.name, consent: true,
      });
      setCurrentLocation?.({ lat: port.lat, lon: port.lon, name: port.name });
      navigate('/chat');
    } catch (err) {
      setError(err.message || 'Could not save your home port.');
    } finally {
      setBusy(false);
    }
  };

  const card = 'bg-orca-surface border border-orca-border rounded-2xl p-6 space-y-5 shadow-xl';

  return (
    <div className="min-h-screen bg-orca-bg flex flex-col">
      <Header />
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-4">

          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orca-teal to-teal-700 flex items-center justify-center">
              <Anchor size={18} className="text-orca-bg" />
            </div>
            <div>
              <h1 className="text-white text-xl font-extrabold tracking-tight">ORCA</h1>
              <p className="text-orca-muted text-[11px]">Marine Intelligence</p>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl">
              {error}
            </div>
          )}

          {/* ── Backend down ── */}
          {isBackendUnreachable && (
            <div className={card}>
              <div className="flex items-start gap-3">
                <WifiOff size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-white font-bold text-sm">Cannot reach the ORCA backend</h2>
                  <p className="text-orca-muted text-xs mt-1 leading-relaxed">
                    {backendError} There is no offline mode: rather than show sample
                    conditions that were never measured, ORCA shows nothing at all.
                  </p>
                  <p className="text-orca-muted text-[11px] mt-2 font-mono">
                    uvicorn app.main:app --port 8000
                  </p>
                </div>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="w-full py-2.5 rounded-xl font-bold text-xs bg-orca-surface-2 border border-orca-border text-white hover:border-orca-teal transition-all"
              >
                Retry connection
              </button>
            </div>
          )}

          {/* ── Dev bypass ── */}
          {!isBackendUnreachable && devBypassActive && step === 'entry' && (
            <div className={card}>
              <div className="flex items-start gap-3">
                <ShieldOff size={20} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-white font-bold text-sm">Developer bypass active</h2>
                  <p className="text-orca-muted text-xs mt-1 leading-relaxed">
                    <span className="text-amber-300 font-semibold">DEV_AUTH_BYPASS</span> is
                    enabled on the backend, so every request is already authenticated as the
                    development user. There is no sign-in step to perform.
                  </p>
                  <p className="text-orca-muted text-xs mt-2 leading-relaxed">
                    Marine data behind this screen is live. Only authentication is bypassed.
                  </p>
                </div>
              </div>
              <button
                onClick={handleContinue}
                disabled={busy}
                className="w-full py-2.5 rounded-xl font-bold text-xs bg-orca-teal hover:bg-orca-teal/90 text-orca-bg flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-60"
              >
                <span>{busy ? 'Establishing session…' : 'Continue as development user'}</span>
                <ArrowRight size={15} />
              </button>
            </div>
          )}

          {/* ── Bypass off, Firebase not wired ── */}
          {!isBackendUnreachable && !devBypassActive && !isAuthenticated && (
            <div className={card}>
              <div className="flex items-start gap-3">
                <Phone size={20} className="text-orca-teal flex-shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-white font-bold text-sm">Phone sign-in is not yet wired</h2>
                  <p className="text-orca-muted text-xs mt-1 leading-relaxed">
                    ORCA uses Firebase Phone Auth. The backend endpoint is built and
                    waiting, but the Firebase client SDK is not configured in this build,
                    so there is no way to obtain a real verification code.
                  </p>
                  <p className="text-orca-muted text-xs mt-2 leading-relaxed">
                    The previous demo form accepted <code className="text-orca-teal">123456</code> for
                    any number without contacting a server. It has been removed rather than
                    left in place looking like authentication.
                  </p>
                  <p className="text-orca-muted text-[11px] mt-3">
                    For local work, set <code className="text-amber-300">DEV_AUTH_BYPASS=true</code> in
                    the backend <code>.env</code> and restart.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── Onboarding: name + home port + consent ── */}
          {(step === 'onboarding' || needsOnboarding) && !isBackendUnreachable && (
            <form onSubmit={handleCompleteOnboarding} className={card}>
              <div>
                <h2 className="text-white font-bold text-sm flex items-center gap-2">
                  <MapPin size={16} className="text-orca-teal" />
                  Set your home port
                </h2>
                <p className="text-orca-muted text-xs mt-1 leading-relaxed">
                  Used when you ask about conditions without naming a place. You can change
                  or delete it at any time from your profile.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-orca-muted block mb-1.5">
                  Name (optional)
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Vessel master name"
                  className="w-full bg-orca-bg border border-orca-border text-white text-sm px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-orca-teal"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-orca-muted block mb-1.5">
                  Home port
                </label>
                <select
                  value={selectedPortKey}
                  onChange={(e) => setSelectedPortKey(e.target.value)}
                  className="w-full bg-orca-bg border border-orca-border text-white text-sm px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-orca-teal"
                >
                  {(KNOWN_COASTAL_LOCATIONS || []).map((loc) => (
                    <option key={loc.key} value={loc.key}>
                      {loc.name}{loc.region ? ` (${loc.region})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 accent-orca-teal"
                />
                <span className="text-[11px] text-orca-muted leading-snug">
                  I agree to ORCA storing this port as my default location. It is stored
                  once — ORCA keeps no history of where I have been.
                </span>
              </label>

              <button
                type="submit"
                disabled={busy || !consent}
                className="w-full py-2.5 rounded-xl font-bold text-xs bg-orca-teal hover:bg-orca-teal/90 text-orca-bg flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-50"
              >
                <span>{busy ? 'Saving…' : 'Save and continue'}</span>
                <CheckCircle2 size={15} />
              </button>
            </form>
          )}

          {/* ── Already signed in ── */}
          {isAuthenticated && !needsOnboarding && step === 'entry' && (
            <div className={card}>
              <div className="flex items-center gap-3">
                <ShieldCheck size={20} className="text-emerald-400" />
                <div>
                  <h2 className="text-white font-bold text-sm">Session active</h2>
                  <p className="text-orca-muted text-xs mt-0.5">
                    Signed in as {user?.name || user?.phone}
                    {user?.baseLocation?.label ? ` · ${user.baseLocation.label}` : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate('/chat')}
                className="w-full py-2.5 rounded-xl font-bold text-xs bg-orca-teal hover:bg-orca-teal/90 text-orca-bg flex items-center justify-center gap-2 transition-all"
              >
                <span>Go to ORCA</span>
                <ArrowRight size={15} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}