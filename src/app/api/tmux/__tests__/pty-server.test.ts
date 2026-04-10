import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("child_process", () => ({
  execSync: vi.fn(),
}));

import { execSync } from "child_process";
import { GET } from "../pty-server/route";

describe("GET /api/tmux/pty-server", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns running=true when Node.js PTY server is already running", async () => {
    vi.mocked(execSync).mockImplementation((cmd: unknown) => {
      const cmdStr = String(cmd);
      if (cmdStr.includes("lsof")) return "12345\n";
      if (cmdStr.includes("ps -p")) return "node helpers/pty-server.mjs 3001";
      return "";
    });

    const response = await GET();
    const data = await response.json();

    expect(data.running).toBe(true);
    expect(data.port).toBe(3001);
  });

  it("replaces stale non-Node PTY server on port", async () => {
    vi.mocked(execSync).mockImplementation((cmd: unknown) => {
      const cmdStr = String(cmd);
      if (cmdStr.includes("lsof")) return "99999\n";
      if (cmdStr.includes("ps -p")) return "python pty-server.py 3001";
      // kill, chmod, start — all succeed
      return "";
    });

    const response = await GET();
    const data = await response.json();

    expect(data.running).toBe(true);
    // Should have called kill to remove stale server
    const calls = vi.mocked(execSync).mock.calls.map((c) => String(c[0]));
    expect(calls.some((c) => c.includes("kill"))).toBe(true);
  });

  it("starts the PTY server when not running", async () => {
    let callCount = 0;
    vi.mocked(execSync).mockImplementation((cmd: unknown) => {
      callCount++;
      const cmdStr = String(cmd);
      if (cmdStr.includes("lsof")) {
        throw new Error("no process");
      }
      // ensureSpawnHelper chmod or server start — both succeed
      return "";
    });

    const response = await GET();
    const data = await response.json();

    expect(data.running).toBe(true);
    expect(callCount).toBeGreaterThanOrEqual(2);
  });

  it("returns 500 when server fails to start", async () => {
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error("failed");
    });

    const response = await GET();
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.running).toBe(false);
  });
});
