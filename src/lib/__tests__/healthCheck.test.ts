import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("child_process", () => ({
  execFileSync: vi.fn(),
}));

vi.mock("fs", () => ({
  existsSync: vi.fn(),
  accessSync: vi.fn(),
  chmodSync: vi.fn(),
  constants: { X_OK: 1 },
}));


import { execFileSync } from "child_process";
import { existsSync, accessSync, chmodSync } from "fs";
import {
  checkClaude,
  checkNodePty,
  checkPtyServer,
  checkNodeVersion,
  runHealthCheck,
} from "../healthCheck";

// ---------------------------------------------------------------------------
// checkClaude
// ---------------------------------------------------------------------------

describe("checkClaude", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns ok when claude is found in PATH", () => {
    vi.mocked(execFileSync).mockReturnValue("/usr/local/bin/claude\n");
    const result = checkClaude();
    expect(result.ok).toBe(true);
    expect(result.path).toBe("/usr/local/bin/claude");
  });

  it("returns not ok when which returns empty", () => {
    vi.mocked(execFileSync).mockReturnValue("");
    const result = checkClaude();
    expect(result.ok).toBe(false);
    expect(result.error).toContain("not found");
  });

  it("returns not ok when which throws", () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error("not found");
    });
    const result = checkClaude();
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Install");
  });
});

// ---------------------------------------------------------------------------
// checkNodePty
// ---------------------------------------------------------------------------

describe("checkNodePty", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns ok when spawn-helper is executable", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(accessSync).mockReturnValue(undefined);
    const result = checkNodePty();
    expect(result.ok).toBe(true);
  });

  it("auto-fixes permissions and returns ok", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(accessSync).mockImplementation(() => {
      throw new Error("EACCES");
    });
    vi.mocked(chmodSync).mockReturnValue(undefined);
    const result = checkNodePty();
    expect(result.ok).toBe(true);
    expect(chmodSync).toHaveBeenCalledWith(expect.any(String), 0o755);
  });

  it("returns not ok when chmod fails", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(accessSync).mockImplementation(() => {
      throw new Error("EACCES");
    });
    vi.mocked(chmodSync).mockImplementation(() => {
      throw new Error("EPERM");
    });
    const result = checkNodePty();
    expect(result.ok).toBe(false);
    expect(result.error).toContain("chmod");
  });

  it("returns not ok when spawn-helper does not exist", () => {
    vi.mocked(existsSync).mockReturnValue(false);
    const result = checkNodePty();
    expect(result.ok).toBe(false);
    expect(result.error).toContain("not found");
  });
});

// ---------------------------------------------------------------------------
// checkPtyServer
// ---------------------------------------------------------------------------

describe("checkPtyServer", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns ok when server is running", () => {
    vi.mocked(execFileSync).mockReturnValue("12345\n");
    const result = checkPtyServer(3001);
    expect(result.ok).toBe(true);
    expect(result.port).toBe(3001);
  });

  it("returns not ok when lsof finds nothing", () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error("no process");
    });
    const result = checkPtyServer(3001);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("3001");
  });
});

// ---------------------------------------------------------------------------
// checkNodeVersion
// ---------------------------------------------------------------------------

describe("checkNodeVersion", () => {
  it("returns ok for current node version (>= 20)", () => {
    const result = checkNodeVersion(20);
    const major = parseInt(process.version.slice(1).split(".")[0], 10);
    if (major >= 20) {
      expect(result.ok).toBe(true);
    } else {
      expect(result.ok).toBe(false);
    }
    expect(result.version).toBe(process.version);
  });

  it("returns not ok when min version is higher than current", () => {
    const result = checkNodeVersion(999);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("999");
  });

  it("returns ok when min version is 1", () => {
    const result = checkNodeVersion(1);
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// runHealthCheck
// ---------------------------------------------------------------------------

describe("runHealthCheck", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns all check results", () => {
    vi.mocked(execFileSync).mockReturnValue("/usr/local/bin/claude\n");
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(accessSync).mockReturnValue(undefined);

    const result = runHealthCheck();
    expect(result).toHaveProperty("claude");
    expect(result).toHaveProperty("nodePty");
    expect(result).toHaveProperty("ptyServer");
    expect(result).toHaveProperty("nodeVersion");
  });
});
