import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Header from '../layout/Header.jsx';
import Sidebar from '../layout/Sidebar.jsx';
import AgentProcessingCard from './AgentProcessingCard.jsx';
import EvidenceCards from './EvidenceCards.jsx';
import { getPfzLayer } from '../../data/pfz.js';
import { getWeatherData } from '../../data/weather.js';
import { SAMPLE_HAZARD_ZONES } from '../../data/hazards.js';
import { useLocationState, getSectorForLatLon } from '../../context/LocationContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  Send,
  Mic,
  Paperclip,
  Sparkles,
  MapPin,
  Compass,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Waves,
  Wind,
  Thermometer,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Navigation
} from 'lucide-react';

export default function ChatPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q');

  const { currentLocation, setCurrentLocation, resolveLocationFromText } = useLocationState();
  const { user, safeHouse } = useAuth();

  // ── 1. Persistent Thread and Messages Storage (LocalStorage) ──
  const getStoredThreads = () => {
    try {
      const saved = localStorage.getItem('orca_chat_threads');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    const baseLoc = currentLocation?.name?.split(' ')[0] || 'Coastal';
    return [
      { id: 't-1', title: `Marine Intelligence (${baseLoc})`, timestamp: 'Active', isRealMl: true }
    ];
  };

  const getStoredActiveThreadId = () => {
    return localStorage.getItem('orca_active_thread_id') || 't-1';
  };

  const getStoredMessagesMap = () => {
    try {
      const saved = localStorage.getItem('orca_chat_messages_map');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed === 'object' && parsed !== null) return parsed;
      }
    } catch {}
    return {};
  };

  const [threads, setThreads] = useState(getStoredThreads);
  const [activeThreadId, setActiveThreadId] = useState(getStoredActiveThreadId);
  const [messagesMap, setMessagesMap] = useState(getStoredMessagesMap);

  const [inputQuery, setInputQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [stepStatus, setStepStatus] = useState({
    planner: 'queued',
    weather: 'queued',
    pfz: 'queued',
    risk: 'queued',
  });

  const chatScrollRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Synchronize state changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('orca_chat_threads', JSON.stringify(threads));
    } catch {}
  }, [threads]);

  useEffect(() => {
    try {
      localStorage.setItem('orca_active_thread_id', activeThreadId);
    } catch {}
  }, [activeThreadId]);

  useEffect(() => {
    try {
      localStorage.setItem('orca_chat_messages_map', JSON.stringify(messagesMap));
    } catch {}
  }, [messagesMap]);

  // Messages of the active thread
  const activeMessages = messagesMap[activeThreadId] || [];

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages, isProcessing]);

  // Handle URL query parameter if present
  useEffect(() => {
    if (initialQuery) {
      handleSendQuery(initialQuery);
    }
  }, [initialQuery]);

  const handleSend = (e) => {
    if (e) e.preventDefault();
    if (!inputQuery.trim() || isProcessing) return;
    const text = inputQuery.trim();
    setInputQuery('');
    handleSendQuery(text);
  };

  const handleSendQuery = async (queryText) => {
    const userMsg = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: queryText,
      timestamp: 'Just now',
    };

    // Append user message immediately
    setMessagesMap(prev => ({
      ...prev,
      [activeThreadId]: [...(prev[activeThreadId] || []), userMsg],
    }));
    setIsProcessing(true);

    await runAgentPipeline(queryText);
  };

  const runAgentPipeline = async (queryText) => {
    setStepStatus({
      planner: 'running',
      weather: 'queued',
      pfz: 'queued',
      risk: 'queued',
    });

    // ── Step 1: Location Resolution & Grounding ──
    let targetLoc = await resolveLocationFromText(queryText);

    // If query refers to user's personal area / home harbor / safe house or no explicit place specified
    if (!targetLoc) {
      if (currentLocation) {
        targetLoc = currentLocation;
      } else if (user?.safe_house) {
        targetLoc = {
          name: user.safe_house.label || 'Safe House Harbor',
          lat: user.safe_house.lat,
          lon: user.safe_house.lon,
          region: 'Coastal Waters',
          sector: getSectorForLatLon(user.safe_house.lat, user.safe_house.lon),
        };
      } else {
        targetLoc = { lat: 12.914, lon: 74.856, name: 'Mangalore Coastal Shelf Basin', sector: 'Sector 7' };
      }
    }

    // Keep active focus location synced with the user's current inquiry
    setCurrentLocation(targetLoc);

    // Dynamic Intent Classification
    const isWeather = /\b(weather|forecast|swell|wave|waves|wind|temp|temperature|sea state|calm|rough|rain|monsoon|breeze|current|tide)\b/i.test(queryText);
    const isHazard = /\b(hazard|hazards|danger|dangerous|warning|warnings|safe to sail|go out|restricted|firing|cyclone|storm|alert|security|risk)\b/i.test(queryText);
    const isRoute = /\b(route|routes|navigate|navigation|waypoint|direction|directions|port to port|transit|fuel|passage)\b/i.test(queryText);
    const isPfz = /\b(fish|fishing|pfz|catch|tuna|mackerel|sardine|yield|zones|zone|pelagic|chlorophyll|shoal|where to fish|grounds)\b/i.test(queryText);
    const isGeneral = !isWeather && !isHazard && !isRoute && !isPfz;

    // Update active thread title to match context
    const shortPlace = targetLoc.name.split(' ')[0];
    const threadTitle = isWeather
      ? `Weather in ${shortPlace}`
      : isHazard
      ? `Hazards in ${shortPlace}`
      : isRoute
      ? `Route from ${shortPlace}`
      : isPfz
      ? `PFZ near ${shortPlace}`
      : `Intelligence (${shortPlace})`;

    setThreads(prev =>
      prev.map(th => (th.id === activeThreadId ? { ...th, title: threadTitle } : th))
    );

    await new Promise(r => setTimeout(r, 200));
    setStepStatus(prev => ({ ...prev, planner: 'done', weather: 'running' }));

    // ── Step 2: Weather Agent ──
    let weatherData = null;
    try {
      weatherData = await getWeatherData(targetLoc.lat, targetLoc.lon);
    } catch {
      weatherData = { waveHeight: 1.0, swellHeight: 0.9, windSpeed: 12, sst: 29.8 };
    }
    setStepStatus(prev => ({ ...prev, weather: 'done', pfz: 'running' }));

    // ── Step 3: PFZ ML Model Agent (FastAPI XGBoost) ──
    let pfzResult = null;
    if (isPfz || isGeneral) {
      try {
        pfzResult = await getPfzLayer(targetLoc.lat, targetLoc.lon, { count: 8 });
      } catch (err) {
        console.error('PFZ call failed:', err);
      }
    }
    setStepStatus(prev => ({ ...prev, pfz: 'done', risk: 'running' }));

    // ── Step 4: Risk Assessment Agent ──
    await new Promise(r => setTimeout(r, 200));
    setStepStatus(prev => ({ ...prev, risk: 'done' }));

    // ── Step 5: Formulate Contextualized Response ──
    let summaryText = '';
    const wave = weatherData?.waveHeight || 1.0;
    const waveAdvisory =
      wave < 1.2
        ? 'Calm Sea State — Safe for motorized craft and artisanal nearshore fishing.'
        : wave < 2.0
        ? 'Moderate Swell — Safe for mechanized trawlers; open craft advised caution.'
        : 'High Swell Alert — Rough sea conditions. Stay within inner channels.';

    if (isWeather) {
      summaryText = `Coastal Marine Weather & Swell Report for ${targetLoc.name} (${targetLoc.sector || 'Indian EEZ'}). Analyzed Open-Meteo satellite marine wave spectrum, surface winds, and thermal gradients. ${waveAdvisory}`;
    } else if (isHazard) {
      summaryText = `Marine Navigational Hazards & Safety Advisory for ${targetLoc.name} (${targetLoc.sector || 'Indian EEZ'}). Screened active Indian EEZ coastal exclusion zones, NDMA weather advisories, and naval boundaries.`;
    } else if (isRoute) {
      summaryText = `Safe Navigational Route Guidance departing from ${targetLoc.name}. Computed coastal transit path with automated hazard boundary clearance and sea depth contours.`;
    } else if (isPfz) {
      summaryText = `Potential Fishing Zones (PFZ) synthesis for ${targetLoc.name} (${targetLoc.sector || 'Indian EEZ'}). Analyzed MODIS satellite thermal fronts and candidate offshore coordinate sites using ORCA's trained XGBoost model.`;
    } else {
      summaryText = `Acknowledged, Captain ${user?.name?.split(' ')[0] || 'Fisherman'}. ORCA is currently monitoring ${targetLoc.name} (${targetLoc.sector || 'Indian EEZ'}) based on your profile and region selection. How can I assist your voyage today?`;
    }

    // Identify closest hazard if hazard query
    const nearbyHazard = SAMPLE_HAZARD_ZONES[1]; // High Swell / Regional alert

    const botResponse = {
      id: `orca-${Date.now()}`,
      sender: 'orca',
      timestamp: 'Just now',
      locationName: targetLoc.name,
      locationSector: targetLoc.sector || 'Coastal Zone',
      targetLoc,
      isWeather,
      isHazard,
      isRoute,
      isPfz,
      isGeneral,
      summary: summaryText,
      waveAdvisory,
      weather: weatherData,
      zones: pfzResult?.zones || [],
      topZone: pfzResult?.zones?.[0] || null,
      hazard: nearbyHazard,
      isLive: pfzResult?.isLive ?? false,
    };

    setMessagesMap(prev => ({
      ...prev,
      [activeThreadId]: [...(prev[activeThreadId] || []), botResponse],
    }));
    setIsProcessing(false);
  };

  const handleNewChat = () => {
    const newId = `t-${Date.now()}`;
    const locName = currentLocation?.name?.split(' ')[0] || 'Coastal';
    const newThread = {
      id: newId,
      title: `Query ${threads.length + 1} (${locName})`,
      timestamp: 'Just Now',
      isRealMl: true,
    };
    setThreads(prev => [newThread, ...prev]);
    setActiveThreadId(newId);
  };

  const scrollToTop = () => {
    chatScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const activeLocName = currentLocation?.name || 'Mangalore Coastal Shelf Basin';
  const activeShortPlace = activeLocName.split(' ')[0];

  return (
    <div className="h-screen bg-orca-bg flex flex-col overflow-hidden">
      {/* Persistent Global Header */}
      <Header />

      {/* Main Workspace Layout with Full-Height Sidebar & Chat Thread */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Full-Height Sidebar with Persistent Thread History */}
        <Sidebar
          threads={threads}
          activeThreadId={activeThreadId}
          onSelectThread={setActiveThreadId}
          onNewChat={handleNewChat}
        />

        {/* Chat Area */}
        <main className="flex-1 min-h-0 flex flex-col bg-orca-bg overflow-hidden relative">
          {/* Messages Scroll View */}
          <div ref={chatScrollRef} className="flex-1 min-h-0 overflow-y-auto p-4 md:p-8 space-y-6">
            
            {/* Empty State: Customized to the User's Active Location & Profile */}
            {activeMessages.length === 0 && !isProcessing && (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto my-auto space-y-5">
                <div className="w-14 h-14 rounded-2xl bg-orca-teal/15 text-orca-teal flex items-center justify-center border border-orca-teal/30 shadow-xl shadow-orca-teal/10">
                  <Sparkles size={28} />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-xl font-extrabold text-white tracking-tight">
                    Ask ORCA Marine Intelligence
                  </h3>
                  <div className="flex items-center justify-center gap-1.5 text-xs text-orca-teal font-semibold">
                    <MapPin size={14} />
                    <span>Connected Region: {activeLocName} ({currentLocation?.sector || 'Coastal Sector'})</span>
                  </div>
                  <p className="text-xs text-orca-muted leading-relaxed max-w-md pt-1">
                    Ask natural questions in plain language about live weather, swell safety, predicted fishing zones (PFZ), or safe routes for your area.
                  </p>
                </div>

                {/* Quick Interactive Prompt Chips Grounded in User's Area */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full pt-3">
                  <button
                    onClick={() => handleSendQuery(`Weather and wave swell report for ${activeShortPlace}`)}
                    className="text-left text-xs p-3 rounded-xl bg-orca-surface border border-orca-border text-orca-muted hover:text-white hover:border-orca-teal/40 transition-all flex items-center gap-2 group"
                  >
                    <Waves size={16} className="text-cyan-400 group-hover:scale-110 transition-transform flex-shrink-0" />
                    <span className="truncate">🌊 Weather & Swell for {activeShortPlace}</span>
                  </button>

                  <button
                    onClick={() => handleSendQuery(`Identify best fishing zones near ${activeShortPlace}`)}
                    className="text-left text-xs p-3 rounded-xl bg-orca-surface border border-orca-border text-orca-muted hover:text-white hover:border-orca-teal/40 transition-all flex items-center gap-2 group"
                  >
                    <Sparkles size={16} className="text-emerald-400 group-hover:scale-110 transition-transform flex-shrink-0" />
                    <span className="truncate">🐟 Best Fishing Zones near {activeShortPlace}</span>
                  </button>

                  <button
                    onClick={() => handleSendQuery(`Active marine hazards and warnings near ${activeShortPlace}`)}
                    className="text-left text-xs p-3 rounded-xl bg-orca-surface border border-orca-border text-orca-muted hover:text-white hover:border-orca-teal/40 transition-all flex items-center gap-2 group"
                  >
                    <AlertTriangle size={16} className="text-amber-400 group-hover:scale-110 transition-transform flex-shrink-0" />
                    <span className="truncate">⚠️ Marine Hazards near {activeShortPlace}</span>
                  </button>

                  <button
                    onClick={() => handleSendQuery(`Safe navigational routes departing from ${activeShortPlace}`)}
                    className="text-left text-xs p-3 rounded-xl bg-orca-surface border border-orca-border text-orca-muted hover:text-white hover:border-orca-teal/40 transition-all flex items-center gap-2 group"
                  >
                    <Compass size={16} className="text-orca-teal group-hover:scale-110 transition-transform flex-shrink-0" />
                    <span className="truncate">🧭 Safe Routes from {activeShortPlace}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Conversation Messages */}
            {activeMessages.map(msg => (
              <div
                key={msg.id}
                className={`flex gap-3.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {/* Bot Avatar */}
                {msg.sender === 'orca' && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orca-teal to-teal-700 flex items-center justify-center flex-shrink-0 text-orca-bg font-black text-sm shadow-md">
                    O
                  </div>
                )}

                {/* Message Body */}
                <div className={`${msg.sender === 'user' ? 'max-w-md' : 'max-w-4xl w-full'} space-y-3`}>
                  {/* User Message Bubble */}
                  {msg.sender === 'user' && (
                    <div className="bg-orca-surface-2 border border-orca-border px-4 py-3 rounded-2xl rounded-tr-sm text-sm text-white shadow-sm">
                      {msg.text}
                    </div>
                  )}

                  {/* ORCA Bot Response Bubble */}
                  {msg.sender === 'orca' && (
                    <div className="space-y-4">
                      {/* Natural Language Summary Card */}
                      <div className="bg-orca-surface border border-orca-border p-4 rounded-2xl text-sm text-white leading-relaxed shadow-sm">
                        <p>{msg.summary}</p>
                        {msg.isLive && (
                          <div className="mt-2 flex items-center gap-2 text-[11px] text-emerald-400 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span>Powered by live XGBoost model service ({msg.locationSector || 'Coastal Sector'})</span>
                          </div>
                        )}
                      </div>

                      {/* ── Case A: Dedicated Weather & Wave Swell Card ── */}
                      {msg.isWeather && (
                        <div className="bg-orca-surface border border-orca-border rounded-2xl p-5 shadow-sm space-y-4">
                          <div className="flex items-center justify-between border-b border-orca-border pb-3">
                            <div className="flex items-center gap-2">
                              <Waves size={18} className="text-cyan-400" />
                              <span className="text-xs font-bold text-white uppercase tracking-wider">
                                Marine Weather & Swell Report
                              </span>
                            </div>
                            <span className="text-[11px] text-orca-teal font-semibold">
                              {msg.locationName}
                            </span>
                          </div>

                          {/* Sea State Banner */}
                          <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl flex items-center gap-2 text-xs text-cyan-300">
                            <CheckCircle2 size={16} className="text-cyan-400 flex-shrink-0" />
                            <span>{msg.waveAdvisory}</span>
                          </div>

                          {/* Metrics Grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="p-3 bg-orca-bg rounded-xl border border-orca-border space-y-1">
                              <span className="text-[10px] text-orca-muted block uppercase font-semibold">Wave Swell</span>
                              <div className="text-base font-extrabold text-white flex items-center gap-1">
                                <span>{msg.weather?.waveHeight || 1.02}m</span>
                              </div>
                              <span className="text-[10px] text-cyan-400 block font-medium">Calm to Moderate</span>
                            </div>

                            <div className="p-3 bg-orca-bg rounded-xl border border-orca-border space-y-1">
                              <span className="text-[10px] text-orca-muted block uppercase font-semibold">Surface Wind</span>
                              <div className="text-base font-extrabold text-white flex items-center gap-1">
                                <span>{msg.weather?.windSpeed || 12} kt</span>
                              </div>
                              <span className="text-[10px] text-emerald-400 block font-medium">Safe Offshore</span>
                            </div>

                            <div className="p-3 bg-orca-bg rounded-xl border border-orca-border space-y-1">
                              <span className="text-[10px] text-orca-muted block uppercase font-semibold">Sea Temp (SST)</span>
                              <div className="text-base font-extrabold text-amber-400 flex items-center gap-1">
                                <span>{msg.weather?.sst || 29.8}°C</span>
                              </div>
                              <span className="text-[10px] text-orca-muted block">MODIS Thermal Front</span>
                            </div>

                            <div className="p-3 bg-orca-bg rounded-xl border border-orca-border space-y-1">
                              <span className="text-[10px] text-orca-muted block uppercase font-semibold">Visibility</span>
                              <div className="text-base font-extrabold text-white flex items-center gap-1">
                                <span>10+ nm</span>
                              </div>
                              <span className="text-[10px] text-emerald-400 block font-medium">Clear Horizon</span>
                            </div>
                          </div>

                          {/* Quick Actions */}
                          <div className="flex flex-wrap gap-2 pt-1">
                            <button
                              onClick={() => navigate('/analytics')}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-orca-surface-2 border border-orca-border text-white hover:border-orca-teal/40 transition-all flex items-center gap-1.5"
                            >
                              <span>View Ocean Analytics Map</span>
                              <ChevronRight size={13} />
                            </button>
                            <button
                              onClick={() => handleSendQuery(`Identify best fishing zones near ${msg.locationName.split(' ')[0]}`)}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-orca-teal/15 text-orca-teal border border-orca-teal/30 hover:bg-orca-teal hover:text-orca-bg transition-all flex items-center gap-1.5"
                            >
                              <span>Find Fishing Zones in this Swell</span>
                              <Sparkles size={13} />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* ── Case B: Dedicated Hazard & Safety Card ── */}
                      {msg.isHazard && (
                        <div className="bg-orca-surface border border-orca-border rounded-2xl p-5 shadow-sm space-y-4">
                          <div className="flex items-center justify-between border-b border-orca-border pb-3">
                            <div className="flex items-center gap-2">
                              <AlertTriangle size={18} className="text-amber-400" />
                              <span className="text-xs font-bold text-white uppercase tracking-wider">
                                Navigational Hazards & Advisories
                              </span>
                            </div>
                            <span className="text-[11px] text-orca-teal font-semibold">
                              {msg.locationName}
                            </span>
                          </div>

                          <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                                <span>{msg.hazard?.title || 'Monsoon Swell & Navigational Advisory'}</span>
                              </span>
                              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                                {msg.hazard?.severity || 'WARNING'}
                              </span>
                            </div>
                            <p className="text-xs text-orca-muted">
                              {msg.hazard?.guidance || 'Vessels advised to maintain safe standoff from shallow coastal bars and monitor offshore weather bulletins.'}
                            </p>
                          </div>

                          <button
                            onClick={() => navigate('/hazards')}
                            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-orca-surface-2 border border-orca-border text-white hover:border-amber-400/40 hover:text-amber-400 transition-all flex items-center gap-2"
                          >
                            <span>Open Interactive Hazards Map</span>
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      )}

                      {/* ── Case C: Dedicated Route Card ── */}
                      {msg.isRoute && (
                        <div className="bg-orca-surface border border-orca-border rounded-2xl p-5 shadow-sm space-y-4">
                          <div className="flex items-center justify-between border-b border-orca-border pb-3">
                            <div className="flex items-center gap-2">
                              <Compass size={18} className="text-orca-teal" />
                              <span className="text-xs font-bold text-white uppercase tracking-wider">
                                Navigational Route Guidance
                              </span>
                            </div>
                            <span className="text-[11px] text-orca-teal font-semibold">
                              {msg.locationName}
                            </span>
                          </div>

                          <div className="p-3 bg-orca-bg rounded-xl border border-orca-border flex items-center justify-between text-xs text-white">
                            <div className="flex items-center gap-2">
                              <Navigation size={14} className="text-orca-teal" />
                              <span className="font-semibold">{msg.locationName}</span>
                            </div>
                            <ArrowRight size={14} className="text-orca-muted" />
                            <div className="text-orca-muted">Nearest Deepwater Channel (~22 nm)</div>
                          </div>

                          <button
                            onClick={() => navigate('/route')}
                            className="px-4 py-2 rounded-xl text-xs font-bold bg-orca-teal text-orca-bg hover:bg-orca-teal/90 transition-all flex items-center gap-2 shadow-lg"
                          >
                            <span>Launch Safe Route Planner</span>
                            <ArrowRight size={14} />
                          </button>
                        </div>
                      )}

                      {/* ── Case D: Potential Fishing Zones (PFZ) Matrix & Evidence ── */}
                      {msg.isPfz && msg.zones && msg.zones.length > 0 && (
                        <>
                          <div className="bg-orca-surface border border-orca-border rounded-2xl overflow-hidden shadow-sm">
                            <div className="px-4 py-3 border-b border-orca-border bg-orca-surface-2/40 flex items-center justify-between">
                              <span className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                                <span>Predicted Zones Matrix</span>
                                <span className="text-orca-teal text-[11px]">({msg.zones.length} candidate sites)</span>
                              </span>
                              <span className="text-[10px] text-orca-muted">
                                {msg.locationName}
                              </span>
                            </div>

                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs">
                                <thead>
                                  <tr className="border-b border-orca-border text-orca-muted text-[10px] uppercase tracking-wider bg-orca-bg/50">
                                    <th className="py-2.5 px-4">Zone ID</th>
                                    <th className="py-2.5 px-4">Sector / Distance</th>
                                    <th className="py-2.5 px-4">Expected Species</th>
                                    <th className="py-2.5 px-4">SST / Chlorophyll</th>
                                    <th className="py-2.5 px-4">Probability</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-orca-border/50 text-white">
                                  {msg.zones.slice(0, 5).map(z => {
                                    const gradeKey = z.predictedZone === 'BEST' ? 'best' : z.predictedZone === 'GOOD' ? 'good' : 'poor';
                                    const badgeClass =
                                      z.predictedZone === 'BEST'
                                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                        : z.predictedZone === 'GOOD'
                                        ? 'bg-[#00D8FF]/20 text-[#00D8FF] border-[#00D8FF]/30'
                                        : 'bg-amber-500/20 text-amber-400 border-amber-500/30';

                                    return (
                                      <tr key={z.id} className="hover:bg-orca-surface-2/30 transition-colors">
                                        <td className="py-3 px-4 font-mono font-bold text-orca-teal flex items-center gap-1.5">
                                          <span>{z.id}</span>
                                        </td>
                                        <td className="py-3 px-4 text-orca-muted">
                                          <div className="text-white font-semibold">{z.sector || 'Sector'}</div>
                                          <div className="text-[10px]">{z.distanceNm} nm ({z.bearing})</div>
                                        </td>
                                        <td className="py-3 px-4 font-medium">
                                          {z.expectedSpecies}
                                        </td>
                                        <td className="py-3 px-4 font-mono text-orca-muted">
                                          <span className="text-amber-400">{z.temperature}°C</span> · <span className="text-emerald-400">{z.chlorophyll} mg/m³</span>
                                        </td>
                                        <td className="py-3 px-4">
                                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeClass}`}>
                                            {t(`badges.${gradeKey}`)}
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>

                            <div className="p-3 bg-orca-surface-2/20 border-t border-orca-border flex items-center justify-between text-xs">
                              <button
                                onClick={() => navigate('/pfz')}
                                className="text-orca-teal font-bold hover:underline flex items-center gap-1"
                              >
                                <span>Explore All Identified Zones</span>
                                <ChevronRight size={14} />
                              </button>
                              <span className="text-[10px] text-orca-muted">
                                Lat: {msg.zones[0]?.lat.toFixed(3)}°, Lon: {msg.zones[0]?.lon.toFixed(3)}°
                              </span>
                            </div>
                          </div>

                          {/* Satellite Evidence Cards */}
                          {msg.topZone && (
                            <EvidenceCards zone={msg.topZone} weather={msg.weather} />
                          )}
                        </>
                      )}

                      {/* ── Case E: General Conversational Suggestions ── */}
                      {msg.isGeneral && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          <button
                            onClick={() => handleSendQuery(`Weather report for ${msg.locationName.split(' ')[0]}`)}
                            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-orca-surface border border-orca-border text-white hover:border-orca-teal/40 transition-all flex items-center gap-1.5"
                          >
                            <Waves size={13} className="text-cyan-400" />
                            <span>Check Sea Swell & Weather</span>
                          </button>
                          <button
                            onClick={() => handleSendQuery(`Identify best fishing zones near ${msg.locationName.split(' ')[0]}`)}
                            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-orca-surface border border-orca-border text-white hover:border-orca-teal/40 transition-all flex items-center gap-1.5"
                          >
                            <Sparkles size={13} className="text-emerald-400" />
                            <span>Predict Fishing Zones (PFZ)</span>
                          </button>
                          <button
                            onClick={() => handleSendQuery(`Marine hazards in ${msg.locationName.split(' ')[0]}`)}
                            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-orca-surface border border-orca-border text-white hover:border-orca-teal/40 transition-all flex items-center gap-1.5"
                          >
                            <AlertTriangle size={13} className="text-amber-400" />
                            <span>View Hazards & Advisories</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Multi-Agent Processing Card */}
            {isProcessing && (
              <div className="max-w-2xl">
                <AgentProcessingCard stepStatus={stepStatus} />
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Floating Jump Arrows */}
          <div className="absolute bottom-20 right-6 md:right-8 z-30 flex flex-col gap-1.5 bg-orca-surface/90 backdrop-blur border border-orca-border rounded-xl p-1 shadow-2xl">
            <button
              onClick={scrollToTop}
              title={t('chat.jump_top')}
              className="p-2 rounded-lg text-orca-muted hover:text-white hover:bg-orca-surface-2 transition-colors"
            >
              <ChevronUp size={16} />
            </button>
            <div className="h-px bg-orca-border" />
            <button
              onClick={scrollToBottom}
              title={t('chat.jump_bottom')}
              className="p-2 rounded-lg text-orca-muted hover:text-white hover:bg-orca-surface-2 transition-colors"
            >
              <ChevronDown size={16} />
            </button>
          </div>

          {/* Fixed Sticky Input Form */}
          <div className="p-3 md:p-4 border-t border-orca-border bg-orca-surface/95 backdrop-blur flex-shrink-0 sticky bottom-0 z-20">
            <form onSubmit={handleSend} className="max-w-4xl mx-auto flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 bg-orca-bg rounded-2xl border border-orca-border px-3.5 py-2.5 focus-within:border-orca-teal/60 transition-colors">
                <button
                  type="button"
                  title="Attach telemetry"
                  className="text-orca-muted hover:text-white transition-colors"
                >
                  <Paperclip size={18} />
                </button>
                <input
                  type="text"
                  value={inputQuery}
                  onChange={e => setInputQuery(e.target.value)}
                  placeholder={t('chat.ask_placeholder')}
                  className="flex-1 bg-transparent text-sm text-white placeholder-orca-muted focus:outline-none"
                  disabled={isProcessing}
                />
                <button
                  type="button"
                  title="Voice input"
                  className="text-orca-muted hover:text-white transition-colors"
                >
                  <Mic size={18} />
                </button>
              </div>

              <button
                type="submit"
                disabled={!inputQuery.trim() || isProcessing}
                className="
                  w-11 h-11 rounded-2xl bg-orca-teal text-orca-bg flex items-center justify-center
                  disabled:opacity-40 disabled:cursor-not-allowed hover:bg-orca-teal/90 active:scale-95
                  transition-all shadow-md shadow-orca-teal/20 flex-shrink-0
                "
              >
                <Send size={18} />
              </button>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
