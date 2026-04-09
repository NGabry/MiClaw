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

  it("returns running=true when PTY server is already running", async () => {
    // lsof finds the server
    vi.mocked(execSync).mockReturnValue("12345\n");

    const response = await GET();
    const data = await response.json();

    expect(data.running).toBe(true);
    expect(data.port).toBe(3001);
  });

  it("starts the PTY server when not running", async () => {
    let callCount = 0;
    vi.mocked(execSync).mockImplementation((cmd: unknown) => {
      callCount++;
      const cmdStr = String(cmd);
      if (cmdStr.includes("lsof")) {
        // lsof check: server not running
        throw new Error("no process");
      }
      // ensureSpawnHelper chmod or server start — both succeed
      return "";
    });

    const response = await GET();
    const data = await response.json();

    expect(data.running).toBe(true);
    // lsof (fail) + ensureSpawnHelper (chmod) + start server = 3 calls
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
