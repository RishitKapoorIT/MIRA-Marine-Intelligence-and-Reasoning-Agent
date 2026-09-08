import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLocationState, KNOWN_COASTAL_LOCATIONS } from '../../context/LocationContext.jsx';
import Header from '../layout/Header.jsx';
import { ShieldCheck, Phone, KeyRound, ArrowRight, Anchor, CheckCircle2, Sparkles, MapPin } from 'lucide-react';

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, isAuthenticated, requestOtp, verifyOtp, updateProfile, loginAsDemo, logout } = useAuth();
  const { setCurrentLocation } = useLocationState();

  const [step, setStep] = useState('phone'); // 'phone' | 'otp' | 'onboarding'
  const [phone, setPhone] = useState('+91 ');
  const [otp, setOtp] = useState('');
  const [devOtpNotice, setDevOtpNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Onboarding state
  const [name, setName] = useState('');
  const [aadhaar, setAadhaar] = useState('');
  const [selectedPortKey, setSelectedPortKey] = useState('mangalore');

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    const raw = phone.trim();
    if (raw.length < 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }

    setLoading(true);
    try {
      const res = await requestOtp(raw);
      if (res.dev_otp) {
        setDevOtpNotice(`Dev OTP: ${res.dev_otp}`);
        setOtp(res.dev_otp);
      }
      setStep('otp');
    } catch (err) {
      setError(err.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    if (!otp.trim()) {
      setError('Please enter the 6-digit code');
      return;
    }

    setLoading(true);
    try {
      const res = await verifyOtp(phone.trim(), otp.trim());
      if (res.is_new_user) {
        setStep('onboarding');
      } else {
        navigate('/chat');
      }
    } catch (err) {
      setError(err.message || 'Verification failed. Try 123456.');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteOnboarding = async (e) => {
    e.preventDefault();
    setLoading(true);
    const chosenPort = KNOWN_COASTAL_LOCATIONS.find(p => p.key === selectedPortKey) || KNOWN_COASTAL_LOCATIONS[7];
    const safeHouse = {
      lat: chosenPort.lat,
      lon: chosenPort.lon,
      label: chosenPort.name,
    };

    await updateProfile({
      name: name.trim() || 'Coastal Fisher',
      safe_house: safeHouse,
      aadhaar: aadhaar.trim(),
    });

    setCurrentLocation(chosenPort);
    navigate('/chat');
  };

  return (
    <div className="min-h-screen bg-orca-bg flex flex-col">
      <Header />

      <main className="flex-1 flex items-center justify-center p-4 relative">
        <div className="max-w-md w-full bg-orca-surface border border-orca-border rounded-2xl p-6 md:p-8 shadow-2xl relative z-10 space-y-6">
          
          {/* If already authenticated and not in onboarding, offer direct actions or switch account */}
          {isAuthenticated && step !== 'onboarding' ? (
            <div className="space-y-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/30 mx-auto shadow-lg shadow-emerald-500/10">
                <CheckCircle2 size={30} />
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                  Active Session
                </span>
                <h1 className="text-xl font-extrabold text-white tracking-tight pt-1">
                  {user?.name || 'Vessel Master'}
                </h1>
                <p className="text-xs text-orca-muted font-mono">
                  {user?.phone || 'Registered Mobile Identity'}
                </p>
                {user?.safe_house?.label && (
                  <p className="text-[11px] text-orca-teal flex items-center justify-center gap-1 mt-1">
                    <MapPin size={12} />
                    <span>Safe House: {user.safe_house.label}</span>
                  </p>
                )}
              </div>

              <div className="space-y-2.5 pt-2">
                <button
                  onClick={() => navigate('/chat')}
                  className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-orca-teal hover:bg-orca-teal/90 text-orca-bg flex items-center justify-center gap-2 shadow-lg transition-all"
                >
                  <span>Launch Marine Workspace</span>
                  <ArrowRight size={14} />
                </button>

                <button
                  onClick={() => navigate('/profile')}
                  className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs bg-orca-surface-2 border border-orca-border text-white hover:border-orca-teal/40 transition-all flex items-center justify-center gap-2"
                >
                  <span>Captain & Vessel Profile</span>
                </button>

                <button
                  onClick={async () => {
                    await logout();
                    setStep('phone');
                    setPhone('+91 ');
                    setOtp('');
                  }}
                  className="w-full py-2 px-4 rounded-xl font-medium text-xs text-red-400 hover:bg-red-500/10 transition-all flex items-center justify-center gap-2"
                >
                  <span>Log Out / Switch Account</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Header Brand */}
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-orca-teal/15 text-orca-teal flex items-center justify-center border border-orca-teal/30 mx-auto">
                  <Anchor size={24} />
                </div>
                <h1 className="text-xl font-extrabold text-white tracking-tight">
                  {step === 'onboarding'
                    ? '🎉 Vessel Master Onboarding'
                    : t('auth.login_title')}
                </h1>
                <p className="text-xs text-orca-muted">
                  {step === 'onboarding'
                    ? 'New fisherman registration: Set your captain name and Safe House harbor'
                    : 'Enter your Indian mobile number to log in or register as a new vessel master'}
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl">
                  {error}
                </div>
              )}

              {devOtpNotice && step === 'otp' && (
                <div 
                  onClick={() => setOtp('123456')}
                  className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs rounded-xl flex items-center justify-between cursor-pointer hover:bg-emerald-500/15 transition-colors"
                  title="Click to auto-fill"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} />
                    <span>{devOtpNotice} (Dev OTP)</span>
                  </div>
                  <span className="text-[10px] font-bold underline">Fill 123456</span>
                </div>
              )}

              {/* STEP 1: Phone Entry */}
              {step === 'phone' && (
                <div className="space-y-5">
                  <form onSubmit={handleSendOtp} className="space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-orca-muted block mb-1.5">
                        {t('auth.phone_label')}
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-3 text-orca-muted">
                          <Phone size={16} />
                        </span>
                        <input
                          type="text"
                          value={phone}
                          onChange={e => setPhone(e.target.value)}
                          placeholder="+91 98450 12345"
                          className="w-full bg-orca-bg border border-orca-border text-white text-sm pl-10 pr-4 py-2.5 rounded-xl focus:outline-none focus:border-orca-teal"
                          autoFocus
                        />
                      </div>
                      <p className="text-[10px] text-orca-muted mt-1">
                        Any new mobile number will automatically begin the new-user onboarding setup.
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-orca-teal hover:bg-orca-teal/90 text-orca-bg flex items-center justify-center gap-2 shadow-lg transition-all"
                    >
                      <span>{loading ? 'Sending...' : t('auth.send_otp')}</span>
                      <ArrowRight size={14} />
                    </button>
                  </form>

                  {/* Quick Test / Demo Shortcuts */}
                  <div className="border-t border-orca-border/60 pt-4 space-y-2">
                    <p className="text-[10px] text-center text-orca-muted uppercase tracking-wider font-semibold">
                      Developer & Testing Shortcuts
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          await loginAsDemo();
                          navigate('/chat');
                        }}
                        className="p-2 rounded-xl text-[11px] font-semibold bg-orca-surface-2 border border-orca-border text-white hover:border-orca-teal/50 hover:text-orca-teal transition-all text-center"
                      >
                        ⚡ Demo Captain
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const randomPhone = `+91 98765 ${Math.floor(10000 + Math.random() * 90000)}`;
                          setPhone(randomPhone);
                        }}
                        className="p-2 rounded-xl text-[11px] font-semibold bg-orca-surface-2 border border-orca-border text-white hover:border-orca-teal/50 hover:text-orca-teal transition-all text-center"
                      >
                        🆕 New User Mobile
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: OTP Verification */}
              {step === 'otp' && (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-xs font-semibold text-orca-muted">
                        {t('auth.otp_label')}
                      </label>
                      <button
                        type="button"
                        onClick={() => setStep('phone')}
                        className="text-[11px] text-orca-teal hover:underline"
                      >
                        Change Number
                      </button>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3.5 top-3 text-orca-muted">
                        <KeyRound size={16} />
                      </span>
                      <input
                        type="text"
                        value={otp}
                        onChange={e => setOtp(e.target.value)}
                        placeholder="123456"
                        maxLength={6}
                        className="w-full bg-orca-bg border border-orca-border text-white text-base tracking-widest pl-10 pr-4 py-2.5 rounded-xl focus:outline-none focus:border-orca-teal font-mono"
                        autoFocus
                      />
                    </div>
                    <p className="text-[10px] text-orca-muted mt-1">
                      In local dev mode, entering <code className="text-orca-teal">123456</code> is accepted for any phone number.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-orca-teal hover:bg-orca-teal/90 text-orca-bg flex items-center justify-center gap-2 shadow-lg transition-all"
                  >
                    <span>{loading ? 'Verifying...' : t('auth.verify_otp')}</span>
                    <ShieldCheck size={16} />
                  </button>
                </form>
              )}

              {/* STEP 3: New User Onboarding */}
              {step === 'onboarding' && (
                <form onSubmit={handleCompleteOnboarding} className="space-y-4">
                  <div className="p-3 bg-orca-teal/10 border border-orca-teal/30 rounded-xl">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-orca-teal block">
                      New Registration Detected
                    </span>
                    <span className="text-xs text-white font-medium">
                      Mobile: {phone}
                    </span>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-orca-muted block mb-1">
                      Master / Captain Full Name *
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="e.g. Captain Ramesh Poojary"
                      className="w-full bg-orca-bg border border-orca-border text-white text-sm p-2.5 rounded-xl focus:outline-none focus:border-orca-teal"
                      required
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-orca-muted block mb-1">
                      Select Safe House (Home Harbor Anchor) *
                    </label>
                    <select
                      value={selectedPortKey}
                      onChange={e => setSelectedPortKey(e.target.value)}
                      className="w-full bg-orca-bg border border-orca-border text-white text-xs p-2.5 rounded-xl focus:outline-none focus:border-orca-teal"
                    >
                      {KNOWN_COASTAL_LOCATIONS.map(loc => (
                        <option key={loc.key} value={loc.key}>
                          {loc.name} ({loc.region} · {loc.sector})
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-orca-muted mt-1">
                      Your Safe House sets your fallback GPS coordinates and ocean diagnostics when satellite GPS is unavailable.
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-orca-muted block mb-1">
                      Aadhaar Number (Optional Verification)
                    </label>
                    <input
                      type="text"
                      value={aadhaar}
                      onChange={e => setAadhaar(e.target.value)}
                      placeholder="XXXX-XXXX-XXXX (Optional for government subsidies)"
                      className="w-full bg-orca-bg border border-orca-border text-white text-xs p-2.5 rounded-xl focus:outline-none focus:border-orca-teal font-mono"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-orca-teal hover:bg-orca-teal/90 text-orca-bg flex items-center justify-center gap-2 shadow-lg transition-all"
                  >
                    <span>Complete Onboarding & Enter Workspace</span>
                    <CheckCircle2 size={16} />
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
