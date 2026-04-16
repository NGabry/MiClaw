import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("fs/promises", () => ({
  default: {
    readdir: vi.fn(),
    readFile: vi.fn(),
    stat: vi.fn(),
    open: vi.fn(),
  },
}));

import fs from "fs/promises";
import path from "path";
import { scanHistory } from "../historyScanner";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeHistoryLine(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    display: "Fix the login bug",
    timestamp: 1700000000000,
    project: "/Users/test/myproject",
    sessionId: "sess-001",
    ...overrides,
  });
}

/** Build a history.jsonl string from multiple lines */
function buildHistoryJsonl(lines: string[]): string {
  return lines.join("\n") + "\n";
}

function setupMocks(historyContent: string) {
  vi.mocked(fs.readFile).mockImplementation(async (filePath: unknown) => {
    if (String(filePath).includes("history.jsonl")) {
      return historyContent;
    }
    throw new Error("ENOENT");
  });

  // JSONL stat/open for cost reading — not found by default
  vi.mocked(fs.stat).mockRejectedValue(new Error("ENOENT"));
  vi.mocked(fs.open).mockRejectedValue(new Error("ENOENT"));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("scanHistory", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns empty when history.jsonl does not exist", async () => {
    vi.mocked(fs.readFile).mockRejectedValue(new Error("ENOENT"));
    const result = await scanHistory();
    expect(result.sessions).toEqual([]);
    expect(result.stats.totalSessions).toBe(0);
  });

  it("groups prompts by sessionId and computes counts", async () => {
    setupMocks(buildHistoryJsonl([
      makeHistoryLine({ sessionId: "s1", display: "First prompt", timestamp: 1000 }),
      makeHistoryLine({ sessionId: "s1", display: "Second prompt", timestamp: 2000 }),
      makeHistoryLine({ sessionId: "s1", display: "Third prompt", timestamp: 3000 }),
      makeHistoryLine({ sessionId: "s2", display: "Only prompt", timestamp: 1500 }),
    ]));

    const result = await scanHistory({ withCost: false });
    expect(result.sessions).toHaveLength(2);
    expect(result.total).toBe(2);

    const s1 = result.sessions.find((s) => s.sessionId === "s1");
    expect(s1?.promptCount).toBe(3);
    expect(s1?.firstPrompt).toBe("First prompt");

    const s2 = result.sessions.find((s) => s.sessionId === "s2");
    expect(s2?.promptCount).toBe(1);
  });

  it("sorts sessions by most recent activity descending", async () => {
    setupMocks(buildHistoryJsonl([
      makeHistoryLine({ sessionId: "old", timestamp: 1000 }),
      makeHistoryLine({ sessionId: "new", timestamp: 3000 }),
      makeHistoryLine({ sessionId: "mid", timestamp: 2000 }),
    ]));

    const result = await scanHistory({ withCost: false });
    expect(result.sessions.map((s) => s.sessionId)).toEqual(["new", "mid", "old"]);
  });

  it("filters by search query on firstPrompt", async () => {
    setupMocks(buildHistoryJsonl([
      makeHistoryLine({ sessionId: "s1", display: "Fix the login bug", timestamp: 1000 }),
      makeHistoryLine({ sessionId: "s2", display: "Add pagination feature", timestamp: 2000 }),
      makeHistoryLine({ sessionId: "s3", display: "Refactor database queries", timestamp: 3000 }),
    ]));

    const result = await scanHistory({ search: "pagination", withCost: false });
    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0].sessionId).toBe("s2");
  });

  it("filters by project", async () => {
    setupMocks(buildHistoryJsonl([
      makeHistoryLine({ sessionId: "s1", project: "/Users/test/projectA", timestamp: 1000 }),
      makeHistoryLine({ sessionId: "s2", project: "/Users/test/projectB", timestamp: 2000 }),
    ]));

    const result = await scanHistory({ project: "/Users/test/projectA", withCost: false });
    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0].sessionId).toBe("s1");
  });

  it("paginates with limit and offset", async () => {
    const lines = Array.from({ length: 10 }, (_, i) =>
      makeHistoryLine({ sessionId: `s${i}`, timestamp: (i + 1) * 1000 }),
    );
    setupMocks(buildHistoryJsonl(lines));

    const page1 = await scanHistory({ limit: 3, offset: 0, withCost: false });
    expect(page1.sessions).toHaveLength(3);
    expect(page1.total).toBe(10);
    expect(page1.sessions[0].sessionId).toBe("s9"); // most recent first

    const page2 = await scanHistory({ limit: 3, offset: 3, withCost: false });
    expect(page2.sessions).toHaveLength(3);
    expect(page2.sessions[0].sessionId).toBe("s6");
  });

  it("reports project counts in stats", async () => {
    setupMocks(buildHistoryJsonl([
      makeHistoryLine({ sessionId: "s1", project: "/A", timestamp: 1000 }),
      makeHistoryLine({ sessionId: "s2", project: "/A", timestamp: 2000 }),
      makeHistoryLine({ sessionId: "s3", project: "/B", timestamp: 3000 }),
    ]));

    const result = await scanHistory({ withCost: false });
    expect(result.stats.projects).toHaveLength(2);
    const projectA = result.stats.projects.find((p) => p.path === "/A");
    expect(projectA?.count).toBe(2);
  });

  it("search is case-insensitive", async () => {
    setupMocks(buildHistoryJsonl([
      makeHistoryLine({ sessionId: "s1", display: "Fix AUTHENTICATION Bug", timestamp: 1000 }),
    ]));

    const result = await scanHistory({ search: "authentication", withCost: false });
    expect(result.sessions).toHaveLength(1);
  });

  it("uses earliest and latest timestamps for created/modified", async () => {
    setupMocks(buildHistoryJsonl([
      makeHistoryLine({ sessionId: "s1", timestamp: 1000 }),
      makeHistoryLine({ sessionId: "s1", timestamp: 5000 }),
      makeHistoryLine({ sessionId: "s1", timestamp: 3000 }),
    ]));

    const result = await scanHistory({ withCost: false });
    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0].created).toBe(new Date(1000).toISOString());
    expect(result.sessions[0].modified).toBe(new Date(5000).toISOString());
  });

  it("derives projectName from project path basename", async () => {
    setupMocks(buildHistoryJsonl([
      makeHistoryLine({ sessionId: "s1", project: "/Users/test/my-cool-project", timestamp: 1000 }),
    ]));

    const result = await scanHistory({ withCost: false });
    expect(result.sessions[0].projectName).toBe("my-cool-project");
  });

  it("builds correct encodedProject and jsonlPath", async () => {
    setupMocks(buildHistoryJsonl([
      makeHistoryLine({ sessionId: "sess-abc", project: "/Users/test/proj", timestamp: 1000 }),
    ]));

    const result = await scanHistory({ withCost: false });
    expect(result.sessions[0].encodedProject).toBe("-Users-test-proj");
    expect(result.sessions[0].jsonlPath).toContain(
      path.join("-Users-test-proj", "sess-abc.jsonl"),
    );
  });
});
