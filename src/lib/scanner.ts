import fs from "fs/promises";
import path from "path";
import {
  CLAUDE_DIR,
  GLOBAL_AGENTS_DIR,
  GLOBAL_CLAUDE_JSON_PATH,
  GLOBAL_KEYBINDINGS_PATH,
  GLOBAL_OUTPUT_STYLES_DIR,
  GLOBAL_SETTINGS_PATH,
  GLOBAL_SKILLS_DIR,
  PROJECTS_DIR,
  PROJECT_INSTRUCTION_FILES,
} from "./constants";
import { extractAgentReferences, parseMarkdownWithFrontmatter } from "./parser";
import type {
  Agent,
  AgentFrontmatter,
  ClaudeConfig,
  Command,
  GlobalSettings,
  HooksConfig,
  InstructionFile,
  Keybinding,
  McpConfig,
  McpServer,
  OutputStyle,
  ProjectSettings,
  ProjectSummary,
  Scope,
  SettingsFile,
  Skill,
  SkillFrontmatter,
} from "./types";

// --- Filesystem helpers ---

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonSafe(filePath: string): Promise<Record<string, unknown>> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return {};
  }
}

async function readFileSafe(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

async function globMdFiles(dir: string): Promise<string[]> {
  if (!(await exists(dir))) return [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith(".md"))
      .map((e) => path.join(dir, e.name));
  } catch {
    return [];
  }
}

// --- Agents ---

async function scanAgents(dir: string, scope: Scope): Promise<Agent[]> {
  const files = await globMdFiles(dir);
  const agents: Agent[] = [];
  for (const filePath of files) {
    const content = await readFileSafe(filePath);
    if (!content) continue;
    const { frontmatter, body } =
      parseMarkdownWithFrontmatter<AgentFrontmatter>(content);
    if (!frontmatter.name) {
      frontmatter.name = path.basename(filePath, ".md");
    }
    agents.push({ frontmatter, body, filePath, scope });
  }
  return agents;
}

// --- Skills ---

async function scanSkills(dir: string, scope: Scope): Promise<Skill[]> {
  if (!(await exists(dir))) return [];
  const skills: Skill[] = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillFile = path.join(dir, entry.name, "SKILL.md");
      const content = await readFileSafe(skillFile);
      if (!content) continue;
      const { frontmatter, body } =
        parseMarkdownWithFrontmatter<SkillFrontmatter>(content);
      if (!frontmatter.name) {
        frontmatter.name = entry.name;
      }
      skills.push({
        frontmatter,
        body,
        filePath: skillFile,
        scope,
        referencedAgents: [],
      });
    }
  } catch {
    // directory not readable
  }
  return skills;
}

// --- Commands ---

async function scanCommands(dir: string, scope: Scope): Promise<Command[]> {
  const files = await globMdFiles(dir);
  const commands: Command[] = [];
  for (const filePath of files) {
    const content = await readFileSafe(filePath);
    if (!content) continue;
    commands.push({
      name: path.basename(filePath, ".md"),
      body: content.trim(),
      filePath,
      scope,
    });
  }
  return commands;
}

// --- Output Styles ---

async function scanOutputStyles(
  dir: string,
  scope: Scope
): Promise<OutputStyle[]> {
  const files = await globMdFiles(dir);
  const styles: OutputStyle[] = [];
  for (const filePath of files) {
    const content = await readFileSafe(filePath);
    if (!content) continue;
    styles.push({
      name: path.basename(filePath, ".md"),
      body: content.trim(),
      filePath,
      scope,
    });
  }
  return styles;
}

// --- MCP Servers ---

function parseMcpServers(
  raw: Record<string, unknown>,
  filePath: string,
  scope: Scope
): McpConfig | null {
  const mcpServers = raw.mcpServers as Record<string, Record<string, unknown>> | undefined;
  if (!mcpServers || Object.keys(mcpServers).length === 0) return null;

  const servers: McpServer[] = Object.entries(mcpServers).map(
    ([name, config]) => ({
      name,
      type: (config.type as string) ?? "stdio",
      command: config.command as string | undefined,
      args: config.args as string[] | undefined,
      url: config.url as string | undefined,
      env: config.env as Record<string, string> | undefined,
      headers: config.headers as Record<string, string> | undefined,
      raw: config,
    })
  );

  return { servers, filePath, scope };
}

async function scanMcpConfig(
  projectPath: string,
  scope: Scope
): Promise<McpConfig | null> {
  const mcpPath = path.join(projectPath, ".mcp.json");
  const raw = await readJsonSafe(mcpPath);
  return parseMcpServers(raw, mcpPath, scope);
}

async function scanGlobalMcpConfig(): Promise<McpConfig | null> {
  const raw = await readJsonSafe(GLOBAL_CLAUDE_JSON_PATH);
  return parseMcpServers(raw, GLOBAL_CLAUDE_JSON_PATH, { type: "global" });
}

// --- Keybindings ---

async function scanKeybindings(): Promise<Keybinding[]> {
  const content = await readFileSafe(GLOBAL_KEYBINDINGS_PATH);
  if (!content) return [];
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return parsed as Keybinding[];
    }
    return [];
  } catch {
    return [];
  }
}

// --- Hooks (extracted from settings) ---

function extractHooks(
  settingsRaw: Record<string, unknown>
): HooksConfig | undefined {
  const hooks = settingsRaw.hooks as HooksConfig | undefined;
  if (!hooks || Object.keys(hooks).length === 0) return undefined;
  return hooks;
}

// --- Settings ---

async function scanSettingsFile(
  filePath: string,
  scope: SettingsFile["scope"],
  projectName?: string
): Promise<SettingsFile | null> {
  const raw = await readJsonSafe(filePath);
  if (Object.keys(raw).length === 0) return null;

  const permissions = raw.permissions as
    | { allow?: string[]; deny?: string[]; ask?: string[] }
    | undefined;

  return {
    scope,
    filePath,
    projectName,
    permissions: permissions
      ? {
          allow: permissions.allow ?? [],
          deny: permissions.deny,
          ask: permissions.ask,
        }
      : undefined,
    hooks: extractHooks(raw),
    mcpServers: raw.mcpServers as Record<string, unknown> | undefined,
    env: raw.env as Record<string, string> | undefined,
    raw,
  };
}

async function scanProjectSettings(
  projectPath: string,
  encodedName: string
): Promise<ProjectSettings | null> {
  const projectName = deriveProjectName(projectPath);
  const sharedPath = path.join(projectPath, ".claude", "settings.json");
  const localPath = path.join(projectPath, ".claude", "settings.local.json");
  const globalProjectPath = path.join(
    PROJECTS_DIR,
    encodedName,
    "settings.local.json"
  );

  const [shared, local, globalProject] = await Promise.all([
    scanSettingsFile(sharedPath, "project-shared", projectName),
    scanSettingsFile(localPath, "project-local", projectName),
    scanSettingsFile(globalProjectPath, "project-local", projectName),
  ]);

  // Merge permissions from local > shared > global project settings
  const allAllow: string[] = [];
  const allDeny: string[] = [];
  const allAsk: string[] = [];

  for (const s of [globalProject, shared, local]) {
    if (s?.permissions) {
      allAllow.push(...s.permissions.allow);
      if (s.permissions.deny) allDeny.push(...s.permissions.deny);
      if (s.permissions.ask) allAsk.push(...s.permissions.ask);
    }
  }

  if (allAllow.length === 0 && allDeny.length === 0 && allAsk.length === 0) {
    if (!shared && !local) return null;
  }

  return {
    projectPath,
    projectName,
    permissions: {
      allow: allAllow,
      deny: allDeny.length > 0 ? allDeny : undefined,
      ask: allAsk.length > 0 ? allAsk : undefined,
    },
    shared,
    local: local ?? globalProject,
  };
}

// --- Instruction Files ---

async function scanInstructionFiles(
  projectPath: string,
  projectName: string
): Promise<InstructionFile[]> {
  const files: InstructionFile[] = [];
  for (const fileName of PROJECT_INSTRUCTION_FILES) {
    const filePath = path.join(projectPath, fileName);
    const content = await readFileSafe(filePath);
    if (content) {
      files.push({
        type: path.basename(fileName),
        content: content.trim(),
        filePath,
        projectName,
      });
    }
  }
  return files;
}

// --- Project Path Decoding ---
//
// The encoding replaces ALL non-alphanumeric characters with `-`.
// This is lossy -- `/`, `_`, `-`, `.` all become `-`.
// Strategy: greedy forward scan, trying `/` then `-` then `_` at each position.
// No backtracking -- fast and handles the vast majority of cases.

async function decodeProjectPath(
  encodedName: string
): Promise<string | null> {
  const parts = encodedName.substring(1).split("-");
  const separators = ["/", "-", "_", ".", " "];

  // Greedy forward scan
  let current = "";
  for (let i = 0; i < parts.length; i++) {
    if (i === 0) {
      current = "/" + parts[i];
      continue;
    }

    let found = false;
    for (const sep of separators) {
      const candidate = current + sep + parts[i];
      if (await exists(candidate)) {
        current = candidate;
        found = true;
        break;
      }
    }

    if (!found) {
      current = current + "/" + parts[i];
    }
  }

  if (await exists(current)) return current;

  // Greedy failed. Try brute-force: for each possible "split point" where
  // we insert a `/`, join the rest with `-`. This handles cases like
  // `wgs-ingestion-bot` where the directory name contains hyphens.
  for (let splitAt = parts.length - 1; splitAt >= 2; splitAt--) {
    const dirParts = parts.slice(0, splitAt);
    const nameParts = parts.slice(splitAt);

    // Build the directory path greedily
    let dir = "";
    for (let i = 0; i < dirParts.length; i++) {
      if (i === 0) { dir = "/" + dirParts[i]; continue; }
      let found = false;
      for (const sep of separators) {
        const candidate = dir + sep + dirParts[i];
        if (await exists(candidate)) { dir = candidate; found = true; break; }
      }
      if (!found) dir = dir + "/" + dirParts[i];
    }

    // Join remaining parts with `-` as the leaf name
    const leaf = nameParts.join("-");
    const fullPath = dir + "/" + leaf;
    if (await exists(fullPath)) return fullPath;

    // Also try `_` join
    const leafUnderscore = nameParts.join("_");
    const fullPathUnderscore = dir + "/" + leafUnderscore;
    if (await exists(fullPathUnderscore)) return fullPathUnderscore;
  }

  return null;
}

const GENERIC_DIR_NAMES = new Set([
  "src", "lib", "dist", "build", "results", "output", "data", "test", "tests",
  "packages", "apps", "services", "scripts", "docs", "public", "assets",
]);

function deriveProjectName(decodedPath: string): string {
  const basename = path.basename(decodedPath);
  if (GENERIC_DIR_NAMES.has(basename.toLowerCase())) {
    const parent = path.basename(path.dirname(decodedPath));
    return `${parent}/${basename}`;
  }
  return basename;
}

async function discoverProjectPaths(): Promise<
  { encodedName: string; decodedPath: string }[]
> {
  if (!(await exists(PROJECTS_DIR))) return [];
  const entries = await fs.readdir(PROJECTS_DIR, { withFileTypes: true });
  const projects: { encodedName: string; decodedPath: string }[] = [];
  const homeDir = CLAUDE_DIR.replace(/\/.claude$/, "");
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("-")) continue;
    const decoded = await decodeProjectPath(entry.name);
    if (!decoded) continue;
    if (decoded === homeDir) continue;
    if (await exists(decoded)) {
      projects.push({ encodedName: entry.name, decodedPath: decoded });
    }
  }
  return projects;
}

// --- Main Scanner ---

export async function scanClaudeConfig(): Promise<ClaudeConfig> {
  const globalScope: Scope = { type: "global" };

  // Scan global config in parallel
  const [
    globalAgents,
    globalSkills,
    globalOutputStyles,
    globalSettingsRaw,
    keybindings,
    globalMcpConfig,
  ] = await Promise.all([
    scanAgents(GLOBAL_AGENTS_DIR, globalScope),
    scanSkills(GLOBAL_SKILLS_DIR, globalScope),
    scanOutputStyles(GLOBAL_OUTPUT_STYLES_DIR, globalScope),
    readJsonSafe(GLOBAL_SETTINGS_PATH),
    scanKeybindings(),
    scanGlobalMcpConfig(),
  ]);

  const globalSettings: GlobalSettings = {
    raw: globalSettingsRaw,
    hooks: extractHooks(globalSettingsRaw),
  };

  // Discover projects
  const projectPaths = await discoverProjectPaths();

  // Scan all projects in parallel
  const projectResults = await Promise.all(
    projectPaths.map(async ({ encodedName, decodedPath }) => {
      const projectName = deriveProjectName(decodedPath);
      const scope: Scope = {
        type: "project",
        projectName,
        projectPath: decodedPath,
      };

      const [
        agents,
        skills,
        commands,
        outputStyles,
        settings,
        instructionFiles,
        mcpConfig,
      ] = await Promise.all([
        scanAgents(path.join(decodedPath, ".claude", "agents"), scope),
        scanSkills(path.join(decodedPath, ".claude", "skills"), scope),
        scanCommands(path.join(decodedPath, ".claude", "commands"), scope),
        scanOutputStyles(
          path.join(decodedPath, ".claude", "output-styles"),
          scope
        ),
        scanProjectSettings(decodedPath, encodedName),
        scanInstructionFiles(decodedPath, projectName),
        scanMcpConfig(decodedPath, scope),
      ]);

      const summary: ProjectSummary = {
        name: projectName,
        path: decodedPath,
        encodedName,
        agents,
        skills,
        commands,
        outputStyles,
        instructionFiles,
        settings,
        mcpConfig,
      };

      return summary;
    })
  );

  // Aggregate
  const allAgents = [
    ...globalAgents,
    ...projectResults.flatMap((p) => p.agents),
  ];
  const allSkills = [
    ...globalSkills,
    ...projectResults.flatMap((p) => p.skills),
  ];
  const allCommands = projectResults.flatMap((p) => p.commands);
  const allOutputStyles = [
    ...globalOutputStyles,
    ...projectResults.flatMap((p) => p.outputStyles),
  ];
  const allInstructionFiles = projectResults.flatMap(
    (p) => p.instructionFiles
  );
  const allProjectSettings = projectResults
    .map((p) => p.settings)
    .filter((s): s is ProjectSettings => s !== null);
  const allMcpConfigs = [
    ...(globalMcpConfig ? [globalMcpConfig] : []),
    ...projectResults
      .map((p) => p.mcpConfig)
      .filter((m): m is McpConfig => m !== null),
  ];

  // Resolve agent references in skills
  const allAgentNames = allAgents.map((a) => a.frontmatter.name);
  for (const skill of allSkills) {
    skill.referencedAgents = extractAgentReferences(skill.body, allAgentNames);
  }

  return {
    agents: allAgents,
    skills: allSkills,
    commands: allCommands,
    outputStyles: allOutputStyles,
    globalSettings,
    projectSettings: allProjectSettings,
    instructionFiles: allInstructionFiles,
    mcpConfigs: allMcpConfigs,
    keybindings,
    projects: projectResults,
  };
}
