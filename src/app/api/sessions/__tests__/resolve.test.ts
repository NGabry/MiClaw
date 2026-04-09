import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("child_process", () => ({
  execFile: vi.fn(),
}));

vi.mock("fs/promises", () => ({
  stat: vi.fn(),
}));

import { execFile } from "child_process";
import { stat } from "fs/promises";
import { POST } from "../resolve/route";

describe("POST /api/sessions/resolve", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("resolves a file name to its full path", async () => {
    vi.mocked(execFile).mockImplementation(
      (_cmd: string, _args: unknown, _opts: unknown, cb: unknown) => {
        (cb as Function)(null, "/Users/test/Desktop/myfile.txt\n/Users/test/Downloads/myfile.txt\n");
        return {} as ReturnType<typeof execFile>;
      },
    );

    vi.mocked(stat).mockResolvedValue({
      isDirectory: () => false,
      isFile: () => true,
    } as Awaited<ReturnType<typeof stat>>);

    const request = new Request("http://localhost/api/sessions/resolve", {
      method: "POST",
      body: JSON.stringify({ name: "myfile.txt" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.path).toBe("/Users/test/Desktop/myfile.txt");
  });

  it("resolves a directory name", async () => {
    vi.mocked(execFile).mockImplementation(
      (_cmd: string, _args: unknown, _opts: unknown, cb: unknown) => {
        (cb as Function)(null, "/Users/test/Desktop/mydir\n");
        return {} as ReturnType<typeof execFile>;
      },
    );

    vi.mocked(stat).mockResolvedValue({
      isDirectory: () => true,
      isFile: () => false,
    } as Awaited<ReturnType<typeof stat>>);

    const request = new Request("http://localhost/api/sessions/resolve", {
      method: "POST",
      body: JSON.stringify({ name: "mydir", isDirectory: true }),
    });

    const response = await POST(request);
    const data = await response.json();
    expect(data.path).toBe("/Users/test/Desktop/mydir");
  });

  it("returns 400 when name is missing", async () => {
    const request = new Request("http://localhost/api/sessions/resolve", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns 400 when name is empty string", async () => {
    const request = new Request("http://localhost/api/sessions/resolve", {
      method: "POST",
      body: JSON.stringify({ name: "" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns 404 when file not found", async () => {
    vi.mocked(execFile).mockImplementation(
      (_cmd: string, _args: unknown, _opts: unknown, cb: unknown) => {
        (cb as Function)(new Error("not found"), "");
        return {} as ReturnType<typeof execFile>;
      },
    );

    const request = new Request("http://localhost/api/sessions/resolve", {
      method: "POST",
      body: JSON.stringify({ name: "nonexistent.txt" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(404);
  });

  it("returns 404 when basename does not match exactly", async () => {
    vi.mocked(execFile).mockImplementation(
      (_cmd: string, _args: unknown, _opts: unknown, cb: unknown) => {
        // Returns a path where basename differs
        (cb as Function)(null, "/Users/test/myfile-copy.txt\n");
        return {} as ReturnType<typeof execFile>;
      },
    );

    const request = new Request("http://localhost/api/sessions/resolve", {
      method: "POST",
      body: JSON.stringify({ name: "myfile.txt" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(404);
  });
});
