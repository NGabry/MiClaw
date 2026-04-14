import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/miclawSessions", () => ({
  listSessions: vi.fn(),
  createSession: vi.fn(),
  removeSession: vi.fn(),
  updateSession: vi.fn(),
}));

vi.mock("@/lib/sessionScanner", () => ({
  getSessionCost: vi.fn(),
}));

vi.mock("ws", () => ({
  default: vi.fn(),
}));

import { listSessions, createSession, removeSession, updateSession } from "@/lib/miclawSessions";
import { getSessionCost } from "@/lib/sessionScanner";
import WebSocket from "ws";
import { GET, POST, DELETE } from "../sessions/route";

// ---------------------------------------------------------------------------
// Helper to mock WebSocket (PTY server)
// ---------------------------------------------------------------------------

function mockPtyWebSocket(sessions: { sessionId: string; alive: boolean; title: string; activity: string; claudeSessionId?: string }[]) {
  vi.mocked(WebSocket).mockImplementation(function (this: Record<string, unknown>) {
    const handlers: Record<string, ((...args: unknown[]) => void)[]> = {};

    this.on = (event: string, cb: (...args: unknown[]) => void) => {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(cb);
      return this;
    };

    this.send = () => {
      // Simulate receiving session list
      setTimeout(() => {
        for (const cb of handlers["message"] ?? []) {
          cb(JSON.stringify({ type: "session:list", sessions }));
        }
      }, 0);
    };

    this.close = () => {};

    // Trigger open
    setTimeout(() => {
      for (const cb of handlers["open"] ?? []) cb();
    }, 0);

    return this;
  } as unknown as typeof WebSocket);
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

describe("GET /api/tmux/sessions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getSessionCost).mockResolvedValue({});
  });

  it("returns annotated sessions with PTY info and turnState", async () => {
    vi.mocked(listSessions).mockReturnValue([
      {
        id: "miclaw-test",
        displayName: "test",
        cwd: "/Users/test/project",
        created: 1700000000000,
      },
    ]);

    mockPtyWebSocket([
      { sessionId: "miclaw-test", alive: true, title: "My Project", activity: "running", claudeSessionId: "cs-123" },
    ]);

    vi.mocked(getSessionCost).mockResolvedValue({
      costUSD: 0.05,
      inputTokens: 1000,
      outputTokens: 500,
      turnState: "working",
    });

    const response = await GET();
    const data = await response.json();

    expect(data).toHaveLength(1);
    expect(data[0].alive).toBe(true);
    expect(data[0].displayName).toBe("My Project");
    expect(data[0].costUSD).toBe(0.05);
    expect(data[0].turnState).toBe("working");
  });

  it("defaults to not-alive when PTY server is unreachable", async () => {
    vi.mocked(listSessions).mockReturnValue([
      { id: "miclaw-test", displayName: "test", cwd: "/test", created: 0 },
    ]);

    // WebSocket fails
    vi.mocked(WebSocket).mockImplementation(function (this: Record<string, unknown>) {
      const handlers: Record<string, ((...args: unknown[]) => void)[]> = {};
      this.on = (event: string, cb: (...args: unknown[]) => void) => {
        if (!handlers[event]) handlers[event] = [];
        handlers[event].push(cb);
        return this;
      };
      this.send = () => {};
      this.close = () => {};
      setTimeout(() => {
        for (const cb of handlers["error"] ?? []) cb(new Error("ECONNREFUSED"));
      }, 0);
      return this;
    } as unknown as typeof WebSocket);

    const response = await GET();
    const data = await response.json();
    expect(data[0].alive).toBe(false);
  });

  it("falls back to stored name when PTY title is generic 'Claude Code'", async () => {
    vi.mocked(listSessions).mockReturnValue([
      { id: "miclaw-desktop", displayName: "DESKTOP", cwd: "/test", created: 0 },
    ]);

    mockPtyWebSocket([
      { sessionId: "miclaw-desktop", alive: true, title: "✳ Claude Code", activity: "idle" },
    ]);

    const response = await GET();
    const data = await response.json();
    expect(data[0].displayName).toBe("DESKTOP");
  });

  it("strips Unicode ✳ prefix from PTY title", async () => {
    vi.mocked(listSessions).mockReturnValue([
      { id: "miclaw-test", displayName: "test", cwd: "/test", created: 0 },
    ]);

    mockPtyWebSocket([
      { sessionId: "miclaw-test", alive: true, title: "✳ My Custom Title", activity: "idle" },
    ]);

    const response = await GET();
    const data = await response.json();
    expect(data[0].displayName).toBe("My Custom Title");
  });

  it("strips accumulated ASCII * prefixes from PTY title", async () => {
    vi.mocked(listSessions).mockReturnValue([
      { id: "miclaw-test", displayName: "test", cwd: "/test", created: 0 },
    ]);

    mockPtyWebSocket([
      { sessionId: "miclaw-test", alive: true, title: "* * * GENERAL", activity: "idle" },
    ]);

    const response = await GET();
    const data = await response.json();
    expect(data[0].displayName).toBe("GENERAL");
  });

  it("defaults turnState to idle when no cost data", async () => {
    vi.mocked(listSessions).mockReturnValue([
      { id: "miclaw-test", displayName: "test", cwd: "/test", created: 0 },
    ]);

    mockPtyWebSocket([
      { sessionId: "miclaw-test", alive: true, title: "", activity: "idle" },
    ]);

    vi.mocked(getSessionCost).mockResolvedValue({});

    const response = await GET();
    const data = await response.json();
    expect(data[0].turnState).toBe("idle");
  });

  it("persists discovered claudeSessionId", async () => {
    vi.mocked(listSessions).mockReturnValue([
      { id: "miclaw-test", displayName: "test", cwd: "/test", created: 0 },
    ]);

    mockPtyWebSocket([
      { sessionId: "miclaw-test", alive: true, title: "", activity: "idle", claudeSessionId: "discovered-id" },
    ]);

    await GET();
    expect(updateSession).toHaveBeenCalledWith("miclaw-test", { claudeSessionId: "discovered-id" });
  });
});

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------

describe("POST /api/tmux/sessions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("creates a new session", async () => {
    vi.mocked(createSession).mockReturnValue({
      id: "miclaw-new",
      displayName: "new",
      cwd: "/test",
      created: Date.now(),
    });

    const request = new Request("http://localhost/api/tmux/sessions", {
      method: "POST",
      body: JSON.stringify({ name: "new", cwd: "/test" }),
    });

    const response = await POST(request);
    const data = await response.json();
    expect(data.id).toBe("miclaw-new");
    expect(createSession).toHaveBeenCalled();
  });

  it("creates a session with all options", async () => {
    vi.mocked(createSession).mockReturnValue({
      id: "miclaw-full",
      displayName: "full",
      cwd: "/test",
      created: Date.now(),
      permissionMode: "plan",
      model: "sonnet",
    });

    const request = new Request("http://localhost/api/tmux/sessions", {
      method: "POST",
      body: JSON.stringify({
        name: "full",
        cwd: "/test",
        resumeId: "r1",
        permissionMode: "plan",
        model: "sonnet",
        allowedTools: "Read",
        appendSystemPrompt: "Be careful",
        worktree: true,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
  });

  it("passes killPid for adopt flow", async () => {
    vi.mocked(createSession).mockReturnValue({
      id: "miclaw-adopted",
      displayName: "adopted",
      cwd: "/test",
      created: Date.now(),
      killPid: 99999,
    });

    const request = new Request("http://localhost/api/tmux/sessions", {
      method: "POST",
      body: JSON.stringify({
        name: "adopted",
        cwd: "/test",
        resumeId: "session-abc",
        killPid: 99999,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(createSession).toHaveBeenCalledWith("adopted", "/test", "session-abc", expect.objectContaining({
      killPid: 99999,
    }));
  });

  it("returns 500 on creation error", async () => {
    vi.mocked(createSession).mockImplementation(() => {
      throw new Error("disk full");
    });

    const request = new Request("http://localhost/api/tmux/sessions", {
      method: "POST",
      body: JSON.stringify({ name: "fail" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------

describe("DELETE /api/tmux/sessions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("removes a session by ID", async () => {
    const request = new Request("http://localhost/api/tmux/sessions", {
      method: "DELETE",
      body: JSON.stringify({ id: "miclaw-test" }),
    });

    const response = await DELETE(request);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(removeSession).toHaveBeenCalledWith("miclaw-test");
  });

  it("returns 400 when id is not a string", async () => {
    const request = new Request("http://localhost/api/tmux/sessions", {
      method: "DELETE",
      body: JSON.stringify({ id: 123 }),
    });

    const response = await DELETE(request);
    expect(response.status).toBe(400);
  });

  it("returns 500 on removal error", async () => {
    vi.mocked(removeSession).mockImplementation(() => {
      throw new Error("file locked");
    });

    const request = new Request("http://localhost/api/tmux/sessions", {
      method: "DELETE",
      body: JSON.stringify({ id: "miclaw-test" }),
    });

    const response = await DELETE(request);
    expect(response.status).toBe(500);
  });
});
