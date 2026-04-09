import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/healthCheck", () => ({
  runHealthCheck: vi.fn(),
}));

import { runHealthCheck } from "@/lib/healthCheck";
import { GET } from "../route";

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns healthy=true when all checks pass", async () => {
    vi.mocked(runHealthCheck).mockReturnValue({
      claude: { ok: true, path: "/usr/local/bin/claude" },
      nodePty: { ok: true },
      ptyServer: { ok: false, port: 3001, error: "not running" }, // PTY server not required for healthy
      nodeVersion: { ok: true, version: "v20.19.4" },
    });

    const response = await GET();
    const data = await response.json();

    expect(data.healthy).toBe(true);
    expect(data.claude.ok).toBe(true);
    expect(data.nodePty.ok).toBe(true);
  });

  it("returns healthy=false when claude is missing", async () => {
    vi.mocked(runHealthCheck).mockReturnValue({
      claude: { ok: false, error: "not found" },
      nodePty: { ok: true },
      ptyServer: { ok: true, port: 3001 },
      nodeVersion: { ok: true, version: "v20.19.4" },
    });

    const response = await GET();
    const data = await response.json();

    expect(data.healthy).toBe(false);
    expect(data.claude.ok).toBe(false);
  });

  it("returns healthy=false when node-pty is broken", async () => {
    vi.mocked(runHealthCheck).mockReturnValue({
      claude: { ok: true, path: "/usr/local/bin/claude" },
      nodePty: { ok: false, error: "spawn-helper missing" },
      ptyServer: { ok: true, port: 3001 },
      nodeVersion: { ok: true, version: "v20.19.4" },
    });

    const response = await GET();
    const data = await response.json();

    expect(data.healthy).toBe(false);
  });

  it("returns healthy=false when node version is too old", async () => {
    vi.mocked(runHealthCheck).mockReturnValue({
      claude: { ok: true, path: "/usr/local/bin/claude" },
      nodePty: { ok: true },
      ptyServer: { ok: true, port: 3001 },
      nodeVersion: { ok: false, version: "v18.0.0", error: "Node.js 20+ required" },
    });

    const response = await GET();
    const data = await response.json();

    expect(data.healthy).toBe(false);
  });

  it("does not require PTY server for healthy status", async () => {
    vi.mocked(runHealthCheck).mockReturnValue({
      claude: { ok: true, path: "/usr/local/bin/claude" },
      nodePty: { ok: true },
      ptyServer: { ok: false, port: 3001, error: "not running" },
      nodeVersion: { ok: true, version: "v20.19.4" },
    });

    const response = await GET();
    const data = await response.json();

    // PTY server is started on demand, so not required for health
    expect(data.healthy).toBe(true);
  });
});
