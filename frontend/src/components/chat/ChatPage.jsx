import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Header from '../layout/Header.jsx';
import Sidebar from '../layout/Sidebar.jsx';
import AgentProcessingCard from './AgentProcessingCard.jsx';
import EvidenceTrace from './EvidenceTrace.jsx';
import VerdictBanner from './VerdictBanner.jsx';
import { streamChat, createTurnAccumulator } from '../../services/chat.js';
import { AuthError, NetworkError } from '../../services/http.js';
import { useLocationState } from '../../context/LocationContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  Send, Mic, Paperclip, Sparkles, MapPin, Compass, ChevronRight, ChevronUp,
  ChevronDown, Waves, AlertTriangle, WifiOff, Fish, StopCircle, Clock,
} from 'lucide-react';

/**
 * Conversational workspace.
 *
 * WHAT CHANGED: the client-side pipeline is gone. It used to resolve location
 * with regexes, fetch bundled sample weather, classify intent with keyword
 * matching, and compose the answer text in the browser — then present the
 * result as a multi-agent system. The agents were on the screen, not in the
 * request.
 *
 * Now one call to POST /chat?stream=true drives everything. Location
 * resolution, planning, agent selection, the safety verdict and the prose all
 * happen server-side, and this component renders the events as they arrive.
 *
 * There is no fallback. If the stream fails, the failure is what gets shown.
 */
export default function ChatPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q');

  const { currentLocation, setCurrentLocation } = useLocationState();
  const { user, isAuthenticated, isBackendUnreachable } = useAuth();

  // ── Thread + message persistence (display cache only; the backend is the
  //    authoritative record — every turn is persisted server-side, including
  //    turns whose stream was interrupted). ──
  const getStoredThreads = () => {
    try {
      const saved = localStorage.getItem('orca_chat_threads');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { /* private browsing */ }
    const baseLoc = currentLocation?.name?.split(' ')[0] || 'Coastal';
    return [{ id: 't-1', title: `Marine Intelligence (${baseLoc})`, timestamp: 'Active', conversationId: null }];
  };

  const getStoredMessagesMap = () => {
    try {
      const saved = localStorage.getItem('orca_chat_messages_map');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed === 'object' && parsed !== null) return parsed;
      }
    } catch { /* private browsing */ }
    return {};
  };

  const [threads, setThreads] = useState(getStoredThreads);
  const [activeThreadId, setActiveThreadId] = useState(
    () => localStorage.getItem('orca_active_thread_id') || 't-1',
  );
  const [messagesMap, setMessagesMap] = useState(getStoredMessagesMap);

  const [inputQuery, setInputQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [liveTurn, setLiveTurn] = useState(null);

  const chatScrollRef = useRef(null);
  const messagesEndRef = useRef(null);
  const abortRef = useRef(null);
  const startedInitial = useRef(false);

  useEffect(() => {
    try { localStorage.setItem('orca_chat_threads', JSON.stringify(threads)); } catch { /* */ }
  }, [threads]);
  useEffect(() => {
    try { localStorage.setItem('orca_active_thread_id', activeThreadId); } catch { /* */ }
  }, [activeThreadId]);
  useEffect(() => {
    try { localStorage.setItem('orca_chat_messages_map', JSON.stringify(messagesMap)); } catch { /* */ }
  }, [messagesMap]);

  const activeMessages = messagesMap[activeThreadId] || [];
  const activeThread = threads.find((th) => th.id === activeThreadId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages, liveTurn]);

  useEffect(() => {
    if (initialQuery && !startedInitial.current) {
      startedInitial.current = true;
      handleSendQuery(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  // Cancel an in-flight stream if the user navigates away. The backend still
  // finishes and persists the turn — only the live view is dropped.
  useEffect(() => () => abortRef.current?.abort(), []);

  const appendMessage = (message) => {
    setMessagesMap((prev) => ({
      ...prev,
      [activeThreadId]: [...(prev[activeThreadId] || []), message],
    }));
  };

  const handleSend = (e) => {
    if (e) e.preventDefault();
    if (!inputQuery.trim() || isProcessing) return;
    const text = inputQuery.trim();
    setInputQuery('');
    handleSendQuery(text);
  };

  const handleStop = () => abortRef.current?.abort();

  const handleSendQuery = async (queryText) => {
    appendMessage({
      id: `usr-${Date.now()}`, sender: 'user', text: queryText, timestamp: 'Just now',
    });
    setIsProcessing(true);

    const accumulator = createTurnAccumulator();
    const controller = new AbortController();
    abortRef.current = controller;

    let finalState = null;

    try {
      for await (const frame of streamChat({
        queryText,
        conversationId: activeThread?.conversationId || null,
        signal: controller.signal,
      })) {
        const next = accumulator.apply(frame);
        setLiveTurn(next);

        // Keep the app-wide focus in step with what the backend resolved,
        // rather than what the browser guessed.
        if (frame.event === 'context_resolved') {
          setCurrentLocation({
            lat: frame.data.latitude,
            lon: frame.data.longitude,
            name: frame.data.label || `${frame.data.latitude.toFixed(3)}, ${frame.data.longitude.toFixed(3)}`,
          });
        }
      }
      finalState = accumulator.get();
    } catch (err) {
      if (controller.signal.aborted) {
        // User pressed stop. Partial content is kept and labelled.
        const partial = accumulator.get();
        appendMessage({
          id: `orca-${Date.now()}`, sender: 'orca', timestamp: 'Just now',
          turn: { ...partial, status: 'interrupted' },
        });
        return;
      }
      appendMessage({
        id: `err-${Date.now()}`, sender: 'error', timestamp: 'Just now',
        errorKind:
          err instanceof NetworkError ? 'network' : err instanceof AuthError ? 'auth' : 'server',
        text: err.message || 'The request failed.',
      });
      return;
    } finally {
      setIsProcessing(false);
      setLiveTurn(null);
      abortRef.current = null;
    }

    if (finalState) {
      appendMessage({
        id: `orca-${finalState.turnId || Date.now()}`,
        sender: 'orca', timestamp: 'Just now', turn: finalState,
      });

      if (finalState.conversationId && !activeThread?.conversationId) {
        setThreads((prev) =>
          prev.map((th) =>
            th.id === activeThreadId
              ? {
                  ...th,
                  conversationId: finalState.conversationId,
                  title: queryText.length > 38 ? `${queryText.slice(0, 38)}…` : queryText,
                }
              : th,
          ),
        );
      }
    }
  };

  const handleNewChat = () => {
    const newId = `t-${Date.now()}`;
    setThreads((prev) => [
      { id: newId, title: 'New query', timestamp: 'Just now', conversationId: null },
      ...prev,
    ]);
    setActiveThreadId(newId);
  };

  const scrollToTop = () => chatScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  const activeLocName = currentLocation?.name
    || user?.baseLocation?.label
    || 'No location set';
  const activeShortPlace = activeLocName.split(' ')[0];

  const suggestions = [
    { icon: Waves, color: 'text-cyan-400', label: `Weather and swell at ${activeShortPlace}`, q: `Weather and swell at ${activeShortPlace} tomorrow` },
    { icon: Fish, color: 'text-emerald-400', label: `Fishing zones near ${activeShortPlace}`, q: `Where are the best fishing zones near ${activeShortPlace}?` },
    { icon: AlertTriangle, color: 'text-amber-400', label: `Is it safe to sail from ${activeShortPlace}?`, q: `Is it safe to sail from ${activeShortPlace} tomorrow?` },
    { icon: Compass, color: 'text-orca-teal', label: 'Conditions tonight', q: `Conditions at ${activeShortPlace} tonight` },
  ];

  return (
    <div className="h-screen bg-orca-bg flex flex-col overflow-hidden">
      <Header />

      <div className="flex-1 min-h-0 flex overflow-hidden">
        <Sidebar
          threads={threads}
          activeThreadId={activeThreadId}
          onSelectThread={setActiveThreadId}
          onNewChat={handleNewChat}
        />

        <main className="flex-1 min-h-0 flex flex-col bg-orca-bg overflow-hidden relative">
          <div ref={chatScrollRef} className="flex-1 min-h-0 overflow-y-auto p-4 md:p-8 space-y-6">

            {/* Empty state */}
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
                    <span>{activeLocName}</span>
                  </div>
                  <p className="text-xs text-orca-muted leading-relaxed max-w-md pt-1">
                    Ask about conditions, safety to sail, or fishing zones. Name a place
                    (Mangaluru, Malpe, Karwar) or set a home port in your profile.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full pt-3">
                  {suggestions.map((s) => (
                    <button
                      key={s.q}
                      onClick={() => handleSendQuery(s.q)}
                      disabled={isBackendUnreachable}
                      className="text-left text-xs p-3 rounded-xl bg-orca-surface border border-orca-border text-orca-muted hover:text-white hover:border-orca-teal/40 transition-all flex items-center gap-2 group disabled:opacity-40"
                    >
                      <s.icon size={16} className={`${s.color} group-hover:scale-110 transition-transform flex-shrink-0`} />
                      <span className="truncate">{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Conversation */}
            {activeMessages.map((msg) => (
              <div key={msg.id} className={`flex gap-3.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.sender !== 'user' && (
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-sm shadow-md ${
                    msg.sender === 'error'
                      ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                      : 'bg-gradient-to-br from-orca-teal to-teal-700 text-orca-bg'
                  }`}>
                    {msg.sender === 'error' ? '!' : 'O'}
                  </div>
                )}

                <div className={`${msg.sender === 'user' ? 'max-w-md' : 'max-w-4xl w-full'} space-y-3`}>
                  {msg.sender === 'user' && (
                    <div className="bg-orca-surface-2 border border-orca-border px-4 py-3 rounded-2xl rounded-tr-sm text-sm text-white shadow-sm">
                      {msg.text}
                    </div>
                  )}

                  {/* Failure — stated, never papered over with sample data */}
                  {msg.sender === 'error' && (
                    <div className="bg-red-500/5 border border-red-500/30 p-4 rounded-2xl space-y-1.5">
                      <div className="flex items-center gap-2 text-red-400 font-bold text-xs">
                        <WifiOff size={14} />
                        <span>
                          {msg.errorKind === 'network' ? 'Could not reach the ORCA backend'
                            : msg.errorKind === 'auth' ? 'Session expired'
                            : 'The request failed'}
                        </span>
                      </div>
                      <p className="text-[11px] text-red-300/80 leading-snug">{msg.text}</p>
                      <p className="text-[11px] text-orca-muted leading-snug">
                        No answer is shown because none was produced. ORCA does not fall back
                        to sample conditions.
                      </p>
                    </div>
                  )}

                  {/* Completed turn */}
                  {msg.sender === 'orca' && msg.turn && (
                    <div className="space-y-3">
                      {msg.turn.status === 'interrupted' && (
                        <div className="flex items-center gap-2 text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
                          <StopCircle size={13} />
                          <span>Stopped early. The full answer was still saved on the server.</span>
                        </div>
                      )}

                      <VerdictBanner
                        verdict={msg.turn.verdict}
                        cappedByMissingInput={msg.turn.cappedByMissingInput}
                        reasons={msg.turn.verdictReasons}
                      />

                      {msg.turn.answer && (
                        <div className="bg-orca-surface border border-orca-border p-4 rounded-2xl text-sm text-white leading-relaxed shadow-sm whitespace-pre-wrap">
                          {msg.turn.answer}
                        </div>
                      )}

                      {/* FR-D1.3 route + FR-A4.2 assumed-window flag */}
                      {msg.turn.location && (
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                          <span className="px-2 py-0.5 rounded border bg-orca-surface text-orca-muted border-orca-border flex items-center gap-1">
                            <MapPin size={10} />
                            {msg.turn.location.label || `${msg.turn.location.latitude?.toFixed(3)}, ${msg.turn.location.longitude?.toFixed(3)}`}
                            {' · '}{String(msg.turn.location.resolutionRoute || '').replace(/_/g, ' ')}
                          </span>
                          {msg.turn.window && (
                            <span className={`px-2 py-0.5 rounded border flex items-center gap-1 ${
                              msg.turn.window.assumed
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                : 'bg-orca-surface text-orca-muted border-orca-border'
                            }`}>
                              <Clock size={10} />
                              {msg.turn.window.description}
                            </span>
                          )}
                          {msg.turn.latencyMs != null && (
                            <span className="px-2 py-0.5 rounded border bg-orca-surface text-orca-muted border-orca-border">
                              {(msg.turn.latencyMs / 1000).toFixed(1)}s
                            </span>
                          )}
                        </div>
                      )}

                      {/* Fishing zones, when the ocean agent returned any.
                          No species column: the backend has no species data,
                          and inventing one would be the exact fabrication the
                          evidence panel exists to rule out. */}
                      {msg.turn.agents?.ocean_agent?.status === 'ok'
                        && Array.isArray(msg.turn.agents.ocean_agent.findings?.zones)
                        && msg.turn.agents.ocean_agent.findings.zones.length > 0 && (
                        <div className="bg-orca-surface border border-orca-border rounded-2xl overflow-hidden shadow-sm">
                          <div className="px-4 py-3 border-b border-orca-border bg-orca-surface-2/40 flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-white">
                              Fishing zones
                              <span className="text-orca-teal text-[11px] ml-1.5">
                                ({msg.turn.agents.ocean_agent.findings.zones.length})
                              </span>
                            </span>
                            <button onClick={() => navigate('/pfz')} className="text-orca-teal text-[11px] font-bold hover:underline flex items-center gap-1">
                              Explore <ChevronRight size={12} />
                            </button>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead>
                                <tr className="border-b border-orca-border text-orca-muted text-[10px] uppercase tracking-wider bg-orca-bg/50">
                                  <th className="py-2.5 px-4">Class</th>
                                  <th className="py-2.5 px-4">Distance / bearing</th>
                                  <th className="py-2.5 px-4">Area</th>
                                  <th className="py-2.5 px-4">SST</th>
                                  <th className="py-2.5 px-4">Chlorophyll</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-orca-border/50 text-white">
                                {msg.turn.agents.ocean_agent.findings.zones.slice(0, 5).map((z, i) => (
                                  <tr key={i} className="hover:bg-orca-surface-2/30 transition-colors">
                                    <td className="py-3 px-4">
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                        z.zone_class === 'BEST'
                                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                          : 'bg-[#00D8FF]/20 text-[#00D8FF] border-[#00D8FF]/30'
                                      }`}>{z.zone_class}</span>
                                    </td>
                                    <td className="py-3 px-4 text-orca-muted font-mono">
                                      {z.distance_km} km · {z.bearing_deg}°
                                    </td>
                                    <td className="py-3 px-4 font-mono text-orca-muted">
                                      {Math.round(z.area_km2)} km²
                                    </td>
                                    <td className="py-3 px-4 font-mono text-amber-400">
                                      {z.sea_surface_temperature_c ?? '—'}°C
                                    </td>
                                    <td className="py-3 px-4 font-mono">
                                      {z.chlorophyll_mg_m3 == null ? (
                                        <span className="text-orca-muted/70 italic">unavailable</span>
                                      ) : (
                                        <span className="text-emerald-400">{z.chlorophyll_mg_m3} mg/m³</span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      <EvidenceTrace
                        evidence={msg.turn.evidence}
                        disclosures={msg.turn.disclosures}
                        verdictReasons={msg.turn.verdictReasons}
                        missingInputs={msg.turn.missingInputs}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isProcessing && (
              <div className="max-w-2xl space-y-3">
                <AgentProcessingCard liveTurn={liveTurn} />
                {liveTurn?.answer && (
                  <div className="bg-orca-surface border border-orca-border p-4 rounded-2xl text-sm text-white leading-relaxed shadow-sm whitespace-pre-wrap">
                    {liveTurn.answer}
                    <span className="inline-block w-1.5 h-4 bg-orca-teal ml-0.5 animate-pulse align-text-bottom" />
                  </div>
                )}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="absolute bottom-20 right-6 md:right-8 z-30 flex flex-col gap-1.5 bg-orca-surface/90 backdrop-blur border border-orca-border rounded-xl p-1 shadow-2xl">
            <button onClick={scrollToTop} title={t('chat.jump_top')} className="p-2 rounded-lg text-orca-muted hover:text-white hover:bg-orca-surface-2 transition-colors">
              <ChevronUp size={16} />
            </button>
            <div className="h-px bg-orca-border" />
            <button onClick={scrollToBottom} title={t('chat.jump_bottom')} className="p-2 rounded-lg text-orca-muted hover:text-white hover:bg-orca-surface-2 transition-colors">
              <ChevronDown size={16} />
            </button>
          </div>

          <div className="p-3 md:p-4 border-t border-orca-border bg-orca-surface/95 backdrop-blur flex-shrink-0 sticky bottom-0 z-20">
            {isBackendUnreachable && (
              <div className="max-w-4xl mx-auto mb-2 text-[11px] text-red-400 flex items-center gap-1.5">
                <WifiOff size={12} />
                <span>Backend unreachable — questions cannot be answered right now.</span>
              </div>
            )}
            {!isAuthenticated && !isBackendUnreachable && (
              <div className="max-w-4xl mx-auto mb-2 text-[11px] text-amber-400">
                Not signed in. <button onClick={() => navigate('/login')} className="underline font-semibold">Sign in</button> to ask questions.
              </div>
            )}

            <form onSubmit={handleSend} className="max-w-4xl mx-auto flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 bg-orca-bg rounded-2xl border border-orca-border px-3.5 py-2.5 focus-within:border-orca-teal/60 transition-colors">
                <button type="button" title="Attach telemetry" className="text-orca-muted hover:text-white transition-colors">
                  <Paperclip size={18} />
                </button>
                <input
                  type="text"
                  value={inputQuery}
                  onChange={(e) => setInputQuery(e.target.value)}
                  placeholder={t('chat.ask_placeholder')}
                  className="flex-1 bg-transparent text-sm text-white placeholder-orca-muted focus:outline-none"
                  disabled={isProcessing || isBackendUnreachable || !isAuthenticated}
                />
                {/* Voice input needs FR-A6 STT, which is not wired. Disabled
                    rather than left looking functional. */}
                <button type="button" title="Voice input is not yet available" disabled className="text-orca-muted/40 cursor-not-allowed">
                  <Mic size={18} />
                </button>
              </div>

              {isProcessing ? (
                <button
                  type="button"
                  onClick={handleStop}
                  title="Stop"
                  className="w-11 h-11 rounded-2xl bg-orca-surface-2 border border-orca-border text-white flex items-center justify-center hover:border-red-400/50 hover:text-red-400 transition-all flex-shrink-0"
                >
                  <StopCircle size={18} />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!inputQuery.trim() || isBackendUnreachable || !isAuthenticated}
                  className="w-11 h-11 rounded-2xl bg-orca-teal text-orca-bg flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-orca-teal/90 active:scale-95 transition-all shadow-md shadow-orca-teal/20 flex-shrink-0"
                >
                  <Send size={18} />
                </button>
              )}
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}