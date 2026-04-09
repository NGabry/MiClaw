import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fs/promises before importing the module
vi.mock("fs/promises", () => ({
  default: {
    readdir: vi.fn(),
    readFile: vi.fn(),
    stat: vi.fn(),
    open: vi.fn(),
    access: vi.fn(),
  },
}));

import fs from "fs/promises";
import { scanActiveSessions, killSession, getSessionCost } from "../sessionScanner";

// ---------------------------------------------------------------------------
// scanActiveSessions
// ---------------------------------------------------------------------------

describe("scanActiveSessions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns empty array when sessions dir does not exist", async () => {
    vi.mocked(fs.readdir).mockRejectedValue(new Error("ENOENT"));
    const sessions = await scanActiveSessions();
    expect(sessions).toEqual([]);
  });

  it("parses a PID file and returns session info", async () => {
    const pidData = {
      pid: 12345,
      sessionId: "sess-abc",
      cwd: "/Users/test/project",
      kind: "interactive",
      startedAt: 1700000000000,
    };

    // Mock readdir for sessions dir
    vi.mocked(fs.readdir).mockImplementation(async (dirPath: unknown) => {
      const p = String(dirPath);
      if (p.includes("sessions")) {
        return ["12345.json"] as unknown as Awaited<ReturnType<typeof fs.readdir>>;
      }
      // For project dirs (readJsonlTail)
      return [] as unknown as Awaited<ReturnType<typeof fs.readdir>>;
    });

    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(pidData));

    // Mock process.kill for isProcessRunning
    const originalKill = process.kill;
    process.kill = vi.fn(() => true) as unknown as typeof process.kill;

    const sessions = await scanActiveSessions();

    expect(sessions).toHaveLength(1);
    expect(sessions[0].pid).toBe(12345);
    expect(sessions[0].sessionId).toBe("sess-abc");
    expect(sessions[0].cwd).toBe("/Users/test/project");
    expect(sessions[0].projectName).toBe("project");
    expect(sessions[0].isAlive).toBe(true);

    process.kill = originalKill;
  });

  it("marks dead processes correctly", async () => {
    const pidData = { pid: 99999, sessionId: "s1", cwd: "/test", startedAt: 0 };

    vi.mocked(fs.readdir).mockImplementation(async (dirPath: unknown) => {
      if (String(dirPath).includes("sessions")) {
        return ["99999.json"] as unknown as Awaited<ReturnType<typeof fs.readdir>>;
      }
      return [] as unknown as Awaited<ReturnType<typeof fs.readdir>>;
    });
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(pidData));

    const originalKill = process.kill;
    process.kill = vi.fn(() => { throw new Error("ESRCH"); }) as unknown as typeof process.kill;

    const sessions = await scanActiveSessions();
    expect(sessions[0].isAlive).toBe(false);
    expect(sessions[0].turnState).toBe("idle"); // dead sessions are always idle

    process.kill = originalKill;
  });

  it("skips unparseable PID files", async () => {
    vi.mocked(fs.readdir).mockImplementation(async (dirPath: unknown) => {
      if (String(dirPath).includes("sessions")) {
        return ["bad.json", "123.json"] as unknown as Awaited<ReturnType<typeof fs.readdir>>;
      }
      return [] as unknown as Awaited<ReturnType<typeof fs.readdir>>;
    });
    vi.mocked(fs.readFile).mockRejectedValue(new Error("corrupt"));

    const sessions = await scanActiveSessions();
    // "bad.json" doesn't match /^\d+\.json$/, "123.json" fails to parse
    expect(sessions).toEqual([]);
  });

  it("sorts alive sessions before dead ones, then by startedAt desc", async () => {
    const sessions = [
      { pid: 1, sessionId: "s1", cwd: "/a", startedAt: 100 },
      { pid: 2, sessionId: "s2", cwd: "/b", startedAt: 200 },
      { pid: 3, sessionId: "s3", cwd: "/c", startedAt: 150 },
    ];

    vi.mocked(fs.readdir).mockImplementation(async (dirPath: unknown) => {
      if (String(dirPath).includes("sessions")) {
        return ["1.json", "2.json", "3.json"] as unknown as Awaited<ReturnType<typeof fs.readdir>>;
      }
      return [] as unknown as Awaited<ReturnType<typeof fs.readdir>>;
    });

    let callIdx = 0;
    vi.mocked(fs.readFile).mockImplementation(async () => {
      return JSON.stringify(sessions[callIdx++]);
    });

    const originalKill = process.kill;
    process.kill = vi.fn((pid: number) => {
      if (pid === 2) throw new Error("ESRCH"); // pid 2 is dead
      return true;
    }) as unknown as typeof process.kill;

    const result = await scanActiveSessions();
    // Alive first (s1 startedAt:100, s3 startedAt:150), then dead (s2)
    // Within alive: sorted by startedAt desc => s3 (150) before s1 (100)
    expect(result.map((s) => s.sessionId)).toEqual(["s3", "s1", "s2"]);

    process.kill = originalKill;
  });
});

// ---------------------------------------------------------------------------
// killSession
// ---------------------------------------------------------------------------

describe("killSession", () => {
  it("returns true when kill succeeds", async () => {
    const originalKill = process.kill;
    process.kill = vi.fn(() => true) as unknown as typeof process.kill;

    const result = await killSession(12345);
    expect(result).toBe(true);
    expect(process.kill).toHaveBeenCalledWith(12345, "SIGTERM");

    process.kill = originalKill;
  });

  it("returns false when kill throws", async () => {
    const originalKill = process.kill;
    process.kill = vi.fn(() => { throw new Error("ESRCH"); }) as unknown as typeof process.kill;

    const result = await killSession(99999);
    expect(result).toBe(false);

    process.kill = originalKill;
  });
});

// ---------------------------------------------------------------------------
// Turn state detection (tested via getSessionCost / internal readJsonlTail)
// ---------------------------------------------------------------------------

describe("getSessionCost", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns empty cost when no JSONL found", async () => {
    vi.mocked(fs.readdir).mockRejectedValue(new Error("ENOENT"));
    const result = await getSessionCost("nonexistent");
    expect(result.costUSD).toBeUndefined();
    expect(result.inputTokens).toBeUndefined();
    expect(result.outputTokens).toBeUndefined();
  });
});
