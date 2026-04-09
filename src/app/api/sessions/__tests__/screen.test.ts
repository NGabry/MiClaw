import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("child_process", () => ({
  execSync: vi.fn(),
  execFileSync: vi.fn(),
}));

import { execSync, execFileSync } from "child_process";
import { POST } from "../screen/route";

describe("POST /api/sessions/screen", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns terminal tab history", async () => {
    vi.mocked(execSync).mockReturnValue("ttys001\n");
    vi.mocked(execFileSync).mockReturnValue("$ claude\nHello! How can I help?\n");

    const request = new Request("http://localhost/api/sessions/screen", {
      method: "POST",
      body: JSON.stringify({ pid: 12345 }),
    });

    const response = await POST(request);
    const data = await response.json();
    expect(data.screen).toBe("$ claude\nHello! How can I help?\n");
  });

  it("returns 400 when pid is not a number", async () => {
    const request = new Request("http://localhost/api/sessions/screen", {
      method: "POST",
      body: JSON.stringify({ pid: "abc" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns 404 when TTY not found", async () => {
    vi.mocked(execSync).mockReturnValue("");

    const request = new Request("http://localhost/api/sessions/screen", {
      method: "POST",
      body: JSON.stringify({ pid: 12345 }),
    });

    const response = await POST(request);
    expect(response.status).toBe(404);
  });

  it("returns 404 when terminal tab not found", async () => {
    vi.mocked(execSync).mockReturnValue("ttys001\n");
    vi.mocked(execFileSync).mockReturnValue("NOT_FOUND");

    const request = new Request("http://localhost/api/sessions/screen", {
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

    const request = new Request("http://localhost/api/sessions/screen", {
      method: "POST",
      body: JSON.stringify({ pid: 12345 }),
    });

    const response = await POST(request);
    expect(response.status).toBe(500);
  });
});
