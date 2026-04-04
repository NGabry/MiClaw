"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { ActiveSession } from "@/lib/sessionScanner";
import { Skull, Clock, GitBranch, Terminal, Bot, ChevronDown, ChevronRight, ExternalLink, GripVertical } from "lucide-react";
import { VimEditor } from "./VimEditor";
import { TerminalMirror } from "./TerminalMirror";

const POLL_INTERVAL = 500;

function formatDuration(startedAt: number): string {
  const ms = Date.now() - startedAt;
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m`;
}


function StatusDot({ status, isAlive, maybeWaiting }: { status?: string; isAlive: boolean; maybeWaiting?: boolean }) {
  if (!isAlive) return <span className="w-2.5 h-2.5 rounded-full bg-text-dim inline-block shrink-0" title="Dead" />;
  if (status === "waiting" || maybeWaiting) return <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 animate-pulse inline-block shrink-0" title="Waiting for input" />;
  if (status === "busy") return <span className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse inline-block shrink-0" title="Busy" />;
  return <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block shrink-0" title="Idle" />;
}

async function focusTerminal(pid: number) {
  try {
    await fetch("/api/sessions/focus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pid }),
    });
  } catch {
    // Silent fail
  }
}

// --- Prompt input ---

function SessionPrompt({ session, onInputRef }: { session: ActiveSession; onInputRef?: (el: HTMLInputElement | null) => void }) {
  const [sending, setSending] = useState(false);
  const [permError, setPermError] = useState(false);

  async function handleSubmit(text: string) {
    if (!text.trim() || sending) return;

    setSending(true);
    setPermError(false);

    try {
      const res = await fetch("/api/sessions/type", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pid: session.pid,
          sessionId: session.sessionId,
          cwd: session.cwd,
          message: text,
        }),
      });

      if (res.status === 403) setPermError(true);
    } catch { /* silent */ } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-3 space-y-2">
      {permError && (
        <p className="text-xs font-mono text-accent">
          Grant accessibility access: System Settings &gt; Privacy &amp; Security &gt; Accessibility &gt; enable Terminal
        </p>
      )}
      <VimEditor
        onSubmit={handleSubmit}
        placeholder="Type into this session... -- vim enabled"
        disabled={sending || !session.isAlive}
        inputRef={(el) => onInputRef?.(el as HTMLInputElement | null)}
      />
    </div>
  );
}

// --- Session row ---

function SessionRow({
  session,
  onKill,
  isVimSelected,
  expanded,
  onToggleExpand,
  onRowRef,
  onInputRef,
  index,
  onDragStart,
  onDragOver,
  onDragEnd,
  isDragOver,
}: {
  session: ActiveSession;
  onKill: () => void;
  isVimSelected: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onRowRef: (el: HTMLDivElement | null) => void;
  onInputRef: (el: HTMLInputElement | null) => void;
  index: number;
  onDragStart: (index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDragEnd: () => void;
  isDragOver: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      ref={onRowRef}
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDragStart(index); }}
      onDragOver={(e) => onDragOver(e, index)}
      onDragEnd={onDragEnd}
      className={`border-b border-border ${!session.isAlive ? "opacity-30" : ""} ${isVimSelected ? "border-l-2 border-l-accent bg-surface-hover/30" : ""} ${isDragOver ? "border-t-2 border-t-accent" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Main row */}
      <div
        className="flex items-center gap-4 py-4 px-2 cursor-pointer hover:bg-surface-hover/50 transition-colors"
        onClick={onToggleExpand}
      >
        <span className="text-text-dim/30 shrink-0 cursor-grab active:cursor-grabbing">
          <GripVertical size={14} />
        </span>

        <span className="text-text-dim shrink-0">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>

        <StatusDot status={session.status} isAlive={session.isAlive} maybeWaiting={session.maybeWaitingForInput} />

        <div className="min-w-0 flex-1">
          <p className="font-mono text-sm font-medium text-text truncate">
            {session.title ?? session.name ?? session.projectName}
          </p>
          <p className="font-mono text-[11px] text-text-dim truncate mt-0.5">
            {session.cwd.replace(/^\/Users\/[^/]+/, "~")}
          </p>
        </div>

        <div className="flex items-center gap-4 text-[11px] font-mono text-text-dim shrink-0">
          <span className="flex items-center gap-1">
            <Terminal size={10} />
            {session.kind}
          </span>
          {session.gitBranch && (
            <span className="flex items-center gap-1">
              <GitBranch size={10} />
              {session.gitBranch}
            </span>
          )}
          {session.agent && (
            <span className="flex items-center gap-1">
              <Bot size={10} />
              {session.agent}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock size={10} />
            {formatDuration(session.startedAt)}
          </span>
          <span className="w-12 text-right">:{session.pid}</span>
        </div>

        {session.isAlive && hovered && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); focusTerminal(session.pid); }}
              className="p-1.5 rounded-sm text-text-dim hover:text-accent hover:bg-surface-hover transition-colors"
              title="Open terminal"
            >
              <ExternalLink size={14} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onKill(); }}
              className="p-1.5 rounded-sm text-text-dim hover:text-red-400 hover:bg-surface-hover transition-colors"
              title="Kill session"
            >
              <Skull size={14} />
            </button>
          </div>
        )}
        {(!session.isAlive || !hovered) && <div className="w-16 shrink-0" />}
      </div>

      {/* Expanded: messages + prompt */}
      {expanded && (
        <div className="pb-4 px-10">
          {session.waitingFor && session.isAlive && (
            <p className="text-[11px] font-mono text-yellow-500/80 mb-2">
              waiting: {session.waitingFor}
            </p>
          )}
          {session.maybeWaitingForInput && session.isAlive && !session.waitingFor && (
            <div className="flex items-center gap-2 mb-2 py-1.5 px-3 rounded-sm bg-yellow-500/10 border border-yellow-500/20">
              <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse shrink-0" />
              <p className="text-[11px] font-mono text-yellow-500/80">
                session may need input -- press O to jump to terminal
              </p>
            </div>
          )}

          {/* Terminal mirror (read-only, prompt area stripped) */}
          <div className="mb-3">
            <TerminalMirror pid={session.pid} />
          </div>

          {/* Prompt input */}
          {session.isAlive && <SessionPrompt session={session} onInputRef={onInputRef} />}
        </div>
      )}
    </div>
  );
}

// --- Main ---

export function SessionsView() {
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [expandedSet, setExpandedSet] = useState<Set<string>>(new Set());
  const [customOrder, setCustomOrder] = useState<string[] | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const rowRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());
  const inputRefs = useRef<Map<number, HTMLInputElement | null>>(new Map());
  const pendingGRef = useRef(false);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions");
      if (res.ok) {
        const newData = await res.json();
        // Only update state if data actually changed to prevent scroll jitter
        setSessions((prev) => {
          if (JSON.stringify(prev) === JSON.stringify(newData)) return prev;
          return newData;
        });
      }
    } catch {
      // Fetch failed
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  // Clamp selectedIndex when sessions list changes
  useEffect(() => {
    if (sessions.length > 0 && selectedIndex >= sessions.length) {
      setSelectedIndex(sessions.length - 1);
    }
  }, [sessions.length, selectedIndex]);

  // Auto-scroll selected row into view
  useEffect(() => {
    if (sessions.length === 0) return;
    const session = orderedRef.current[selectedIndex];
    if (!session) return;
    const el = rowRefs.current.get(session.pid);
    if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedIndex, sessions]);

  function sessionKey(s: ActiveSession): string {
    return `${s.pid}-${s.sessionId}`;
  }

  function toggleExpand(index: number) {
    const s = orderedRef.current[index];
    if (!s) return;
    const key = sessionKey(s);
    setExpandedSet((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // --- Drag-to-reorder ---
  function handleDragStart(index: number) {
    setDragIndex(index);
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  }

  function handleDragEnd() {
    if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
      const ordered = [...orderedSessions];
      const [moved] = ordered.splice(dragIndex, 1);
      ordered.splice(dragOverIndex, 0, moved);
      setCustomOrder(ordered.map(sessionKey));
      setSelectedIndex(dragOverIndex);
    }
    setDragIndex(null);
    setDragOverIndex(null);
  }

  // Apply custom ordering if set, otherwise use API order
  const orderedSessions = customOrder
    ? [...sessions].sort((a, b) => {
        const ai = customOrder.indexOf(sessionKey(a));
        const bi = customOrder.indexOf(sessionKey(b));
        return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi);
      })
    : sessions;

  const orderedRef = useRef(orderedSessions);
  orderedRef.current = orderedSessions;

  async function handleKill(pid: number) {
    if (!window.confirm(`Kill session with PID ${pid}?`)) return;
    try {
      await fetch("/api/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pid }),
      });
      fetchSessions();
    } catch {
      alert("Failed to kill session");
    }
  }

  // Vim-style keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const activeEl = document.activeElement;
      const isInputFocused = activeEl instanceof HTMLInputElement
        || activeEl instanceof HTMLTextAreaElement
        || activeEl?.closest(".cm-editor") !== null;

      // When input is focused (insert mode), only Esc returns to normal mode
      if (isInputFocused) {
        if (e.key === "Escape") {
          e.preventDefault();
          (activeEl as HTMLElement).blur();
        }
        return;
      }

      const ordered = orderedRef.current;
      if (ordered.length === 0) return;

      // Handle gg sequence
      if (pendingGRef.current) {
        pendingGRef.current = false;
        if (e.key === "g") {
          e.preventDefault();
          setSelectedIndex(0);
          return;
        }
      }

      switch (e.key) {
        case "j":
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, ordered.length - 1));
          break;

        case "k":
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;

        case "l":
          e.preventDefault();
          toggleExpand(selectedIndex);
          break;

        case "Escape":
        case "h": {
          e.preventDefault();
          const s = ordered[selectedIndex];
          if (s) {
            const key = sessionKey(s);
            setExpandedSet((prev) => {
              const next = new Set(prev);
              next.delete(key);
              return next;
            });
          }
          break;
        }

        case "i":
        case "/": {
          e.preventDefault();
          const s = ordered[selectedIndex];
          if (!s) break;
          const key = sessionKey(s);
          if (!expandedSet.has(key)) {
            setExpandedSet((prev) => new Set(prev).add(key));
          }
          setTimeout(() => {
            const input = inputRefs.current.get(s.pid);
            if (input) input.focus();
          }, 50);
          break;
        }

        case "O": {
          e.preventDefault();
          const s = ordered[selectedIndex];
          if (s?.isAlive) focusTerminal(s.pid);
          break;
        }

        case "X": {
          e.preventDefault();
          const s = ordered[selectedIndex];
          if (s?.isAlive) handleKill(s.pid);
          break;
        }

        case "g":
          pendingGRef.current = true;
          break;

        case "G":
          e.preventDefault();
          setSelectedIndex(ordered.length - 1);
          break;
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, selectedIndex, expandedSet]);

  const aliveCount = sessions.filter((s) => s.isAlive).length;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[90rem] mx-auto px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-mono font-medium tracking-tight">Sessions</h1>
          <p className="mt-1 text-sm text-text-muted">
            {loading
              ? "Scanning..."
              : `${aliveCount} active, ${sessions.length - aliveCount} stale`}
          </p>
        </div>

        {sessions.length === 0 && !loading && (
          <p className="text-sm font-mono text-text-dim">No Claude Code sessions found.</p>
        )}

        <div>
          {orderedSessions.map((session, index) => (
            <SessionRow
              key={`${session.pid}-${session.sessionId}`}
              session={session}
              onKill={() => handleKill(session.pid)}
              isVimSelected={index === selectedIndex}
              expanded={expandedSet.has(sessionKey(session))}
              onToggleExpand={() => toggleExpand(index)}
              onRowRef={(el) => { rowRefs.current.set(session.pid, el); }}
              onInputRef={(el) => { inputRefs.current.set(session.pid, el); }}
              index={index}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              isDragOver={dragOverIndex === index}
            />
          ))}
        </div>

        <p className="text-[10px] font-mono text-text-dim text-center mt-4">
          j/k navigate -- l/h expand/collapse -- i insert -- O terminal -- X kill
        </p>
      </div>
    </div>
  );
}
