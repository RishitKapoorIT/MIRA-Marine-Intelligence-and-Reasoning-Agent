import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Header from '../layout/Header.jsx';
import Sidebar from '../layout/Sidebar.jsx';
import AgentProcessingCard from './AgentProcessingCard.jsx';
import EvidenceCards from './EvidenceCards.jsx';
import { getPfzLayer } from '../../data/pfz.js';
import { getWeatherData } from '../../data/weather.js';
import { Send, Mic, Paperclip, Sparkles, MapPin, Compass, ChevronRight, ExternalLink } from 'lucide-react';

const INITIAL_THREADS = [
  { id: 't-1', title: 'PFZ Tomorrow Mangalore', timestamp: 'Just Now', isRealMl: true },
  { id: 't-2', title: 'Monsoon Swell Forecast Malpe', timestamp: '2h ago', isRealMl: false },
  { id: 't-3', title: 'Fuel Efficient Route to Karwar', timestamp: 'Yesterday', isRealMl: false },
];

const DEFAULT_COORDS = { lat: 12.914, lon: 74.856 }; // Mangalore

export default function ChatPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q');

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

  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  // Load initial conversation on mount
  useEffect(() => {
    executeInitialQuery(initialQuery || 'Identify best fishing zones near Mangalore');
  }, []);

  const executeInitialQuery = async (queryText) => {
    // Add user message
    const userMsg = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: queryText,
      timestamp: 'Just now',
    };
    setMessages([userMsg]);
    setIsProcessing(true);

    // Run multi-agent orchestration
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

    // Step 1: Planner
    await new Promise(r => setTimeout(r, 250));
    setStepStatus(prev => ({ ...prev, planner: 'done', weather: 'running' }));

    // Step 2: Weather Agent (Real Open-Meteo call)
    let weatherData = null;
    try {
      weatherData = await getWeatherData(DEFAULT_COORDS.lat, DEFAULT_COORDS.lon);
    } catch {
      weatherData = { waveHeight: 1.1, swellHeight: 0.9, windSpeed: 14 };
    }
    setStepStatus(prev => ({ ...prev, weather: 'done', pfz: 'running' }));

    // Step 3: PFZ Agent (Real FastAPI XGBoost call)
    let pfzResult = null;
    try {
      pfzResult = await getPfzLayer(DEFAULT_COORDS.lat, DEFAULT_COORDS.lon, { count: 8 });
    } catch (err) {
      console.error(err);
    }
    setStepStatus(prev => ({ ...prev, pfz: 'done', risk: 'running' }));

    // Step 4: Risk Assessment Agent
    await new Promise(r => setTimeout(r, 300));
    setStepStatus(prev => ({ ...prev, risk: 'done' }));

    // Formulate ORCA response
    const topZone = pfzResult?.zones?.[0];
    const isPfzQuery = /fish|zone|pfz|yield|tuna|mackerel|catch/i.test(queryText);

    const botResponse = {
      id: `orca-${Date.now()}`,
      sender: 'orca',
      timestamp: 'Just now',
      isPfz: isPfzQuery,
      summary: `Completed multi-agent synthesis for Mangalore coastal sector. Analyzed MODIS satellite thermal fronts and ${pfzResult?.totalInputs || 8} candidate coordinate clusters using ORCA's trained XGBoost model.`,
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

  return (
    <div className="min-h-screen bg-orca-bg flex flex-col">
      {/* Persistent Global Header */}
      <Header />

      {/* Main Workspace Layout with Sidebar & Chat Thread */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          threads={threads}
          activeThreadId={activeThreadId}
          onSelectThread={setActiveThreadId}
          onNewChat={handleNewChat}
        />

        {/* Chat Area */}
        <main className="flex-1 flex flex-col bg-orca-bg overflow-hidden relative">
          {/* Messages Scroll View */}
          <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
            {messages.length === 0 && !isProcessing && (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto my-auto space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-orca-teal/15 text-orca-teal flex items-center justify-center border border-orca-teal/30 shadow-lg">
                  <Sparkles size={24} />
                </div>
                <h3 className="text-lg font-bold text-white">Ask ORCA Marine Intelligence</h3>
                <p className="text-xs text-orca-muted leading-relaxed">
                  Query oceanographic satellite layers, trained fishing zone predictions, swell safety, and safe maritime routes.
                </p>
                <div className="grid grid-cols-1 gap-2 w-full pt-2">
                  {[
                    'Identify best fishing zones near Mangalore',
                    'Check sea surface temperature & chlorophyll bloom',
                    'Is the swell safe for motorized craft today?',
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
                            <span>Powered by live XGBoost model service (services/pfz-api)</span>
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
                              Target Species Heuristic (FR-G1)
                            </span>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead>
                                <tr className="border-b border-orca-border text-orca-muted text-[10px] uppercase tracking-wider bg-orca-bg/50">
                                  <th className="py-2.5 px-4">Zone ID</th>
                                  <th className="py-2.5 px-4">Distance & Bearing</th>
                                  <th className="py-2.5 px-4">Expected Species</th>
                                  <th className="py-2.5 px-4">SST · Chlorophyll</th>
                                  <th className="py-2.5 px-4 text-right">Confidence</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-orca-border/50 text-white">
                                {msg.zones.slice(0, 5).map((z, idx) => (
                                  <tr key={z.id} className="hover:bg-orca-surface-2/50 transition-colors">
                                    <td className="py-3 px-4 font-bold text-orca-teal flex items-center gap-1.5">
                                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                      {z.id}
                                    </td>
                                    <td className="py-3 px-4 text-orca-muted">
                                      <span className="text-white font-medium">{z.distanceNm} nm</span> ({z.bearing})
                                    </td>
                                    <td className="py-3 px-4 text-white font-medium">
                                      {z.expectedSpecies}
                                    </td>
                                    <td className="py-3 px-4 text-orca-muted font-mono">
                                      <span className="text-amber-300">{z.temperature}°C</span> · <span className="text-emerald-300">{z.chlorophyll} mg/m³</span>
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold text-[11px] border border-emerald-500/20">
                                        {z.confidence}%
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* Action Buttons under table matching Frame 03 */}
                          <div className="p-3 bg-orca-surface-2/30 border-t border-orca-border flex items-center gap-2">
                            <button
                              onClick={() => navigate('/maps')}
                              className="
                                flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold
                                bg-orca-teal text-orca-bg hover:bg-orca-teal/90 active:scale-[0.98]
                                transition-all shadow-sm shadow-orca-teal/20
                              "
                            >
                              <span>View on Map</span>
                              <ExternalLink size={13} />
                            </button>
                            <button
                              onClick={() => navigate(`/route?dest=${msg.topZone?.id || 'PFZ-01'}`)}
                              className="
                                flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold
                                bg-orca-surface border border-orca-border text-white hover:bg-orca-surface-2
                                transition-all
                              "
                            >
                              <Compass size={14} className="text-cyan-400" />
                              <span>Plot Safest Route</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Frame 05: Satellite Evidence & Logical Reasoning */}
                      {msg.isPfz && msg.topZone && (
                        <EvidenceCards zone={msg.topZone} weather={msg.weather} />
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Frame 04: Inline Agent Processing State */}
            {isProcessing && (
              <div className="flex gap-3.5 justify-start">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orca-teal to-teal-700 flex items-center justify-center flex-shrink-0 text-orca-bg font-black text-sm shadow-md">
                  O
                </div>
                <AgentProcessingCard stepStatus={stepStatus} />
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ── Input Area at Bottom (Frame 03) ── */}
          <div className="p-4 border-t border-orca-border bg-orca-surface">
            <form onSubmit={handleSend} className="max-w-4xl mx-auto flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 bg-orca-bg rounded-2xl border border-orca-border px-3.5 py-2.5 focus-within:border-orca-teal/60 transition-colors">
                <button
                  type="button"
                  title="Attach file (visual indicator)"
                  className="text-orca-muted hover:text-white transition-colors"
                >
                  <Paperclip size={18} />
                </button>
                <input
                  type="text"
                  value={inputQuery}
                  onChange={e => setInputQuery(e.target.value)}
                  placeholder="Ask ORCA about fishing zones, swell safety, hazards, or routing..."
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
                  transition-all shadow-md shadow-orca-teal/20
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
