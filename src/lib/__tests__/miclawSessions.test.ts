import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fs before importing the module
vi.mock("fs", () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(),
}));

vi.mock("crypto", () => ({
  randomBytes: vi.fn(() => ({
    toString: () => "deadbeef",
  })),
}));

import { readFileSync, writeFileSync, existsSync } from "fs";
import {
  listSessions,
  createSession,
  updateSession,
  removeSession,
  getSession,
} from "../miclawSessions";

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const sampleSessions = [
  {
    id: "miclaw-test",
    displayName: "test",
    cwd: "/Users/test/project",
    created: 1700000000000,
  },
  {
    id: "miclaw-other",
    displayName: "other",
    cwd: "/Users/test/other",
    created: 1700000001000,
  },
];

// ---------------------------------------------------------------------------
// listSessions
// ---------------------------------------------------------------------------

describe("listSessions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns sessions from the file", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(sampleSessions));

    const result = listSessions();
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("miclaw-test");
  });

  it("returns empty array when file does not exist", () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const result = listSessions();
    expect(result).toEqual([]);
  });

  it("returns empty array when file is corrupt", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue("not-json");

    const result = listSessions();
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// createSession
// ---------------------------------------------------------------------------

describe("createSession", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue("[]");
  });

  it("creates a session with a display name", () => {
    const session = createSession("my-session", "/Users/test/cwd");
    expect(session.id).toBe("miclaw-my-session");
    expect(session.displayName).toBe("my-session");
    expect(session.cwd).toBe("/Users/test/cwd");
    expect(session.created).toBeGreaterThan(0);
    expect(writeFileSync).toHaveBeenCalled();
  });

  it("creates a session with a random ID when no name given", () => {
    const session = createSession();
    expect(session.id).toBe("miclaw-deadbeef");
    expect(session.displayName).toBe("deadbeef");
  });

  it("sanitizes display name for ID", () => {
    const session = createSession("My Session!@#");
    expect(session.id).toBe("miclaw-My-Session---");
  });

  it("resolves ~ in cwd", () => {
    const session = createSession("test", "~/Desktop");
    expect(session.cwd).toContain("/Desktop");
    expect(session.cwd).not.toContain("~");
  });

  it("defaults cwd to ~/Desktop when not provided", () => {
    const session = createSession("test");
    expect(session.cwd).toContain("/Desktop");
  });

  it("stores optional configuration", () => {
    const session = createSession("test", "/cwd", "resume-123", {
      permissionMode: "plan",
      model: "sonnet",
      allowedTools: "Read,Write",
      appendSystemPrompt: "Be careful",
      worktree: true,
    });
    expect(session.claudeSessionId).toBe("resume-123");
    expect(session.permissionMode).toBe("plan");
    expect(session.model).toBe("sonnet");
    expect(session.allowedTools).toBe("Read,Write");
    expect(session.appendSystemPrompt).toBe("Be careful");
    expect(session.worktree).toBe(true);
  });

  it("stores killPid for adopt flow", () => {
    const session = createSession("adopted", "/cwd", "resume-456", {
      killPid: 12345,
    });
    expect(session.claudeSessionId).toBe("resume-456");
    expect(session.killPid).toBe(12345);
  });

  it("appends to existing sessions", () => {
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(sampleSessions));
    createSession("new");

    const writeCall = vi.mocked(writeFileSync).mock.calls[0];
    const written = JSON.parse(writeCall[1] as string);
    expect(written).toHaveLength(3);
  });

  it("appends random suffix when ID already exists", () => {
    const existing = [{ id: "miclaw-dupe", displayName: "dupe", cwd: "/tmp", created: 1 }];
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(existing));

    const session = createSession("dupe");
    expect(session.id).toBe("miclaw-dupe-deadbeef");
    expect(session.displayName).toBe("dupe");
  });

  it("keeps base ID when no collision", () => {
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(sampleSessions));

    const session = createSession("unique-name");
    expect(session.id).toBe("miclaw-unique-name");
  });
});

// ---------------------------------------------------------------------------
// updateSession
// ---------------------------------------------------------------------------

describe("updateSession", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(sampleSessions));
  });

  it("updates an existing session", () => {
    updateSession("miclaw-test", { displayName: "updated" });

    const writeCall = vi.mocked(writeFileSync).mock.calls[0];
    const written = JSON.parse(writeCall[1] as string);
    expect(written[0].displayName).toBe("updated");
    expect(written[0].id).toBe("miclaw-test");
  });

  it("does nothing for a non-existent session", () => {
    updateSession("nonexistent", { displayName: "nope" });
    expect(writeFileSync).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// removeSession
// ---------------------------------------------------------------------------

describe("removeSession", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(sampleSessions));
  });

  it("removes a session by ID", () => {
    removeSession("miclaw-test");

    const writeCall = vi.mocked(writeFileSync).mock.calls[0];
    const written = JSON.parse(writeCall[1] as string);
    expect(written).toHaveLength(1);
    expect(written[0].id).toBe("miclaw-other");
  });

  it("writes unchanged array when ID not found", () => {
    removeSession("nonexistent");

    const writeCall = vi.mocked(writeFileSync).mock.calls[0];
    const written = JSON.parse(writeCall[1] as string);
    expect(written).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// getSession
// ---------------------------------------------------------------------------

describe("getSession", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(sampleSessions));
  });

  it("returns a session by ID", () => {
    const result = getSession("miclaw-test");
    expect(result).toBeDefined();
    expect(result!.displayName).toBe("test");
  });

  it("returns undefined for unknown ID", () => {
    expect(getSession("nonexistent")).toBeUndefined();
  });
});
