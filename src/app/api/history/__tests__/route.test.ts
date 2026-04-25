import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/historyScanner", () => ({
  scanHistory: vi.fn(),
}));

import { scanHistory } from "@/lib/historyScanner";
import { GET } from "../route";

const EMPTY_STATS = {
  totalSessions: 0,
  totalCostUSD: 0,
  totalInputTokens: 0,
  totalOutputTokens: 0,
  projects: [],
  dateRange: null,
  cacheStats: { totalInput: 0, totalCacheRead: 0, totalCacheCreate: 0, hitRate: 0, savedUSD: 0 },
  modelBreakdown: [],
  timeSeries: [],
  toolUsage: [],
  filesTouched: [],
};

describe("GET /api/history", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns session history with default params", async () => {
    vi.mocked(scanHistory).mockResolvedValue({
      sessions: [
        {
          sessionId: "s1",
          projectPath: "/test",
          projectName: "test",
          encodedProject: "-test",
          firstPrompt: "Fix bug",
          promptCount: 10,
          created: "2025-12-01T00:00:00Z",
          modified: "2025-12-01T01:00:00Z",
          jsonlPath: "/path/to/s1.jsonl",
          costUSD: 0.05,
          inputTokens: 1000,
          outputTokens: 500,
          model: "claude-sonnet-4-6",
        },
      ],
      stats: {
        ...EMPTY_STATS,
        totalSessions: 1,
        totalCostUSD: 0.05,
        totalInputTokens: 1000,
        totalOutputTokens: 500,
        projects: [{ name: "test", path: "/test", count: 1, costUSD: 0.05 }],
        dateRange: { earliest: "2025-12-01T00:00:00Z", latest: "2025-12-01T01:00:00Z" },
      },
      total: 1,
    });

    const request = new Request("http://localhost/api/history");
    const response = await GET(request);
    const data = await response.json();

    expect(data.sessions).toHaveLength(1);
    expect(data.stats.totalSessions).toBe(1);
    expect(scanHistory).toHaveBeenCalledWith({
      search: undefined,
      project: undefined,
      limit: 50,
      offset: 0,
      withCost: true,
      sinceDays: 0,
    });
  });

  it("passes search and filter query params", async () => {
    vi.mocked(scanHistory).mockResolvedValue({
      sessions: [],
      stats: EMPTY_STATS,
      total: 0,
    });

    const request = new Request("http://localhost/api/history?q=login&project=/test&limit=10&offset=20");
    await GET(request);

    expect(scanHistory).toHaveBeenCalledWith({
      search: "login",
      project: "/test",
      limit: 10,
      offset: 20,
      withCost: true,
      sinceDays: 0,
    });
  });

  it("supports withCost=false param", async () => {
    vi.mocked(scanHistory).mockResolvedValue({
      sessions: [],
      stats: EMPTY_STATS,
      total: 0,
    });

    const request = new Request("http://localhost/api/history?withCost=false");
    await GET(request);

    expect(scanHistory).toHaveBeenCalledWith(
      expect.objectContaining({ withCost: false }),
    );
  });

  it("passes sinceDays param when provided", async () => {
    vi.mocked(scanHistory).mockResolvedValue({
      sessions: [],
      stats: EMPTY_STATS,
      total: 0,
    });

    const request = new Request("http://localhost/api/history?sinceDays=7");
    await GET(request);

    expect(scanHistory).toHaveBeenCalledWith(
      expect.objectContaining({ sinceDays: 7 }),
    );
  });
});
