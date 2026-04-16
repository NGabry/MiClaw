import fs from "fs/promises";
import path from "path";
import { CLAUDE_DIR, PROJECTS_DIR, HOME_DIR } from "./constants";
import { estimateCostUSD } from "./pricing";

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
  inputTokens?: number;
  outputTokens?: number;
  contextTokens?: number;
  model?: string;
  title?: string;
  gitBranch?: string;
}

export interface HistoryStats {
  totalSessions: number;
  totalCostUSD: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  projects: { name: string; path: string; count: number }[];
  dateRange: { earliest: string; latest: string } | null;
}

// ---------------------------------------------------------------------------
// Cost + metadata cache (mtime-based)
// ---------------------------------------------------------------------------

const metaCache = new Map<string, {
  data: {
    costUSD: number;
    inputTokens: number;
    outputTokens: number;
    contextTokens?: number;
    model?: string;
    title?: string;
    gitBranch?: string;
  };
  mtime: number;
}>();

const TAIL_SIZE = 2 * 1024 * 1024; // 2MB tail

async function readJsonlMeta(jsonlPath: string, sessionId: string): Promise<{
  costUSD?: number;
  inputTokens?: number;
  outputTokens?: number;
  contextTokens?: number;
  model?: string;
  title?: string;
  gitBranch?: string;
}> {
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

      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const entry = JSON.parse(lines[i]);
          if (entry.type === "assistant" && entry.message?.usage) {
            const u = entry.message.usage;
            if (typeof u.input_tokens === "number") {
              if (!model && entry.message.model) {
                model = entry.message.model;
              }
              if (contextTokens === undefined) {
                contextTokens = u.input_tokens + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
              }
              totalInputTokens += u.input_tokens;
              totalOutputTokens += (u.output_tokens ?? 0);
              totalCacheRead += (u.cache_read_input_tokens ?? 0);
              totalCacheCreate += (u.cache_creation_input_tokens ?? 0);
              hasUsageData = true;
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

      // Also try extracting title/branch from regex on tail (faster for large files)
      if (!title) {
        const titleMatch = /"customTitle"\s*:\s*"([^"]*)"/.exec(tail)
          ?? /"aiTitle"\s*:\s*"([^"]*)"/.exec(tail);
        if (titleMatch) title = titleMatch[1];
      }
      if (!gitBranch) {
        const branchMatch = /"gitBranch"\s*:\s*"([^"]*)"/.exec(tail);
        if (branchMatch) gitBranch = branchMatch[1];
      }

      if (!hasUsageData) return { title, gitBranch };

      const costUSD = estimateCostUSD(totalInputTokens, totalCacheRead, totalCacheCreate, totalOutputTokens, model);
      const inputTokens = totalInputTokens + totalCacheRead + totalCacheCreate;
      const result = { costUSD, inputTokens, outputTokens: totalOutputTokens, contextTokens, model, title, gitBranch };
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
// Public API
// ---------------------------------------------------------------------------

export interface ScanHistoryOpts {
  search?: string;
  project?: string;
  limit?: number;
  offset?: number;
  withCost?: boolean;
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

  // Convert to array and add derived fields
  let entries = Array.from(sessionMap.values()).map((s) => ({
    ...s,
    projectName: s.projectPath ? path.basename(s.projectPath) : "",
    encodedProject: s.projectPath ? s.projectPath.replace(/\//g, "-") : "",
  }));

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
  const enrichEntry = async (entry: typeof entries[number]) => {
    const jsonlPath = path.join(PROJECTS_DIR, entry.encodedProject, `${entry.sessionId}.jsonl`);
    const created = new Date(entry.firstTimestamp).toISOString();
    const modified = new Date(entry.lastTimestamp).toISOString();

    let meta: Awaited<ReturnType<typeof readJsonlMeta>> = {};
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
      costUSD: meta.costUSD,
      inputTokens: meta.inputTokens,
      outputTokens: meta.outputTokens,
      contextTokens: meta.contextTokens,
      model: meta.model,
      title: meta.title,
      gitBranch: meta.gitBranch,
    };
  };

  const allEnriched = await Promise.all(entries.map(enrichEntry));
  const sessions = allEnriched.slice(offset, offset + limit);

  // Compute project counts from filtered entries (after JSONL existence check)
  const projectCounts = new Map<string, { name: string; path: string; count: number }>();
  for (const entry of entries) {
    const key = entry.projectPath || "unknown";
    const existing = projectCounts.get(key);
    if (existing) {
      existing.count++;
    } else {
      projectCounts.set(key, {
        name: entry.projectName || "unknown",
        path: entry.projectPath,
        count: 1,
      });
    }
  }

  // Compute stats
  const allTimestamps = entries.map((e) => e.lastTimestamp).sort((a, b) => a - b);
  const stats: HistoryStats = {
    totalSessions: total,
    totalCostUSD: allEnriched.reduce((sum, s) => sum + (s.costUSD ?? 0), 0),
    totalInputTokens: allEnriched.reduce((sum, s) => sum + (s.inputTokens ?? 0), 0),
    totalOutputTokens: allEnriched.reduce((sum, s) => sum + (s.outputTokens ?? 0), 0),
    projects: Array.from(projectCounts.values()).sort((a, b) => b.count - a.count),
    dateRange: allTimestamps.length > 0
      ? {
          earliest: new Date(allTimestamps[0]).toISOString(),
          latest: new Date(allTimestamps[allTimestamps.length - 1]).toISOString(),
        }
      : null,
  };

  // Shorten project paths for display
  for (const p of stats.projects) {
    if (p.path.startsWith(HOME_DIR)) {
      p.name = "~" + p.path.slice(HOME_DIR.length);
    }
  }

  return { sessions, stats, total };
}
