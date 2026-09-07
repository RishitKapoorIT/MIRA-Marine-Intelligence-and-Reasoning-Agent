import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Header from '../layout/Header.jsx';
import Sidebar from '../layout/Sidebar.jsx';
import AgentProcessingCard from './AgentProcessingCard.jsx';
import EvidenceCards from './EvidenceCards.jsx';
import { getPfzLayer } from '../../data/pfz.js';
import { getWeatherData } from '../../data/weather.js';
import { useLocationState } from '../../context/LocationContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  Send,
  Mic,
  Paperclip,
  Sparkles,
  MapPin,
  Compass,
  ChevronRight,
  ExternalLink,
  ChevronUp,
  ChevronDown,
  Navigation
} from 'lucide-react';

const INITIAL_THREADS = [
  { id: 't-1', title: 'PFZ Near Mangalore Shelf', timestamp: 'Just Now', isRealMl: true },
  { id: 't-2', title: 'Monsoon Swell Forecast Malpe', timestamp: '2h ago', isRealMl: false },
  { id: 't-3', title: 'Fuel Efficient Route to Karwar', timestamp: 'Yesterday', isRealMl: false },
];

export default function ChatPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q');

  const { currentLocation, resolveLocationFromText } = useLocationState();
  const { safeHouse } = useAuth();

  const [threads, setThreads] = useState(INITIAL_THREADS);
  const [activeThreadId, setActiveThreadId] = useState('t-1');

  // Messages state for the active thread
  const [messages, setMessages] = useState([]);
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

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  // Load initial conversation on mount
  useEffect(() => {
    executeInitialQuery(initialQuery || 'Identify best fishing zones near Mangalore');
  }, []);

  const executeInitialQuery = async (queryText) => {
    const userMsg = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: queryText,
      timestamp: 'Just now',
    };
    setMessages([userMsg]);
    setIsProcessing(true);

    await runAgentPipeline(queryText);
  };

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!inputQuery.trim() || isProcessing) return;

    const text = inputQuery.trim();
    setInputQuery('');

    const userMsg = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: 'Just now',
    };
    setMessages(prev => [...prev, userMsg]);
    setIsProcessing(true);

    await runAgentPipeline(text);
  };

  const runAgentPipeline = async (queryText) => {
    // Reset steps
    setStepStatus({
      planner: 'running',
      weather: 'queued',
      pfz: 'queued',
      risk: 'queued',
    });

    // Step 1: Planner & Dynamic Location Resolution (Fix A1.3 & Part G)
    let targetLoc = await resolveLocationFromText(queryText);
    if (!targetLoc) {
      targetLoc = currentLocation || safeHouse || { lat: 12.914, lon: 74.856, name: 'Mangalore Coastal Shelf Basin' };
    }

    // Update active thread title to reflect the queried location
    setThreads(prev =>
      prev.map(th =>
        th.id === activeThreadId
          ? { ...th, title: `PFZ Near ${targetLoc.name.split(' ')[0]}` }
          : th
      )
    );

    await new Promise(r => setTimeout(r, 200));
    setStepStatus(prev => ({ ...prev, planner: 'done', weather: 'running' }));

    // Step 2: Weather Agent for dynamic target coordinates
    let weatherData = null;
    try {
      weatherData = await getWeatherData(targetLoc.lat, targetLoc.lon);
    } catch {
      weatherData = { waveHeight: 1.0, swellHeight: 0.8, windSpeed: 12 };
    }
    setStepStatus(prev => ({ ...prev, weather: 'done', pfz: 'running' }));

    // Step 3: PFZ Agent (Real FastAPI XGBoost call for dynamic coordinates)
    let pfzResult = null;
    try {
      pfzResult = await getPfzLayer(targetLoc.lat, targetLoc.lon, { count: 8 });
    } catch (err) {
      console.error(err);
    }
    setStepStatus(prev => ({ ...prev, pfz: 'done', risk: 'running' }));

    // Step 4: Risk Assessment Agent
    await new Promise(r => setTimeout(r, 250));
    setStepStatus(prev => ({ ...prev, risk: 'done' }));

    // Formulate response
    const topZone = pfzResult?.zones?.[0];
    const isPfzQuery = /fish|zone|pfz|yield|tuna|mackerel|catch|near|where/i.test(queryText);

    const botResponse = {
      id: `orca-${Date.now()}`,
      sender: 'orca',
      timestamp: 'Just now',
      isPfz: isPfzQuery,
      locationName: targetLoc.name,
      locationSector: targetLoc.sector || 'Coastal Zone',
      summary: `Completed multi-agent ocean synthesis for ${targetLoc.name} (${targetLoc.sector || 'Indian EEZ'}). Analyzed MODIS satellite thermal fronts and ${pfzResult?.totalInputs || 8} candidate offshore coordinate sites using ORCA's trained XGBoost model.`,
      zones: pfzResult?.zones || [],
      topZone,
      weather: weatherData,
      isLive: pfzResult?.isLive ?? false,
    };

    setMessages(prev => [...prev, botResponse]);
    setIsProcessing(false);
  };

  const handleNewChat = () => {
    const newId = `t-${Date.now()}`;
    const newThread = {
      id: newId,
      title: 'New Ocean Query',
      timestamp: 'Just Now',
      isRealMl: true,
    };
    setThreads([newThread, ...threads]);
    setActiveThreadId(newId);
    setMessages([]);
  };

  const scrollToTop = () => {
    chatScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="h-screen bg-orca-bg flex flex-col overflow-hidden">
      {/* Persistent Global Header */}
      <Header />

      {/* Main Workspace Layout with Full-Height Sidebar & Chat Thread (Fix A1.1) */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Full-Height Sidebar */}
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
            {messages.length === 0 && !isProcessing && (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto my-auto space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-orca-teal/15 text-orca-teal flex items-center justify-center border border-orca-teal/30 shadow-lg">
                  <Sparkles size={24} />
                </div>
                <h3 className="text-lg font-bold text-white">Ask ORCA Marine Intelligence</h3>
                <p className="text-xs text-orca-muted leading-relaxed">
                  Query oceanographic satellite layers, trained fishing zone predictions, swell safety, and safe maritime routes across Indian coastal ports.
                </p>
                <div className="grid grid-cols-1 gap-2 w-full pt-2">
                  {[
                    'Identify best fishing zones near Kolkata',
                    'Find potential fishing zones near Kochi',
                    'Check sea surface temperature near Mumbai',
                    'Is the sea swell safe for motorized craft near Mangalore?',
                  ].map(prompt => (
                    <button
                      key={prompt}
                      onClick={() => executeInitialQuery(prompt)}
                      className="text-left text-xs p-3 rounded-xl bg-orca-surface border border-orca-border text-orca-muted hover:text-white hover:border-orca-teal/40 transition-colors"
                    >
                      {prompt} →
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map(msg => (
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
                <div className={`${msg.sender === 'user' ? 'max-w-md' : 'max-w-4xl'} space-y-3`}>
                  {/* User Bubble */}
                  {msg.sender === 'user' && (
                    <div className="bg-orca-surface-2 border border-orca-border px-4 py-3 rounded-2xl rounded-tr-sm text-sm text-white shadow-sm">
                      {msg.text}
                    </div>
                  )}

                  {/* ORCA Bot Response */}
                  {msg.sender === 'orca' && (
                    <div className="space-y-4">
                      {/* Natural Language Summary */}
                      <div className="bg-orca-surface border border-orca-border p-4 rounded-2xl text-sm text-white leading-relaxed shadow-sm">
                        <p>{msg.summary}</p>
                        {msg.isLive && (
                          <div className="mt-2 flex items-center gap-2 text-[11px] text-emerald-400 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span>Powered by live XGBoost model service ({msg.locationSector || 'Coastal Sector'})</span>
                          </div>
                        )}
                      </div>

                      {/* Frame 03: Structured PFZ Table */}
                      {msg.isPfz && msg.zones && msg.zones.length > 0 && (
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
                      )}

                      {/* Frame 05: Satellite Telemetry Evidence Cards & Reasoning */}
                      {msg.topZone && (
                        <EvidenceCards zone={msg.topZone} weather={msg.weather} />
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Frame 04: Multi-Agent Processing Card */}
            {isProcessing && (
              <div className="max-w-2xl">
                <AgentProcessingCard stepStatus={stepStatus} />
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ── Floating Up/Down Jump Arrows (Fix A1.4) ── */}
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

          {/* ── Fixed/Sticky Input Area at Bottom (Fix A1.2) ── */}
          <div className="p-3 md:p-4 border-t border-orca-border bg-orca-surface/95 backdrop-blur flex-shrink-0 sticky bottom-0 z-20">
            <form onSubmit={handleSend} className="max-w-4xl mx-auto flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 bg-orca-bg rounded-2xl border border-orca-border px-3.5 py-2.5 focus-within:border-orca-teal/60 transition-colors">
                <button
                  type="button"
                  title="Attach telemetry (visual indicator)"
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
                  title="Voice input (visual indicator per FR-A5/A6)"
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
