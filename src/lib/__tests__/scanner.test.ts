import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "path";
import { homedir } from "os";

// Mock fs/promises
vi.mock("fs/promises", () => ({
  default: {
    access: vi.fn(),
    readdir: vi.fn(),
    readFile: vi.fn(),
    stat: vi.fn(),
  },
}));

import fs from "fs/promises";

// We need to dynamically import scanner after mocks are in place
// to ensure the mocks are applied
let scanClaudeConfig: typeof import("../scanner").scanClaudeConfig;

beforeAll(async () => {
  const mod = await import("../scanner");
  scanClaudeConfig = mod.scanClaudeConfig;
});

const HOME = homedir();
const CLAUDE_DIR = path.join(HOME, ".claude");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFileSystem(files: Record<string, string | object>) {
  const filePaths = new Set(Object.keys(files));
  // Also add parent directories
  const dirPaths = new Set<string>();
  for (const f of filePaths) {
    let dir = path.dirname(f);
    while (dir !== "/") {
      dirPaths.add(dir);
      dir = path.dirname(dir);
    }
  }

  vi.mocked(fs.access).mockImplementation(async (p: unknown) => {
    const pathStr = String(p);
    if (filePaths.has(pathStr) || dirPaths.has(pathStr)) return;
    throw new Error("ENOENT");
  });

  vi.mocked(fs.readFile).mockImplementation(async (p: unknown) => {
    const pathStr = String(p);
    if (filePaths.has(pathStr)) {
      const content = files[pathStr];
      return typeof content === "string" ? content : JSON.stringify(content);
    }
    throw new Error("ENOENT");
  });

  vi.mocked(fs.readdir).mockImplementation(async (p: unknown, opts?: unknown) => {
    const pathStr = String(p);
    const entries: { name: string; isDirectory: () => boolean; isFile: () => boolean }[] = [];

    for (const f of filePaths) {
      if (path.dirname(f) === pathStr) {
        const isDir = dirPaths.has(f);
        entries.push({
          name: path.basename(f),
          isDirectory: () => isDir,
          isFile: () => !isDir,
        });
      }
    }

    // Also add subdirectories
    for (const d of dirPaths) {
      if (path.dirname(d) === pathStr && !entries.some((e) => e.name === path.basename(d))) {
        entries.push({
          name: path.basename(d),
          isDirectory: () => true,
          isFile: () => false,
        });
      }
    }

    if (opts && typeof opts === "object" && "withFileTypes" in opts) {
      return entries as unknown as Awaited<ReturnType<typeof fs.readdir>>;
    }
    return entries.map((e) => e.name) as unknown as Awaited<ReturnType<typeof fs.readdir>>;
  });
}

// ---------------------------------------------------------------------------
// scanClaudeConfig
// ---------------------------------------------------------------------------

describe("scanClaudeConfig", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns empty config when no claude directories exist", async () => {
    // All fs operations fail
    vi.mocked(fs.access).mockRejectedValue(new Error("ENOENT"));
    vi.mocked(fs.readdir).mockRejectedValue(new Error("ENOENT"));
    vi.mocked(fs.readFile).mockRejectedValue(new Error("ENOENT"));

    const config = await scanClaudeConfig();
    expect(config.agents).toEqual([]);
    expect(config.skills).toEqual([]);
    expect(config.commands).toEqual([]);
    expect(config.keybindings).toEqual([]);
    expect(config.projects).toEqual([]);
  });

  it("scans global agents", async () => {
    const agentPath = path.join(CLAUDE_DIR, "agents", "test-agent.md");
    mockFileSystem({
      [agentPath]: `---
name: test-agent
description: A test agent
model: sonnet
---

Agent body here.`,
      [path.join(CLAUDE_DIR, "settings.json")]: "{}",
    });

    const config = await scanClaudeConfig();
    expect(config.agents.length).toBeGreaterThanOrEqual(1);
    const agent = config.agents.find((a) => a.frontmatter.name === "test-agent");
    expect(agent).toBeDefined();
    expect(agent!.frontmatter.description).toBe("A test agent");
    expect(agent!.scope.type).toBe("global");
  });

  it("scans global keybindings", async () => {
    const keybindingsPath = path.join(CLAUDE_DIR, "keybindings.json");
    mockFileSystem({
      [keybindingsPath]: JSON.stringify([
        { key: "ctrl+s", command: "save" },
      ]),
      [path.join(CLAUDE_DIR, "settings.json")]: "{}",
    });

    const config = await scanClaudeConfig();
    expect(config.keybindings).toHaveLength(1);
    expect(config.keybindings[0].key).toBe("ctrl+s");
  });

  it("returns empty keybindings for invalid JSON", async () => {
    const keybindingsPath = path.join(CLAUDE_DIR, "keybindings.json");
    mockFileSystem({
      [keybindingsPath]: "not-json",
      [path.join(CLAUDE_DIR, "settings.json")]: "{}",
    });

    const config = await scanClaudeConfig();
    expect(config.keybindings).toEqual([]);
  });

  it("scans global settings with hooks", async () => {
    const settingsPath = path.join(CLAUDE_DIR, "settings.json");
    mockFileSystem({
      [settingsPath]: JSON.stringify({
        model: "sonnet",
        hooks: {
          PreToolUse: [{ matcher: "*", hooks: [{ type: "command", command: "echo" }] }],
        },
      }),
    });

    const config = await scanClaudeConfig();
    expect(config.globalSettings.hooks).toBeDefined();
    expect(config.globalSettings.hooks!.PreToolUse).toHaveLength(1);
  });

  it("scans global MCP config from ~/.claude.json", async () => {
    const claudeJsonPath = path.join(HOME, ".claude.json");
    mockFileSystem({
      [claudeJsonPath]: JSON.stringify({
        mcpServers: {
          neon: { type: "stdio", command: "npx", args: ["@neondatabase/mcp-server-neon"] },
        },
      }),
      [path.join(CLAUDE_DIR, "settings.json")]: "{}",
    });

    const config = await scanClaudeConfig();
    expect(config.mcpConfigs.length).toBeGreaterThanOrEqual(1);
    const neon = config.mcpConfigs.flatMap((c) => c.servers).find((s) => s.name === "neon");
    expect(neon).toBeDefined();
    expect(neon!.type).toBe("stdio");
  });

  it("returns empty MCP config when no servers defined", async () => {
    mockFileSystem({
      [path.join(HOME, ".claude.json")]: "{}",
      [path.join(CLAUDE_DIR, "settings.json")]: "{}",
    });

    const config = await scanClaudeConfig();
    // May have 0 or more depending on other scanning, but neon shouldn't be there
    const neon = config.mcpConfigs.flatMap((c) => c.servers).find((s) => s.name === "neon");
    expect(neon).toBeUndefined();
  });

  it("handles agents without a name in frontmatter (uses filename)", async () => {
    const agentPath = path.join(CLAUDE_DIR, "agents", "fallback-name.md");
    mockFileSystem({
      [agentPath]: `---
description: No name provided
---

Body`,
      [path.join(CLAUDE_DIR, "settings.json")]: "{}",
    });

    const config = await scanClaudeConfig();
    const agent = config.agents.find((a) => a.frontmatter.name === "fallback-name");
    expect(agent).toBeDefined();
  });
});
