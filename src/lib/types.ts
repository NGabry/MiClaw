export type Scope =
  | { type: "global" }
  | { type: "project"; projectName: string; projectPath: string };

// --- Agent types ---

export interface AgentFrontmatter {
  name: string;
  description: string;
  tools?: string;
  disallowedTools?: string | string[];
  model?: string;
  color?: string;
  permissionMode?: string;
  maxTurns?: number;
  memory?: string;
  background?: boolean;
  effort?: string;
  isolation?: string;
  omitClaudeMd?: boolean;
  initialPrompt?: string;
  mcpServers?: unknown[];
  hooks?: Record<string, unknown>;
  skills?: string[];
}

export interface Agent {
  frontmatter: AgentFrontmatter;
  body: string;
  filePath: string;
  scope: Scope;
}

// --- Skill types ---

export interface SkillFrontmatter {
  name: string;
  description: string;
  "user-invocable"?: boolean;
  "disable-model-invocation"?: boolean;
  "argument-hint"?: string;
  "allowed-tools"?: string;
  "when-to-use"?: string;
  arguments?: string | string[];
  model?: string;
  effort?: string;
  version?: string;
  context?: string;
  agent?: string;
  paths?: string | string[];
  shell?: string;
  hooks?: Record<string, unknown>;
}

export interface Skill {
  frontmatter: SkillFrontmatter;
  body: string;
  filePath: string;
  scope: Scope;
  referencedAgents: string[];
}

// --- Command types ---

export interface Command {
  name: string;
  body: string;
  filePath: string;
  scope: Scope;
}

// --- Output Style types ---

export interface OutputStyle {
  name: string;
  body: string;
  filePath: string;
  scope: Scope;
}

// --- Instruction file types ---

export interface InstructionFile {
  type: string;
  content: string;
  filePath: string;
  projectName: string;
}

// --- MCP Server types ---

export interface McpServer {
  name: string;
  type: string;
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  headers?: Record<string, string>;
  raw: Record<string, unknown>;
}

export interface McpConfig {
  servers: McpServer[];
  filePath: string;
  scope: Scope;
}

// --- Hook types ---

export interface HookEntry {
  type: string;
  command?: string;
  url?: string;
  agent?: string;
  prompt?: string;
  timeout?: number;
}

export interface HookMatcher {
  matcher: string;
  hooks: HookEntry[];
}

export interface HooksConfig {
  PreToolUse?: HookMatcher[];
  PostToolUse?: HookMatcher[];
  Notification?: HookMatcher[];
  Stop?: HookMatcher[];
  SubagentStop?: HookMatcher[];
  [key: string]: HookMatcher[] | undefined;
}

// --- Keybinding types ---

export interface Keybinding {
  key: string;
  command: string;
  when?: string;
}

// --- Permission types ---

export interface PermissionSet {
  allow: string[];
  deny?: string[];
  ask?: string[];
}

// --- Settings types ---

export interface SettingsFile {
  scope: "user" | "project-shared" | "project-local";
  filePath: string;
  projectName?: string;
  permissions?: PermissionSet;
  hooks?: HooksConfig;
  mcpServers?: Record<string, unknown>;
  env?: Record<string, string>;
  raw: Record<string, unknown>;
}

export interface GlobalSettings {
  raw: Record<string, unknown>;
  hooks?: HooksConfig;
}

export interface ProjectSettings {
  projectPath: string;
  projectName: string;
  permissions: PermissionSet;
  shared: SettingsFile | null;
  local: SettingsFile | null;
}

// --- Project summary ---

export interface ProjectSummary {
  name: string;
  path: string;
  encodedName: string;
  agents: Agent[];
  skills: Skill[];
  commands: Command[];
  outputStyles: OutputStyle[];
  instructionFiles: InstructionFile[];
  settings: ProjectSettings | null;
  mcpConfig: McpConfig | null;
}

// --- Top-level config ---

export interface ClaudeConfig {
  agents: Agent[];
  skills: Skill[];
  commands: Command[];
  outputStyles: OutputStyle[];
  globalSettings: GlobalSettings;
  projectSettings: ProjectSettings[];
  instructionFiles: InstructionFile[];
  mcpConfigs: McpConfig[];
  keybindings: Keybinding[];
  projects: ProjectSummary[];
}
