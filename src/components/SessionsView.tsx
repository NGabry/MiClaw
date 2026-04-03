"use client";

import { useState, useEffect, useCallback } from "react";
import type { ActiveSession } from "@/lib/sessionScanner";
import { Skull, Clock, GitBranch, Terminal, Bot, ChevronDown, ChevronRight, Send, Loader2, ExternalLink } from "lucide-react";

const POLL_INTERVAL = 5000;

function formatDuration(startedAt: number): string {
  const ms = Date.now() - startedAt;
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m`;
}

function formatTime(timestamp: string): string {
  if (!timestamp) return "";
  try {
    return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function StatusDot({ status, isAlive }: { status?: string; isAlive: boolean }) {
  if (!isAlive) return <span className="w-2.5 h-2.5 rounded-full bg-text-dim inline-block shrink-0" title="Dead" />;
  if (status === "busy") return <span className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse inline-block shrink-0" title="Busy" />;
  if (status === "waiting") return <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 animate-pulse inline-block shrink-0" title="Waiting" />;
  return <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block shrink-0" title="Idle" />;
}

// --- Prompt input with streaming response ---

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

function SessionPrompt({ session }: { session: ActiveSession }) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [permError, setPermError] = useState(false);

  async function handleSend() {
    if (!input.trim() || sending) return;

    const prompt = input.trim();
    setInput("");
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
          message: prompt,
          refocusApp: navigator.userAgent.includes("Chrome") ? "com.google.Chrome"
            : navigator.userAgent.includes("Safari") ? "com.apple.Safari"
            : navigator.userAgent.includes("Firefox") ? "org.mozilla.firefox"
            : navigator.userAgent.includes("Arc") ? "company.thebrowser.Browser"
            : null,
        }),
      });

      if (res.status === 403) {
        setPermError(true);
      }

      // Refocus browser window after Terminal gets the keystroke
      setTimeout(() => window.focus(), 100);
    } catch {
      // Silent fail
    } finally {
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
      <div className="flex gap-2">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
        placeholder="Type into this session's terminal..."
        disabled={sending || !session.isAlive}
        className="flex-1 bg-surface-raised border border-border rounded-sm px-3 py-2 text-sm font-mono text-text
          focus:border-accent focus:outline-none disabled:opacity-50
          placeholder:text-text-dim"
      />
      <button
        onClick={handleSend}
        disabled={sending || !input.trim() || !session.isAlive}
        className="px-3 py-2 bg-accent/15 text-accent border border-accent/30 rounded-sm
          hover:bg-accent/25 transition-colors disabled:opacity-30
          flex items-center gap-1.5 font-mono text-sm"
      >
        {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
      </button>
      </div>
    </div>
  );
}

// --- Session row ---

function SessionRow({ session, onKill }: { session: ActiveSession; onKill: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={`border-b border-border ${!session.isAlive ? "opacity-30" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Main row */}
      <div
        className="flex items-center gap-4 py-4 px-2 cursor-pointer hover:bg-surface-hover/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-text-dim shrink-0">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>

        <StatusDot status={session.status} isAlive={session.isAlive} />

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

          {/* Recent messages */}
          {session.recentMessages.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] font-mono text-text-dim mb-1.5"># conversation</p>
              <div className="max-h-96 overflow-y-auto space-y-1.5 border border-border rounded-sm p-3">
                {session.recentMessages.map((msg, i) => (
                  <div key={i} className="flex gap-3">
                    <span className={`text-[10px] font-mono w-12 shrink-0 text-right
                      ${msg.type === "user" ? "text-accent" : "text-text-dim"}`}>
                      {msg.type === "assistant" ? "claude" : msg.type}
                    </span>
                    <span className="text-[10px] font-mono text-text-dim w-12 shrink-0">
                      {formatTime(msg.timestamp)}
                    </span>
                    <p className="text-xs font-mono text-text-muted whitespace-pre-wrap break-all flex-1">
                      {msg.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Prompt input */}
          {session.isAlive && <SessionPrompt session={session} />}
        </div>
      )}
    </div>
  );
}

// --- Main ---

export function SessionsView() {
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions");
      if (res.ok) setSessions(await res.json());
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

  const aliveCount = sessions.filter((s) => s.isAlive).length;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-8 py-8">
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
          {sessions.map((session) => (
            <SessionRow
              key={`${session.pid}-${session.sessionId}`}
              session={session}
              onKill={() => handleKill(session.pid)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
