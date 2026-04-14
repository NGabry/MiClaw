"use client";

import { useState, useCallback, useRef, useMemo, memo } from "react";
import { Terminal, Eye, Plus, Clock, GitBranch, Bot, Skull, ExternalLink, Columns2, Rows2, X } from "lucide-react";
import { TerminalMirror } from "./TerminalMirror";
import { MiclawTerminal } from "./MiclawTerminal";
import { usePaneContext, type TabItem, type MiclawSessionWithStatus } from "@/lib/paneContext";
import type { LeafPane } from "@/lib/paneTypes";
import type { ActiveSession } from "@/lib/sessionScanner";

// ---------------------------------------------------------------------------
// Helpers (shared with SessionsView)
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

export function tabId(item: TabItem): string {
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
  if (item.type === "detected") return item.session.turnState;
  // PTY actively producing output is the strongest signal
  if (item.type === "miclaw" && item.session.activity === "producing_output") return "working";
  // Fall back to JSONL-based turn state (survives thinking pauses where PTY is silent)
  if (item.type === "miclaw" && item.session.turnState) return item.session.turnState;
  return "idle";
}

function formatCost(usd: number): string {
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
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

const DRAG_MIME = "application/x-miclaw-tab";

function TabButton({ item, active, selected, index, paneId, selectedTabIds, onClick, onMultiClick }: {
  item: TabItem;
  active: boolean;
  selected: boolean;
  index: number;
  paneId: string;
  selectedTabIds: string[];
  onClick: () => void;
  onMultiClick: (e: React.MouseEvent) => void;
}) {
  const alive = isTabAlive(item);
  const isMiclaw = item.type === "miclaw";
  const tid = tabId(item);

  function onDragStart(e: React.DragEvent) {
    e.dataTransfer.effectAllowed = "move";
    // Include all selected tabs if this tab is part of the selection
    const extraIds = selected ? selectedTabIds.filter((id) => id !== tid) : [];
    e.dataTransfer.setData(DRAG_MIME, JSON.stringify({ tabId: tid, paneId, extraTabIds: extraIds }));
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "0.4";
    }
  }

  function onDragEnd(e: React.DragEvent) {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "";
    }
  }

  return (
    <button
      draggable
      onClick={(e) => {
        if (e.shiftKey || e.metaKey) {
          onMultiClick(e);
        } else {
          onClick();
        }
      }}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      title={`${tabName(item)}${index < 9 ? ` (${index + 1})` : ""}${"\n"}Shift+click to multi-select`}
      className={[
        "flex items-center gap-2 px-3 py-2 text-xs font-mono whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-grab active:cursor-grabbing",
        active
          ? "border-accent text-text bg-surface-raised/40"
          : selected
            ? "border-accent/40 text-text bg-accent/10"
            : "border-transparent hover:bg-surface-hover/30",
        alive ? "" : "opacity-40",
        isMiclaw ? "text-text" : "text-text-muted",
      ].join(" ")}
    >
      <StatusDot turnState={tabTurnState(item)} isAlive={alive} size="small" />
      {isMiclaw ? <Terminal size={12} /> : <Eye size={12} />}
      <span className="max-w-[140px] truncate">{tabName(item)}</span>
      {index < 9 && (
        <span className="text-[10px] text-text-dim/40 ml-0.5">{index + 1}</span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// DetectedSessionContent (read-only)
// ---------------------------------------------------------------------------

function DetectedSessionContent({ session, onAdopt, onKill }: {
  session: ActiveSession;
  onAdopt: () => void;
  onKill: () => void;
}) {
  const shortPath = session.cwd.replace(/^\/Users\/[^/]+/, "~");

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-4 py-3 border-b border-border bg-surface-raised/30">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <StatusDot turnState={session.turnState} isAlive={session.isAlive} />
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
                {session.costUSD != null && session.costUSD > 0 && (
                  <span className="text-text-muted">{formatCost(session.costUSD)}</span>
                )}
                {session.inputTokens != null && session.inputTokens > 0 && (
                  <span>{formatTokens(session.inputTokens)} in / {formatTokens(session.outputTokens ?? 0)} out</span>
                )}
                {session.contextTokens != null && session.contextTokens > 0 && (
                  <span className="text-text-muted" title="Active context window size">ctx {formatTokens(session.contextTokens)}</span>
                )}
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
        <p className="text-[10px] font-mono text-text-dim mt-2">
          Read-only mirror of a Terminal.app session. Adopt to get full interactive control.
        </p>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        <TerminalMirror pid={session.pid} fillHeight />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MiclawSessionContent (interactive terminal)
// ---------------------------------------------------------------------------

// Memoized terminal wrapper -- only re-renders when the session ID changes,
// NOT when volatile data (cost, tokens, activity) updates from polling.
// This prevents the terminal from losing focus during status bar updates.
const StableTerminal = memo(function StableTerminal({ session }: {
  session: MiclawSessionWithStatus;
}) {
  return (
    <div
      className="flex-1 min-h-0 overflow-hidden p-3"
      data-miclaw-session={session.id}
    >
      <MiclawTerminal
        sessionId={session.id}
        cwd={session.cwd}
        name={session.displayName}
        resumeId={session.claudeSessionId}
        killPid={session.killPid}
        permissionMode={session.permissionMode}
        model={session.model}
        allowedTools={session.allowedTools}
        appendSystemPrompt={session.appendSystemPrompt}
        worktree={session.worktree}
      />
    </div>
  );
}, (prev, next) => prev.session.id === next.session.id);

function MiclawSessionContent({ session, onKill }: {
  session: MiclawSessionWithStatus;
  onKill: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-white/[0.04] bg-white/[0.03] backdrop-blur-sm">
        <div className="flex items-center gap-3 text-[11px] font-mono text-text-dim">
          <StatusDot
            turnState={session.activity === "producing_output" ? "working" : (session.turnState ?? "idle")}
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
          {session.contextTokens != null && session.contextTokens > 0 && (
            <span className="text-text-muted" title="Active context window size">
              ctx {formatTokens(session.contextTokens)}
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
      {!session.alive && (
        <div className="shrink-0 flex items-center gap-2 mx-4 mt-2 py-2 px-3 rounded-sm bg-accent/10 border border-accent/20">
          <span className="text-[11px] font-mono text-accent">Session will resume with --resume on connection</span>
        </div>
      )}
      <StableTerminal session={session} />
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

  function handleCreate() {
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
// Edge drop zone overlay
// ---------------------------------------------------------------------------

type Edge = "left" | "right" | "top" | "bottom";

function EdgeDropZone({ edge, onDrop, visible }: {
  edge: Edge;
  onDrop: (tabId: string, fromPaneId: string, extraTabIds?: string[]) => void;
  visible: boolean;
}) {
  const [hovering, setHovering] = useState(false);

  const positionStyle: React.CSSProperties = {
    position: "absolute",
    zIndex: 20,
    ...(edge === "left" && { left: 0, top: 0, bottom: 0, width: "48px" }),
    ...(edge === "right" && { right: 0, top: 0, bottom: 0, width: "48px" }),
    ...(edge === "top" && { left: 0, right: 0, top: 0, height: "48px" }),
    ...(edge === "bottom" && { left: 0, right: 0, bottom: 0, height: "48px" }),
  };

  if (!visible) return null;

  return (
    <div
      style={positionStyle}
      className={[
        "transition-colors pointer-events-auto",
        hovering ? "bg-accent/20 border-accent/40" : "bg-transparent",
        edge === "left" ? "border-r-2" : "",
        edge === "right" ? "border-l-2" : "",
        edge === "top" ? "border-b-2" : "",
        edge === "bottom" ? "border-t-2" : "",
        hovering ? "" : "border-transparent",
      ].join(" ")}
      onDragEnter={(e) => { e.preventDefault(); setHovering(true); }}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
      onDragLeave={() => setHovering(false)}
      onDrop={(e) => {
        e.preventDefault();
        setHovering(false);
        try {
          const data = JSON.parse(e.dataTransfer.getData(DRAG_MIME));
          const extras: string[] = data.extraTabIds ?? [];
          onDrop(data.tabId, data.paneId, extras.length > 0 ? extras : undefined);
        } catch { /* invalid drag data */ }
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// PaneLeaf
// ---------------------------------------------------------------------------

interface PaneLeafProps {
  pane: LeafPane;
}

export function PaneLeaf({ pane }: PaneLeafProps) {
  const ctx = usePaneContext();
  const {
    allTabs,
    focusedPaneId,
    totalPaneCount,
    splitPane,
    closePane,
    focusPane,
    setActiveTab,
    reorderTabs,
    moveTabToPane,
    dropTabOnEdge,
    handleKillDetected,
    handleKillMiclaw,
    handleAdopt,
    handleCreateSession,
    showNewForm,
    setShowNewForm,
  } = ctx;

  const isFocused = focusedPaneId === pane.id;
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [selectedTabIds, setSelectedTabIds] = useState<string[]>([]);
  const dragOverRef = useRef<string | null>(null);

  // Filter tabs for this pane
  const paneTabs = useMemo(() => {
    const ordered: TabItem[] = [];
    for (const tid of pane.tabIds) {
      const tab = allTabs.find((t) => tabId(t) === tid);
      if (tab) ordered.push(tab);
    }
    return ordered;
  }, [pane.tabIds, allTabs]);

  const activeTab = paneTabs.find((t) => tabId(t) === pane.activeTabId) ?? null;
  const isNewForm = showNewForm(pane.id);

  // Tab bar drop handler (reorder or receive from another pane)
  const handleTabBarDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    try {
      const data = JSON.parse(e.dataTransfer.getData(DRAG_MIME));
      const extras: string[] = data.extraTabIds ?? [];
      const allDragged = new Set([data.tabId, ...extras]);
      if (data.paneId === pane.id) {
        // Intra-pane reorder: move dragged tabs to the end
        const newOrder = pane.tabIds.filter((id) => !allDragged.has(id));
        newOrder.push(data.tabId, ...extras);
        reorderTabs(pane.id, newOrder);
      } else {
        // Cross-pane move
        moveTabToPane(data.tabId, data.paneId, pane.id, extras.length > 0 ? extras : undefined);
      }
      setSelectedTabIds([]);
    } catch { /* invalid */ }
  }, [pane.id, pane.tabIds, reorderTabs, moveTabToPane]);

  // Tab bar drag-and-drop reorder
  const handleTabDragOver = useCallback((e: React.DragEvent, targetTabId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    dragOverRef.current = targetTabId;
  }, []);

  const handleTabDrop = useCallback((e: React.DragEvent, targetTabId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    try {
      const data = JSON.parse(e.dataTransfer.getData(DRAG_MIME));
      const extras: string[] = data.extraTabIds ?? [];
      const allDragged = new Set([data.tabId, ...extras]);
      if (data.paneId === pane.id) {
        // Intra-pane reorder
        const ids = pane.tabIds.filter((id) => !allDragged.has(id));
        const toIdx = ids.indexOf(targetTabId);
        if (toIdx >= 0) {
          ids.splice(toIdx, 0, data.tabId, ...extras);
        } else {
          ids.push(data.tabId, ...extras);
        }
        reorderTabs(pane.id, ids);
      } else {
        // Cross-pane: move to target pane
        moveTabToPane(data.tabId, data.paneId, pane.id, extras.length > 0 ? extras : undefined);
      }
      setSelectedTabIds([]);
    } catch { /* invalid */ }
  }, [pane.id, pane.tabIds, reorderTabs, moveTabToPane]);

  return (
    <div
      className={`flex flex-col h-full w-full relative overflow-hidden border transition-[border-color,box-shadow] duration-200 ${
        isFocused
          ? "border-accent/50 shadow-[inset_0_0_0_1px_rgba(217,119,87,0.15),0_0_12px_rgba(217,119,87,0.1)]"
          : "border-border"
      }`}
      onMouseDown={() => {
        focusPane(pane.id);
      }}
      onDragOver={(e) => {
        // Only react to miclaw tab drags (not file drops etc.)
        if (e.dataTransfer.types.includes(DRAG_MIME)) {
          e.preventDefault();
          setIsDraggingOver(true);
        }
      }}
      onDragLeave={(e) => {
        // Only clear if we're leaving the pane entirely (not entering a child)
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsDraggingOver(false);
        }
      }}
      onDragEnd={() => setIsDraggingOver(false)}
    >
      {/* Focus indicator */}
      <div className={`h-[2px] shrink-0 transition-colors ${isFocused ? "bg-accent" : "bg-transparent"}`} />

      {/* Tab bar */}
      <div
        className="shrink-0 border-b border-border bg-surface/80 backdrop-blur-sm"
        onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={handleTabBarDrop}
      >
        <div className="flex items-center">
          <div className={[
            "flex items-center overflow-x-auto scrollbar-hide flex-1",
            isDraggingOver ? "bg-accent/5" : "",
          ].join(" ")}>
            {paneTabs.map((item, i) => {
              const tid = tabId(item);
              return (
                <div
                  key={tid}
                  onDragOver={(e) => handleTabDragOver(e, tid)}
                  onDrop={(e) => handleTabDrop(e, tid)}
                >
                  <TabButton
                    item={item}
                    active={!isNewForm && tid === pane.activeTabId}
                    selected={selectedTabIds.includes(tid)}
                    index={i}
                    paneId={pane.id}
                    selectedTabIds={selectedTabIds}
                    onClick={() => {
                      setSelectedTabIds([]);
                      setShowNewForm(pane.id, false);
                      setActiveTab(pane.id, tid);
                      focusPane(pane.id);
                    }}
                    onMultiClick={() => {
                      setSelectedTabIds((prev) =>
                        prev.includes(tid)
                          ? prev.filter((id) => id !== tid)
                          : [...prev, tid],
                      );
                      focusPane(pane.id);
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* Right side: split buttons, new, close */}
          <div className="flex items-center gap-1 px-2 shrink-0 border-l border-border">
            <button
              onClick={() => splitPane(pane.id, "horizontal")}
              className="p-1.5 rounded-sm text-text-dim hover:text-accent transition-colors"
              title="Split right"
            >
              <Columns2 size={12} />
            </button>
            <button
              onClick={() => splitPane(pane.id, "vertical")}
              className="p-1.5 rounded-sm text-text-dim hover:text-accent transition-colors"
              title="Split down"
            >
              <Rows2 size={12} />
            </button>
            <button
              onClick={() => setShowNewForm(pane.id, true)}
              className={[
                "p-1.5 rounded-sm transition-colors",
                isNewForm ? "text-accent" : "text-text-dim hover:text-accent",
              ].join(" ")}
              title="New session"
            >
              <Plus size={12} />
            </button>
            {totalPaneCount > 1 && (
              <button
                onClick={() => closePane(pane.id)}
                className="p-1.5 rounded-sm text-text-dim hover:text-red-400 transition-colors"
                title="Close pane"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        {isNewForm ? (
          <NewSessionForm
            onCreate={handleCreateSession}
            onCancel={() => setShowNewForm(pane.id, false)}
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
            <p className="text-sm font-mono text-text-dim">No sessions in this pane</p>
            <button
              onClick={() => setShowNewForm(pane.id, true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-sm bg-accent/10 border border-accent/30 text-xs font-mono text-accent hover:bg-accent/20 transition-colors"
            >
              <Plus size={12} />
              New Session
            </button>
          </div>
        )}

        {/* Edge drop zones for drag-to-split */}
        <EdgeDropZone
          edge="left"
          visible={isDraggingOver}
          onDrop={(tid, fromPid, extras) => dropTabOnEdge(tid, fromPid, pane.id, "left", extras)}
        />
        <EdgeDropZone
          edge="right"
          visible={isDraggingOver}
          onDrop={(tid, fromPid, extras) => dropTabOnEdge(tid, fromPid, pane.id, "right", extras)}
        />
        <EdgeDropZone
          edge="top"
          visible={isDraggingOver}
          onDrop={(tid, fromPid, extras) => dropTabOnEdge(tid, fromPid, pane.id, "top", extras)}
        />
        <EdgeDropZone
          edge="bottom"
          visible={isDraggingOver}
          onDrop={(tid, fromPid, extras) => dropTabOnEdge(tid, fromPid, pane.id, "bottom", extras)}
        />
      </div>
    </div>
  );
}
