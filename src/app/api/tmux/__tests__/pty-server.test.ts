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
    vi.mocked(execSync).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // First call: lsof check (server not running)
        throw new Error("no process");
      }
      // Second call: starting the server
      return "";
    });

    const response = await GET();
    const data = await response.json();

    expect(data.running).toBe(true);
    expect(execSync).toHaveBeenCalledTimes(2);
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
