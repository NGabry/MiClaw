import { readFileSync, writeFileSync, existsSync } from "fs";
import { homedir } from "os";
import path from "path";
import { randomBytes } from "crypto";

const SESSIONS_FILE = path.join(homedir(), ".claude", "miclaw-sessions.json");

export interface MiclawSession {
  id: string;
  displayName: string;
  cwd: string;
  created: number;
  claudeSessionId?: string;  // For resume on crash recovery
}

function readSessions(): MiclawSession[] {
  try {
    if (existsSync(SESSIONS_FILE)) {
      return JSON.parse(readFileSync(SESSIONS_FILE, "utf-8"));
    }
  } catch { /* corrupt file */ }
  return [];
}

function writeSessions(sessions: MiclawSession[]): void {
  writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2), "utf-8");
}

export function listSessions(): MiclawSession[] {
  return readSessions();
}

export function createSession(displayName?: string, cwd?: string, resumeId?: string): MiclawSession {
  const sessions = readSessions();
  const id = `miclaw-${displayName?.replace(/[^a-zA-Z0-9_-]/g, "-") || randomBytes(4).toString("hex")}`;
  const resolvedCwd = (cwd ?? "~/Desktop").replace(/^~/, homedir());

  const session: MiclawSession = {
    id,
    displayName: displayName || id.slice(7),
    cwd: resolvedCwd,
    created: Date.now(),
    claudeSessionId: resumeId,
  };

  sessions.push(session);
  writeSessions(sessions);
  return session;
}

export function removeSession(id: string): void {
  const sessions = readSessions().filter((s) => s.id !== id);
  writeSessions(sessions);
}

export function getSession(id: string): MiclawSession | undefined {
  return readSessions().find((s) => s.id === id);
}
