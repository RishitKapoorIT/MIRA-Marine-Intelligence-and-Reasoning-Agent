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
import { useLocationState, getSectorForLatLon, KNOWN_COASTAL_LOCATIONS } from '../../context/LocationContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { safeStorage, escapeHtml } from '../../utils/storage.js';
import {
  Send,
  Mic,
  MicOff,
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
  Anchor,
  Volume2,
  VolumeX,
  Copy,
  Check,
  Radio,
  History,
  MessageSquare
} from 'lucide-react';
import { generateMarineAiResponse } from './marineChatEngine.js';


function renderFormattedText(text) {
  if (!text) return null;
  const lines = text.split('\n');
  return (
    <div className="space-y-2 leading-relaxed text-sm">
      {lines.map((rawLine, idx) => {
        const line = rawLine.trim();
        if (!line) return <div key={idx} className="h-1" />;

        // Header 3
        if (rawLine.startsWith('### ')) {
          return (
            <h4 key={idx} className="text-sm font-bold text-white pt-2 pb-1 border-b border-orca-border/50 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-orca-teal inline-block" />
              <span>{rawLine.replace(/^###\s*/, '')}</span>
            </h4>
          );
        }

        // Header 4
        if (rawLine.startsWith('#### ')) {
          return (
            <h5 key={idx} className="text-xs font-bold uppercase tracking-wider text-orca-teal pt-1 pb-0.5">
              {rawLine.replace(/^####\s*/, '')}
            </h5>
          );
        }

        const isBullet = line.startsWith('•') || line.startsWith('-');
        const isNumber = /^\d+\.\s/.test(line);
        const contentToParse = isBullet ? line.replace(/^[•\-]\s*/, '') : isNumber ? line.replace(/^\d+\.\s*/, '') : rawLine;

        const parts = contentToParse.split(/(\*\*.*?\*\*|`.*?`)/g);

        const renderedContent = parts.map((part, pIdx) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={pIdx} className="text-white font-bold">{part.slice(2, -2)}</strong>;
          }
          if (part.startsWith('`') && part.endsWith('`')) {
            return <code key={pIdx} className="px-1.5 py-0.5 rounded bg-orca-bg border border-orca-border font-mono text-[11px] text-orca-teal font-semibold">{part.slice(1, -1)}</code>;
          }
          return part;
        });

        if (isBullet) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-2 text-orca-muted text-xs leading-normal">
              <span className="text-orca-teal font-bold select-none">•</span>
              <div className="flex-1">{renderedContent}</div>
            </div>
          );
        }

        if (isNumber) {
          const numMatch = line.match(/^(\d+)\.\s/);
          const num = numMatch ? numMatch[1] : '';
          return (
            <div key={idx} className="flex items-start gap-2 pl-2 text-orca-muted text-xs leading-normal">
              <span className="text-orca-teal font-mono font-bold select-none">{num}.</span>
              <div className="flex-1">{renderedContent}</div>
            </div>
          );
        }

        return (
          <p key={idx} className="text-orca-muted text-xs leading-relaxed">
            {renderedContent}
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
  const handledQueryRef = useRef(false);

  const { currentLocation, setCurrentLocation, resolveLocationFromText } = useLocationState();
  const { user, safeHouse } = useAuth();

  // Compute effective home harbor grounded in the authenticated mariner's profile
  const effectiveLocation = React.useMemo(() => {
    if (user?.safe_house?.lat && user?.safe_house?.lon) {
      const match = KNOWN_COASTAL_LOCATIONS.find(
        l => Math.abs(l.lat - user.safe_house.lat) < 0.15 && Math.abs(l.lon - user.safe_house.lon) < 0.15
      );
      if (match) return match;
      return {
        key: 'user-safehouse',
        name: user.safe_house.label || 'Home Port Basin',
        lat: user.safe_house.lat,
        lon: user.safe_house.lon,
        region: user.safe_house.region || 'Coastal Waters',
        sector: user.safe_house.sector || 'Home Waters',
      };
    }
    return currentLocation || KNOWN_COASTAL_LOCATIONS.find(l => l.key === 'mangalore');
  }, [user?.id, user?.safe_house?.lat, user?.safe_house?.lon, currentLocation]);

  const userId = user?.id || 'guest';

  // ── 1. User-Scoped Persistent Thread and Messages Storage ──
  const getStoredThreadsForUser = (uId, loc) => {
    try {
      const saved = safeStorage.getItem(`orca_chat_${uId}_threads`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    const locShort = loc?.name?.split(' ')[0] || 'Coastal';
    return [
      { id: `t-init-${uId}`, title: `Marine Advisory (${locShort})`, timestamp: 'Active', isRealMl: true }
    ];
  };

  const getStoredActiveThreadIdForUser = (uId) => {
    return safeStorage.getItem(`orca_chat_${uId}_active_id`) || `t-init-${uId}`;
  };

  const getStoredMessagesMapForUser = (uId) => {
    try {
      const saved = safeStorage.getItem(`orca_chat_${uId}_messages_map`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed === 'object' && parsed !== null) return parsed;
      }
    } catch {}
    return {};
  };

  const [threads, setThreads] = useState(() => getStoredThreadsForUser(userId, effectiveLocation));
  const [activeThreadId, setActiveThreadId] = useState(() => getStoredActiveThreadIdForUser(userId));
  const [messagesMap, setMessagesMap] = useState(() => getStoredMessagesMapForUser(userId));
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);

  const [inputQuery, setInputQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState(null);
  const recognitionRef = useRef(null);

  const [stepStatus, setStepStatus] = useState({
    planner: 'queued',
    weather: 'queued',
    pfz: 'queued',
    risk: 'queued',
  });

  const chatScrollRef = useRef(null);
  const messagesEndRef = useRef(null);

  // When active user ID switches, reload their isolated chat state
  useEffect(() => {
    const loadedThreads = getStoredThreadsForUser(userId, effectiveLocation);
    const loadedActiveId = getStoredActiveThreadIdForUser(userId);
    const loadedMessages = getStoredMessagesMapForUser(userId);

    setThreads(loadedThreads);
    setActiveThreadId(loadedActiveId);
    setMessagesMap(loadedMessages);
  }, [userId]);

  // Persist whenever threads, activeId, or messagesMap change
  useEffect(() => {
    try {
      safeStorage.setItem(`orca_chat_${userId}_threads`, JSON.stringify(threads));
    } catch {}
  }, [threads, userId]);

  useEffect(() => {
    try {
      safeStorage.setItem(`orca_chat_${userId}_active_id`, activeThreadId);
    } catch {}
  }, [activeThreadId, userId]);

  useEffect(() => {
    try {
      safeStorage.setItem(`orca_chat_${userId}_messages_map`, JSON.stringify(messagesMap));
    } catch {}
  }, [messagesMap, userId]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const handleSpeakText = (msgId, rawText) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    if (speakingMsgId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const cleanText = (rawText || '')
      .replace(/###/g, '')
      .replace(/\*\*/g, '')
      .replace(/`/g, '')
      .replace(/•/g, '')
      .replace(/[\n\r]+/g, '. ')
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.onend = () => setSpeakingMsgId(null);
    utterance.onerror = () => setSpeakingMsgId(null);
    setSpeakingMsgId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  const toggleVoiceInput = () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice recognition is not supported in this browser. Please use Chrome, Edge, or a Chromium browser.');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-IN';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputQuery(transcript);
        }
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Speech recognition start failed:', err);
      setIsListening(false);
    }
  };

  const handleCopyText = (msgId, text) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedMsgId(msgId);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  const handleDeleteThread = (threadId) => {
    const updated = threads.filter(t => t.id !== threadId);
    if (updated.length === 0) {
      const locName = effectiveLocation?.name?.split(' ')[0] || 'Coastal';
      const freshId = `t-${Date.now()}`;
      const fresh = [{ id: freshId, title: `Marine Advisory (${locName})`, timestamp: 'Active', isRealMl: true }];
      setThreads(fresh);
      setActiveThreadId(freshId);
      try {
        localStorage.setItem(`orca_chat_${userId}_threads`, JSON.stringify(fresh));
        localStorage.setItem(`orca_chat_${userId}_active_id`, freshId);
      } catch {}
    } else {
      setThreads(updated);
      if (activeThreadId === threadId) {
        setActiveThreadId(updated[0].id);
        try {
          localStorage.setItem(`orca_chat_${userId}_active_id`, updated[0].id);
        } catch {}
      }
      try {
        localStorage.setItem(`orca_chat_${userId}_threads`, JSON.stringify(updated));
      } catch {}
    }

    setMessagesMap(prev => {
      const copy = { ...prev };
      delete copy[threadId];
      try {
        localStorage.setItem(`orca_chat_${userId}_messages_map`, JSON.stringify(copy));
      } catch {}
      return copy;
    });
  };

  // Messages of the active thread
  const activeMessages = messagesMap[activeThreadId] || [];

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages, isProcessing]);

  // Handle URL query parameter if present (guarded against re-firing)
  useEffect(() => {
    if (initialQuery && !handledQueryRef.current) {
      handledQueryRef.current = true;
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

    const targetThreadId = activeThreadId;

    // Append user message immediately and synchronously save to localStorage
    setMessagesMap(prev => {
      const updated = {
        ...prev,
        [targetThreadId]: [...(prev[targetThreadId] || []), userMsg],
      };
      try {
        localStorage.setItem(`orca_chat_${userId}_messages_map`, JSON.stringify(updated));
      } catch {}
      return updated;
    });

    setIsProcessing(true);

    await runAgentPipeline(queryText, targetThreadId);
  };

  const runAgentPipeline = async (queryText, targetThreadId = activeThreadId) => {
    setStepStatus({
      planner: 'running',
      weather: 'queued',
      pfz: 'queued',
      risk: 'queued',
    });

    // ── Step 1: Location Resolution & Grounding ──
    let targetLoc = await resolveLocationFromText(queryText);

    // If query does not mention another coastal port or is asking about home waters / safe house
    if (!targetLoc) {
      targetLoc = effectiveLocation;
    }

    // Only update app-wide focus if user explicitly inquired about a different coastal port
    if (targetLoc && targetLoc.key && targetLoc.key !== currentLocation?.key) {
      setCurrentLocation(targetLoc);
    }

    // Update active thread title to match query context
    const threadTitle = queryText.length > 25 ? `${queryText.slice(0, 22)}...` : queryText;

    setThreads(prev => {
      const updated = prev.map(th => (th.id === targetThreadId ? { ...th, title: threadTitle } : th));
      try {
        localStorage.setItem(`orca_chat_${userId}_threads`, JSON.stringify(updated));
      } catch {}
      return updated;
    });

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
      conversationHistory: messagesMap[targetThreadId] || [],
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

    setMessagesMap(prev => {
      const updated = {
        ...prev,
        [targetThreadId]: [...(prev[targetThreadId] || []), botResponse],
      };
      try {
        safeStorage.setItem(`orca_chat_${userId}_messages_map`, JSON.stringify(updated));
      } catch {}
      return updated;
    });
    setIsProcessing(false);
  };

  const handleNewChat = () => {
    const newId = `t-${Date.now()}`;
    const locName = effectiveLocation?.name?.split(' ')[0] || 'Coastal';
    const newThread = {
      id: newId,
      title: `Query ${threads.length + 1} (${locName})`,
      timestamp: 'Just Now',
      isRealMl: true,
    };
    const updatedThreads = [newThread, ...threads];
    setThreads(updatedThreads);
    setActiveThreadId(newId);
    try {
      safeStorage.setItem(`orca_chat_${userId}_threads`, JSON.stringify(updatedThreads));
      safeStorage.setItem(`orca_chat_${userId}_active_id`, newId);
    } catch {}
  };

  const scrollToTop = () => {
    chatScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const activeLocName = effectiveLocation?.name || 'Coastal Shelf Basin';
  const activeShortPlace = activeLocName.split(' ')[0];

  return (
    <div className="h-screen bg-orca-bg flex flex-col overflow-hidden">
      {/* Persistent Global Header */}
      <Header />

      {/* Main Workspace Layout with Full-Height Sidebar & Chat Thread */}
      <div className="flex-1 min-h-0 flex overflow-hidden relative">
        {/* Full-Height Sidebar with Persistent Thread History & Mobile Drawer */}
        <Sidebar
          threads={threads}
          activeThreadId={activeThreadId}
          onSelectThread={setActiveThreadId}
          onNewChat={handleNewChat}
          onDeleteThread={handleDeleteThread}
          mobileOpen={mobileHistoryOpen}
          onCloseMobile={() => setMobileHistoryOpen(false)}
        />

        {/* Chat Area */}
        <main className="flex-1 min-h-0 flex flex-col bg-orca-bg overflow-hidden relative">
          {/* Mobile Top Context & Drawer Bar */}
          <div className="md:hidden flex items-center justify-between px-3 py-2 border-b border-orca-border bg-orca-surface/80 backdrop-blur z-10">
            <button
              type="button"
              onClick={() => setMobileHistoryOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-orca-surface-2 border border-orca-border text-xs text-orca-muted hover:text-white transition-colors touch-target"
            >
              <History size={14} className="text-orca-teal" />
              <span>Threads ({threads.length})</span>
            </button>

            <div className="text-[11px] text-orca-teal font-semibold flex items-center gap-1">
              <MapPin size={12} />
              <span className="truncate max-w-[150px]">{activeLocName}</span>
            </div>
          </div>

          {/* Messages Scroll View */}
          <div ref={chatScrollRef} className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 md:p-8 space-y-5">

            
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
                    <span>Mariner: {user?.name || 'Coastal Fisher'} • Port: {activeLocName} ({effectiveLocation?.sector || 'Coastal Waters'})</span>
                  </div>
                  <p className="text-xs text-orca-muted leading-relaxed max-w-md pt-1">
                    Ask natural questions in plain language about live weather, sea swell, predicted fishing zones (PFZ), or safe passage routes for {activeShortPlace} waters.
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
                    onClick={() => handleSendQuery(`Can I go out to sea right now from ${activeShortPlace}?`)}
                    className="text-left text-xs p-3 rounded-xl bg-orca-surface border border-orca-border text-orca-muted hover:text-white hover:border-orca-teal/40 transition-all flex items-center gap-2 group"
                  >
                    <Waves size={16} className="text-cyan-400 group-hover:scale-110 transition-transform flex-shrink-0" />
                    <span className="truncate">🌊 Can I sail safely today from {activeShortPlace}?</span>
                  </button>

                  <button
                    onClick={() => handleSendQuery('where is my safe house')}
                    className="text-left text-xs p-3 rounded-xl bg-orca-surface border border-orca-border text-orca-muted hover:text-white hover:border-purple-400/40 transition-all flex items-center gap-2 group"
                  >
                    <span className="text-base group-hover:scale-110 transition-transform flex-shrink-0">🏠</span>
                    <span className="truncate">🏠 Where is my Safe House ({user?.safe_house?.label?.split(' ')[0] || activeShortPlace})?</span>
                  </button>

                  <button
                    onClick={() => handleSendQuery(`nearest port to ${activeShortPlace}`)}
                    className="text-left text-xs p-3 rounded-xl bg-orca-surface border border-orca-border text-orca-muted hover:text-white hover:border-orca-teal/40 transition-all flex items-center gap-2 group"
                  >
                    <Anchor size={16} className="text-orca-teal group-hover:scale-110 transition-transform flex-shrink-0" />
                    <span className="truncate">⚓ Nearest Ports & Shelter around {activeShortPlace}</span>
                  </button>

                  <button
                    onClick={() => handleSendQuery('How can I save diesel on fishing trips?')}
                    className="text-left text-xs p-3 rounded-xl bg-orca-surface border border-orca-border text-orca-muted hover:text-white hover:border-amber-400/40 transition-all flex items-center gap-2 group"
                  >
                    <span className="text-base group-hover:scale-110 transition-transform flex-shrink-0">⛽</span>
                    <span className="truncate">⛽ How to save diesel on long hauls?</span>
                  </button>

                  <button
                    onClick={() => handleSendQuery('When is the monsoon fishing ban in India?')}
                    className="text-left text-xs p-3 rounded-xl bg-orca-surface border border-orca-border text-orca-muted hover:text-white hover:border-blue-400/40 transition-all flex items-center gap-2 group"
                  >
                    <span className="text-base group-hover:scale-110 transition-transform flex-shrink-0">🗓️</span>
                    <span className="truncate">🗓️ When does the Monsoon Ban start?</span>
                  </button>

                  <button
                    onClick={() => handleSendQuery('What is VHF Channel 16 emergency protocol?')}
                    className="text-left text-xs p-3 rounded-xl bg-orca-surface border border-orca-border text-orca-muted hover:text-white hover:border-red-400/40 transition-all flex items-center gap-2 group"
                  >
                    <AlertTriangle size={16} className="text-red-400 group-hover:scale-110 transition-transform flex-shrink-0" />
                    <span className="truncate">🚨 Emergency Coast Guard & VHF 16</span>
                  </button>

                  <button
                    onClick={() => handleSendQuery('What bait and gear is best for Tuna?')}
                    className="text-left text-xs p-3 rounded-xl bg-orca-surface border border-orca-border text-orca-muted hover:text-white hover:border-teal-400/40 transition-all flex items-center gap-2 group"
                  >
                    <span className="text-base group-hover:scale-110 transition-transform flex-shrink-0">🎣</span>
                    <span className="truncate">🎣 What bait and gear for Tuna?</span>
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
                      {/* Natural Language AI Summary Bubble with Action Toolbar */}
                      <div className="bg-orca-surface border border-orca-border rounded-2xl text-sm text-white leading-relaxed shadow-sm overflow-hidden">
                        {/* Header Action Toolbar */}
                        <div className="flex items-center justify-between px-4 py-2.5 bg-orca-surface-2/60 border-b border-orca-border text-xs">
                          <div className="flex items-center gap-2 text-orca-muted">
                            <span className="text-orca-teal font-bold tracking-wider uppercase text-[10px] flex items-center gap-1.5">
                              <Sparkles size={12} className="text-orca-teal" />
                              ORCA Intelligence
                            </span>
                            <span className="text-orca-border">•</span>
                            <span className="text-[11px] text-orca-muted truncate max-w-[200px]">
                              {msg.locationName || 'Coastal Basin'}
                            </span>
                            {msg.locationSector && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-orca-bg border border-orca-border text-orca-teal font-mono">
                                {msg.locationSector}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            {/* Voice Readout (TTS) */}
                            <button
                              type="button"
                              onClick={() => handleSpeakText(msg.id, msg.summary)}
                              title={speakingMsgId === msg.id ? "Stop voice readout" : "Listen to marine briefing"}
                              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all ${
                                speakingMsgId === msg.id
                                  ? 'bg-orca-teal text-orca-bg font-bold shadow-sm shadow-orca-teal/20 animate-pulse'
                                  : 'bg-orca-bg/80 text-orca-muted hover:text-white hover:bg-orca-surface-2 border border-orca-border'
                              }`}
                            >
                              {speakingMsgId === msg.id ? (
                                <>
                                  <VolumeX size={12} />
                                  <span>Stop</span>
                                </>
                              ) : (
                                <>
                                  <Volume2 size={12} />
                                  <span>Listen</span>
                                </>
                              )}
                            </button>

                            {/* Copy Text */}
                            <button
                              type="button"
                              onClick={() => handleCopyText(msg.id, msg.summary)}
                              title="Copy briefing text"
                              className="p-1 rounded-lg text-orca-muted hover:text-white hover:bg-orca-surface-2 border border-orca-border bg-orca-bg/80 transition-all"
                            >
                              {copiedMsgId === msg.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                            </button>
                          </div>
                        </div>

                        {/* Content Body */}
                        <div className="p-4">
                          {renderFormattedText(msg.summary)}
                          {msg.isLive && (
                            <div className="mt-3 flex items-center gap-2 text-[11px] text-emerald-400 font-medium pt-2 border-t border-orca-border/40">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              <span>Powered by live XGBoost model service ({msg.locationSector || 'Coastal Sector'})</span>
                            </div>
                          )}
                        </div>
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
          <div className="p-3 md:p-4 border-t border-orca-border bg-orca-surface/95 backdrop-blur flex-shrink-0 sticky bottom-0 z-20 mb-14 md:mb-0 pb-safe">
            {isListening && (
              <div className="max-w-4xl mx-auto mb-2.5 flex items-center justify-between px-3.5 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs animate-pulse">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  <span className="font-bold">Deck Voice Input Active:</span>
                  <span className="text-red-300">Speak now (e.g. "Can I sail today?", "Where is my safe house?", "Tuna fishing advice")</span>
                </div>
                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  className="px-2 py-0.5 rounded-lg bg-red-500/20 text-red-300 text-[10px] font-bold hover:bg-red-500/30"
                >
                  Done
                </button>
              </div>
            )}
            <form onSubmit={handleSend} className="max-w-4xl mx-auto flex items-center gap-2">
              <div className={`flex-1 flex items-center gap-2 bg-orca-bg rounded-2xl border px-3.5 py-2.5 transition-colors ${
                isListening ? 'border-red-500/60 ring-1 ring-red-500/30' : 'border-orca-border focus-within:border-orca-teal/60'
              }`}>
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
                  placeholder={isListening ? "Listening... speak now..." : t('chat.ask_placeholder')}
                  className="flex-1 bg-transparent text-sm text-white placeholder-orca-muted focus:outline-none"
                  disabled={isProcessing}
                />
                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  title={isListening ? "Stop listening" : "Deck voice input (Hands-free)"}
                  className={`p-1.5 rounded-xl transition-all ${
                    isListening
                      ? 'bg-red-500/20 text-red-400 shadow-sm shadow-red-500/30 animate-pulse'
                      : 'text-orca-muted hover:text-white hover:bg-orca-surface-2'
                  }`}
                >
                  {isListening ? <MicOff size={18} /> : <Mic size={18} />}
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
