import fs from "fs/promises";
import path from "path";
import { CLAUDE_DIR, PROJECTS_DIR } from "./constants";

const SESSIONS_DIR = path.join(CLAUDE_DIR, "sessions");

// How much of the JSONL tail to read for metadata
const TAIL_READ_SIZE = 256 * 1024;

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
  // Derived from JSONL
  title?: string;
  gitBranch?: string;
  lastPrompt?: string;
  recentMessages: SessionMessage[];
}

export interface SessionMessage {
  type: "user" | "assistant" | "system";
  text: string;
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
            text: text.substring(0, 200),
            timestamp: entry.timestamp ?? "",
          });
        }
      } else if (entry.type === "assistant" && entry.message?.content) {
        const text = Array.isArray(entry.message.content)
          ? entry.message.content
              .filter((c: { type: string }) => c.type === "text")
              .map((c: { text: string }) => c.text)
              .join(" ")
          : "";
        if (text) {
          messages.unshift({
            type: "assistant",
            text: text.substring(0, 200),
            timestamp: entry.timestamp ?? "",
          });
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
}> {
  // Find the JSONL file across all project directories
  try {
    const projectDirs = await fs.readdir(PROJECTS_DIR, { withFileTypes: true });
    for (const dir of projectDirs) {
      if (!dir.isDirectory()) continue;
      const jsonlPath = path.join(PROJECTS_DIR, dir.name, `${sessionId}.jsonl`);
      try {
        const stat = await fs.stat(jsonlPath);
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
          const recentMessages = extractRecentMessages(tail, 50);

          return { title, gitBranch, lastPrompt, recentMessages };
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

  return { recentMessages: [] };
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
            title: jsonlData.title,
            gitBranch: jsonlData.gitBranch,
            lastPrompt: jsonlData.lastPrompt,
            recentMessages: jsonlData.recentMessages,
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
