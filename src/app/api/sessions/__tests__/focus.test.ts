import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("child_process", () => ({
  execSync: vi.fn(),
  execFileSync: vi.fn(),
}));

import { execSync, execFileSync } from "child_process";
import { POST } from "../focus/route";

describe("POST /api/sessions/focus", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("brings a terminal window to front", async () => {
    vi.mocked(execSync).mockReturnValue("ttys001\n");
    vi.mocked(execFileSync).mockReturnValue("ok");

    const request = new Request("http://localhost/api/sessions/focus", {
      method: "POST",
      body: JSON.stringify({ pid: 12345 }),
    });

    const response = await POST(request);
    const data = await response.json();
    expect(data.success).toBe(true);
  });

  it("returns 400 for invalid PID type", async () => {
    const request = new Request("http://localhost/api/sessions/focus", {
      method: "POST",
      body: JSON.stringify({ pid: "not-a-number" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns 404 when TTY not found", async () => {
    vi.mocked(execSync).mockReturnValue("");

    const request = new Request("http://localhost/api/sessions/focus", {
      method: "POST",
      body: JSON.stringify({ pid: 12345 }),
    });

    const response = await POST(request);
    expect(response.status).toBe(404);
  });

  it("returns 404 when terminal tab not found", async () => {
    vi.mocked(execSync).mockReturnValue("ttys001\n");
    vi.mocked(execFileSync).mockReturnValue("not found");

    const request = new Request("http://localhost/api/sessions/focus", {
      method: "POST",
      body: JSON.stringify({ pid: 12345 }),
    });

    const response = await POST(request);
    expect(response.status).toBe(404);
  });

  it("returns 500 on error", async () => {
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error("ps failed");
    });

    const request = new Request("http://localhost/api/sessions/focus", {
      method: "POST",
      body: JSON.stringify({ pid: 12345 }),
    });

    const response = await POST(request);
    expect(response.status).toBe(500);
  });
});
