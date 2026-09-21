import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLocationState, KNOWN_COASTAL_LOCATIONS } from '../../context/LocationContext.jsx';
import Header from '../layout/Header.jsx';
import { ShieldCheck, Phone, KeyRound, ArrowRight, Anchor, CheckCircle2, Sparkles, MapPin, UserPlus, LogIn, User, Globe, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, isAuthenticated, requestOtp, verifyOtp, registerNewUser, updateProfile, loginAsDemo, logout } = useAuth();
  const { setCurrentLocation } = useLocationState();

  // Mode: 'signin' | 'register'
  const [activeTab, setActiveTab] = useState('signin');
  const [step, setStep] = useState('phone'); // for signin: 'phone' | 'otp' | 'onboarding'
  const [phone, setPhone] = useState('+91 ');
  const [otp, setOtp] = useState('');
  const [devOtpNotice, setDevOtpNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successNotice, setSuccessNotice] = useState('');

  // Register / Onboarding Form State
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('+91 ');
  const [regPortKey, setRegPortKey] = useState('mangalore');
  const [regLang, setRegLang] = useState(i18n.language || 'en');
  const [regVesselId, setRegVesselId] = useState('');

  // Handlers for Sign In flow
  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessNotice('');
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
    const chosenPort = KNOWN_COASTAL_LOCATIONS.find(p => p.key === regPortKey) || KNOWN_COASTAL_LOCATIONS[7];
    const safeHouse = {
      lat: chosenPort.lat,
      lon: chosenPort.lon,
      label: chosenPort.name,
      region: chosenPort.region,
      sector: chosenPort.sector,
    };

    await updateProfile({
      name: regName.trim() || 'Coastal Fisher',
      safe_house: safeHouse,
      aadhaar: regVesselId.trim(),
      preferred_language: regLang,
    });

    setCurrentLocation(chosenPort);
    navigate('/chat');
  };

  // Direct New User Registration
  const handleDirectRegister = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessNotice('');
    if (!regName.trim()) {
      setError('Please enter the Captain / Mariner Name');
      return;
    }

    setLoading(true);
    try {
      const chosenPort = KNOWN_COASTAL_LOCATIONS.find(p => p.key === regPortKey) || KNOWN_COASTAL_LOCATIONS[7];
      const safeHouse = {
        lat: chosenPort.lat,
        lon: chosenPort.lon,
        label: chosenPort.name,
        region: chosenPort.region,
        sector: chosenPort.sector,
      };

      const newUser = await registerNewUser({
        name: regName.trim(),
        phone: regPhone.trim() || '+91 98450 11223',
        safe_house: safeHouse,
        preferred_language: regLang,
        aadhaar: regVesselId.trim(),
      });

      // Update current location and i18n
      setCurrentLocation(chosenPort);
      if (regLang && i18n.changeLanguage) {
        i18n.changeLanguage(regLang);
      }

      setSuccessNotice(`Account created for ${newUser.name}! Redirecting...`);
      setTimeout(() => {
        navigate('/chat');
      }, 500);
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-orca-bg flex flex-col">
      <Header />

      <main className="flex-1 flex items-center justify-center p-4 relative">
        <div className="max-w-md w-full bg-orca-surface border border-orca-border rounded-2xl p-6 md:p-8 shadow-2xl relative z-10 space-y-6">
          
          {/* ── CASE 1: USER IS ALREADY LOGGED IN ── */}
          {isAuthenticated && step !== 'onboarding' ? (
            <div className="space-y-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/30 mx-auto shadow-lg shadow-emerald-500/10">
                <CheckCircle2 size={30} />
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                  Active Mariner Session
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
                  <span>Continue to Marine Workspace</span>
                  <ArrowRight size={14} />
                </button>

                <button
                  onClick={() => navigate('/profile')}
                  className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs bg-orca-surface-2 border border-orca-border text-white hover:border-orca-teal/40 transition-all flex items-center justify-center gap-2"
                >
                  <User size={14} />
                  <span>Captain & Vessel Profile</span>
                </button>

                <div className="pt-2 border-t border-orca-border space-y-2">
                  <p className="text-[11px] text-orca-muted text-center font-medium">
                    Want to use a different account or register a new user?
                  </p>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={async () => {
                        await logout();
                        setActiveTab('register');
                        setRegName('');
                        setRegPhone('+91 ');
                      }}
                      className="w-full py-2 px-3 rounded-xl font-semibold text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-all flex items-center justify-center gap-1.5"
                    >
                      <UserPlus size={13} />
                      <span>Register New</span>
                    </button>

                    <button
                      onClick={async () => {
                        await logout();
                        setActiveTab('signin');
                        setStep('phone');
                        setPhone('+91 ');
                        setOtp('');
                      }}
                      className="w-full py-2 px-3 rounded-xl font-semibold text-xs bg-orca-surface-2 border border-orca-border text-white hover:text-orca-teal transition-all flex items-center justify-center gap-1.5"
                    >
                      <LogIn size={13} />
                      <span>Sign In Again</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ── CASE 2: AUTH / REGISTRATION TABS ── */
            <>
              {/* Header Icon & Title */}
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-orca-teal/15 text-orca-teal flex items-center justify-center border border-orca-teal/30 mx-auto">
                  <Anchor size={24} />
                </div>
                <h1 className="text-xl font-extrabold text-white tracking-tight">
                  {step === 'onboarding'
                    ? '🎉 Set Up Mariner Profile'
                    : activeTab === 'register'
                    ? 'Register New Mariner Account'
                    : t('auth.login_title')}
                </h1>
                <p className="text-xs text-orca-muted">
                  {step === 'onboarding'
                    ? 'Set your captain details and Safe House refuge harbor'
                    : activeTab === 'register'
                    ? 'Create a customized profile with your home harbor and coordinates'
                    : 'Sign in to access real-time ocean intelligence and safe routes'}
                </p>
              </div>

              {/* Tab Switcher: Sign In vs Register New User */}
              {step !== 'onboarding' && (
                <div className="grid grid-cols-2 p-1 bg-orca-bg rounded-xl border border-orca-border text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('signin');
                      setError('');
                    }}
                    className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                      activeTab === 'signin'
                        ? 'bg-orca-surface text-white shadow-sm border border-orca-border'
                        : 'text-orca-muted hover:text-white'
                    }`}
                  >
                    <LogIn size={13} />
                    <span>Sign In (OTP)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('register');
                      setError('');
                    }}
                    className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                      activeTab === 'register'
                        ? 'bg-orca-teal text-orca-bg shadow-sm'
                        : 'text-orca-muted hover:text-white'
                    }`}
                  >
                    <UserPlus size={13} />
                    <span>New Mariner</span>
                  </button>
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle size={15} className="flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {successNotice && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs rounded-xl flex items-center gap-2">
                  <CheckCircle2 size={15} className="flex-shrink-0" />
                  <span>{successNotice}</span>
                </div>
              )}

              {/* ── TAB A: DIRECT REGISTRATION FOR NEW USERS ── */}
              {activeTab === 'register' && step !== 'onboarding' && (
                <form onSubmit={handleDirectRegister} className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-orca-muted block mb-1">
                      Captain / Mariner Name *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-3 text-orca-muted">
                        <User size={15} />
                      </span>
                      <input
                        type="text"
                        value={regName}
                        onChange={e => setRegName(e.target.value)}
                        placeholder="e.g. Captain Vikram Shenoy"
                        className="w-full bg-orca-bg border border-orca-border text-white text-xs pl-10 pr-3 py-2.5 rounded-xl focus:outline-none focus:border-orca-teal"
                        required
                        autoFocus
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-orca-muted block mb-1">
                      Mobile Number
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-3 text-orca-muted">
                        <Phone size={15} />
                      </span>
                      <input
                        type="text"
                        value={regPhone}
                        onChange={e => setRegPhone(e.target.value)}
                        placeholder="+91 98765 43210"
                        className="w-full bg-orca-bg border border-orca-border text-white text-xs pl-10 pr-3 py-2.5 rounded-xl focus:outline-none focus:border-orca-teal font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-orca-muted block mb-1">
                      Home Port / Safe House Harbor *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-3 text-orca-muted">
                        <MapPin size={15} />
                      </span>
                      <select
                        value={regPortKey}
                        onChange={e => setRegPortKey(e.target.value)}
                        className="w-full bg-orca-bg border border-orca-border text-white text-xs pl-10 pr-3 py-2.5 rounded-xl focus:outline-none focus:border-orca-teal"
                      >
                        {KNOWN_COASTAL_LOCATIONS.map(loc => (
                          <option key={loc.key} value={loc.key}>
                            {loc.name} ({loc.region} · {loc.sector})
                          </option>
                        ))}
                      </select>
                    </div>
                    <p className="text-[10px] text-orca-muted mt-1">
                      Your home port coordinates will ground all your weather advisories, PFZ distance calculations, and hazard alerts.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-orca-muted block mb-1">
                        Language
                      </label>
                      <select
                        value={regLang}
                        onChange={e => setRegLang(e.target.value)}
                        className="w-full bg-orca-bg border border-orca-border text-white text-xs p-2.5 rounded-xl focus:outline-none focus:border-orca-teal"
                      >
                        <option value="en">English</option>
                        <option value="hi">हिन्दी (Hindi)</option>
                        <option value="kn">ಕನ್ನಡ (Kannada)</option>
                        <option value="ta">தமிழ் (Tamil)</option>
                        <option value="ml">മലയാളം (Malayalam)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-orca-muted block mb-1">
                        Vessel Reg / Aadhaar
                      </label>
                      <input
                        type="text"
                        value={regVesselId}
                        onChange={e => setRegVesselId(e.target.value)}
                        placeholder="IND-KA-04-MM-8841"
                        className="w-full bg-orca-bg border border-orca-border text-white text-xs p-2.5 rounded-xl focus:outline-none focus:border-orca-teal font-mono"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-orca-teal hover:bg-orca-teal/90 text-orca-bg flex items-center justify-center gap-2 shadow-lg transition-all"
                  >
                    <span>{loading ? 'Registering...' : 'Register & Launch Workspace'}</span>
                    <ArrowRight size={14} />
                  </button>

                  <p className="text-[11px] text-center text-orca-muted">
                    Already registered?{' '}
                    <button
                      type="button"
                      onClick={() => setActiveTab('signin')}
                      className="text-orca-teal font-semibold hover:underline"
                    >
                      Sign in with OTP
                    </button>
                  </p>
                </form>
              )}

              {/* ── TAB B: EXISTING USER SIGN IN WITH OTP ── */}
              {activeTab === 'signin' && step === 'phone' && (
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
                        Enter any 10-digit number. In development mode, OTP is instantly verified with 123456.
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

                  {/* Shortcuts */}
                  <div className="border-t border-orca-border/60 pt-4 space-y-2">
                    <p className="text-[10px] text-center text-orca-muted uppercase tracking-wider font-semibold">
                      Instant Access & Demo
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          await loginAsDemo();
                          navigate('/chat');
                        }}
                        className="p-2.5 rounded-xl text-[11px] font-semibold bg-orca-surface-2 border border-orca-border text-white hover:border-orca-teal/50 hover:text-orca-teal transition-all text-center"
                      >
                        ⚡ Demo Captain (Mangalore)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('register');
                          setRegName('Captain Rajesh');
                          setRegPortKey('kochi');
                          setRegPhone(`+91 98450 ${Math.floor(10000 + Math.random() * 90000)}`);
                        }}
                        className="p-2.5 rounded-xl text-[11px] font-semibold bg-orca-surface-2 border border-orca-border text-white hover:border-orca-teal/50 hover:text-orca-teal transition-all text-center"
                      >
                        🆕 Register as New Mariner
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: OTP Verification */}
              {activeTab === 'signin' && step === 'otp' && (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  {devOtpNotice && (
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

              {/* STEP 3: OTP New User Onboarding */}
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
                      value={regName}
                      onChange={e => setRegName(e.target.value)}
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
                      value={regPortKey}
                      onChange={e => setRegPortKey(e.target.value)}
                      className="w-full bg-orca-bg border border-orca-border text-white text-xs p-2.5 rounded-xl focus:outline-none focus:border-orca-teal"
                    >
                      {KNOWN_COASTAL_LOCATIONS.map(loc => (
                        <option key={loc.key} value={loc.key}>
                          {loc.name} ({loc.region} · {loc.sector})
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-orca-muted mt-1">
                      Your Safe House sets your fallback GPS coordinates and ocean diagnostics.
                    </p>
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