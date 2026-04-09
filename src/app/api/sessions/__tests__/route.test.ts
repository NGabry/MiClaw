import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("@/lib/sessionScanner", () => ({
  scanActiveSessions: vi.fn(),
  killSession: vi.fn(),
}));

vi.mock("child_process", () => ({
  execSync: vi.fn(),
}));

import { scanActiveSessions, killSession } from "@/lib/sessionScanner";
import { execSync } from "child_process";
import { GET, DELETE } from "../route";

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

describe("GET /api/sessions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default: no MiClaw PIDs
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error("no output");
    });
  });

  it("returns detected sessions as JSON", async () => {
    vi.mocked(scanActiveSessions).mockResolvedValue([
      {
        pid: 123,
        sessionId: "s1",
        cwd: "/test",
        projectName: "test",
        kind: "interactive",
        startedAt: 1000,
        isAlive: true,
        turnState: "idle",
        recentMessages: [{ type: "user", text: "hello", timestamp: "" }],
      },
    ]);

    const response = await GET();
    const data = await response.json();

    expect(data).toHaveLength(1);
    expect(data[0].pid).toBe(123);
    expect(data[0].sessionId).toBe("s1");
    // recentMessages should be stripped
    expect(data[0].recentMessages).toBeUndefined();
  });

  it("filters out MiClaw-spawned sessions", async () => {
    vi.mocked(scanActiveSessions).mockResolvedValue([
      {
        pid: 100,
        sessionId: "s1",
        cwd: "/a",
        projectName: "a",
        kind: "interactive",
        startedAt: 1000,
        isAlive: true,
        turnState: "idle",
        recentMessages: [],
      },
      {
        pid: 200,
        sessionId: "s2",
        cwd: "/b",
        projectName: "b",
        kind: "interactive",
        startedAt: 2000,
        isAlive: true,
        turnState: "working",
        recentMessages: [],
      },
    ]);

    // lsof finds PTY server
    vi.mocked(execSync).mockImplementation((cmd: string) => {
      if (cmd.includes("lsof")) return "999\n";
      if (cmd.includes("pgrep -P 999")) return "200\n"; // pid 200 is a child of PTY
      if (cmd.includes("pgrep -P 200")) throw new Error("no children");
      return "";
    });

    const response = await GET();
    const data = await response.json();

    expect(data).toHaveLength(1);
    expect(data[0].pid).toBe(100);
  });

  it("returns empty array when no sessions", async () => {
    vi.mocked(scanActiveSessions).mockResolvedValue([]);
    const response = await GET();
    const data = await response.json();
    expect(data).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------

describe("DELETE /api/sessions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("kills a session by PID", async () => {
    vi.mocked(killSession).mockResolvedValue(true);

    const request = new Request("http://localhost/api/sessions", {
      method: "DELETE",
      body: JSON.stringify({ pid: 12345 }),
    });

    const response = await DELETE(request);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(killSession).toHaveBeenCalledWith(12345);
  });

  it("returns error for invalid PID type", async () => {
    const request = new Request("http://localhost/api/sessions", {
      method: "DELETE",
      body: JSON.stringify({ pid: "not-a-number" }),
    });

    const response = await DELETE(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Invalid PID");
  });

  it("returns false when kill fails", async () => {
    vi.mocked(killSession).mockResolvedValue(false);

    const request = new Request("http://localhost/api/sessions", {
      method: "DELETE",
      body: JSON.stringify({ pid: 99999 }),
    });

    const response = await DELETE(request);
    const data = await response.json();
    expect(data.success).toBe(false);
  });
});
