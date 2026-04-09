import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("child_process", () => ({
  execFileSync: vi.fn(),
}));

import { execFileSync } from "child_process";
import { POST } from "../colors/route";

describe("POST /api/sessions/colors", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns terminal colors JSON", async () => {
    const mockColors = JSON.stringify({
      bg: "#2b2a27",
      fg: "#faf9f5",
      ansi: ["#000", "#f00", "#0f0"],
    });

    vi.mocked(execFileSync).mockReturnValue(mockColors);

    const response = await POST();
    const text = await response.text();
    const data = JSON.parse(text);

    expect(response.status).toBe(200);
    expect(data.bg).toBe("#2b2a27");
    expect(data.fg).toBe("#faf9f5");
  });

  it("returns 500 when python script fails", async () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error("python3 not found");
    });

    const response = await POST();
    expect(response.status).toBe(500);
    const data = JSON.parse(await response.text());
    expect(data.error).toContain("python3");
  });
});
