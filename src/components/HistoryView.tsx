"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Search, GitBranch, Clock, DollarSign, MessageSquare, ChevronDown, ChevronRight, Zap, ArrowUpDown, Filter } from "lucide-react";

// ---------------------------------------------------------------------------
// Types (mirror historyScanner)
// ---------------------------------------------------------------------------

interface HistoryEntry {
  sessionId: string;
  projectPath: string;
  projectName: string;
  encodedProject: string;
  firstPrompt: string;
  promptCount: number;
  created: string;
  modified: string;
  gitBranch?: string;
  costUSD?: number;
  inputTokens?: number;
  outputTokens?: number;
  model?: string;
  title?: string;
}

interface HistoryStats {
  totalSessions: number;
  totalCostUSD: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  projects: { name: string; path: string; count: number }[];
  dateRange: { earliest: string; latest: string } | null;
}

interface HistoryResponse {
  sessions: HistoryEntry[];
  stats: HistoryStats;
  total: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCost(usd: number): string {
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}

function formatTokens(n: number): string {
  if (n < 1000) return `${n}`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return `Today ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  if (diffDays === 1) return `Yesterday ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
}

function formatModel(model?: string): string {
  if (!model) return "";
  if (model.includes("opus")) return "Opus";
  if (model.includes("sonnet")) return "Sonnet";
  if (model.includes("haiku")) return "Haiku";
  return model.split("-").pop() ?? model;
}

function modelColor(): string {
  return "text-accent";
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function StatCard({ label, value, sub, icon: Icon }: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ size?: number }>;
}) {
  return (
    <div className="border border-border rounded-sm p-4 bg-surface-raised/30">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} />
        <span className="text-[10px] font-mono text-text-dim uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-xl font-mono font-medium text-text">{value}</p>
      {sub && <p className="text-[11px] font-mono text-text-dim mt-0.5">{sub}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Session row
// ---------------------------------------------------------------------------

function SessionRow({ session, expanded, onToggle }: {
  session: HistoryEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  const ChevronIcon = expanded ? ChevronDown : ChevronRight;

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full text-left px-4 py-3 hover:bg-surface-hover/30 transition-colors flex items-start gap-3"
      >
        <ChevronIcon size={14} className="shrink-0 mt-1 text-text-dim" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-mono font-medium text-text truncate max-w-[400px]">
              {session.title || session.firstPrompt?.slice(0, 80) || session.sessionId.slice(0, 8)}
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-surface-hover/50 text-text-muted shrink-0">
              {session.projectName}
            </span>
            {session.model && (
              <span className={`text-[10px] font-mono ${modelColor()}`}>
                {formatModel(session.model)}
              </span>
            )}
            {session.promptCount > 1 && (
              <span className="text-[10px] font-mono text-text-dim">{session.promptCount} prompts</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-[11px] font-mono text-text-dim">
            <span className="flex items-center gap-1">
              <Clock size={10} />
              {formatDate(session.modified)}
            </span>
            {session.gitBranch && (
              <span className="flex items-center gap-1">
                <GitBranch size={10} />
                <span className="max-w-[180px] truncate">{session.gitBranch}</span>
              </span>
            )}
            <span className="flex items-center gap-1">
              <MessageSquare size={10} />
              {session.promptCount}
            </span>
            {session.costUSD != null && session.costUSD > 0 && (
              <span className="flex items-center gap-1 text-text-muted">
                <DollarSign size={10} />
                {formatCost(session.costUSD)}
              </span>
            )}
            {session.inputTokens != null && session.inputTokens > 0 && (
              <span className="text-text-dim">
                {formatTokens(session.inputTokens)} in / {formatTokens(session.outputTokens ?? 0)} out
              </span>
            )}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pl-11">
          <div className="border border-border rounded-sm p-4 bg-surface-raised/20">
            {session.firstPrompt && (
              <div className="mb-3">
                <p className="text-[10px] font-mono text-text-dim uppercase tracking-wider mb-1">First prompt</p>
                <p className="text-xs font-mono text-text-muted leading-relaxed whitespace-pre-wrap">
                  {session.firstPrompt}
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[11px] font-mono">
              <div>
                <span className="text-text-dim">Session ID:</span>{" "}
                <span className="text-text-muted">{session.sessionId}</span>
              </div>
              <div>
                <span className="text-text-dim">Project:</span>{" "}
                <span className="text-text-muted">{session.projectPath}</span>
              </div>
              <div>
                <span className="text-text-dim">Created:</span>{" "}
                <span className="text-text-muted">{new Date(session.created).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-text-dim">Modified:</span>{" "}
                <span className="text-text-muted">{new Date(session.modified).toLocaleString()}</span>
              </div>
              {session.model && (
                <div>
                  <span className="text-text-dim">Model:</span>{" "}
                  <span className={modelColor()}>{session.model}</span>
                </div>
              )}
              {session.gitBranch && (
                <div>
                  <span className="text-text-dim">Branch:</span>{" "}
                  <span className="text-text-muted">{session.gitBranch}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const PAGE_SIZE = 50;

export function HistoryView() {
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<"modified" | "cost" | "tokens" | "messages">("modified");
  const [offset, setOffset] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchHistory = useCallback(async (searchVal: string, project: string, pageOffset: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchVal) params.set("q", searchVal);
      if (project) params.set("project", project);
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(pageOffset));
      const res = await fetch(`/api/history?${params}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  // Initial fetch
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/history?limit=${PAGE_SIZE}&offset=0`)
      .then((res) => res.ok ? res.json() : null)
      .then((json) => { if (!cancelled && json) { setData(json); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Debounced search
  function handleSearchChange(val: string) {
    setSearch(val);
    setOffset(0);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchHistory(val, projectFilter, 0);
    }, 300);
  }

  function handleProjectChange(val: string) {
    setProjectFilter(val);
    setOffset(0);
    fetchHistory(search, val, 0);
  }

  function handlePageChange(newOffset: number) {
    setOffset(newOffset);
    fetchHistory(search, projectFilter, newOffset);
  }

  // Client-side sort (within the current page)
  const sortedSessions = data?.sessions ? [...data.sessions].sort((a, b) => {
    switch (sortField) {
      case "cost": return (b.costUSD ?? 0) - (a.costUSD ?? 0);
      case "tokens": return ((b.inputTokens ?? 0) + (b.outputTokens ?? 0)) - ((a.inputTokens ?? 0) + (a.outputTokens ?? 0));
      case "messages": return (b.promptCount ?? 0) - (a.promptCount ?? 0);
      default: return new Date(b.modified).getTime() - new Date(a.modified).getTime();
    }
  }) : [];

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-mono font-medium tracking-tight">History</h1>
        <p className="mt-1 text-sm text-text-muted">Session history, search, and usage across all projects</p>
      </div>

      {/* Stats cards */}
      {data?.stats && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          <StatCard
            label="Sessions"
            value={String(data.stats.totalSessions)}
            sub={data.stats.projects.length + " projects"}
            icon={MessageSquare}
          />
          <StatCard
            label="30-Day Est. Cost"
            value={formatCost(data.stats.totalCostUSD)}
            sub="model-aware · transcript retention window"
            icon={DollarSign}
          />
          <StatCard
            label="30-Day Input Tokens"
            value={formatTokens(data.stats.totalInputTokens)}
            sub={`${data.stats.totalSessions} sessions with transcripts`}
            icon={Zap}
          />
          <StatCard
            label="30-Day Output Tokens"
            value={formatTokens(data.stats.totalOutputTokens)}
            sub={`${data.stats.totalSessions} sessions with transcripts`}
            icon={Zap}
          />
        </div>
      )}

      {/* Search + filters bar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
          <input
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search sessions..."
            className="w-full bg-transparent border border-border rounded-sm pl-9 pr-3 py-2 text-xs font-mono text-text placeholder:text-text-dim/40 outline-none focus:border-accent/40"
          />
        </div>

        <div className="relative">
          <Filter size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-dim pointer-events-none" />
          <select
            value={projectFilter}
            onChange={(e) => handleProjectChange(e.target.value)}
            className="bg-transparent border border-border rounded-sm pl-8 pr-6 py-2 text-xs font-mono text-text outline-none focus:border-accent/40 appearance-none [&>option]:bg-[#353430] [&>option]:text-text"
          >
            <option value="">All projects</option>
            {data?.stats.projects.map((p) => (
              <option key={p.path} value={p.path}>
                {p.name} ({p.count})
              </option>
            ))}
          </select>
        </div>

        <div className="relative">
          <ArrowUpDown size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-dim pointer-events-none" />
          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value as typeof sortField)}
            className="bg-transparent border border-border rounded-sm pl-8 pr-6 py-2 text-xs font-mono text-text outline-none focus:border-accent/40 appearance-none [&>option]:bg-[#353430] [&>option]:text-text"
          >
            <option value="modified">Recent</option>
            <option value="cost">Cost</option>
            <option value="tokens">Tokens</option>
            <option value="messages">Messages</option>
          </select>
        </div>
      </div>

      {/* Session list */}
      <div className="border border-border rounded-sm bg-surface-raised/10">
        {loading && !data ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm font-mono text-text-dim">Loading session history...</p>
          </div>
        ) : sortedSessions.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm font-mono text-text-dim">
              {search ? "No sessions match your search" : "No session history found"}
            </p>
          </div>
        ) : (
          <>
            {sortedSessions.map((session) => (
              <SessionRow
                key={session.sessionId}
                session={session}
                expanded={expandedId === session.sessionId}
                onToggle={() => setExpandedId(expandedId === session.sessionId ? null : session.sessionId)}
              />
            ))}
          </>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-[11px] font-mono text-text-dim">
            Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, data?.total ?? 0)} of {data?.total ?? 0}
          </p>
          <div className="flex items-center gap-2">
            <button
              disabled={currentPage <= 1}
              onClick={() => handlePageChange(offset - PAGE_SIZE)}
              className="px-3 py-1.5 rounded-sm border border-border text-xs font-mono text-text-muted hover:text-text hover:border-text-dim/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            <span className="text-[11px] font-mono text-text-dim">
              {currentPage} / {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => handlePageChange(offset + PAGE_SIZE)}
              className="px-3 py-1.5 rounded-sm border border-border text-xs font-mono text-text-muted hover:text-text hover:border-text-dim/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Loading overlay for subsequent fetches */}
      {loading && data && (
        <div className="fixed bottom-6 right-6 px-3 py-1.5 rounded-sm bg-surface-raised border border-border text-[11px] font-mono text-text-dim">
          Loading...
        </div>
      )}
    </div>
  );
}
