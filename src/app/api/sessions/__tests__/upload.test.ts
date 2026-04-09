import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("fs/promises", () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
  },
}));

import fs from "fs/promises";
import { POST } from "../upload/route";

describe("POST /api/sessions/upload", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
  });

  it("saves a base64 image to a temp file", async () => {
    const base64Data = Buffer.from("fake-png-data").toString("base64");
    const request = new Request("http://localhost/api/sessions/upload", {
      method: "POST",
      body: JSON.stringify({ data: base64Data, filename: "test.png" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.path).toContain("miclaw-uploads");
    expect(data.path).toMatch(/\.png$/);
    expect(fs.mkdir).toHaveBeenCalled();
    expect(fs.writeFile).toHaveBeenCalled();
  });

  it("strips data URL prefix", async () => {
    const base64Data = "data:image/png;base64," + Buffer.from("test").toString("base64");
    const request = new Request("http://localhost/api/sessions/upload", {
      method: "POST",
      body: JSON.stringify({ data: base64Data, filename: "test.png" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
  });

  it("defaults to .png extension when no filename", async () => {
    const request = new Request("http://localhost/api/sessions/upload", {
      method: "POST",
      body: JSON.stringify({ data: "aGVsbG8=" }),
    });

    const response = await POST(request);
    const data = await response.json();
    expect(data.path).toMatch(/\.png$/);
  });

  it("uses correct extension from filename", async () => {
    const request = new Request("http://localhost/api/sessions/upload", {
      method: "POST",
      body: JSON.stringify({ data: "aGVsbG8=", filename: "photo.jpg" }),
    });

    const response = await POST(request);
    const data = await response.json();
    expect(data.path).toMatch(/\.jpg$/);
  });

  it("returns 400 when data is missing", async () => {
    const request = new Request("http://localhost/api/sessions/upload", {
      method: "POST",
      body: JSON.stringify({ filename: "test.png" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns 400 when data is empty string", async () => {
    const request = new Request("http://localhost/api/sessions/upload", {
      method: "POST",
      body: JSON.stringify({ data: "" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
