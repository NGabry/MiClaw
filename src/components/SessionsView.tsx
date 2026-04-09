"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { ActiveSession } from "@/lib/sessionScanner";
import { disposeTerminal } from "./MiclawTerminal";
import type { PaneLayout } from "@/lib/paneTypes";
import {
  collectLeaves,
  defaultLayout,
  loadLayout,
  reconcileTabs,
  saveLayout,
  splitLeaf,
  removeLeaf,
  moveTab,
  updateRatio,
  findLeaf,
} from "@/lib/paneUtils";
import { PaneCtx, type PaneContextValue, type TabItem, type MiclawSessionWithStatus } from "@/lib/paneContext";
import { PaneTree } from "./PaneTree";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DETECTED_POLL_INTERVAL = 7000;
const MICLAW_POLL_INTERVAL = 3000;
const SAVE_DEBOUNCE_MS = 300;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tabIdFromItem(item: TabItem): string {
  return item.type === "miclaw" ? item.session.id : `detected-${item.session.pid}`;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface HealthIssue {
  key: string;
  message: string;
}

export function SessionsView() {
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [tmuxSessions, setTmuxSessions] = useState<MiclawSessionWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [paneLayout, setPaneLayout] = useState<PaneLayout | null>(null);
  const [commandMode, setCommandMode] = useState(false);
  const [newFormPanes, setNewFormPanes] = useState<Set<string>>(new Set());
  const [healthIssues, setHealthIssues] = useState<HealthIssue[]>([]);
  const [healthDismissed, setHealthDismissed] = useState(false);

  // Debounced save to localStorage
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistLayout = useCallback((layout: PaneLayout) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveLayout(layout), SAVE_DEBOUNCE_MS);
  }, []);

  // Wrapper that sets state and triggers persistence
  const updateLayout = useCallback((layout: PaneLayout) => {
    setPaneLayout(layout);
    persistLayout(layout);
  }, [persistLayout]);

  // Mutable ref for async functions that need the latest layout after awaits
  const paneLayoutRef = useRef(paneLayout);
  paneLayoutRef.current = paneLayout;

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

  // ---- Health check on mount ----

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((data) => {
        const issues: HealthIssue[] = [];
        if (!data.claude?.ok) {
          issues.push({
            key: "claude",
            message: data.claude?.error || "Claude CLI not found. Install: npm install -g @anthropic-ai/claude-code",
          });
        }
        if (!data.nodePty?.ok) {
          issues.push({
            key: "nodePty",
            message: data.nodePty?.error || "node-pty issue detected. Try: bun install",
          });
        }
        if (!data.nodeVersion?.ok) {
          issues.push({
            key: "nodeVersion",
            message: data.nodeVersion?.error || "Node.js 20+ required",
          });
        }
        setHealthIssues(issues);
      })
      .catch(() => {}); // Health endpoint unavailable, skip
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

  const allTabIds = useMemo(() => allTabs.map(tabIdFromItem), [allTabs]);

  // ---- Initialize layout from localStorage or default ----

  useEffect(() => {
    if (paneLayout !== null) return;
    const saved = loadLayout();
    if (saved) {
      setPaneLayout(saved);
    } else {
      setPaneLayout(defaultLayout(allTabIds));
    }
  }, [allTabIds, paneLayout]);

  // ---- Reconcile tabs whenever allTabIds changes ----

  useEffect(() => {
    if (!paneLayout) return;
    const reconciled = reconcileTabs(paneLayout, allTabIds);
    // Only update if something actually changed
    if (JSON.stringify(reconciled) !== JSON.stringify(paneLayout)) {
      updateLayout(reconciled);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allTabIds]);

  // ---- Pane count ----

  const totalPaneCount = useMemo(
    () => (paneLayout ? collectLeaves(paneLayout.root).length : 1),
    [paneLayout],
  );

  // Keep a ref of sorted leaves for keyboard nav
  const leavesRef = useRef<ReturnType<typeof collectLeaves>>([]);
  useEffect(() => {
    if (paneLayout) leavesRef.current = collectLeaves(paneLayout.root);
  }, [paneLayout]);

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
      // 1. Create the MiClaw session with killPid so the PTY server kills the
      //    detected process right before spawning `claude --resume`. This ensures
      //    the sessions-index.json entry still exists when --resume looks it up.
      const res = await fetch("/api/tmux/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: detected.title ?? detected.name ?? detected.projectName,
          cwd: detected.cwd,
          resumeId: detected.sessionId,
          killPid: detected.pid,
        }),
      });
      if (!res.ok) return;
      const newSession = await res.json();
      const newTabId = newSession.id as string;

      // 2. Refresh both lists so reconcileTabs sees the new MiClaw tab.
      //    The detected session may still appear briefly until the PTY server
      //    kills it; the next poll cycle will clean it up.
      await Promise.all([fetchTmuxSessions(), fetchSessions()]);

      // 3. Switch the focused pane to the newly adopted session tab.
      const layout = paneLayoutRef.current;
      if (layout) {
        const focusedId = layout.focusedPaneId;
        function setTab(node: import("@/lib/paneTypes").PaneNode): import("@/lib/paneTypes").PaneNode {
          if (node.type === "leaf" && node.id === focusedId) {
            return { ...node, activeTabId: newTabId };
          }
          if (node.type === "split") {
            return { ...node, children: [setTab(node.children[0]), setTab(node.children[1])] };
          }
          return node;
        }
        updateLayout({ root: setTab(layout.root), focusedPaneId: focusedId });
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
        const newTabId = newSession.id as string;
        await fetchTmuxSessions();
        // Close new form for all panes
        setNewFormPanes(new Set());
        // Switch the focused pane to the newly created session tab
        const layout = paneLayoutRef.current;
        if (layout) {
          const focusedId = layout.focusedPaneId;
          function setTab(node: import("@/lib/paneTypes").PaneNode): import("@/lib/paneTypes").PaneNode {
            if (node.type === "leaf" && node.id === focusedId) {
              return { ...node, activeTabId: newTabId };
            }
            if (node.type === "split") {
              return { ...node, children: [setTab(node.children[0]), setTab(node.children[1])] };
            }
            return node;
          }
          updateLayout({ root: setTab(layout.root), focusedPaneId: focusedId });
        }
      }
    } catch { /* silent */ }
  }

  // ---- Layout mutation callbacks ----

  const splitPane = useCallback((paneId: string, direction: "horizontal" | "vertical") => {
    if (!paneLayout) return;
    updateLayout(splitLeaf(paneLayout, paneId, direction));
  }, [paneLayout, updateLayout]);

  const closePane = useCallback((paneId: string) => {
    if (!paneLayout) return;
    const result = removeLeaf(paneLayout, paneId);
    if (result) updateLayout(result);
  }, [paneLayout, updateLayout]);

  const focusPane = useCallback((paneId: string) => {
    if (!paneLayout || paneLayout.focusedPaneId === paneId) return;
    updateLayout({ ...paneLayout, focusedPaneId: paneId });
  }, [paneLayout, updateLayout]);

  const setActiveTab = useCallback((paneId: string, tabId: string) => {
    if (!paneLayout) return;
    // Use mapNode-like approach via a fresh object
    function updateNode(node: import("@/lib/paneTypes").PaneNode): import("@/lib/paneTypes").PaneNode {
      if (node.type === "leaf" && node.id === paneId) {
        return { ...node, activeTabId: tabId };
      }
      if (node.type === "split") {
        return {
          ...node,
          children: [updateNode(node.children[0]), updateNode(node.children[1])],
        };
      }
      return node;
    }
    updateLayout({ root: updateNode(paneLayout.root), focusedPaneId: paneLayout.focusedPaneId });
  }, [paneLayout, updateLayout]);

  const reorderTabs = useCallback((paneId: string, tabIds: string[]) => {
    if (!paneLayout) return;
    function updateNode(node: import("@/lib/paneTypes").PaneNode): import("@/lib/paneTypes").PaneNode {
      if (node.type === "leaf" && node.id === paneId) {
        return { ...node, tabIds };
      }
      if (node.type === "split") {
        return {
          ...node,
          children: [updateNode(node.children[0]), updateNode(node.children[1])],
        };
      }
      return node;
    }
    updateLayout({ root: updateNode(paneLayout.root), focusedPaneId: paneLayout.focusedPaneId });
  }, [paneLayout, updateLayout]);

  const moveTabToPane = useCallback((tabId: string, fromPaneId: string, toPaneId: string) => {
    if (!paneLayout) return;
    updateLayout(moveTab(paneLayout, tabId, fromPaneId, toPaneId));
  }, [paneLayout, updateLayout]);

  const dropTabOnEdge = useCallback((
    tabId: string,
    fromPaneId: string,
    toPaneId: string,
    edge: "left" | "right" | "top" | "bottom",
  ) => {
    if (!paneLayout) return;
    // Split the target pane in the appropriate direction
    const direction = (edge === "left" || edge === "right") ? "horizontal" : "vertical";
    let newLayout = splitLeaf(paneLayout, toPaneId, direction);

    // Find the two new leaves from the split
    const newLeaves = collectLeaves(newLayout.root);
    // The split creates [original, newLeaf]. The original keeps its id.
    const newLeaf = newLeaves.find((l) => l.id !== toPaneId && !leavesRef.current.some((ol) => ol.id === l.id));

    if (!newLeaf) return;

    // Move the tab to the new leaf
    newLayout = moveTab(newLayout, tabId, fromPaneId, newLeaf.id);

    // If edge is "left" or "top", we need to swap the children in the parent split
    if (edge === "left" || edge === "top") {
      function swapChildren(node: import("@/lib/paneTypes").PaneNode): import("@/lib/paneTypes").PaneNode {
        if (node.type === "split") {
          // Check if one of the direct children contains our new leaf
          const leftLeaves = collectLeaves(node.children[0]);
          const rightLeaves = collectLeaves(node.children[1]);
          const newInLeft = leftLeaves.some((l) => l.id === newLeaf!.id);
          const origInRight = rightLeaves.some((l) => l.id === toPaneId);
          if (newInLeft && origInRight) {
            // Already in correct position (new is first), no swap needed
            return node;
          }
          const origInLeft = leftLeaves.some((l) => l.id === toPaneId);
          const newInRight = rightLeaves.some((l) => l.id === newLeaf!.id);
          if (origInLeft && newInRight) {
            return { ...node, children: [node.children[1], node.children[0]] };
          }
          return {
            ...node,
            children: [swapChildren(node.children[0]), swapChildren(node.children[1])],
          };
        }
        return node;
      }
      newLayout = { ...newLayout, root: swapChildren(newLayout.root) };
    }

    updateLayout(newLayout);
  }, [paneLayout, updateLayout]);

  const updateSplitRatio = useCallback((splitId: string, ratio: number) => {
    if (!paneLayout) return;
    updateLayout(updateRatio(paneLayout, splitId, ratio));
  }, [paneLayout, updateLayout]);

  // ---- New form state (per-pane) ----

  const showNewFormFn = useCallback((paneId: string) => newFormPanes.has(paneId), [newFormPanes]);
  const setShowNewFormFn = useCallback((paneId: string, show: boolean) => {
    setNewFormPanes((prev) => {
      const next = new Set(prev);
      if (show) next.add(paneId);
      else next.delete(paneId);
      return next;
    });
  }, []);

  // ---- Command mode (Shift+Space leader key) ----

  function enterCommandMode() {
    setCommandMode(true);
  }

  const allTabsRef = useRef(allTabs);
  allTabsRef.current = allTabs;

  function executeCommand(key: string) {
    if (key === "Escape" || key === "Enter") {
      setCommandMode(false);
      // Focus the terminal in the selected pane so keystrokes go there
      if (key === "Enter") {
        const layout = paneLayoutRef.current;
        if (layout) {
          const leaf = findLeaf(layout.root, layout.focusedPaneId);
          if (leaf?.activeTabId) {
            // Find the terminal textarea in the active session's container
            const el = document.querySelector(
              `[data-miclaw-session="${leaf.activeTabId}"] textarea`,
            ) as HTMLElement | null;
            el?.focus();
          }
        }
      }
      return;
    }

    // Read from refs to always get fresh state -- useCallback wrappers
    // go stale between rapid keystrokes in command mode.
    const layout = paneLayoutRef.current;
    if (!layout) return;

    const focusedLeaf = findLeaf(layout.root, layout.focusedPaneId);
    if (!focusedLeaf) return;

    const paneTabs = allTabsRef.current.filter(
      (t) => focusedLeaf.tabIds.includes(tabIdFromItem(t)),
    );
    const currentIdx = paneTabs.findIndex(
      (t) => tabIdFromItem(t) === focusedLeaf.activeTabId,
    );
    const currentTab = currentIdx >= 0 ? paneTabs[currentIdx] : null;

    // Helper: directly update layout from ref (avoids stale closures)
    function commitLayout(newLayout: PaneLayout) {
      setPaneLayout(newLayout);
      paneLayoutRef.current = newLayout;
      persistLayout(newLayout);
    }

    function setTab(paneId: string, tabId: string) {
      function updateNode(node: import("@/lib/paneTypes").PaneNode): import("@/lib/paneTypes").PaneNode {
        if (node.type === "leaf" && node.id === paneId) return { ...node, activeTabId: tabId };
        if (node.type === "split") return { ...node, children: [updateNode(node.children[0]), updateNode(node.children[1])] };
        return node;
      }
      const l = paneLayoutRef.current!;
      commitLayout({ root: updateNode(l.root), focusedPaneId: l.focusedPaneId });
    }

    function setFocus(paneId: string) {
      const l = paneLayoutRef.current!;
      commitLayout({ ...l, focusedPaneId: paneId });
    }

    // Number keys 1-9: jump to tab within focused pane
    if (key >= "1" && key <= "9") {
      const idx = parseInt(key, 10) - 1;
      if (idx < paneTabs.length) {
        setShowNewFormFn(layout.focusedPaneId, false);
        setTab(layout.focusedPaneId, tabIdFromItem(paneTabs[idx]));
      }
      return;
    }

    const leaves = collectLeaves(paneLayoutRef.current!.root);
    const focusIdx = leaves.findIndex((l) => l.id === paneLayoutRef.current!.focusedPaneId);

    switch (key) {
      case "h":
      case "[": {
        if (paneTabs.length === 0) break;
        const prev = currentIdx > 0 ? currentIdx - 1 : paneTabs.length - 1;
        setShowNewFormFn(layout.focusedPaneId, false);
        setTab(layout.focusedPaneId, tabIdFromItem(paneTabs[prev]));
        break;
      }
      case "l":
      case "]": {
        if (paneTabs.length === 0) break;
        const next = currentIdx < paneTabs.length - 1 ? currentIdx + 1 : 0;
        setShowNewFormFn(layout.focusedPaneId, false);
        setTab(layout.focusedPaneId, tabIdFromItem(paneTabs[next]));
        break;
      }
      case "j": {
        if (leaves.length <= 1) break;
        const next = focusIdx < leaves.length - 1 ? focusIdx + 1 : 0;
        setFocus(leaves[next].id);
        break;
      }
      case "k": {
        if (leaves.length <= 1) break;
        const prev = focusIdx > 0 ? focusIdx - 1 : leaves.length - 1;
        setFocus(leaves[prev].id);
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
        setShowNewFormFn(layout.focusedPaneId, true);
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
      if (commandMode) {
        e.preventDefault();
        e.stopPropagation();
        executeCommand(e.key);
        return;
      }

      // Shift+Escape triggers command mode from anywhere
      if (e.key === "Escape" && e.shiftKey) {
        e.preventDefault();
        enterCommandMode();
        return;
      }

      const layout = paneLayoutRef.current;
      if (!layout) return;

      // Alt+1-9: switch tabs within focused pane
      if (e.altKey && e.code >= "Digit1" && e.code <= "Digit9") {
        e.preventDefault();
        e.stopPropagation();
        const idx = parseInt(e.code.slice(5), 10) - 1;
        const focusedLeaf = findLeaf(layout.root, layout.focusedPaneId);
        if (!focusedLeaf) return;
        const paneTabs = allTabsRef.current.filter(
          (t) => focusedLeaf.tabIds.includes(tabIdFromItem(t)),
        );
        if (idx < paneTabs.length) {
          setShowNewFormFn(layout.focusedPaneId, false);
          setActiveTab(layout.focusedPaneId, tabIdFromItem(paneTabs[idx]));
        }
        return;
      }

      // All other shortcuts require explicit command mode (Shift+Esc).
      // Bare-key shortcuts are disabled to prevent focus-loss from causing
      // random command execution when typing in terminals.
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commandMode, newFormPanes]);

  // ---- Context value ----

  const ctxValue = useMemo<PaneContextValue | null>(() => {
    if (!paneLayout) return null;
    return {
      layout: paneLayout,
      allTabs,
      focusedPaneId: paneLayout.focusedPaneId,
      totalPaneCount,
      splitPane,
      closePane,
      focusPane,
      setActiveTab,
      reorderTabs,
      moveTabToPane,
      dropTabOnEdge,
      updateSplitRatio,
      handleKillDetected,
      handleKillMiclaw,
      handleAdopt,
      handleCreateSession,
      showNewForm: showNewFormFn,
      setShowNewForm: setShowNewFormFn,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    paneLayout,
    allTabs,
    totalPaneCount,
    splitPane,
    closePane,
    focusPane,
    setActiveTab,
    reorderTabs,
    moveTabToPane,
    dropTabOnEdge,
    updateSplitRatio,
    showNewFormFn,
    setShowNewFormFn,
  ]);

  // ---- Render ----

  if (!paneLayout || !ctxValue) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm font-mono text-text-dim">
          {loading ? "Scanning sessions..." : "Initializing..."}
        </p>
      </div>
    );
  }

  return (
    <PaneCtx.Provider value={ctxValue}>
      <div className="flex flex-col h-full relative">
        {/* Health issue banner */}
        {healthIssues.length > 0 && !healthDismissed && (
          <div data-testid="health-banner" className="shrink-0 border-b border-red-500/20 bg-red-500/5 px-4 py-2.5 flex items-start gap-3">
            <div className="flex-1 flex flex-col gap-1">
              {healthIssues.map((issue) => (
                <p key={issue.key} className="text-xs font-mono text-red-400">
                  <span className="text-red-500 font-semibold">[{issue.key}]</span>{" "}
                  {issue.message}
                </p>
              ))}
            </div>
            <button
              onClick={() => setHealthDismissed(true)}
              className="text-red-400/60 hover:text-red-400 text-xs font-mono shrink-0 mt-0.5"
            >
              dismiss
            </button>
          </div>
        )}

        {/* Pane tree fills the main area */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <PaneTree node={paneLayout.root} />
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
                <span className="text-text-muted"><span className="text-text">j/k</span> cycle tabs</span>
                <span className="text-text-muted"><span className="text-text">h/l</span> cycle panes</span>
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
              {totalPaneCount > 1 && " | h/l cycle panes"}
            </p>
          )}
        </div>
      </div>
    </PaneCtx.Provider>
  );
}
