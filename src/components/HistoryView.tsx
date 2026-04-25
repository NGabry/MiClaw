"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search, GitBranch, Clock, DollarSign, MessageSquare,
  ChevronDown, ChevronRight, Zap, ArrowUpDown, Filter, Wrench, FileText, Database,
} from "lucide-react";
import { LineChart } from "@/components/charts/LineChart";
import { Sparkline } from "@/components/charts/Sparkline";

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
  cacheReadTokens?: number;
  cacheCreateTokens?: number;
  contextTokens?: number;
  model?: string;
  title?: string;
  perTurnTokens?: number[];
}

interface TimePoint {
  date: string;
  costUSD: number;
  inputTokens: number;
  outputTokens: number;
  sessionCount: number;
}

interface ModelStat {
  model: string;
  costUSD: number;
  sessionCount: number;
  inputTokens: number;
  outputTokens: number;
}

interface ToolUseEntry { tool: string; count: number; }
interface FileEntry { path: string; count: number; }
interface CacheStats {
  totalInput: number;
  totalCacheRead: number;
  totalCacheCreate: number;
  hitRate: number;
  savedUSD: number;
}

interface HistoryStats {
  totalSessions: number;
  totalCostUSD: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  projects: { name: string; path: string; count: number; costUSD: number }[];
  dateRange: { earliest: string; latest: string } | null;
  cacheStats: CacheStats;
  modelBreakdown: ModelStat[];
  timeSeries: TimePoint[];
  toolUsage: ToolUseEntry[];
  filesTouched: FileEntry[];
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
  if (usd === 0) return "$0";
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

/** Short YYYY-MM-DD → "Mar 4" style */
function formatDayKey(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return key;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

/**
 * Model color tokens. Follows DESIGN.md: terracotta is the hero; cyan/green
 * are borrowed from the status-dot semantic palette for the secondary models.
 */
function modelBg(model: string): string {
  const m = model.toLowerCase();
  if (m.includes("opus")) return "bg-accent/70";
  if (m.includes("sonnet")) return "bg-cyan-400/70";
  if (m.includes("haiku")) return "bg-green-500/70";
  return "bg-text-dim/60";
}

function modelText(model: string): string {
  const m = model.toLowerCase();
  if (m.includes("opus")) return "text-accent";
  if (m.includes("sonnet")) return "text-cyan-400";
  if (m.includes("haiku")) return "text-green-500";
  return "text-text-dim";
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function StatCard({ label, value, sub, icon: Icon, accent = false }: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ size?: number }>;
  accent?: boolean;
}) {
  return (
    <div className={`border rounded-sm p-4 bg-surface-raised/30 ${accent ? "border-accent/30" : "border-border"}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} />
        <span className="text-[10px] font-mono text-text-dim uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-xl font-mono font-medium ${accent ? "text-accent" : "text-text"}`}>{value}</p>
      {sub && <p className="text-[11px] font-mono text-text-dim mt-0.5">{sub}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Time range selector
// ---------------------------------------------------------------------------

const RANGES: { label: string; days: number }[] = [
  { label: "24h", days: 1 },
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
];

function RangeSelector({ value, onChange }: { value: number; onChange: (days: number) => void }) {
  return (
    <div className="inline-flex border border-border rounded-sm overflow-hidden">
      {RANGES.map((r) => (
        <button
          key={r.label}
          onClick={() => onChange(r.days)}
          className={`px-3 py-1 text-[11px] font-mono transition-colors ${
            value === r.days
              ? "bg-surface-raised text-accent"
              : "text-text-dim hover:text-text hover:bg-surface-hover"
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Model breakdown strip
// ---------------------------------------------------------------------------

function ModelBreakdownStrip({ models, totalCost }: { models: ModelStat[]; totalCost: number }) {
  if (models.length === 0 || totalCost === 0) return null;

  return (
    <div className="mb-6">
      <p className="text-[10px] font-mono text-text-dim uppercase tracking-wider mb-2">Cost by model</p>
      <div className="flex h-5 rounded-sm overflow-hidden border border-border">
        {models.map((m) => {
          const pct = (m.costUSD / totalCost) * 100;
          if (pct < 0.5) return null;
          return (
            <div
              key={m.model}
              className={`${modelBg(m.model)} relative group`}
              style={{ width: `${pct}%` }}
              title={`${formatModel(m.model)}: ${formatCost(m.costUSD)} (${pct.toFixed(1)}%)`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
        {models.map((m) => {
          const pct = (m.costUSD / totalCost) * 100;
          return (
            <div key={m.model} className="flex items-center gap-1.5 text-[11px] font-mono">
              <span className={`inline-block w-2 h-2 rounded-sm ${modelBg(m.model)}`} />
              <span className={modelText(m.model)}>{formatModel(m.model)}</span>
              <span className="text-text-dim">
                {formatCost(m.costUSD)} · {pct.toFixed(0)}% · {m.sessionCount} sess
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tools + files panels
// ---------------------------------------------------------------------------

function BarRow({ label, count, max, className = "" }: { label: string; count: number; max: number; className?: string }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className={`flex items-center gap-2 py-1 text-[11px] font-mono ${className}`}>
      <span className="text-text truncate flex-1">{label}</span>
      <span className="relative w-24 h-1.5 bg-surface-raised rounded-sm overflow-hidden shrink-0">
        <span
          className="absolute inset-y-0 left-0 bg-accent/60"
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="text-text-dim w-10 text-right shrink-0">{count}</span>
    </div>
  );
}

function CollapsiblePanel({
  title, icon: Icon, items, renderLabel, defaultOpen = false,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number }>;
  items: { label: string; count: number }[];
  renderLabel?: (label: string) => React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const top = items.slice(0, 10);
  const max = top[0]?.count ?? 0;

  return (
    <div className="border border-border rounded-sm bg-surface-raised/20">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface-hover/30 transition-colors"
      >
        {open ? <ChevronDown size={12} className="text-text-dim" /> : <ChevronRight size={12} className="text-text-dim" />}
        <Icon size={12} />
        <span className="text-[11px] font-mono text-text flex-1 text-left"># {title}</span>
        <span className="text-[10px] font-mono text-text-dim">{items.length}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1">
          {top.length === 0 ? (
            <p className="text-[11px] font-mono text-text-dim py-2">No data</p>
          ) : (
            top.map((it) => (
              <BarRow
                key={it.label}
                label={(renderLabel ? renderLabel(it.label) : it.label) as string}
                count={it.count}
                max={max}
              />
            ))
          )}
        </div>
      )}
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
  const hasSparkline = session.perTurnTokens && session.perTurnTokens.length >= 2;

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
              <span className={`text-[10px] font-mono ${modelText(session.model)}`}>
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
            {session.contextTokens != null && session.contextTokens > 0 && (
              <span className="text-text-muted" title="Active context window size at last turn">
                ctx {formatTokens(session.contextTokens)}
              </span>
            )}
          </div>
        </div>
        {hasSparkline && (
          <div className="shrink-0 flex items-center h-full pt-2" title="Tokens per turn">
            <Sparkline values={session.perTurnTokens!} width={60} height={16} />
          </div>
        )}
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
                  <span className={modelText(session.model)}>{session.model}</span>
                </div>
              )}
              {session.gitBranch && (
                <div>
                  <span className="text-text-dim">Branch:</span>{" "}
                  <span className="text-text-muted">{session.gitBranch}</span>
                </div>
              )}
              {session.cacheReadTokens != null && session.cacheReadTokens > 0 && (
                <div>
                  <span className="text-text-dim">Cache read:</span>{" "}
                  <span className="text-text-muted">{formatTokens(session.cacheReadTokens)}</span>
                </div>
              )}
              {session.cacheCreateTokens != null && session.cacheCreateTokens > 0 && (
                <div>
                  <span className="text-text-dim">Cache create:</span>{" "}
                  <span className="text-text-muted">{formatTokens(session.cacheCreateTokens)}</span>
                </div>
              )}
              {session.contextTokens != null && session.contextTokens > 0 && (
                <div>
                  <span className="text-text-dim">Active context:</span>{" "}
                  <span className="text-text-muted">{formatTokens(session.contextTokens)}</span>
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
const DEFAULT_SINCE_DAYS = 30;

type ChartMetric = "cost" | "input" | "output" | "sessions";

export function HistoryView() {
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<"modified" | "cost" | "tokens" | "messages">("modified");
  const [offset, setOffset] = useState(0);
  const [sinceDays, setSinceDays] = useState(DEFAULT_SINCE_DAYS);
  const [chartMetric, setChartMetric] = useState<ChartMetric>("cost");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchHistory = useCallback(async (searchVal: string, project: string, pageOffset: number, sd: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchVal) params.set("q", searchVal);
      if (project) params.set("project", project);
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(pageOffset));
      if (sd > 0) params.set("sinceDays", String(sd));
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
    const params = new URLSearchParams();
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", "0");
    params.set("sinceDays", String(DEFAULT_SINCE_DAYS));
    fetch(`/api/history?${params}`)
      .then((res) => res.ok ? res.json() : null)
      .then((json) => { if (!cancelled && json) { setData(json); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function handleSearchChange(val: string) {
    setSearch(val);
    setOffset(0);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchHistory(val, projectFilter, 0, sinceDays);
    }, 300);
  }

  function handleProjectChange(val: string) {
    setProjectFilter(val);
    setOffset(0);
    fetchHistory(search, val, 0, sinceDays);
  }

  function handlePageChange(newOffset: number) {
    setOffset(newOffset);
    fetchHistory(search, projectFilter, newOffset, sinceDays);
  }

  function handleRangeChange(days: number) {
    setSinceDays(days);
    setOffset(0);
    fetchHistory(search, projectFilter, 0, days);
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

  const rangeLabel = sinceDays === 1 ? "24h" : `${sinceDays}d`;

  // Chart data: pick the metric, filter out all-zero ranges
  const chartData = (data?.stats.timeSeries ?? []).map((p) => ({
    x: p.date,
    y: chartMetric === "cost" ? p.costUSD
      : chartMetric === "input" ? p.inputTokens
      : chartMetric === "output" ? p.outputTokens
      : p.sessionCount,
  }));

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-mono font-medium tracking-tight">History</h1>
          <p className="mt-1 text-sm text-text-muted">
            Session history, usage & cost · {rangeLabel}
          </p>
        </div>
        <RangeSelector value={sinceDays} onChange={handleRangeChange} />
      </div>

      {/* Stats cards — 5 across at lg+ */}
      {data?.stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          <StatCard
            label="Sessions"
            value={String(data.stats.totalSessions)}
            sub={`${data.stats.projects.length} projects`}
            icon={MessageSquare}
          />
          <StatCard
            label="Cost"
            value={formatCost(data.stats.totalCostUSD)}
            sub={rangeLabel}
            icon={DollarSign}
          />
          <StatCard
            label="Input"
            value={formatTokens(data.stats.totalInputTokens)}
            sub={`${data.stats.totalSessions} sessions`}
            icon={Zap}
          />
          <StatCard
            label="Output"
            value={formatTokens(data.stats.totalOutputTokens)}
            sub={`${data.stats.totalSessions} sessions`}
            icon={Zap}
          />
          <StatCard
            label="Cache hit"
            value={`${(data.stats.cacheStats.hitRate * 100).toFixed(0)}%`}
            sub={`saved ${formatCost(data.stats.cacheStats.savedUSD)}`}
            icon={Database}
            accent={data.stats.cacheStats.hitRate > 0.4}
          />
        </div>
      )}

      {/* Time-series chart */}
      {data?.stats && data.stats.timeSeries.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-mono text-text-dim uppercase tracking-wider">Over time</p>
            <div className="inline-flex border border-border rounded-sm overflow-hidden text-[10px] font-mono">
              {(["cost", "input", "output", "sessions"] as ChartMetric[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setChartMetric(m)}
                  className={`px-2 py-0.5 transition-colors ${
                    chartMetric === m
                      ? "bg-surface-raised text-accent"
                      : "text-text-dim hover:text-text hover:bg-surface-hover"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <LineChart
            data={chartData}
            height={180}
            xFormat={formatDayKey}
            yFormat={chartMetric === "cost" ? formatCost : formatTokens}
          />
        </div>
      )}

      {/* Model breakdown strip */}
      {data?.stats && (
        <ModelBreakdownStrip models={data.stats.modelBreakdown} totalCost={data.stats.totalCostUSD} />
      )}

      {/* Tools + files panels (side by side on wide) */}
      {data?.stats && (data.stats.toolUsage.length > 0 || data.stats.filesTouched.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          <CollapsiblePanel
            title="Top tools"
            icon={Wrench}
            items={data.stats.toolUsage.map((t) => ({ label: t.tool, count: t.count }))}
          />
          <CollapsiblePanel
            title="Top files touched"
            icon={FileText}
            items={data.stats.filesTouched.map((f) => ({ label: f.path, count: f.count }))}
          />
        </div>
      )}

      {/* Search + filters bar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex-1 min-w-[220px] relative">
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
                {p.name} ({p.count}) · {formatCost(p.costUSD)}
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
