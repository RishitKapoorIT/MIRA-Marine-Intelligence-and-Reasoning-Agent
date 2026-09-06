import React from 'react';
import { Plus, MessageSquare, Clock, Trash2, Compass, ShieldAlert, Sparkles } from 'lucide-react';

export default function Sidebar({ threads = [], activeThreadId, onSelectThread, onNewChat }) {
  return (
    <aside className="w-72 bg-orca-surface border-r border-orca-border flex flex-col h-full flex-shrink-0">
      {/* ── New Chat Button ── */}
      <div className="p-4 border-b border-orca-border">
        <button
          onClick={onNewChat}
          className="
            w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
            bg-orca-teal text-orca-bg font-bold text-xs uppercase tracking-wider
            hover:bg-orca-teal/90 active:scale-[0.98]
            transition-all duration-150 shadow-md shadow-orca-teal/15
          "
        >
          <Plus size={16} strokeWidth={2.5} />
          <span>New Query Thread</span>
        </button>
      </div>

      {/* ── Thread List / History ── */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <div className="flex items-center justify-between px-2 mb-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-orca-muted flex items-center gap-1.5">
            <Clock size={11} /> Conversation History
          </span>
          <span className="text-[10px] text-orca-muted/60">
            {threads.length} {threads.length === 1 ? 'thread' : 'threads'}
          </span>
        </div>

        {threads.map(t => {
          const isActive = t.id === activeThreadId;
          return (
            <button
              key={t.id}
              onClick={() => onSelectThread(t.id)}
              className={`
                w-full text-left px-3 py-2.5 rounded-xl transition-all duration-150 flex flex-col gap-1
                ${
                  isActive
                    ? 'bg-orca-surface-2 border border-orca-teal/40 text-white shadow-sm'
                    : 'text-orca-muted hover:text-white hover:bg-orca-surface-2/50 border border-transparent'
                }
              `}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-semibold truncate flex items-center gap-2">
                  <MessageSquare size={13} className={isActive ? 'text-orca-teal' : 'text-orca-muted'} />
                  <span className="truncate">{t.title}</span>
                </span>
                {t.isRealMl && (
                  <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                    ML
                  </span>
                )}
              </div>
              <span className="text-[10px] text-orca-muted/70 pl-5">
                {t.timestamp}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Bottom Session Info Banner ── */}
      <div className="p-3 border-t border-orca-border bg-orca-bg/40">
        <div className="rounded-lg p-2.5 bg-orca-surface-2/60 border border-orca-border/80 flex items-start gap-2 text-[11px]">
          <Sparkles size={14} className="text-orca-teal flex-shrink-0 mt-0.5" />
          <div className="text-orca-muted leading-tight">
            <span className="text-white font-semibold">Active Pipeline</span>: XGBoost PFZ & Open-Meteo live multi-agent workflow.
          </div>
        </div>
      </div>
    </aside>
  );
}
