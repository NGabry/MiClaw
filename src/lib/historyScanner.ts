import fs from "fs/promises";
import path from "path";
import { CLAUDE_DIR, PROJECTS_DIR, HOME_DIR } from "./constants";
import { estimateCostUSD, getPricing } from "./pricing";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HistoryEntry {
  sessionId: string;
  projectPath: string;
  projectName: string;
  encodedProject: string;
  firstPrompt: string;
  promptCount: number;
  created: string; // ISO date
  modified: string; // ISO date
  jsonlPath: string;
  // Cost data (populated from JSONL)
  costUSD?: number;
  inputTokens?: number;           // total input including cache
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheCreateTokens?: number;
  contextTokens?: number;
  model?: string;
  title?: string;
  gitBranch?: string;
  // For sparklines: tokens per assistant turn (input+output+cache), downsampled
  perTurnTokens?: number[];
}

export interface TimePoint {
  date: string;           // YYYY-MM-DD
  costUSD: number;
  inputTokens: number;
  outputTokens: number;
  sessionCount: number;
}

export interface ModelStat {
  model: string;          // "opus" | "sonnet" | "haiku" | other
  costUSD: number;
  sessionCount: number;
  inputTokens: number;
  outputTokens: number;
}

export interface ToolUseEntry {
  tool: string;
  count: number;
}

export interface FileEntry {
  path: string;
  count: number;
}

export interface CacheStats {
  totalInput: number;        // fresh (non-cached) input tokens
  totalCacheRead: number;
  totalCacheCreate: number;
  hitRate: number;           // cacheRead / (input + cacheRead + cacheCreate)
  savedUSD: number;          // estimated savings vs if all cache reads had been fresh input
}

export interface HistoryStats {
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

// ---------------------------------------------------------------------------
// Cost + metadata cache (mtime-based)
// ---------------------------------------------------------------------------

interface JsonlMeta {
  costUSD?: number;
  inputTokens?: number;           // fresh input (non-cached)
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheCreateTokens?: number;
  contextTokens?: number;
  model?: string;
  title?: string;
  gitBranch?: string;
  perTurnTokens?: number[];
  toolUses?: Record<string, number>;
  filesTouched?: Record<string, number>;
}

const metaCache = new Map<string, { data: JsonlMeta; mtime: number }>();

const TAIL_SIZE = 2 * 1024 * 1024; // 2MB tail
const MAX_SPARKLINE_POINTS = 30;

/** Tool names whose `input.file_path` (or similar) should be counted as "files touched". */
function extractFilePath(toolName: string, input: unknown): string | null {
  if (!input || typeof input !== "object") return null;
  const i = input as Record<string, unknown>;
  switch (toolName) {
    case "Edit":
    case "Write":
    case "Read":
    case "MultiEdit":
      return typeof i.file_path === "string" ? i.file_path : null;
    case "NotebookEdit":
    case "NotebookRead":
      return typeof i.notebook_path === "string" ? i.notebook_path : null;
    default:
      return null;
  }
}

function downsample(values: number[], maxPoints: number): number[] {
  if (values.length <= maxPoints) return values;
  const bucketSize = values.length / maxPoints;
  const result: number[] = [];
  for (let i = 0; i < maxPoints; i++) {
    const start = Math.floor(i * bucketSize);
    const end = Math.floor((i + 1) * bucketSize);
    let sum = 0;
    for (let j = start; j < end; j++) sum += values[j];
    result.push(Math.round(sum / Math.max(1, end - start)));
  }
  return result;
}

async function readJsonlMeta(jsonlPath: string, sessionId: string): Promise<JsonlMeta> {
  try {
    const stat = await fs.stat(jsonlPath);
    const cached = metaCache.get(sessionId);
    if (cached && cached.mtime === stat.mtimeMs) {
      return cached.data;
    }

    const fd = await fs.open(jsonlPath, "r");
    try {
      const tailStart = Math.max(0, stat.size - TAIL_SIZE);
      const tailBuf = Buffer.alloc(Math.min(stat.size, TAIL_SIZE));
      await fd.read(tailBuf, 0, tailBuf.length, tailStart);
      const tail = tailBuf.toString("utf-8");
      const lines = tail.split("\n").filter(Boolean);

      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let totalCacheRead = 0;
      let totalCacheCreate = 0;
      let hasUsageData = false;
      let model: string | undefined;
      let contextTokens: number | undefined;
      let title: string | undefined;
      let gitBranch: string | undefined;
      const perTurnTokens: number[] = [];
      const toolUses: Record<string, number> = {};
      const filesTouched: Record<string, number> = {};

      // Walk oldest→newest in the tail so perTurnTokens is chronological
      for (let i = 0; i < lines.length; i++) {
        try {
          const entry = JSON.parse(lines[i]);
          if (entry.type === "assistant" && entry.message?.usage) {
            const u = entry.message.usage;
            if (typeof u.input_tokens === "number") {
              if (!model && entry.message.model) {
                model = entry.message.model;
              }
              const turnTotal = u.input_tokens
                + (u.cache_read_input_tokens ?? 0)
                + (u.cache_creation_input_tokens ?? 0)
                + (u.output_tokens ?? 0);
              perTurnTokens.push(turnTotal);
              totalInputTokens += u.input_tokens;
              totalOutputTokens += (u.output_tokens ?? 0);
              totalCacheRead += (u.cache_read_input_tokens ?? 0);
              totalCacheCreate += (u.cache_creation_input_tokens ?? 0);
              hasUsageData = true;
            }
            // Collect tool_use blocks from content
            if (Array.isArray(entry.message.content)) {
              for (const block of entry.message.content) {
                if (block?.type === "tool_use" && typeof block.name === "string") {
                  toolUses[block.name] = (toolUses[block.name] ?? 0) + 1;
                  const fp = extractFilePath(block.name, block.input);
                  if (fp) filesTouched[fp] = (filesTouched[fp] ?? 0) + 1;
                }
              }
            }
          } else if (!title && entry.type === "custom-title" && entry.customTitle) {
            title = entry.customTitle;
          } else if (!title && entry.type === "ai-title" && entry.aiTitle) {
            title = entry.aiTitle;
          } else if (!gitBranch && entry.type === "user" && entry.gitBranch) {
            gitBranch = entry.gitBranch;
          }
        } catch { /* skip */ }
      }

      // The most recent assistant turn's prompt size = current context window.
      // perTurnTokens is chronological, so the last-turn input is its input tokens.
      // We didn't track that separately — re-parse the last assistant entry only.
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const entry = JSON.parse(lines[i]);
          if (entry.type === "assistant" && entry.message?.usage) {
            const u = entry.message.usage;
            if (typeof u.input_tokens === "number") {
              contextTokens = u.input_tokens
                + (u.cache_read_input_tokens ?? 0)
                + (u.cache_creation_input_tokens ?? 0);
              break;
            }
          }
        } catch { /* skip */ }
      }

      // Faster regex fallback for title/branch if not found
      if (!title) {
        const titleMatch = /"customTitle"\s*:\s*"([^"]*)"/.exec(tail)
          ?? /"aiTitle"\s*:\s*"([^"]*)"/.exec(tail);
        if (titleMatch) title = titleMatch[1];
      }
      if (!gitBranch) {
        const branchMatch = /"gitBranch"\s*:\s*"([^"]*)"/.exec(tail);
        if (branchMatch) gitBranch = branchMatch[1];
      }

      if (!hasUsageData) {
        const result: JsonlMeta = { title, gitBranch };
        metaCache.set(sessionId, { data: result, mtime: stat.mtimeMs });
        return result;
      }

      const costUSD = estimateCostUSD(totalInputTokens, totalCacheRead, totalCacheCreate, totalOutputTokens, model);
      const inputTokens = totalInputTokens + totalCacheRead + totalCacheCreate;
      const result: JsonlMeta = {
        costUSD,
        inputTokens,
        outputTokens: totalOutputTokens,
        cacheReadTokens: totalCacheRead,
        cacheCreateTokens: totalCacheCreate,
        contextTokens,
        model,
        title,
        gitBranch,
        perTurnTokens: downsample(perTurnTokens, MAX_SPARKLINE_POINTS),
        toolUses,
        filesTouched,
      };
      metaCache.set(sessionId, { data: result, mtime: stat.mtimeMs });
      return result;
    } finally {
      await fd.close();
    }
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// history.jsonl reader — the primary source of session data
// ---------------------------------------------------------------------------

interface HistoryPrompt {
  display: string;
  timestamp: number;
  project: string;
  sessionId: string;
}

interface SessionSummary {
  sessionId: string;
  projectPath: string;
  firstPrompt: string;
  promptCount: number;
  firstTimestamp: number;
  lastTimestamp: number;
}

/** Read ~/.claude/history.jsonl and group by sessionId */
async function readHistoryJsonl(): Promise<Map<string, SessionSummary>> {
  const sessions = new Map<string, SessionSummary>();
  const historyPath = path.join(CLAUDE_DIR, "history.jsonl");

  try {
    const content = await fs.readFile(historyPath, "utf-8");
    const lines = content.split("\n").filter(Boolean);

    for (const line of lines) {
      try {
        const entry: HistoryPrompt = JSON.parse(line);
        if (!entry.sessionId) continue;

        const existing = sessions.get(entry.sessionId);
        if (existing) {
          existing.promptCount++;
          if (entry.timestamp < existing.firstTimestamp) {
            existing.firstTimestamp = entry.timestamp;
            existing.firstPrompt = entry.display || existing.firstPrompt;
          }
          if (entry.timestamp > existing.lastTimestamp) {
            existing.lastTimestamp = entry.timestamp;
          }
        } else {
          sessions.set(entry.sessionId, {
            sessionId: entry.sessionId,
            projectPath: entry.project || "",
            firstPrompt: entry.display || "",
            promptCount: 1,
            firstTimestamp: entry.timestamp,
            lastTimestamp: entry.timestamp,
          });
        }
      } catch { /* skip */ }
    }
  } catch { /* history.jsonl doesn't exist */ }

  return sessions;
}

// ---------------------------------------------------------------------------
// Aggregate helpers
// ---------------------------------------------------------------------------

function modelKey(model?: string): string {
  if (!model) return "unknown";
  const lower = model.toLowerCase();
  if (lower.includes("opus")) return "opus";
  if (lower.includes("sonnet")) return "sonnet";
  if (lower.includes("haiku")) return "haiku";
  return model;
}

/** Local YYYY-MM-DD date key for time-series bucketing. */
function dayKey(timestamp: number): string {
  const d = new Date(timestamp);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

interface EnrichedSession {
  sessionId: string;
  projectPath: string;
  projectName: string;
  encodedProject: string;
  firstPrompt: string;
  promptCount: number;
  created: string;
  modified: string;
  jsonlPath: string;
  lastTimestamp: number;
  costUSD?: number;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheCreateTokens?: number;
  contextTokens?: number;
  model?: string;
  title?: string;
  gitBranch?: string;
  perTurnTokens?: number[];
  toolUses?: Record<string, number>;
  filesTouched?: Record<string, number>;
}

function computeStats(
  all: EnrichedSession[],
  filteredTotal: number,
): HistoryStats {
  // Project counts + per-project cost
  const projectAgg = new Map<string, { name: string; path: string; count: number; costUSD: number }>();
  for (const s of all) {
    const key = s.projectPath || "unknown";
    const existing = projectAgg.get(key);
    if (existing) {
      existing.count++;
      existing.costUSD += s.costUSD ?? 0;
    } else {
      projectAgg.set(key, {
        name: s.projectName || "unknown",
        path: s.projectPath,
        count: 1,
        costUSD: s.costUSD ?? 0,
      });
    }
  }
  const projects = Array.from(projectAgg.values()).sort((a, b) => b.count - a.count);
  for (const p of projects) {
    if (p.path.startsWith(HOME_DIR)) {
      p.name = "~" + p.path.slice(HOME_DIR.length);
    }
  }

  // Cache stats + savings
  let freshInput = 0;
  let cacheRead = 0;
  let cacheCreate = 0;
  let savedUSD = 0;
  for (const s of all) {
    freshInput += s.inputTokens && s.cacheReadTokens && s.cacheCreateTokens
      ? s.inputTokens - s.cacheReadTokens - s.cacheCreateTokens
      : 0;
    cacheRead += s.cacheReadTokens ?? 0;
    cacheCreate += s.cacheCreateTokens ?? 0;
    if (s.cacheReadTokens && s.cacheReadTokens > 0) {
      const p = getPricing(s.model);
      savedUSD += (s.cacheReadTokens * (p.input - p.cacheRead)) / 1_000_000;
    }
  }
  const totalInputish = freshInput + cacheRead + cacheCreate;
  const hitRate = totalInputish > 0 ? cacheRead / totalInputish : 0;

  // Model breakdown
  const modelAgg = new Map<string, ModelStat>();
  for (const s of all) {
    const key = modelKey(s.model);
    const existing = modelAgg.get(key);
    if (existing) {
      existing.costUSD += s.costUSD ?? 0;
      existing.sessionCount++;
      existing.inputTokens += s.inputTokens ?? 0;
      existing.outputTokens += s.outputTokens ?? 0;
    } else {
      modelAgg.set(key, {
        model: key,
        costUSD: s.costUSD ?? 0,
        sessionCount: 1,
        inputTokens: s.inputTokens ?? 0,
        outputTokens: s.outputTokens ?? 0,
      });
    }
  }
  const modelBreakdown = Array.from(modelAgg.values()).sort((a, b) => b.costUSD - a.costUSD);

  // Time series (by day, based on modified time)
  const dayAgg = new Map<string, TimePoint>();
  for (const s of all) {
    const key = dayKey(s.lastTimestamp);
    const existing = dayAgg.get(key);
    if (existing) {
      existing.costUSD += s.costUSD ?? 0;
      existing.inputTokens += s.inputTokens ?? 0;
      existing.outputTokens += s.outputTokens ?? 0;
      existing.sessionCount++;
    } else {
      dayAgg.set(key, {
        date: key,
        costUSD: s.costUSD ?? 0,
        inputTokens: s.inputTokens ?? 0,
        outputTokens: s.outputTokens ?? 0,
        sessionCount: 1,
      });
    }
  }
  const timeSeries = Array.from(dayAgg.values()).sort((a, b) => a.date.localeCompare(b.date));

  // Tool usage + files touched
  const toolAgg = new Map<string, number>();
  const fileAgg = new Map<string, number>();
  for (const s of all) {
    if (s.toolUses) {
      for (const [k, v] of Object.entries(s.toolUses)) {
        toolAgg.set(k, (toolAgg.get(k) ?? 0) + v);
      }
    }
    if (s.filesTouched) {
      for (const [k, v] of Object.entries(s.filesTouched)) {
        fileAgg.set(k, (fileAgg.get(k) ?? 0) + v);
      }
    }
  }
  const toolUsage = Array.from(toolAgg.entries())
    .map(([tool, count]) => ({ tool, count }))
    .sort((a, b) => b.count - a.count);
  const filesTouched = Array.from(fileAgg.entries())
    .map(([p, count]) => ({
      path: p.startsWith(HOME_DIR) ? "~" + p.slice(HOME_DIR.length) : p,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const timestamps = all.map((s) => s.lastTimestamp).sort((a, b) => a - b);
  const dateRange = timestamps.length > 0
    ? {
        earliest: new Date(timestamps[0]).toISOString(),
        latest: new Date(timestamps[timestamps.length - 1]).toISOString(),
      }
    : null;

  return {
    totalSessions: filteredTotal,
    totalCostUSD: all.reduce((sum, s) => sum + (s.costUSD ?? 0), 0),
    totalInputTokens: all.reduce((sum, s) => sum + (s.inputTokens ?? 0), 0),
    totalOutputTokens: all.reduce((sum, s) => sum + (s.outputTokens ?? 0), 0),
    projects,
    dateRange,
    cacheStats: {
      totalInput: freshInput,
      totalCacheRead: cacheRead,
      totalCacheCreate: cacheCreate,
      hitRate,
      savedUSD,
    },
    modelBreakdown,
    timeSeries,
    toolUsage,
    filesTouched,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ScanHistoryOpts {
  search?: string;
  project?: string;
  limit?: number;
  offset?: number;
  withCost?: boolean;
  /** Only include sessions modified within the last N days. 0/undefined = no filter. */
  sinceDays?: number;
}

export async function scanHistory(opts?: ScanHistoryOpts): Promise<{
  sessions: HistoryEntry[];
  stats: HistoryStats;
  total: number;
}> {
  const sessionMap = await readHistoryJsonl();
  const search = opts?.search?.toLowerCase();
  const projectFilter = opts?.project;
  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;
  const withCost = opts?.withCost !== false;
  const sinceDays = opts?.sinceDays ?? 0;

  // Convert to array and add derived fields
  let entries = Array.from(sessionMap.values()).map((s) => ({
    ...s,
    projectName: s.projectPath ? path.basename(s.projectPath) : "",
    encodedProject: s.projectPath ? s.projectPath.replace(/\//g, "-") : "",
  }));

  // Filter by time window
  if (sinceDays > 0) {
    const cutoff = Date.now() - sinceDays * 24 * 60 * 60 * 1000;
    entries = entries.filter((e) => e.lastTimestamp >= cutoff);
  }

  // Filter by project
  if (projectFilter) {
    entries = entries.filter((e) =>
      e.projectPath === projectFilter || e.projectName === projectFilter,
    );
  }

  // Filter by search
  if (search) {
    entries = entries.filter((e) =>
      e.firstPrompt?.toLowerCase().includes(search) ||
      e.projectName?.toLowerCase().includes(search),
    );
  }

  // Sort by lastTimestamp descending (most recent first)
  entries.sort((a, b) => b.lastTimestamp - a.lastTimestamp);

  // Pre-filter to sessions that have a JSONL file on disk (cheap stat check).
  // Old sessions get garbage-collected by Claude Code, so many won't exist.
  if (withCost) {
    const withJsonl = await Promise.all(entries.map(async (entry) => {
      const jsonlPath = path.join(PROJECTS_DIR, entry.encodedProject, `${entry.sessionId}.jsonl`);
      try {
        await fs.stat(jsonlPath);
        return true;
      } catch {
        return false;
      }
    }));
    entries = entries.filter((_, i) => withJsonl[i]);
  }

  const total = entries.length;

  // Enrich ALL entries with cost/metadata for accurate global stats.
  // The mtime-based cache makes this fast after the first request.
  const enrichEntry = async (entry: typeof entries[number]): Promise<EnrichedSession> => {
    const jsonlPath = path.join(PROJECTS_DIR, entry.encodedProject, `${entry.sessionId}.jsonl`);
    const created = new Date(entry.firstTimestamp).toISOString();
    const modified = new Date(entry.lastTimestamp).toISOString();

    let meta: JsonlMeta = {};
    if (withCost) {
      meta = await readJsonlMeta(jsonlPath, entry.sessionId);
    }

    return {
      sessionId: entry.sessionId,
      projectPath: entry.projectPath,
      projectName: entry.projectName,
      encodedProject: entry.encodedProject,
      firstPrompt: entry.firstPrompt,
      promptCount: entry.promptCount,
      created,
      modified,
      jsonlPath,
      lastTimestamp: entry.lastTimestamp,
      costUSD: meta.costUSD,
      inputTokens: meta.inputTokens,
      outputTokens: meta.outputTokens,
      cacheReadTokens: meta.cacheReadTokens,
      cacheCreateTokens: meta.cacheCreateTokens,
      contextTokens: meta.contextTokens,
      model: meta.model,
      title: meta.title,
      gitBranch: meta.gitBranch,
      perTurnTokens: meta.perTurnTokens,
      toolUses: meta.toolUses,
      filesTouched: meta.filesTouched,
    };
  };

  const allEnriched = await Promise.all(entries.map(enrichEntry));
  const pageRows = allEnriched.slice(offset, offset + limit);

  // Public-facing sessions (strip internal fields like lastTimestamp / toolUses / filesTouched)
  const sessions: HistoryEntry[] = pageRows.map((s) => ({
    sessionId: s.sessionId,
    projectPath: s.projectPath,
    projectName: s.projectName,
    encodedProject: s.encodedProject,
    firstPrompt: s.firstPrompt,
    promptCount: s.promptCount,
    created: s.created,
    modified: s.modified,
    jsonlPath: s.jsonlPath,
    costUSD: s.costUSD,
    inputTokens: s.inputTokens,
    outputTokens: s.outputTokens,
    cacheReadTokens: s.cacheReadTokens,
    cacheCreateTokens: s.cacheCreateTokens,
    contextTokens: s.contextTokens,
    model: s.model,
    title: s.title,
    gitBranch: s.gitBranch,
    perTurnTokens: s.perTurnTokens,
  }));

  const stats = computeStats(allEnriched, total);

  return { sessions, stats, total };
}
