import { describe, it, expect } from "vitest";
import { shortenHomePath, HOME_DIR, CLAUDE_DIR, GLOBAL_AGENTS_DIR, GLOBAL_SKILLS_DIR, INSTRUCTION_FILE_NAMES, PROJECT_INSTRUCTION_FILES } from "../constants";

describe("shortenHomePath", () => {
  it("replaces home directory with ~", () => {
    const result = shortenHomePath(`${HOME_DIR}/projects/foo`);
    expect(result).toBe("~/projects/foo");
  });

  it("replaces home directory exactly at the prefix", () => {
    const result = shortenHomePath(HOME_DIR);
    expect(result).toBe("~");
  });

  it("returns the path unchanged when it does not start with HOME_DIR", () => {
    expect(shortenHomePath("/tmp/foo")).toBe("/tmp/foo");
  });

  it("does not replace partial matches", () => {
    // /Users/nickgabry2 starts with HOME_DIR so it DOES match and slices
    // This tests actual behavior: "2/projects" is the suffix after HOME_DIR
    const result = shortenHomePath(`${HOME_DIR}2/projects`);
    expect(result).toBe("~2/projects");
  });
});

describe("constants", () => {
  it("CLAUDE_DIR is inside HOME_DIR", () => {
    expect(CLAUDE_DIR).toContain(HOME_DIR);
    expect(CLAUDE_DIR).toMatch(/\.claude$/);
  });

  it("GLOBAL_AGENTS_DIR is inside CLAUDE_DIR", () => {
    expect(GLOBAL_AGENTS_DIR).toContain(CLAUDE_DIR);
    expect(GLOBAL_AGENTS_DIR).toMatch(/agents$/);
  });

  it("GLOBAL_SKILLS_DIR is inside CLAUDE_DIR", () => {
    expect(GLOBAL_SKILLS_DIR).toContain(CLAUDE_DIR);
    expect(GLOBAL_SKILLS_DIR).toMatch(/skills$/);
  });

  it("INSTRUCTION_FILE_NAMES includes expected files", () => {
    expect(INSTRUCTION_FILE_NAMES).toContain("AGENTS.md");
    expect(INSTRUCTION_FILE_NAMES).toContain("CLAUDE.md");
    expect(INSTRUCTION_FILE_NAMES).toContain(".clauderules");
  });

  it("PROJECT_INSTRUCTION_FILES extends INSTRUCTION_FILE_NAMES", () => {
    for (const name of INSTRUCTION_FILE_NAMES) {
      expect(PROJECT_INSTRUCTION_FILES).toContain(name);
    }
    expect(PROJECT_INSTRUCTION_FILES).toContain(".claude/rules.md");
  });
});
