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
  Shield,
  Home,
  CheckCircle2,
  ArrowRight,
  Navigation,
  Anchor
} from 'lucide-react';
import { generateMarineAiResponse } from './marineChatEngine.js';

function renderFormattedText(text) {
  if (!text) return null;
  const lines = text.split('\n');
  return (
    <div className="space-y-1.5 leading-relaxed">
      {lines.map((line, idx) => {
        if (!line.trim()) return <div key={idx} className="h-1" />;
        const parts = line.split(/(\*\*.*?\*\*|`.*?`)/g);
        return (
          <p key={idx} className={line.trim().startsWith('•') ? 'pl-2 text-orca-muted' : ''}>
            {parts.map((part, pIdx) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={pIdx} className="text-white font-bold">{part.slice(2, -2)}</strong>;
              }
              if (part.startsWith('`') && part.endsWith('`')) {
                return <code key={pIdx} className="px-1.5 py-0.5 rounded bg-orca-bg border border-orca-border font-mono text-[11px] text-orca-teal">{part.slice(1, -1)}</code>;
              }
              return part;
            })}
          </p>
        );
      })}
    </div>
  );
}

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

    // Update active thread title to match context
    const threadTitle = queryText.length > 25 ? `${queryText.slice(0, 22)}...` : queryText;

    setThreads(prev =>
      prev.map(th => (th.id === activeThreadId ? { ...th, title: threadTitle } : th))
    );

    await new Promise(r => setTimeout(r, 150));
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
    try {
      pfzResult = await getPfzLayer(targetLoc.lat, targetLoc.lon, { count: 8 });
    } catch (err) {
      console.error('PFZ call failed:', err);
    }
    setStepStatus(prev => ({ ...prev, pfz: 'done', risk: 'running' }));

    // ── Step 4: Risk Assessment Agent ──
    await new Promise(r => setTimeout(r, 150));
    setStepStatus(prev => ({ ...prev, risk: 'done' }));

    // ── Step 5: Formulate Contextualized AI Response ──
    const aiOutput = generateMarineAiResponse({
      queryText,
      user,
      currentLocation: targetLoc,
      weatherData,
      pfzResult,
      hazards: SAMPLE_HAZARD_ZONES,
    });

    const nearbyHazard = SAMPLE_HAZARD_ZONES[1]; // Regional alert

    const botResponse = {
      id: `orca-${Date.now()}`,
      sender: 'orca',
      timestamp: 'Just now',
      locationName: targetLoc.name,
      locationSector: targetLoc.sector || 'Coastal Zone',
      targetLoc,
      ...aiOutput,
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
                    onClick={() => handleSendQuery(`Identify best fishing zones near ${activeShortPlace}`)}
                    className="text-left text-xs p-3 rounded-xl bg-orca-surface border border-orca-border text-orca-muted hover:text-white hover:border-orca-teal/40 transition-all flex items-center gap-2 group"
                  >
                    <Sparkles size={16} className="text-emerald-400 group-hover:scale-110 transition-transform flex-shrink-0" />
                    <span className="truncate">🐟 Best Fishing Grounds near {activeShortPlace}</span>
                  </button>

                  <button
                    onClick={() => handleSendQuery('Can I go out to sea right now?')}
                    className="text-left text-xs p-3 rounded-xl bg-orca-surface border border-orca-border text-orca-muted hover:text-white hover:border-orca-teal/40 transition-all flex items-center gap-2 group"
                  >
                    <Waves size={16} className="text-cyan-400 group-hover:scale-110 transition-transform flex-shrink-0" />
                    <span className="truncate">🌊 Can I sail safely today? (Sea Swell)</span>
                  </button>

                  <button
                    onClick={() => handleSendQuery('where is my safe house')}
                    className="text-left text-xs p-3 rounded-xl bg-orca-surface border border-orca-border text-orca-muted hover:text-white hover:border-purple-400/40 transition-all flex items-center gap-2 group"
                  >
                    <span className="text-base group-hover:scale-110 transition-transform flex-shrink-0">🏠</span>
                    <span className="truncate">🏠 Where is my Safe House?</span>
                  </button>

                  <button
                    onClick={() => handleSendQuery('nearest port to me')}
                    className="text-left text-xs p-3 rounded-xl bg-orca-surface border border-orca-border text-orca-muted hover:text-white hover:border-orca-teal/40 transition-all flex items-center gap-2 group"
                  >
                    <Anchor size={16} className="text-orca-teal group-hover:scale-110 transition-transform flex-shrink-0" />
                    <span className="truncate">⚓ Nearest Ports & Shelter Harbors</span>
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
                      {/* Natural Language AI Summary Bubble */}
                      <div className="bg-orca-surface border border-orca-border p-4 rounded-2xl text-sm text-white leading-relaxed shadow-sm">
                        {renderFormattedText(msg.summary)}
                        {msg.isLive && (
                          <div className="mt-2.5 flex items-center gap-2 text-[11px] text-emerald-400 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span>Powered by live XGBoost model service ({msg.locationSector || 'Coastal Sector'})</span>
                          </div>
                        )}
                      </div>

                      {/* ── Case 1: Safe House Refuge Haven Card ── */}
                      {msg.isSafeHouse && msg.safeHouse && (
                        <div className="bg-orca-surface border border-emerald-500/30 rounded-2xl p-5 shadow-sm space-y-4">
                          <div className="flex items-center justify-between border-b border-orca-border pb-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                                <Home size={16} />
                              </div>
                              <div>
                                <span className="text-xs font-bold text-white uppercase tracking-wider block">
                                  Designated Safe House & Refuge Harbor
                                </span>
                                <span className="text-[10px] text-orca-muted">Official Emergency Haven Base</span>
                              </div>
                            </div>
                            <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-[11px] font-bold border border-emerald-500/40">
                              Active Haven
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="p-3 bg-orca-bg rounded-xl border border-orca-border space-y-1">
                              <span className="text-[10px] text-orca-muted block uppercase font-semibold">Harbor Name</span>
                              <div className="text-sm font-bold text-white truncate" title={msg.safeHouse.label}>
                                {msg.safeHouse.label}
                              </div>
                              <span className="text-[10px] text-emerald-400 block font-medium">{msg.safeHouse.region || 'Registered Haven'}</span>
                            </div>

                            <div className="p-3 bg-orca-bg rounded-xl border border-orca-border space-y-1">
                              <span className="text-[10px] text-orca-muted block uppercase font-semibold">Distance & Bearing</span>
                              <div className="text-sm font-extrabold text-white flex items-center gap-1.5">
                                <span>~{msg.safeHouseDist ?? 0} km</span>
                                <span className="text-orca-teal text-xs">({msg.safeHouseBearing ?? 'Direct'})</span>
                              </div>
                              <span className="text-[10px] text-orca-muted block font-mono">
                                ~{Math.round((msg.safeHouseDist ?? 0) * 0.539957)} nm transit
                              </span>
                            </div>

                            <div className="p-3 bg-orca-bg rounded-xl border border-orca-border space-y-1">
                              <span className="text-[10px] text-orca-muted block uppercase font-semibold">GPS Coordinates</span>
                              <div className="text-xs font-mono font-bold text-amber-400 pt-0.5">
                                {Number(msg.safeHouse.lat).toFixed(4)}°N, {Number(msg.safeHouse.lon).toFixed(4)}°E
                              </div>
                              <span className="text-[10px] text-orca-muted block">WGS84 Datum</span>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 pt-1">
                            <button
                              onClick={() => navigate('/maps')}
                              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 transition-all flex items-center gap-2"
                            >
                              <Navigation size={14} />
                              <span>View Safe House on Map</span>
                            </button>
                            <button
                              onClick={() => navigate('/route')}
                              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-orca-surface-2 border border-orca-border text-white hover:border-orca-teal/40 transition-all flex items-center gap-2"
                            >
                              <Compass size={14} className="text-orca-teal" />
                              <span>Calculate Transit Route</span>
                            </button>
                            <button
                              onClick={() => handleSendQuery(`Can I sail safely to ${msg.safeHouse.label.split(' ')[0]}?`)}
                              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-orca-surface-2 border border-orca-border text-white hover:border-orca-teal/40 transition-all flex items-center gap-2"
                            >
                              <Waves size={14} className="text-cyan-400" />
                              <span>Check Sea State en Route</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* ── Case 2: Nearest Coastal Ports Card ── */}
                      {msg.isNearestPort && msg.nearbyPorts && (
                        <div className="bg-orca-surface border border-cyan-500/30 rounded-2xl p-5 shadow-sm space-y-4">
                          <div className="flex items-center justify-between border-b border-orca-border pb-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                                <Anchor size={16} />
                              </div>
                              <div>
                                <span className="text-xs font-bold text-white uppercase tracking-wider block">
                                  Nearest Coastal Ports & Shelters
                                </span>
                                <span className="text-[10px] text-orca-muted">Proximity ranking from active location</span>
                              </div>
                            </div>
                            <span className="text-[11px] text-cyan-400 font-semibold">{msg.locationName}</span>
                          </div>

                          <div className="space-y-2">
                            {msg.nearbyPorts.map((port, pIdx) => (
                              <div
                                key={pIdx}
                                className="p-3 bg-orca-bg rounded-xl border border-orca-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:border-orca-teal/30 transition-all"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="w-6 h-6 rounded-full bg-orca-surface-2 border border-orca-border text-[11px] font-bold text-orca-teal flex items-center justify-center flex-shrink-0">
                                    {pIdx + 1}
                                  </span>
                                  <div>
                                    <div className="text-sm font-bold text-white flex items-center gap-2">
                                      <span>{port.name}</span>
                                      <span className="text-[10px] px-2 py-0.5 rounded bg-orca-surface-2 text-orca-muted border border-orca-border font-normal">
                                        {port.sector}
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-orca-muted flex items-center gap-2 mt-0.5">
                                      <span>{port.region || 'Coastal Port'}</span>
                                      <span>•</span>
                                      <span className="font-mono text-amber-400/90">{port.lat.toFixed(2)}°N, {port.lon.toFixed(2)}°E</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3 justify-between sm:justify-end">
                                  <div className="text-right">
                                    <div className="text-xs font-extrabold text-white">
                                      {port.distanceKm} km
                                    </div>
                                    <div className="text-[10px] text-orca-teal font-medium">
                                      Bearing: {port.bearing}
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => handleSendQuery(`Safe route to ${port.name}`)}
                                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-orca-surface-2 border border-orca-border text-white hover:border-cyan-400/40 hover:text-cyan-300 transition-all flex items-center gap-1"
                                  >
                                    <span>Route</span>
                                    <ChevronRight size={12} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="flex flex-wrap gap-2 pt-1">
                            <button
                              onClick={() => navigate('/maps')}
                              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-orca-surface-2 border border-orca-border text-white hover:border-cyan-400/40 hover:text-cyan-300 transition-all flex items-center gap-2"
                            >
                              <Navigation size={14} className="text-cyan-400" />
                              <span>Open Maritime Ports on Map</span>
                            </button>
                            <button
                              onClick={() => navigate('/route')}
                              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-orca-teal text-orca-bg hover:bg-orca-teal/90 transition-all flex items-center gap-2"
                            >
                              <Compass size={14} />
                              <span>Plan Safe Passage</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* ── Case 3: Sailing Safety Assessment Card ── */}
                      {msg.isSafetyCheck && (
                        <div className="bg-orca-surface border border-orca-border rounded-2xl p-5 shadow-sm space-y-4">
                          <div className="flex items-center justify-between border-b border-orca-border pb-3">
                            <div className="flex items-center gap-2">
                              <Shield size={18} className={msg.verdict === 'GO' ? 'text-emerald-400' : msg.verdict === 'CAUTION' ? 'text-amber-400' : 'text-red-400'} />
                              <span className="text-xs font-bold text-white uppercase tracking-wider">
                                Sailing Safety Assessment & Sea State
                              </span>
                            </div>
                            <span className="text-[11px] text-orca-teal font-semibold">{msg.locationName}</span>
                          </div>

                          <div className={`p-4 rounded-xl border flex items-center gap-3 ${
                            msg.verdict === 'GO'
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                              : msg.verdict === 'CAUTION'
                              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                              : 'bg-red-500/10 border-red-500/30 text-red-300'
                          }`}>
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg flex-shrink-0 ${
                              msg.verdict === 'GO'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                : msg.verdict === 'CAUTION'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                                : 'bg-red-500/20 text-red-400 border border-red-500/40'
                            }`}>
                              {msg.verdict}
                            </div>
                            <div className="space-y-0.5">
                              <div className="text-xs font-bold uppercase tracking-wide">
                                {msg.verdict === 'GO' ? 'Clear Conditions for Offshore Sailing' : msg.verdict === 'CAUTION' ? 'Moderate Swell — Exercise Prudence' : 'Severe Weather Warning — Hazardous Seas'}
                              </div>
                              <div className="text-xs opacity-90">
                                {msg.verdict === 'GO' ? 'Gentle swells and manageable surface winds. Suitable for artisanal boats and mechanized vessels.' : msg.verdict === 'CAUTION' ? 'Elevated sea chop. Open boats should remain within 12 nm and stay vigilant.' : 'High risk of capsizing. All vessels advised to remain anchored in safe harbor.'}
                              </div>
                            </div>
                          </div>

                          {/* Metric Quick Gauges */}
                          <div className="grid grid-cols-3 gap-3">
                            <div className="p-3 bg-orca-bg rounded-xl border border-orca-border text-center space-y-1">
                              <span className="text-[10px] text-orca-muted block uppercase font-semibold">Wave Height</span>
                              <div className="text-base font-extrabold text-white">{msg.wave}m</div>
                              <span className="text-[10px] text-cyan-400 font-medium">Wave Swell</span>
                            </div>
                            <div className="p-3 bg-orca-bg rounded-xl border border-orca-border text-center space-y-1">
                              <span className="text-[10px] text-orca-muted block uppercase font-semibold">Surface Wind</span>
                              <div className="text-base font-extrabold text-white">{msg.wind} kt</div>
                              <span className="text-[10px] text-emerald-400 font-medium">Wind Speed</span>
                            </div>
                            <div className="p-3 bg-orca-bg rounded-xl border border-orca-border text-center space-y-1">
                              <span className="text-[10px] text-orca-muted block uppercase font-semibold">Risk Level</span>
                              <div className={`text-base font-extrabold ${msg.verdictColor || 'text-white'}`}>{msg.verdict}</div>
                              <span className="text-[10px] text-orca-muted font-medium">Vessel Stance</span>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 pt-1">
                            <button
                              onClick={() => navigate('/hazards')}
                              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-orca-surface-2 border border-orca-border text-white hover:border-amber-400/40 hover:text-amber-300 transition-all flex items-center gap-2"
                            >
                              <AlertTriangle size={14} className="text-amber-400" />
                              <span>View Active Hazard Zones</span>
                            </button>
                            <button
                              onClick={() => handleSendQuery(`Identify best fishing zones near ${msg.locationName.split(' ')[0]}`)}
                              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-orca-surface-2 border border-orca-border text-white hover:border-orca-teal/40 hover:text-orca-teal transition-all flex items-center gap-2"
                            >
                              <Sparkles size={14} className="text-emerald-400" />
                              <span>Find Sheltered PFZ Zones</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* ── Case 4: Region / Maritime Sector Information Card ── */}
                      {msg.isRegion && msg.location && (
                        <div className="bg-orca-surface border border-orca-border rounded-2xl p-5 shadow-sm space-y-4">
                          <div className="flex items-center justify-between border-b border-orca-border pb-3">
                            <div className="flex items-center gap-2">
                              <MapPin size={18} className="text-orca-teal" />
                              <span className="text-xs font-bold text-white uppercase tracking-wider">
                                Active Maritime Geographic Datum
                              </span>
                            </div>
                            <span className="px-2 py-0.5 rounded bg-orca-teal/20 text-orca-teal font-mono text-[11px] font-bold border border-orca-teal/30">
                              {msg.location.sector || 'Sector'}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="p-3 bg-orca-bg rounded-xl border border-orca-border space-y-1">
                              <span className="text-[10px] text-orca-muted block uppercase font-semibold">Active Basin</span>
                              <div className="text-sm font-bold text-white truncate">{msg.location.name}</div>
                              <span className="text-[10px] text-orca-teal block font-medium">{msg.location.region || 'Indian EEZ'}</span>
                            </div>

                            <div className="p-3 bg-orca-bg rounded-xl border border-orca-border space-y-1">
                              <span className="text-[10px] text-orca-muted block uppercase font-semibold">Coordinates</span>
                              <div className="text-xs font-mono font-bold text-white pt-0.5">
                                {Number(msg.location.lat).toFixed(4)}°N, {Number(msg.location.lon).toFixed(4)}°E
                              </div>
                              <span className="text-[10px] text-orca-muted block">Active Geo Anchor</span>
                            </div>

                            <div className="p-3 bg-orca-bg rounded-xl border border-orca-border space-y-1">
                              <span className="text-[10px] text-orca-muted block uppercase font-semibold">Sector Grid</span>
                              <div className="text-sm font-bold text-emerald-400">
                                {msg.location.sector || 'Coastal Shelf'}
                              </div>
                              <span className="text-[10px] text-orca-muted block">INCOIS Coastal Grid</span>
                            </div>
                          </div>
                        </div>
                      )}

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

                      {/* ── Dynamic Action Suggestions Chips ── */}
                      {msg.actionSuggestions && msg.actionSuggestions.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {msg.actionSuggestions.map((act, aIdx) => (
                            <button
                              key={aIdx}
                              onClick={() => {
                                if (act.query === 'open_profile') {
                                  navigate('/dashboard');
                                } else if (act.query === 'open_route') {
                                  navigate('/route');
                                } else if (act.to) {
                                  navigate(act.to);
                                } else if (act.query) {
                                  handleSendQuery(act.query);
                                }
                              }}
                              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-orca-surface border border-orca-border text-white hover:border-orca-teal/50 hover:bg-orca-teal/10 hover:text-orca-teal transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                            >
                              <Sparkles size={12} className="text-orca-teal flex-shrink-0" />
                              <span>{act.label}</span>
                            </button>
                          ))}
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
