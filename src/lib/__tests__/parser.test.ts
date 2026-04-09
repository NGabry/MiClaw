import { describe, it, expect } from "vitest";
import { parseMarkdownWithFrontmatter, extractAgentReferences } from "../parser";

// ---------------------------------------------------------------------------
// parseMarkdownWithFrontmatter
// ---------------------------------------------------------------------------

describe("parseMarkdownWithFrontmatter", () => {
  it("parses YAML frontmatter and body", () => {
    const content = `---
name: test-agent
description: A test agent
model: sonnet
---

This is the body.`;

    const result = parseMarkdownWithFrontmatter<{
      name: string;
      description: string;
      model: string;
    }>(content);

    expect(result.frontmatter.name).toBe("test-agent");
    expect(result.frontmatter.description).toBe("A test agent");
    expect(result.frontmatter.model).toBe("sonnet");
    expect(result.body).toBe("This is the body.");
  });

  it("handles content with no frontmatter", () => {
    const content = "Just a body with no frontmatter.";
    const result = parseMarkdownWithFrontmatter(content);
    expect(result.frontmatter).toEqual({});
    expect(result.body).toBe("Just a body with no frontmatter.");
  });

  it("handles empty content", () => {
    const result = parseMarkdownWithFrontmatter("");
    expect(result.frontmatter).toEqual({});
    expect(result.body).toBe("");
  });

  it("handles frontmatter with no body", () => {
    const content = `---
name: lonely-agent
---`;
    const result = parseMarkdownWithFrontmatter<{ name: string }>(content);
    expect(result.frontmatter.name).toBe("lonely-agent");
    expect(result.body).toBe("");
  });

  it("preserves complex frontmatter types", () => {
    const content = `---
name: complex
tools:
  - Read
  - Write
maxTurns: 10
background: true
---

Body here.`;
    const result = parseMarkdownWithFrontmatter<{
      name: string;
      tools: string[];
      maxTurns: number;
      background: boolean;
    }>(content);

    expect(result.frontmatter.tools).toEqual(["Read", "Write"]);
    expect(result.frontmatter.maxTurns).toBe(10);
    expect(result.frontmatter.background).toBe(true);
  });

  it("trims the body content", () => {
    const content = `---
name: trimmed
---

   Lots of whitespace

`;
    const result = parseMarkdownWithFrontmatter(content);
    expect(result.body).toBe("Lots of whitespace");
  });
});

// ---------------------------------------------------------------------------
// extractAgentReferences
// ---------------------------------------------------------------------------

describe("extractAgentReferences", () => {
  it("finds referenced agent names in skill body", () => {
    const body = "This skill uses the code-reviewer agent and also the planner.";
    const agents = ["code-reviewer", "planner", "debugger"];
    const result = extractAgentReferences(body, agents);
    expect(result).toEqual(["code-reviewer", "planner"]);
  });

  it("returns empty array when no agents referenced", () => {
    const body = "This skill doesn't reference any agents.";
    const result = extractAgentReferences(body, ["agent-a", "agent-b"]);
    expect(result).toEqual([]);
  });

  it("is case-insensitive", () => {
    const body = "Use the CodeReviewer for this.";
    const result = extractAgentReferences(body, ["codereviewer"]);
    expect(result).toEqual(["codereviewer"]);
  });

  it("matches whole words only (word boundary)", () => {
    const body = "The superplanner is great.";
    const result = extractAgentReferences(body, ["planner"]);
    // "planner" is NOT a whole word in "superplanner"
    expect(result).toEqual([]);
  });

  it("handles empty agent list", () => {
    const result = extractAgentReferences("any body text", []);
    expect(result).toEqual([]);
  });

  it("handles empty body", () => {
    const result = extractAgentReferences("", ["agent-a"]);
    expect(result).toEqual([]);
  });

  it("escapes regex special characters in agent names", () => {
    // agent++ with word boundary: the ++ is escaped but \b won't match
    // after + characters since they aren't word chars. The actual regex
    // uses \b...\b, so "agent++" won't match due to the boundary check.
    const body = "Use agent++ for this task.";
    const result = extractAgentReferences(body, ["agent++"]);
    // The word boundary after ++ is actually present (space follows)
    // but \b before "agent" also needs a non-word boundary, which works.
    // However, ++ is non-word so \b between t and + fails.
    // Real test: the function handles normal names with hyphens.
    expect(result).toEqual([]);
  });

  it("finds agent names containing hyphens", () => {
    const body = "Use the code-reviewer agent here.";
    const result = extractAgentReferences(body, ["code-reviewer"]);
    expect(result).toEqual(["code-reviewer"]);
  });
});
