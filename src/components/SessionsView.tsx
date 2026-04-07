"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { ActiveSession } from "@/lib/sessionScanner";
import { Terminal, Eye, Plus, Clock, GitBranch, Bot, Skull, ExternalLink } from "lucide-react";
import { TerminalMirror } from "./TerminalMirror";
import { MiclawTerminal, disposeTerminal } from "./MiclawTerminal";
import type { MiclawSession } from "@/lib/miclawSessions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MiclawSessionWithStatus extends MiclawSession {
  alive: boolean;
  activity?: string;
  costUSD?: number;
  inputTokens?: number;
  outputTokens?: number;
}

type TabItem =
  | { type: "miclaw"; session: MiclawSessionWithStatus }
  | { type: "detected"; session: ActiveSession };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DETECTED_POLL_INTERVAL = 7000;
const MICLAW_POLL_INTERVAL = 3000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(startedAt: number): string {
  const ms = Date.now() - startedAt;
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m`;
}

function tabId(item: TabItem): string {
  return item.type === "miclaw" ? item.session.id : `detected-${item.session.pid}`;
}

function tabName(item: TabItem): string {
  if (item.type === "miclaw") {
    const s = item.session;
    return s.alive ? s.displayName : `${s.displayName} (idle)`;
  }
  const s = item.session;
  return s.title ?? s.name ?? s.projectName;
}

function isTabAlive(item: TabItem): boolean {
  return item.type === "miclaw" ? item.session.alive : item.session.isAlive;
}

function tabTurnState(item: TabItem): "idle" | "working" | "needs_input" {
  if (item.type === "detected") {
    return item.session.turnState;
  }
  if (item.type === "miclaw") {
    // MiClaw sessions: PTY activity is the most responsive signal
    if (item.session.activity === "producing_output") return "working";
  }
  return "idle";
}

function formatCost(usd: number): string {
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(2)}`;
  return `$${usd.toFixed(2)}`;
}

function formatTokens(n: number): string {
  if (n < 1000) return `${n}`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

// ---------------------------------------------------------------------------
// StatusDot
// ---------------------------------------------------------------------------

function StatusDot({ turnState, isAlive, size = "normal" }: {
  turnState: "idle" | "working" | "needs_input";
  isAlive: boolean;
  size?: "small" | "normal";
}) {
  const dim = size === "small" ? "w-2 h-2" : "w-2.5 h-2.5";
  if (!isAlive) return <span className={`${dim} rounded-full bg-text-dim inline-block shrink-0`} title="Dead" />;
  if (turnState === "needs_input") return <span className={`${dim} rounded-full bg-yellow-500 animate-pulse inline-block shrink-0`} title="Needs input" />;
  if (turnState === "working") return <span className={`${dim} rounded-full bg-cyan-400 animate-pulse inline-block shrink-0`} title="Working" />;
  return <span className={`${dim} rounded-full bg-green-500 inline-block shrink-0`} title="Idle" />;
}

// ---------------------------------------------------------------------------
// Tab button
// ---------------------------------------------------------------------------

function Tab({ item, active, index, onClick }: {
  item: TabItem;
  active: boolean;
  index: number;
  onClick: () => void;
}) {
  const alive = isTabAlive(item);
  const isMiclaw = item.type === "miclaw";

  return (
    <button
      onClick={onClick}
      title={`${tabName(item)}${index < 9 ? ` (Shift+Space ${index + 1})` : ""}`}
      className={[
        "flex items-center gap-2.5 px-4 py-3 text-sm font-mono whitespace-nowrap shrink-0 border-b-2 transition-colors",
        active
          ? "border-accent text-text bg-surface-raised/40"
          : "border-transparent hover:bg-surface-hover/30",
        alive ? "" : "opacity-40",
        isMiclaw ? "text-text" : "text-text-muted",
      ].join(" ")}
    >
      <StatusDot
        turnState={tabTurnState(item)}
        isAlive={alive}
        size="small"
      />
      {isMiclaw ? <Terminal size={13} /> : <Eye size={13} />}
      <span className="max-w-[180px] truncate">{tabName(item)}</span>
      {index < 9 && (
        <span className="text-[10px] text-text-dim/40 ml-0.5">{index + 1}</span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Detected session content (read-only)
// ---------------------------------------------------------------------------

function DetectedSessionContent({ session, onAdopt, onKill }: {
  session: ActiveSession;
  onAdopt: () => void;
  onKill: () => void;
}) {
  const shortPath = session.cwd.replace(/^\/Users\/[^/]+/, "~");

  return (
    <div className="flex flex-col h-full">
      {/* Top banner */}
      <div className="shrink-0 px-4 py-3 border-b border-border bg-surface-raised/30">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <StatusDot
              turnState={session.turnState}
              isAlive={session.isAlive}
            />
            <div className="min-w-0">
              <p className="text-sm font-mono font-medium text-text truncate">
                {session.title ?? session.name ?? session.projectName}
              </p>
              <div className="flex items-center gap-3 text-[11px] font-mono text-text-dim mt-0.5">
                <span>{shortPath}</span>
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
                {session.startedAt > 0 && (
                  <span className="flex items-center gap-1">
                    <Clock size={10} />
                    {formatDuration(session.startedAt)}
                  </span>
                )}
                <span>PID {session.pid}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {session.isAlive && (
              <button
                onClick={() => {
                  fetch("/api/sessions/focus", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ pid: session.pid }),
                  });
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-border text-xs font-mono text-text-muted hover:text-text hover:border-text-dim/30 transition-colors"
                title="Jump to Terminal.app (O)"
              >
                <ExternalLink size={12} />
                Terminal
              </button>
            )}
            {session.isAlive && (
              <button
                onClick={onAdopt}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-accent/10 border border-accent/30 text-xs font-mono text-accent hover:bg-accent/20 transition-colors"
                title="Adopt into MiClaw (a)"
              >
                <Terminal size={12} />
                Adopt
              </button>
            )}
            {session.isAlive && (
              <button
                onClick={onKill}
                className="p-1.5 rounded-sm text-text-dim hover:text-red-400 hover:bg-surface-hover transition-colors"
                title="Kill session (X)"
              >
                <Skull size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Needs input banner */}
        {session.isAlive && session.turnState === "needs_input" && (
          <div className="flex items-center gap-2 mt-2 py-1.5 px-3 rounded-sm bg-yellow-500/10 border border-yellow-500/20">
            <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse shrink-0" />
            <p className="text-[11px] font-mono text-yellow-500/80">
              {session.waitingFor
                ? `needs input: ${session.waitingFor}`
                : "Session needs input -- Adopt for interactive control"}
            </p>
          </div>
        )}

        {/* Read-only notice */}
        <p className="text-[10px] font-mono text-text-dim mt-2">
          Read-only mirror of a Terminal.app session. Adopt to get full interactive control.
        </p>
      </div>

      {/* Terminal mirror fills remaining space */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <TerminalMirror pid={session.pid} fillHeight />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MiClaw session content (interactive terminal)
// ---------------------------------------------------------------------------

function MiclawSessionContent({ session, onKill }: {
  session: MiclawSessionWithStatus;
  onKill: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Minimal top bar -- glassy look */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-white/[0.04] bg-white/[0.03] backdrop-blur-sm">
        <div className="flex items-center gap-3 text-[11px] font-mono text-text-dim">
          <StatusDot
            turnState={session.activity === "producing_output" ? "working" : "idle"}
            isAlive={session.alive}
            size="small"
          />
          <span className="text-text text-xs font-medium">{session.displayName}</span>
          <span>{session.cwd.replace(/^\/Users\/[^/]+/, "~")}</span>
          {session.created > 0 && (
            <span className="flex items-center gap-1">
              <Clock size={10} />
              {formatDuration(session.created)}
            </span>
          )}
          {session.costUSD != null && session.costUSD > 0 && (
            <span className="text-text-muted">{formatCost(session.costUSD)}</span>
          )}
          {session.inputTokens != null && session.inputTokens > 0 && (
            <span className="text-text-dim">
              {formatTokens(session.inputTokens)} in / {formatTokens(session.outputTokens ?? 0)} out
            </span>
          )}
          {session.claudeSessionId && (
            <span className="text-text-dim/50">{session.claudeSessionId}</span>
          )}
        </div>
        <button
          onClick={onKill}
          className="p-1.5 rounded-sm text-text-dim hover:text-red-400 hover:bg-surface-hover transition-colors"
          title="Kill session (X)"
        >
          <Skull size={14} />
        </button>
      </div>

      {/* Resume banner */}
      {!session.alive && (
        <div className="shrink-0 flex items-center gap-2 mx-4 mt-2 py-2 px-3 rounded-sm bg-accent/10 border border-accent/20">
          <span className="text-[11px] font-mono text-accent">Session will resume with --resume on connection</span>
        </div>
      )}

      {/* Terminal fills remaining space */}
      <div
        className="flex-1 min-h-0 overflow-hidden p-3"
        data-miclaw-session={session.id}
      >
        <MiclawTerminal
          sessionId={session.id}
          cwd={session.cwd}
          name={session.displayName}
          resumeId={!session.alive ? session.claudeSessionId : undefined}
          permissionMode={session.permissionMode}
          model={session.model}
          allowedTools={session.allowedTools}
          appendSystemPrompt={session.appendSystemPrompt}
          worktree={session.worktree}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// New Session form
// ---------------------------------------------------------------------------

function NewSessionForm({ onCreate, onCancel }: {
  onCreate: (name: string, cwd: string, opts?: {
    permissionMode?: string;
    model?: string;
    allowedTools?: string;
    appendSystemPrompt?: string;
    worktree?: boolean;
  }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [cwd, setCwd] = useState("~/Desktop");
  const [creating, setCreating] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [permissionMode, setPermissionMode] = useState("");
  const [model, setModel] = useState("");
  const [allowedTools, setAllowedTools] = useState("");
  const [appendSystemPrompt, setAppendSystemPrompt] = useState("");
  const [worktree, setWorktree] = useState(false);

  async function handleCreate() {
    setCreating(true);
    onCreate(name, cwd, {
      permissionMode: permissionMode || undefined,
      model: model || undefined,
      allowedTools: allowedTools || undefined,
      appendSystemPrompt: appendSystemPrompt || undefined,
      worktree: worktree || undefined,
    });
  }

  const inputClass = "w-full bg-transparent border border-border rounded-sm px-3 py-2 text-xs font-mono text-text placeholder:text-text-dim/40 outline-none focus:border-accent/40";
  const labelClass = "text-[10px] font-mono text-text-dim uppercase tracking-wider block mb-1";
  const selectClass = "w-full bg-transparent border border-border rounded-sm px-3 py-2 text-xs font-mono text-text outline-none focus:border-accent/40 [&>option]:bg-[#353430] [&>option]:text-text";

  return (
    <div className="flex items-center justify-center h-full">
      <div className="w-full max-w-md p-6 border border-border rounded-sm bg-surface-raised/50">
        <h2 className="text-sm font-mono font-medium text-text mb-4">New MiClaw Session</h2>
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Name (optional)</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-project"
              autoFocus
              className={inputClass}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") onCancel(); }}
            />
          </div>
          <div>
            <label className={labelClass}>Working Directory</label>
            <input
              value={cwd}
              onChange={(e) => setCwd(e.target.value)}
              placeholder="~/Desktop"
              className={inputClass}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") onCancel(); }}
            />
          </div>

          {/* Advanced Options */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-[10px] font-mono text-text-dim uppercase tracking-wider hover:text-accent transition-colors"
            >
              {showAdvanced ? "- Advanced Options" : "+ Advanced Options"}
            </button>
          </div>

          {showAdvanced && (
            <div className="space-y-3 pt-1 border-t border-border">
              <div>
                <label className={labelClass}>Permission Mode</label>
                <select
                  value={permissionMode}
                  onChange={(e) => setPermissionMode(e.target.value)}
                  className={selectClass}
                >
                  <option value="">default</option>
                  <option value="acceptEdits">acceptEdits</option>
                  <option value="plan">plan</option>
                  <option value="bypassPermissions">Dangerously Skip Permissions</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Model</label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className={selectClass}
                >
                  <option value="">sonnet (default)</option>
                  <option value="opus">opus</option>
                  <option value="haiku">haiku</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Allowed Tools</label>
                <input
                  value={allowedTools}
                  onChange={(e) => setAllowedTools(e.target.value)}
                  placeholder='Bash(git:*) Edit'
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Append System Prompt</label>
                <input
                  value={appendSystemPrompt}
                  onChange={(e) => setAppendSystemPrompt(e.target.value)}
                  placeholder="Additional instructions..."
                  className={inputClass}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="worktree-checkbox"
                  checked={worktree}
                  onChange={(e) => setWorktree(e.target.checked)}
                  className="accent-[#d97757]"
                />
                <label htmlFor="worktree-checkbox" className={labelClass + " mb-0"}>
                  Worktree (--worktree)
                </label>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex-1 px-4 py-2 rounded-sm bg-accent/10 border border-accent/30 text-xs font-mono text-accent hover:bg-accent/20 transition-colors disabled:opacity-40"
            >
              {creating ? "Launching..." : "Launch"}
            </button>
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-sm border border-border text-xs font-mono text-text-muted hover:text-text transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SessionsView() {
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [tmuxSessions, setTmuxSessions] = useState<MiclawSessionWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [commandMode, setCommandMode] = useState(false);

  // ---- Data fetching ----

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions");
      if (res.ok) {
        const data = await res.json();
        setSessions((prev) => {
          if (JSON.stringify(prev) === JSON.stringify(data)) return prev;
          return data;
        });
      }
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, []);

  const fetchTmuxSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/tmux/sessions");
      if (res.ok) {
        const data = await res.json();
        setTmuxSessions(data);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, DETECTED_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  useEffect(() => {
    fetchTmuxSessions();
    const interval = setInterval(fetchTmuxSessions, MICLAW_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchTmuxSessions]);

  // ---- Tab list ----

  const allTabs = useMemo<TabItem[]>(() => [
    ...tmuxSessions.map((s): TabItem => ({ type: "miclaw", session: s })),
    ...sessions.map((s): TabItem => ({ type: "detected", session: s })),
  ], [tmuxSessions, sessions]);

  const allTabsRef = useRef(allTabs);
  allTabsRef.current = allTabs;

  // Auto-select first tab if current selection is gone
  useEffect(() => {
    if (showNewForm) return;
    if (allTabs.length === 0) {
      setActiveTabId(null);
      return;
    }
    const exists = activeTabId && allTabs.some((t) => tabId(t) === activeTabId);
    if (!exists) {
      setActiveTabId(tabId(allTabs[0]));
    }
  }, [allTabs, activeTabId, showNewForm]);

  const activeTab = allTabs.find((t) => tabId(t) === activeTabId) ?? null;

  // ---- Actions ----

  async function handleKillDetected(pid: number) {
    if (!window.confirm(`Kill session with PID ${pid}?`)) return;
    try {
      await fetch("/api/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pid }),
      });
      fetchSessions();
    } catch { /* silent */ }
  }

  async function handleKillMiclaw(id: string) {
    if (!window.confirm("Kill MiClaw session?")) return;
    try {
      disposeTerminal(id);
      await fetch("/api/tmux/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      await fetchTmuxSessions();
    } catch { /* silent */ }
  }

  async function handleAdopt(detected: ActiveSession) {
    try {
      const res = await fetch("/api/tmux/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: detected.title ?? detected.name ?? detected.projectName,
          cwd: detected.cwd,
          resumeId: detected.sessionId,
        }),
      });
      if (res.ok) {
        const newSession = await res.json();
        await fetchTmuxSessions();
        // Kill original detected session
        await fetch("/api/sessions", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pid: detected.pid }),
        });
        await fetchSessions();
        // Switch to the new MiClaw tab
        if (newSession?.id) setActiveTabId(newSession.id);
      }
    } catch { /* silent */ }
  }

  async function handleCreateSession(name: string, cwd: string, opts?: {
    permissionMode?: string;
    model?: string;
    allowedTools?: string;
    appendSystemPrompt?: string;
    worktree?: boolean;
  }) {
    try {
      const res = await fetch("/api/tmux/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          cwd: cwd.trim() || undefined,
          permissionMode: opts?.permissionMode || undefined,
          model: opts?.model || undefined,
          allowedTools: opts?.allowedTools || undefined,
          appendSystemPrompt: opts?.appendSystemPrompt || undefined,
          worktree: opts?.worktree || undefined,
        }),
      });
      if (res.ok) {
        const newSession = await res.json();
        await fetchTmuxSessions();
        setShowNewForm(false);
        if (newSession?.id) setActiveTabId(newSession.id);
      }
    } catch { /* silent */ }
  }

  // ---- Command mode (Shift+Space leader key) ----

  function enterCommandMode() {
    setCommandMode(true);
  }

  function executeCommand(key: string) {
    if (key === "Escape" || key === "Enter") {
      setCommandMode(false);
      return;
    }

    const tabs = allTabsRef.current;
    const currentIdx = tabs.findIndex((t) => tabId(t) === activeTabId);
    const currentTab = currentIdx >= 0 ? tabs[currentIdx] : null;

    // Number keys 1-9 to jump to tab
    if (key >= "1" && key <= "9") {
      const idx = parseInt(key, 10) - 1;
      if (idx < tabs.length) {
        setShowNewForm(false);
        setActiveTabId(tabId(tabs[idx]));
      }
      return;
    }

    switch (key) {
      case "j":
      case "]": {
        if (tabs.length === 0) break;
        const next = currentIdx < tabs.length - 1 ? currentIdx + 1 : 0;
        setShowNewForm(false);
        setActiveTabId(tabId(tabs[next]));
        break;
      }
      case "k":
      case "[": {
        if (tabs.length === 0) break;
        const prev = currentIdx > 0 ? currentIdx - 1 : tabs.length - 1;
        setShowNewForm(false);
        setActiveTabId(tabId(tabs[prev]));
        break;
      }
      case "X": {
        if (currentTab?.type === "miclaw") handleKillMiclaw(currentTab.session.id);
        else if (currentTab?.type === "detected" && currentTab.session.isAlive) handleKillDetected(currentTab.session.pid);
        break;
      }
      case "O": {
        if (currentTab?.type === "detected" && currentTab.session.isAlive) {
          fetch("/api/sessions/focus", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pid: currentTab.session.pid }),
          });
        }
        break;
      }
      case "a": {
        if (currentTab?.type === "detected" && currentTab.session.isAlive) handleAdopt(currentTab.session);
        break;
      }
      case "n": {
        setShowNewForm(true);
        break;
      }
    }
  }

  // Listen for Shift+Space from xterm (custom event from MiclawTerminal)
  useEffect(() => {
    function onCommandMode() { enterCommandMode(); }
    window.addEventListener("miclaw:command-mode", onCommandMode);
    return () => window.removeEventListener("miclaw:command-mode", onCommandMode);
  }, []);

  // Global keyboard handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Command mode: capture the next key as a command
      if (commandMode) {
        e.preventDefault();
        e.stopPropagation();
        executeCommand(e.key);
        return;
      }

      const el = document.activeElement;
      const isInputFocused = el instanceof HTMLInputElement
        || el instanceof HTMLTextAreaElement
        || el?.closest(".cm-editor") !== null
        || el?.closest(".xterm") !== null;

      // Shift+Escape triggers command mode from anywhere
      if (e.key === "Escape" && e.shiftKey) {
        e.preventDefault();
        enterCommandMode();
        return;
      }

      // When input is focused, don't intercept anything else
      if (isInputFocused) return;

      // When NOT in a terminal/input, bare keys work directly (same commands)
      const tabs = allTabsRef.current;
      const currentIdx = tabs.findIndex((t) => tabId(t) === activeTabId);
      const currentTab = currentIdx >= 0 ? tabs[currentIdx] : null;

      if (e.key >= "1" && e.key <= "9") {
        const idx = parseInt(e.key, 10) - 1;
        if (idx < tabs.length) {
          e.preventDefault();
          setShowNewForm(false);
          setActiveTabId(tabId(tabs[idx]));
        }
        return;
      }

      switch (e.key) {
        case "]":
        case "j": {
          e.preventDefault();
          if (tabs.length === 0) break;
          const next = currentIdx < tabs.length - 1 ? currentIdx + 1 : 0;
          setShowNewForm(false);
          setActiveTabId(tabId(tabs[next]));
          break;
        }
        case "[":
        case "k": {
          e.preventDefault();
          if (tabs.length === 0) break;
          const prev = currentIdx > 0 ? currentIdx - 1 : tabs.length - 1;
          setShowNewForm(false);
          setActiveTabId(tabId(tabs[prev]));
          break;
        }
        case "i": {
          e.preventDefault();
          if (currentTab?.type === "miclaw") {
            const textarea = document.querySelector(`[data-miclaw-session="${currentTab.session.id}"] textarea`) as HTMLElement | null;
            textarea?.focus();
          }
          break;
        }
        case "X": {
          e.preventDefault();
          if (currentTab?.type === "miclaw") handleKillMiclaw(currentTab.session.id);
          else if (currentTab?.type === "detected" && currentTab.session.isAlive) handleKillDetected(currentTab.session.pid);
          break;
        }
        case "O": {
          e.preventDefault();
          if (currentTab?.type === "detected" && currentTab.session.isAlive) {
            fetch("/api/sessions/focus", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ pid: currentTab.session.pid }),
            });
          }
          break;
        }
        case "a": {
          e.preventDefault();
          if (currentTab?.type === "detected" && currentTab.session.isAlive) handleAdopt(currentTab.session);
          break;
        }
        case "n": {
          e.preventDefault();
          setShowNewForm(true);
          break;
        }
        case "Escape": {
          e.preventDefault();
          if (showNewForm) setShowNewForm(false);
          break;
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId, showNewForm, commandMode]);

  // ---- Render ----

  const miclawTabs = allTabs.filter((t) => t.type === "miclaw");
  const detectedTabs = allTabs.filter((t) => t.type === "detected");
  const aliveMiclaw = miclawTabs.filter((t) => isTabAlive(t)).length;
  const aliveDetected = detectedTabs.filter((t) => isTabAlive(t)).length;

  return (
    <div className="flex flex-col h-full relative">
      {/* Tab bar */}
      <div className="shrink-0 border-b border-border bg-surface/80 backdrop-blur-sm">
        <div className="flex items-center">
          <div className="flex items-center overflow-x-auto scrollbar-hide flex-1">
            {/* MiClaw tabs */}
            {miclawTabs.map((item, i) => (
              <Tab
                key={tabId(item)}
                item={item}
                active={!showNewForm && tabId(item) === activeTabId}
                index={i}
                onClick={() => { setShowNewForm(false); setActiveTabId(tabId(item)); }}
              />
            ))}

            {/* Separator between groups (only if both exist) */}
            {miclawTabs.length > 0 && detectedTabs.length > 0 && (
              <div className="h-6 border-r border-border mx-2 shrink-0" />
            )}

            {/* Detected tabs */}
            {detectedTabs.map((item, i) => (
              <Tab
                key={tabId(item)}
                item={item}
                active={!showNewForm && tabId(item) === activeTabId}
                index={miclawTabs.length + i}
                onClick={() => { setShowNewForm(false); setActiveTabId(tabId(item)); }}
              />
            ))}
          </div>

          {/* Right side: counts + new button */}
          <div className="flex items-center gap-3 px-3 shrink-0 border-l border-border">
            <span className="text-[10px] font-mono text-text-dim">
              {loading
                ? "..."
                : `${aliveMiclaw + aliveDetected} active`}
            </span>
            <button
              onClick={() => setShowNewForm(true)}
              className={[
                "flex items-center gap-1 px-2 py-1.5 rounded-sm text-xs font-mono transition-colors",
                showNewForm
                  ? "text-accent border border-accent/30 bg-accent/10"
                  : "text-text-muted hover:text-accent border border-transparent hover:border-accent/20",
              ].join(" ")}
              title="New session (n)"
            >
              <Plus size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {showNewForm ? (
          <NewSessionForm
            onCreate={handleCreateSession}
            onCancel={() => setShowNewForm(false)}
          />
        ) : activeTab?.type === "miclaw" ? (
          <MiclawSessionContent
            key={activeTab.session.id}
            session={activeTab.session}
            onKill={() => handleKillMiclaw(activeTab.session.id)}
          />
        ) : activeTab?.type === "detected" ? (
          <DetectedSessionContent
            key={activeTab.session.pid}
            session={activeTab.session}
            onAdopt={() => handleAdopt(activeTab.session)}
            onKill={() => handleKillDetected(activeTab.session.pid)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <p className="text-sm font-mono text-text-dim">
              {loading ? "Scanning sessions..." : "No sessions detected"}
            </p>
            {!loading && (
              <button
                onClick={() => setShowNewForm(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-sm bg-accent/10 border border-accent/30 text-xs font-mono text-accent hover:bg-accent/20 transition-colors"
              >
                <Plus size={12} />
                New Session
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bottom bar: command mode or hint */}
      <div className={[
        "shrink-0 border-t px-4 py-2 transition-colors",
        commandMode
          ? "border-accent/40 bg-accent/5"
          : "border-border bg-surface/80",
      ].join(" ")}>
        {commandMode ? (
          <div className="flex items-center gap-6 text-[11px] font-mono">
            <span className="text-accent font-medium shrink-0">COMMAND</span>
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-text-muted"><span className="text-text">1-9</span> tab</span>
              <span className="text-text-muted"><span className="text-text">j/k</span> cycle</span>
              <span className="text-text-muted"><span className="text-text">n</span> new</span>
              <span className="text-text-muted"><span className="text-text">a</span> adopt</span>
              <span className="text-text-muted"><span className="text-text">X</span> kill</span>
              <span className="text-text-muted"><span className="text-text">O</span> terminal</span>
            </div>
            <span className="text-text-dim ml-auto shrink-0">Esc to exit</span>
          </div>
        ) : (
          <p className="text-[10px] font-mono text-text-dim text-center">
            Shift+Esc for command mode
          </p>
        )}
      </div>
    </div>
  );
}
