import { describe, it, expect } from "vitest";
import { buildSphereData } from "../sphereData";
import type { ClaudeConfig, ProjectSummary } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyConfig(): ClaudeConfig {
  return {
    agents: [],
    skills: [],
    commands: [],
    outputStyles: [],
    globalSettings: { raw: {} },
    projectSettings: [],
    instructionFiles: [],
    mcpConfigs: [],
    keybindings: [],
    projects: [],
  };
}

function makeProject(overrides: Partial<ProjectSummary> = {}): ProjectSummary {
  return {
    name: "test-project",
    path: "/Users/test/Desktop/test-project",
    encodedName: "-Users-test-Desktop-test-project",
    agents: [],
    skills: [],
    commands: [],
    outputStyles: [],
    instructionFiles: [],
    settings: null,
    mcpConfig: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// buildSphereData
// ---------------------------------------------------------------------------

describe("buildSphereData", () => {
  it("returns empty data for empty config", () => {
    const result = buildSphereData(emptyConfig());
    expect(result.global).toEqual([]);
    expect(result.projects).toEqual([]);
  });

  it("includes global agents", () => {
    const config = emptyConfig();
    config.agents = [
      {
        frontmatter: { name: "test-agent", description: "desc", model: "sonnet" },
        body: "",
        filePath: "/home/.claude/agents/test-agent.md",
        scope: { type: "global" },
      },
    ];
    const result = buildSphereData(config);
    expect(result.global).toHaveLength(1);
    expect(result.global[0].label).toBe("test-agent");
    expect(result.global[0].type).toBe("agent");
    expect(result.global[0].model).toBe("sonnet");
    expect(result.global[0].href).toBe("/agents#test-agent");
  });

  it("does not include project-scoped agents in global items", () => {
    const config = emptyConfig();
    config.agents = [
      {
        frontmatter: { name: "proj-agent", description: "desc" },
        body: "",
        filePath: "/project/.claude/agents/proj-agent.md",
        scope: { type: "project", projectName: "proj", projectPath: "/project" },
      },
    ];
    const result = buildSphereData(config);
    expect(result.global).toEqual([]);
  });

  it("includes global skills", () => {
    const config = emptyConfig();
    config.skills = [
      {
        frontmatter: { name: "test-skill", description: "A skill" },
        body: "",
        filePath: "/home/.claude/skills/test-skill/SKILL.md",
        scope: { type: "global" },
        referencedAgents: [],
      },
    ];
    const result = buildSphereData(config);
    expect(result.global).toHaveLength(1);
    expect(result.global[0].type).toBe("skill");
    expect(result.global[0].href).toBe("/skills#test-skill");
  });

  it("includes keybindings count when present", () => {
    const config = emptyConfig();
    config.keybindings = [
      { key: "ctrl+s", command: "save" },
      { key: "ctrl+d", command: "delete" },
    ];
    const result = buildSphereData(config);
    const kb = result.global.find((i) => i.type === "keybinding");
    expect(kb).toBeDefined();
    expect(kb!.label).toBe("2 keybindings");
  });

  it("does not include keybindings item when empty", () => {
    const config = emptyConfig();
    config.keybindings = [];
    const result = buildSphereData(config);
    expect(result.global.find((i) => i.type === "keybinding")).toBeUndefined();
  });

  it("includes global hooks when present", () => {
    const config = emptyConfig();
    config.globalSettings = {
      raw: { someKey: "val" },
      hooks: { PreToolUse: [{ matcher: "*", hooks: [{ type: "command", command: "echo hi" }] }] },
    };
    const result = buildSphereData(config);
    const hookItem = result.global.find((i) => i.type === "hook");
    expect(hookItem).toBeDefined();
    expect(hookItem!.label).toBe("hooks");
  });

  it("includes global settings item when settings.json has content", () => {
    const config = emptyConfig();
    config.globalSettings = { raw: { model: "sonnet" } };
    const result = buildSphereData(config);
    const settingsItem = result.global.find((i) => i.type === "setting");
    expect(settingsItem).toBeDefined();
    expect(settingsItem!.label).toBe("settings.json");
  });

  it("does not include global settings item when raw is empty", () => {
    const config = emptyConfig();
    const result = buildSphereData(config);
    expect(result.global.find((i) => i.type === "setting")).toBeUndefined();
  });

  // -- Project items --

  it("creates project nodes with items", () => {
    const config = emptyConfig();
    config.projects = [
      makeProject({
        agents: [
          {
            frontmatter: { name: "p-agent", description: "d" },
            body: "",
            filePath: "/test/.claude/agents/p-agent.md",
            scope: { type: "project", projectName: "test-project", projectPath: "/Users/test/Desktop/test-project" },
          },
        ],
      }),
    ];
    const result = buildSphereData(config);
    expect(result.projects).toHaveLength(1);
    expect(result.projects[0].name).toBe("test-project");
    expect(result.projects[0].items).toHaveLength(1);
    expect(result.projects[0].items[0].type).toBe("agent");
  });

  it("excludes projects with no config", () => {
    const config = emptyConfig();
    config.projects = [makeProject()]; // empty project
    const result = buildSphereData(config);
    expect(result.projects).toHaveLength(0);
  });

  it("includes MCP servers in project items", () => {
    const config = emptyConfig();
    config.projects = [
      makeProject({
        mcpConfig: {
          servers: [{ name: "neon", type: "stdio", command: "npx neon", raw: {} }],
          filePath: "/test/.mcp.json",
          scope: { type: "project", projectName: "test-project", projectPath: "/test" },
        },
      }),
    ];
    const result = buildSphereData(config);
    expect(result.projects).toHaveLength(1);
    expect(result.projects[0].items.find((i) => i.type === "mcp")).toBeDefined();
  });

  it("includes instruction files in project items", () => {
    const config = emptyConfig();
    config.projects = [
      makeProject({
        instructionFiles: [
          { type: "CLAUDE.md", content: "# Rules", filePath: "/test/CLAUDE.md", projectName: "test-project" },
        ],
      }),
    ];
    const result = buildSphereData(config);
    expect(result.projects[0].items.find((i) => i.type === "rule")).toBeDefined();
  });

  it("includes output styles in project items", () => {
    const config = emptyConfig();
    config.projects = [
      makeProject({
        outputStyles: [
          { name: "concise", body: "Be concise", filePath: "/test/.claude/output-styles/concise.md", scope: { type: "project", projectName: "test-project", projectPath: "/test" } },
        ],
      }),
    ];
    const result = buildSphereData(config);
    expect(result.projects[0].items.find((i) => i.type === "output-style")).toBeDefined();
  });

  it("includes project settings in project items", () => {
    const config = emptyConfig();
    config.projects = [
      makeProject({
        settings: {
          projectPath: "/test",
          projectName: "test-project",
          permissions: { allow: ["Read", "Write"] },
          shared: null,
          local: null,
        },
      }),
    ];
    const result = buildSphereData(config);
    const settingsItem = result.projects[0].items.find((i) => i.type === "setting");
    expect(settingsItem).toBeDefined();
    expect(settingsItem!.label).toBe("2 permissions");
  });

  it("includes commands and skills in project items", () => {
    const config = emptyConfig();
    config.projects = [
      makeProject({
        commands: [
          { name: "deploy", body: "Deploy the app", filePath: "/test/.claude/commands/deploy.md", scope: { type: "project", projectName: "test-project", projectPath: "/test" } },
        ],
        skills: [
          {
            frontmatter: { name: "review", description: "Review code" },
            body: "",
            filePath: "/test/.claude/skills/review/SKILL.md",
            scope: { type: "project", projectName: "test-project", projectPath: "/test" },
            referencedAgents: [],
          },
        ],
      }),
    ];
    const result = buildSphereData(config);
    expect(result.projects[0].items.find((i) => i.type === "command")).toBeDefined();
    expect(result.projects[0].items.find((i) => i.type === "skill")).toBeDefined();
  });

  // -- Parent-child nesting --

  it("nests child projects under parents based on path", () => {
    const config = emptyConfig();
    config.projects = [
      makeProject({
        name: "parent",
        path: "/Users/test/parent",
        agents: [
          {
            frontmatter: { name: "a", description: "d" },
            body: "",
            filePath: "/Users/test/parent/.claude/agents/a.md",
            scope: { type: "project", projectName: "parent", projectPath: "/Users/test/parent" },
          },
        ],
      }),
      makeProject({
        name: "child",
        path: "/Users/test/parent/child",
        agents: [
          {
            frontmatter: { name: "b", description: "d" },
            body: "",
            filePath: "/Users/test/parent/child/.claude/agents/b.md",
            scope: { type: "project", projectName: "child", projectPath: "/Users/test/parent/child" },
          },
        ],
      }),
    ];
    const result = buildSphereData(config);
    expect(result.projects).toHaveLength(1);
    expect(result.projects[0].name).toBe("parent");
    expect(result.projects[0].children).toHaveLength(1);
    expect(result.projects[0].children[0].name).toBe("child");
  });
});
