"use client";

import { createContext, useContext } from "react";
import type { PaneLayout } from "./paneTypes";
import type { ActiveSession } from "./sessionScanner";
import type { MiclawSession } from "./miclawSessions";

// ---------------------------------------------------------------------------
// Tab types (shared across pane components)
// ---------------------------------------------------------------------------

export interface MiclawSessionWithStatus extends MiclawSession {
  alive: boolean;
  activity?: string;
  turnState?: "idle" | "working" | "needs_input";
  costUSD?: number;
  inputTokens?: number;
  outputTokens?: number;
  contextTokens?: number;
}

export type TabItem =
  | { type: "miclaw"; session: MiclawSessionWithStatus }
  | { type: "detected"; session: ActiveSession };

// ---------------------------------------------------------------------------
// Context value
// ---------------------------------------------------------------------------

export interface PaneContextValue {
  layout: PaneLayout;
  allTabs: TabItem[];
  focusedPaneId: string;
  totalPaneCount: number;

  // Layout mutations
  splitPane: (paneId: string, direction: "horizontal" | "vertical") => void;
  closePane: (paneId: string) => void;
  focusPane: (paneId: string) => void;
  setActiveTab: (paneId: string, tabId: string) => void;
  reorderTabs: (paneId: string, tabIds: string[]) => void;
  moveTabToPane: (tabId: string, fromPaneId: string, toPaneId: string, extraTabIds?: string[]) => void;
  dropTabOnEdge: (
    tabId: string,
    fromPaneId: string,
    toPaneId: string,
    edge: "left" | "right" | "top" | "bottom",
    extraTabIds?: string[],
  ) => void;
  updateSplitRatio: (splitId: string, ratio: number) => void;

  // Session actions
  handleKillDetected: (pid: number) => void;
  handleKillMiclaw: (id: string) => void;
  handleAdopt: (session: ActiveSession) => void;
  handleCreateSession: (
    name: string,
    cwd: string,
    opts?: {
      permissionMode?: string;
      model?: string;
      allowedTools?: string;
      appendSystemPrompt?: string;
      worktree?: boolean;
    },
  ) => void;

  // New form state (per-pane)
  showNewForm: (paneId: string) => boolean;
  setShowNewForm: (paneId: string, show: boolean) => void;
}

export const PaneCtx = createContext<PaneContextValue | null>(null);

export function usePaneContext(): PaneContextValue {
  const ctx = useContext(PaneCtx);
  if (!ctx) throw new Error("usePaneContext must be used within PaneCtx.Provider");
  return ctx;
}
