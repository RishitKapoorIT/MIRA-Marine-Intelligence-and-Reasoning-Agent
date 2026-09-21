import React from 'react';
import { Plus, MessageSquare, Clock, Trash2, Sparkles, X } from 'lucide-react';

export default function Sidebar({ 
  threads = [], 
  activeThreadId, 
  onSelectThread, 
  onNewChat, 
  onDeleteThread,
  mobileOpen = false,
  onCloseMobile
}) {
  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div 
          onClick={onCloseMobile}
          className="md:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-sm animate-fadeIn"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed md:relative top-0 bottom-0 left-0 z-40 md:z-0
        w-72 bg-orca-surface border-r border-orca-border flex flex-col h-full flex-shrink-0
        transition-transform duration-300 ease-in-out
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Mobile Header / Close Bar */}
        <div className="md:hidden flex items-center justify-between p-3 border-b border-orca-border bg-orca-surface-2/80">
          <span className="text-xs font-bold text-white flex items-center gap-2">
            <MessageSquare size={14} className="text-orca-teal" />
            Query Threads
          </span>
          <button
            type="button"
            onClick={onCloseMobile}
            className="p-1 rounded-lg text-orca-muted hover:text-white hover:bg-orca-surface"
            aria-label="Close thread drawer"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── New Chat Button ── */}
        <div className="p-4 border-b border-orca-border">
          <button
            onClick={() => {
              onNewChat?.();
              onCloseMobile?.();
            }}
            className="
              w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
              bg-orca-teal text-orca-bg font-bold text-xs uppercase tracking-wider
              hover:bg-orca-teal/90 active:scale-[0.98]
              transition-all duration-150 shadow-md shadow-orca-teal/15 touch-target
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
              <div
                key={t.id}
                onClick={() => {
                  onSelectThread(t.id);
                  onCloseMobile?.();
                }}
                className={`
                  group relative w-full text-left px-3 py-2.5 rounded-xl transition-all duration-150 flex items-center justify-between cursor-pointer touch-target
                  ${
                    isActive
                      ? 'bg-orca-surface-2 border border-orca-teal/40 text-white shadow-sm'
                      : 'text-orca-muted hover:text-white hover:bg-orca-surface-2/50 border border-transparent'
                  }
                `}
              >
                <div className="flex flex-col gap-1 min-w-0 flex-1 pr-2">
                  <div className="flex items-center gap-2">
                    <MessageSquare size={13} className={isActive ? 'text-orca-teal flex-shrink-0' : 'text-orca-muted flex-shrink-0'} />
                    <span className="text-xs font-semibold truncate">{t.title}</span>
                    {t.isRealMl && (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 flex-shrink-0">
                        ML
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-orca-muted/70 pl-5">
                    {t.timestamp}
                  </span>
                </div>

                {threads.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteThread?.(t.id);
                    }}
                    title="Delete query thread"
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-500/20 text-orca-muted hover:text-red-400 transition-all flex-shrink-0"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Bottom Session Info Banner ── */}
        <div className="p-3 border-t border-orca-border bg-orca-bg/40 pb-safe">
          <div className="rounded-lg p-2.5 bg-orca-surface-2/60 border border-orca-border/80 flex items-start gap-2 text-[11px]">
            <Sparkles size={14} className="text-orca-teal flex-shrink-0 mt-0.5" />
            <div className="text-orca-muted leading-tight">
              <span className="text-white font-semibold">Active Pipeline</span>: XGBoost PFZ & Open-Meteo live multi-agent workflow.
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

