import { describe, it, expect, vi, beforeEach } from "vitest";
import { homedir } from "os";

const HOME = homedir();

// Mock dependencies
vi.mock("fs/promises", () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined),
    rm: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("gray-matter", () => ({
  default: {
    stringify: vi.fn((body: string, frontmatter: Record<string, unknown>) => {
      const yaml = Object.entries(frontmatter)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n");
      return `---\n${yaml}\n---\n${body}`;
    }),
  },
}));

import fs from "fs/promises";
import { revalidatePath } from "next/cache";
import { saveAgent, saveSkill, saveCommand, saveInstructionFile, deleteItem } from "../actions";

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(data)) {
    fd.set(key, value);
  }
  return fd;
}

// ---------------------------------------------------------------------------
// saveAgent
// ---------------------------------------------------------------------------

describe("saveAgent", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
  });

  it("saves a global agent", async () => {
    const result = await saveAgent(
      makeFormData({
        name: "test-agent",
        description: "A test agent",
        model: "sonnet",
        body: "Agent instructions",
        scopeType: "global",
        scopePath: "",
      }),
    );

    expect(result.success).toBe(true);
    expect(fs.mkdir).toHaveBeenCalled();
    expect(fs.writeFile).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalled();
  });

  it("saves a project agent", async () => {
    const homedir = HOME;
    const result = await saveAgent(
      makeFormData({
        name: "proj-agent",
        description: "Project agent",
        model: "",
        body: "body",
        scopeType: "project",
        scopePath: `${homedir}/.claude/test-project`,
      }),
    );

    expect(result.success).toBe(true);
  });

  it("fails when name is missing", async () => {
    const result = await saveAgent(
      makeFormData({ name: "", description: "desc", body: "b", scopeType: "global", scopePath: "" }),
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain("required");
  });

  it("fails when description is missing", async () => {
    const result = await saveAgent(
      makeFormData({ name: "x", description: "", body: "b", scopeType: "global", scopePath: "" }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects paths outside HOME_DIR/.claude", async () => {
    const result = await saveAgent(
      makeFormData({
        name: "agent",
        description: "desc",
        body: "",
        scopeType: "project",
        scopePath: "/tmp/evil",
      }),
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid write path");
  });

  it("deletes old file on rename", async () => {
    const homedir = HOME;
    // The new path will be GLOBAL_AGENTS_DIR/new-name.md
    // The old path must differ but still be valid (inside HOME_DIR with .claude)
    const oldPath = `${homedir}/.claude/agents/old-name.md`;

    // The issue is that saveAgent writes to GLOBAL_AGENTS_DIR which is HOME_DIR/.claude/agents
    // We need writeFile to succeed first
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(fs.unlink).mockResolvedValue(undefined);

    const result = await saveAgent(
      makeFormData({
        name: "new-name",
        description: "desc",
        body: "",
        scopeType: "global",
        scopePath: "",
        filePath: oldPath,
      }),
    );

    expect(result.success).toBe(true);
    expect(fs.unlink).toHaveBeenCalledWith(oldPath);
  });

  it("does not delete when path unchanged", async () => {
    const homedir = HOME;
    const samePath = `${homedir}/.claude/agents/same.md`;
    await saveAgent(
      makeFormData({
        name: "same",
        description: "desc",
        body: "",
        scopeType: "global",
        scopePath: "",
        filePath: samePath,
      }),
    );

    expect(fs.unlink).not.toHaveBeenCalled();
  });

  it("returns error on filesystem failure", async () => {
    vi.mocked(fs.writeFile).mockRejectedValue(new Error("EACCES"));
    const result = await saveAgent(
      makeFormData({
        name: "fail",
        description: "desc",
        body: "",
        scopeType: "global",
        scopePath: "",
      }),
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain("EACCES");
  });
});

// ---------------------------------------------------------------------------
// saveSkill
// ---------------------------------------------------------------------------

describe("saveSkill", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
  });

  it("saves a global skill in its own directory", async () => {
    const result = await saveSkill(
      makeFormData({
        name: "test-skill",
        description: "A test skill",
        body: "Skill body",
        scopeType: "global",
        scopePath: "",
      }),
    );

    expect(result.success).toBe(true);
    // Should create skills/test-skill/SKILL.md
    const writePath = vi.mocked(fs.writeFile).mock.calls[0][0] as string;
    expect(writePath).toContain("test-skill/SKILL.md");
  });

  it("fails when name or description missing", async () => {
    const r1 = await saveSkill(makeFormData({ name: "", description: "d", body: "", scopeType: "global", scopePath: "" }));
    expect(r1.success).toBe(false);

    const r2 = await saveSkill(makeFormData({ name: "x", description: "", body: "", scopeType: "global", scopePath: "" }));
    expect(r2.success).toBe(false);
  });

  it("includes userInvocable when set", async () => {
    await saveSkill(
      makeFormData({
        name: "invocable",
        description: "desc",
        userInvocable: "on",
        argumentHint: "<file>",
        body: "",
        scopeType: "global",
        scopePath: "",
      }),
    );
    expect(fs.writeFile).toHaveBeenCalled();
  });

  it("deletes old skill directory on rename", async () => {
    const homedir = HOME;
    const oldPath = `${homedir}/.claude/skills/old-skill/SKILL.md`;
    await saveSkill(
      makeFormData({
        name: "new-skill",
        description: "desc",
        body: "",
        scopeType: "global",
        scopePath: "",
        filePath: oldPath,
      }),
    );

    expect(fs.rm).toHaveBeenCalledWith(
      expect.stringContaining("old-skill"),
      { recursive: true },
    );
  });
});

// ---------------------------------------------------------------------------
// saveCommand
// ---------------------------------------------------------------------------

describe("saveCommand", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
  });

  it("saves a command file", async () => {
    const homedir = HOME;
    const result = await saveCommand(
      makeFormData({
        name: "deploy",
        body: "Deploy instructions",
        scopePath: `${homedir}/.claude/test`,
      }),
    );

    expect(result.success).toBe(true);
    const writePath = vi.mocked(fs.writeFile).mock.calls[0][0] as string;
    expect(writePath).toContain("commands/deploy.md");
  });

  it("fails when name is missing", async () => {
    const result = await saveCommand(makeFormData({ name: "", body: "", scopePath: "/tmp" }));
    expect(result.success).toBe(false);
  });

  it("rejects invalid paths", async () => {
    const result = await saveCommand(
      makeFormData({ name: "evil", body: "", scopePath: "/tmp/evil" }),
    );
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// saveInstructionFile
// ---------------------------------------------------------------------------

describe("saveInstructionFile", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
  });

  it("saves content to a file path", async () => {
    const homedir = HOME;
    const result = await saveInstructionFile(
      makeFormData({
        filePath: `${homedir}/project/CLAUDE.md`,
        content: "# Rules",
      }),
    );
    expect(result.success).toBe(true);
  });

  it("fails when filePath is missing", async () => {
    const result = await saveInstructionFile(makeFormData({ filePath: "", content: "x" }));
    expect(result.success).toBe(false);
  });

  it("rejects paths outside HOME_DIR", async () => {
    const result = await saveInstructionFile(
      makeFormData({ filePath: "/etc/passwd", content: "bad" }),
    );
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// deleteItem
// ---------------------------------------------------------------------------

describe("deleteItem", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(fs.unlink).mockResolvedValue(undefined);
    vi.mocked(fs.rm).mockResolvedValue(undefined);
  });

  it("deletes a file for non-skill items", async () => {
    const homedir = HOME;
    const result = await deleteItem(
      makeFormData({
        filePath: `${homedir}/.claude/agents/old.md`,
        itemType: "agent",
      }),
    );
    expect(result.success).toBe(true);
    expect(fs.unlink).toHaveBeenCalled();
  });

  it("deletes the entire skill directory for skill items", async () => {
    const homedir = HOME;
    const result = await deleteItem(
      makeFormData({
        filePath: `${homedir}/.claude/skills/my-skill/SKILL.md`,
        itemType: "skill",
      }),
    );
    expect(result.success).toBe(true);
    expect(fs.rm).toHaveBeenCalledWith(
      expect.stringContaining("my-skill"),
      { recursive: true },
    );
  });

  it("rejects invalid paths", async () => {
    const result = await deleteItem(
      makeFormData({ filePath: "/tmp/evil", itemType: "agent" }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects empty filePath", async () => {
    const result = await deleteItem(
      makeFormData({ filePath: "", itemType: "agent" }),
    );
    expect(result.success).toBe(false);
  });

  it("returns error on filesystem failure", async () => {
    const homedir = HOME;
    vi.mocked(fs.unlink).mockRejectedValue(new Error("ENOENT"));
    const result = await deleteItem(
      makeFormData({
        filePath: `${homedir}/.claude/agents/missing.md`,
        itemType: "agent",
      }),
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain("ENOENT");
  });
});
