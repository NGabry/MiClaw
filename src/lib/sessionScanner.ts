import fs from "fs/promises";
import path from "path";
import { CLAUDE_DIR, PROJECTS_DIR } from "./constants";

const SESSIONS_DIR = path.join(CLAUDE_DIR, "sessions");

// How much of the JSONL tail to read for metadata
const TAIL_READ_SIZE = 2 * 1024 * 1024; // 2MB

// Cache JSONL reads keyed by sessionId; skip expensive re-reads when mtime unchanged
const jsonlCache = new Map<string, {
  data: {
    title?: string;
    gitBranch?: string;
    lastPrompt?: string;
    recentMessages: SessionMessage[];
    lastModified?: number;
    lastEntryIsToolUse: boolean;
    costUSD?: number;
    inputTokens?: number;
    outputTokens?: number;
    sessionState?: "idle" | "running" | "requires_action";
  };
  mtime: number;
}>();

export interface ActiveSession {
  pid: number;
  sessionId: string;
  cwd: string;
  projectName: string;
  kind: string;
  startedAt: number;
  status?: "idle" | "busy" | "waiting";
  waitingFor?: string;
  updatedAt?: number;
  name?: string;
  logPath?: string;
  agent?: string;
  isAlive: boolean;
  maybeWaitingForInput: boolean;
  lastTranscriptUpdate?: number;
  // Derived from JSONL
  title?: string;
  gitBranch?: string;
  lastPrompt?: string;
  recentMessages: SessionMessage[];
  costUSD?: number;
  inputTokens?: number;
  outputTokens?: number;
}

export interface SessionMessage {
  type: "user" | "assistant" | "system" | "tool_use" | "tool_result";
  text: string;
  toolName?: string;
  timestamp: string;
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function extractField(text: string, field: string): string | undefined {
  const pattern = new RegExp(`"${field}"\\s*:\\s*"([^"]*)"`, "g");
  let last: string | undefined;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    last = match[1];
  }
  return last;
}

function extractRecentMessages(tail: string, limit: number = 10): SessionMessage[] {
  const messages: SessionMessage[] = [];
  const lines = tail.split("\n").filter(Boolean);

  for (let i = lines.length - 1; i >= 0 && messages.length < limit; i--) {
    try {
      const entry = JSON.parse(lines[i]);
      if (entry.type === "user" && entry.message?.content) {
        const text = Array.isArray(entry.message.content)
          ? entry.message.content
              .filter((c: { type: string }) => c.type === "text")
              .map((c: { text: string }) => c.text)
              .join(" ")
          : typeof entry.message.content === "string"
            ? entry.message.content
            : "";
        if (text) {
          messages.unshift({
            type: "user",
            text,
            timestamp: entry.timestamp ?? "",
          });
        }
      } else if (entry.type === "assistant" && entry.message?.content) {
        const blocks = Array.isArray(entry.message.content) ? entry.message.content : [];

        // Extract text blocks
        const textParts = blocks
          .filter((c: { type: string }) => c.type === "text")
          .map((c: { text: string }) => c.text);
        if (textParts.length > 0) {
          messages.unshift({
            type: "assistant",
            text: textParts.join(" "),
            timestamp: entry.timestamp ?? "",
          });
        }

        // Extract tool_use blocks
        for (const block of blocks) {
          if (block.type === "tool_use") {
            const inputSummary = block.input
              ? (typeof block.input === "object"
                ? (block.input.command ?? block.input.file_path ?? block.input.pattern ?? JSON.stringify(block.input).substring(0, 100))
                : String(block.input).substring(0, 100))
              : "";
            messages.unshift({
              type: "tool_use",
              text: inputSummary,
              toolName: block.name ?? "tool",
              timestamp: entry.timestamp ?? "",
            });
          }
        }
      } else if (entry.type === "user" && entry.message?.content && Array.isArray(entry.message.content)) {
        // Tool results
        for (const block of entry.message.content) {
          if (block.type === "tool_result") {
            const resultText = Array.isArray(block.content)
              ? block.content.filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join(" ").substring(0, 200)
              : typeof block.content === "string" ? block.content.substring(0, 200) : "";
            if (resultText) {
              messages.unshift({
                type: "tool_result",
                text: resultText,
                timestamp: entry.timestamp ?? "",
              });
            }
          }
        }
      }
    } catch {
      // Skip unparseable lines
    }
  }

  return messages;
}

async function readJsonlTail(sessionId: string): Promise<{
  title?: string;
  gitBranch?: string;
  lastPrompt?: string;
  recentMessages: SessionMessage[];
  lastModified?: number;
  lastEntryIsToolUse: boolean;
  costUSD?: number;
  inputTokens?: number;
  outputTokens?: number;
  sessionState?: "idle" | "running" | "requires_action";
}> {
  // Find the JSONL file across all project directories
  try {
    const projectDirs = await fs.readdir(PROJECTS_DIR, { withFileTypes: true });
    for (const dir of projectDirs) {
      if (!dir.isDirectory()) continue;
      const jsonlPath = path.join(PROJECTS_DIR, dir.name, `${sessionId}.jsonl`);
      try {
        const stat = await fs.stat(jsonlPath);
        const cached = jsonlCache.get(sessionId);
        if (cached && cached.mtime === stat.mtimeMs) {
          return cached.data;
        }
        const fd = await fs.open(jsonlPath, "r");
        try {
          // Read tail
          const tailStart = Math.max(0, stat.size - TAIL_READ_SIZE);
          const tailBuf = Buffer.alloc(Math.min(stat.size, TAIL_READ_SIZE));
          await fd.read(tailBuf, 0, tailBuf.length, tailStart);
          const tail = tailBuf.toString("utf-8");

          const title = extractField(tail, "customTitle") ?? extractField(tail, "aiTitle");
          const gitBranch = extractField(tail, "gitBranch");
          const lastPrompt = extractField(tail, "lastPrompt");
          const recentMessages = extractRecentMessages(tail, 5);

          // Check if the session is waiting for user input:
          // Find the last assistant message. If its content contains tool_use blocks,
          // check whether any user message AFTER it contains a tool_result block.
          // Non-tool-result user messages (task notifications, plain text) are ignored.
          // NOTE: stop_reason is unreliable (CC source notes this) -- always check
          // content blocks directly.
          const lines = tail.split("\n").filter(Boolean);
          let lastEntryIsToolUse = false;
          let lastAssistantIdx = -1;
          let lastAssistantHasToolUse = false;

          // Step 1: Find the last assistant entry with a message
          for (let i = lines.length - 1; i >= 0; i--) {
            try {
              const entry = JSON.parse(lines[i]);
              if (!entry.type || !entry.message) continue;
              if (entry.type === "assistant") {
                lastAssistantIdx = i;
                const blocks = Array.isArray(entry.message.content) ? entry.message.content : [];
                if (blocks.some((b: { type: string }) => b.type === "tool_use")) {
                  lastAssistantHasToolUse = true;
                }
                break;
              }
            } catch { /* skip */ }
          }

          // Step 2: If last assistant proposed tool calls, check for tool_result after it
          if (lastAssistantHasToolUse && lastAssistantIdx >= 0) {
            let foundToolResult = false;
            for (let i = lastAssistantIdx + 1; i < lines.length; i++) {
              try {
                const entry = JSON.parse(lines[i]);
                if (!entry.type || !entry.message) continue;
                if (entry.type === "user") {
                  const content = entry.message.content;
                  if (Array.isArray(content) && content.some((b: { type: string }) => b.type === "tool_result")) {
                    foundToolResult = true;
                    break;
                  }
                  // Non-tool-result user messages (notifications, plain text) are NOT
                  // considered as "user responded to tool call" -- skip them.
                }
              } catch { /* skip */ }
            }
            lastEntryIsToolUse = !foundToolResult;
          }

          // Sum tokens from assistant message.usage fields and extract session state
          let totalInputTokens = 0;
          let totalOutputTokens = 0;
          let totalCacheRead = 0;
          let totalCacheCreate = 0;
          let hasUsageData = false;
          let sessionState: "idle" | "running" | "requires_action" | undefined;

          for (let i = lines.length - 1; i >= 0; i--) {
            try {
              const entry = JSON.parse(lines[i]);
              // Sum usage from assistant messages
              if (entry.type === "assistant" && entry.message?.usage) {
                const u = entry.message.usage;
                if (typeof u.input_tokens === "number") {
                  totalInputTokens += u.input_tokens;
                  totalOutputTokens += (u.output_tokens ?? 0);
                  totalCacheRead += (u.cache_read_input_tokens ?? 0);
                  totalCacheCreate += (u.cache_creation_input_tokens ?? 0);
                  hasUsageData = true;
                }
              }
              // Session state from system messages
              if (sessionState === undefined && entry.type === "system" && entry.subtype === "session_state_changed") {
                const s = entry.state;
                if (s === "idle" || s === "running" || s === "requires_action") {
                  sessionState = s;
                }
              }
            } catch { /* skip */ }
          }

          // Estimate cost from token counts (Sonnet pricing)
          // input_tokens is non-cached input at $3/MTok
          // cache_read at $0.30/MTok, cache_create at $3.75/MTok
          // output at $15/MTok
          const costUSD = hasUsageData
            ? (totalInputTokens * 3 + totalCacheRead * 0.3 + totalCacheCreate * 3.75 + totalOutputTokens * 15) / 1_000_000
            : undefined;
          const inputTokens = hasUsageData ? (totalInputTokens + totalCacheRead + totalCacheCreate) : undefined;
          const outputTokens = hasUsageData ? totalOutputTokens : undefined;

          const result = { title, gitBranch, lastPrompt, recentMessages, lastModified: stat.mtimeMs, lastEntryIsToolUse, costUSD, inputTokens, outputTokens, sessionState };
          jsonlCache.set(sessionId, { data: result, mtime: stat.mtimeMs });
          return result;
        } finally {
          await fd.close();
        }
      } catch {
        // Not in this project dir
      }
    }
  } catch {
    // PROJECTS_DIR doesn't exist
  }

  return { recentMessages: [], lastEntryIsToolUse: false, costUSD: undefined, inputTokens: undefined, outputTokens: undefined, sessionState: undefined };
}

export async function scanActiveSessions(): Promise<ActiveSession[]> {
  const sessions: ActiveSession[] = [];

  try {
    const files = await fs.readdir(SESSIONS_DIR);
    const pidFiles = files.filter((f) => /^\d+\.json$/.test(f));

    await Promise.all(
      pidFiles.map(async (file) => {
        try {
          const content = await fs.readFile(path.join(SESSIONS_DIR, file), "utf-8");
          const data = JSON.parse(content);

          const pid = data.pid as number;
          const isAlive = isProcessRunning(pid);

          // Read JSONL metadata
          const jsonlData = await readJsonlTail(data.sessionId);

          sessions.push({
            pid,
            sessionId: data.sessionId,
            cwd: data.cwd ?? "",
            projectName: path.basename(data.cwd ?? ""),
            kind: data.kind ?? "interactive",
            startedAt: data.startedAt ?? 0,
            status: data.status,
            waitingFor: data.waitingFor,
            updatedAt: data.updatedAt,
            name: data.name,
            logPath: data.logPath,
            agent: data.agent,
            isAlive,
            maybeWaitingForInput: isAlive && (jsonlData.sessionState === "requires_action" || jsonlData.lastEntryIsToolUse),
            lastTranscriptUpdate: jsonlData.lastModified,
            title: jsonlData.title,
            gitBranch: jsonlData.gitBranch,
            lastPrompt: jsonlData.lastPrompt,
            recentMessages: jsonlData.recentMessages,
            costUSD: jsonlData.costUSD,
            inputTokens: jsonlData.inputTokens,
            outputTokens: jsonlData.outputTokens,
          });
        } catch {
          // Skip unparseable PID files
        }
      })
    );
  } catch {
    // Sessions dir doesn't exist
  }

  // Sort: alive first, then by startedAt descending
  sessions.sort((a, b) => {
    if (a.isAlive !== b.isAlive) return a.isAlive ? -1 : 1;
    return b.startedAt - a.startedAt;
  });

  return sessions;
}

export async function killSession(pid: number): Promise<boolean> {
  try {
    process.kill(pid, "SIGTERM");
    return true;
  } catch {
    return false;
  }
}

/** Get cost/token data for a session by its Claude session ID (used by MiClaw sessions) */
export async function getSessionCost(sessionId: string): Promise<{
  costUSD?: number;
  inputTokens?: number;
  outputTokens?: number;
}> {
  const data = await readJsonlTail(sessionId);
  return {
    costUSD: data.costUSD,
    inputTokens: data.inputTokens,
    outputTokens: data.outputTokens,
  };
}
