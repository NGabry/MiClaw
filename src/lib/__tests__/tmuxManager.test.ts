import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock child_process
vi.mock("child_process", () => ({
  execFileSync: vi.fn(),
  execSync: vi.fn(),
}));

import { execFileSync } from "child_process";
import {
  listMiclawSessions,
  getMiclawPids,
  killSession,
  capturePane,
  sendKeys,
  sendSpecialKey,
  resizeSession,
  sessionExists,
} from "../tmuxManager";

// ---------------------------------------------------------------------------
// listMiclawSessions
// ---------------------------------------------------------------------------

describe("listMiclawSessions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("parses tmux output into sessions", () => {
    const raw = [
      "miclaw-test\t1700000000\t1\t120\t30\t12345\tClaude Code",
      "miclaw-other\t1700000001\t0\t80\t24\t67890\tmy custom title",
      "other-session\t1700000002\t0\t80\t24\t11111\tignored",
    ].join("\n");

    vi.mocked(execFileSync).mockReturnValue(raw);

    const sessions = listMiclawSessions();
    expect(sessions).toHaveLength(2); // Only miclaw- prefixed
    expect(sessions[0].name).toBe("miclaw-test");
    expect(sessions[0].displayName).toBe("test"); // "Claude Code" is generic
    expect(sessions[0].created).toBe(1700000000);
    expect(sessions[0].attached).toBe(true);
    expect(sessions[0].paneWidth).toBe(120);
    expect(sessions[0].paneHeight).toBe(30);
    expect(sessions[0].panePid).toBe(12345);
    expect(sessions[1].displayName).toBe("my custom title"); // Non-generic
  });

  it("returns empty array when tmux is not running", () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error("no server running");
    });
    expect(listMiclawSessions()).toEqual([]);
  });

  it("returns empty array when output is empty", () => {
    vi.mocked(execFileSync).mockReturnValue("");
    expect(listMiclawSessions()).toEqual([]);
  });

  it("strips status indicators from pane title for generic check", () => {
    const raw = "miclaw-session\t1700000000\t0\t80\t24\t123\t✳ Claude Code";
    vi.mocked(execFileSync).mockReturnValue(raw);
    const sessions = listMiclawSessions();
    // "✳ Claude Code" strips to "Claude Code" which is generic
    expect(sessions[0].displayName).toBe("session");
  });

  it("uses pane title when it is non-generic", () => {
    const raw = "miclaw-session\t1700000000\t0\t80\t24\t123\tMy Project";
    vi.mocked(execFileSync).mockReturnValue(raw);
    const sessions = listMiclawSessions();
    expect(sessions[0].displayName).toBe("My Project");
  });

  it("handles missing paneWidth/paneHeight gracefully", () => {
    const raw = "miclaw-x\t1700000000\t0\t\t\t0\t";
    vi.mocked(execFileSync).mockReturnValue(raw);
    const sessions = listMiclawSessions();
    expect(sessions[0].paneWidth).toBe(80); // fallback
    expect(sessions[0].paneHeight).toBe(24); // fallback
  });
});

// ---------------------------------------------------------------------------
// getMiclawPids
// ---------------------------------------------------------------------------

describe("getMiclawPids", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns pane PIDs and their children", () => {
    // First call: listMiclawSessions tmux call
    vi.mocked(execFileSync)
      .mockReturnValueOnce("miclaw-a\t1700000000\t0\t80\t24\t100\tClaude")
      // pgrep call for pid 100
      .mockReturnValueOnce("200\n300\n");

    const pids = getMiclawPids();
    expect(pids.has(100)).toBe(true);
    expect(pids.has(200)).toBe(true);
    expect(pids.has(300)).toBe(true);
  });

  it("returns empty set when tmux is not running", () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error("no server");
    });
    expect(getMiclawPids().size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// killSession
// ---------------------------------------------------------------------------

describe("killSession", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("kills a miclaw session", () => {
    killSession("miclaw-test");
    expect(execFileSync).toHaveBeenCalledWith(
      "tmux",
      ["kill-session", "-t", "miclaw-test"],
      expect.objectContaining({ timeout: 3000 }),
    );
  });

  it("throws when trying to kill a non-miclaw session", () => {
    expect(() => killSession("other-session")).toThrow("Can only kill miclaw sessions");
  });
});

// ---------------------------------------------------------------------------
// capturePane
// ---------------------------------------------------------------------------

describe("capturePane", () => {
  it("returns tmux capture output", () => {
    vi.mocked(execFileSync).mockReturnValue("terminal content here\n");
    const result = capturePane("miclaw-test");
    expect(result).toBe("terminal content here\n");
  });
});

// ---------------------------------------------------------------------------
// sendKeys
// ---------------------------------------------------------------------------

describe("sendKeys", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("sends literal text to a miclaw session", () => {
    sendKeys("miclaw-test", "hello");
    expect(execFileSync).toHaveBeenCalledWith(
      "tmux",
      ["send-keys", "-t", "miclaw-test", "-l", "hello"],
      expect.objectContaining({ timeout: 3000 }),
    );
  });

  it("throws when targeting a non-miclaw session", () => {
    expect(() => sendKeys("other", "hi")).toThrow("Can only send to miclaw sessions");
  });
});

// ---------------------------------------------------------------------------
// sendSpecialKey
// ---------------------------------------------------------------------------

describe("sendSpecialKey", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("maps Enter to tmux Enter key", () => {
    sendSpecialKey("miclaw-test", "Enter");
    expect(execFileSync).toHaveBeenCalledWith(
      "tmux",
      ["send-keys", "-t", "miclaw-test", "Enter"],
      expect.any(Object),
    );
  });

  it("maps Ctrl+C to C-c", () => {
    sendSpecialKey("miclaw-test", "Ctrl+C");
    expect(execFileSync).toHaveBeenCalledWith(
      "tmux",
      ["send-keys", "-t", "miclaw-test", "C-c"],
      expect.any(Object),
    );
  });

  it("maps ArrowUp to Up", () => {
    sendSpecialKey("miclaw-test", "ArrowUp");
    expect(execFileSync).toHaveBeenCalledWith(
      "tmux",
      ["send-keys", "-t", "miclaw-test", "Up"],
      expect.any(Object),
    );
  });

  it("does nothing for unknown keys", () => {
    sendSpecialKey("miclaw-test", "F13");
    expect(execFileSync).not.toHaveBeenCalled();
  });

  it("throws when targeting a non-miclaw session", () => {
    expect(() => sendSpecialKey("other", "Enter")).toThrow("Can only send to miclaw sessions");
  });
});

// ---------------------------------------------------------------------------
// resizeSession
// ---------------------------------------------------------------------------

describe("resizeSession", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("resizes a miclaw session", () => {
    resizeSession("miclaw-test", 100, 40);
    expect(execFileSync).toHaveBeenCalledWith(
      "tmux",
      ["resize-window", "-t", "miclaw-test", "-x", "100", "-y", "40"],
      expect.any(Object),
    );
  });

  it("does nothing for non-miclaw sessions", () => {
    resizeSession("other-session", 100, 40);
    expect(execFileSync).not.toHaveBeenCalled();
  });

  it("swallows errors from resize", () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error("too small");
    });
    expect(() => resizeSession("miclaw-test", 10, 5)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// sessionExists
// ---------------------------------------------------------------------------

describe("sessionExists", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns true when session exists", () => {
    vi.mocked(execFileSync).mockReturnValue("");
    expect(sessionExists("miclaw-test")).toBe(true);
  });

  it("returns false when session does not exist", () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error("can't find session");
    });
    expect(sessionExists("miclaw-test")).toBe(false);
  });
});
