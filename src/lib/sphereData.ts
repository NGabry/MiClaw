import { shortenHomePath } from "./constants";
import type { ClaudeConfig, ProjectSummary } from "./types";

export interface SphereItem {
  id: string;
  label: string;
  type: "agent" | "skill" | "command" | "mcp" | "rule" | "setting" | "hook" | "keybinding" | "output-style";
  model?: string;
  description?: string;
  href?: string;
}

export interface ProjectNode {
  name: string;
  path: string;
  shortPath: string;
  items: SphereItem[];
  children: ProjectNode[];
}

export interface SphereData {
  global: SphereItem[];
  projects: ProjectNode[];
}

function projectItems(project: ProjectSummary): SphereItem[] {
  const items: SphereItem[] = [];

  for (const a of project.agents) {
    items.push({
      id: `agent-${a.filePath}`,
      label: a.frontmatter.name,
      type: "agent",
      model: a.frontmatter.model,
      description: a.frontmatter.description,
      href: `/projects/${encodeURIComponent(project.name)}`,
    });
  }

  for (const s of project.skills) {
    items.push({
      id: `skill-${s.filePath}`,
      label: s.frontmatter.name,
      type: "skill",
      description: s.frontmatter.description,
      href: `/projects/${encodeURIComponent(project.name)}`,
    });
  }

  for (const c of project.commands) {
    items.push({
      id: `cmd-${c.filePath}`,
      label: c.name,
      type: "command",
      href: `/projects/${encodeURIComponent(project.name)}`,
    });
  }

  if (project.mcpConfig) {
    for (const s of project.mcpConfig.servers) {
      items.push({
        id: `mcp-${s.name}-${project.path}`,
        label: s.name,
        type: "mcp",
        description: `${s.type}: ${s.command ?? s.url ?? ""}`,
        href: "/mcp",
      });
    }
  }

  for (const f of project.instructionFiles) {
    items.push({
      id: `rule-${f.filePath}`,
      label: f.type,
      type: "rule",
      href: `/projects/${encodeURIComponent(project.name)}`,
    });
  }

  for (const s of project.outputStyles) {
    items.push({
      id: `style-${s.filePath}`,
      label: s.name,
      type: "output-style",
    });
  }

  if (project.settings) {
    items.push({
      id: `settings-${project.path}`,
      label: `${project.settings.permissions.allow.length} permissions`,
      type: "setting",
      href: `/projects/${encodeURIComponent(project.name)}`,
    });
  }

  return items;
}

function hasConfig(project: ProjectSummary): boolean {
  return (
    project.agents.length > 0 ||
    project.skills.length > 0 ||
    project.commands.length > 0 ||
    project.mcpConfig !== null ||
    project.instructionFiles.length > 0 ||
    project.outputStyles.length > 0 ||
    project.settings !== null
  );
}

export function buildSphereData(config: ClaudeConfig): SphereData {
  const globalItems: SphereItem[] = [];

  for (const a of config.agents.filter((a) => a.scope.type === "global")) {
    globalItems.push({
      id: `agent-${a.filePath}`,
      label: a.frontmatter.name,
      type: "agent",
      model: a.frontmatter.model,
      description: a.frontmatter.description,
      href: "/agents",
    });
  }

  for (const s of config.skills.filter((s) => s.scope.type === "global")) {
    globalItems.push({
      id: `skill-${s.filePath}`,
      label: s.frontmatter.name,
      type: "skill",
      description: s.frontmatter.description,
      href: "/skills",
    });
  }

  if (config.keybindings.length > 0) {
    globalItems.push({
      id: "keybindings",
      label: `${config.keybindings.length} keybindings`,
      type: "keybinding",
      href: "/settings",
    });
  }

  if (
    config.globalSettings.hooks &&
    Object.keys(config.globalSettings.hooks).length > 0
  ) {
    globalItems.push({
      id: "global-hooks",
      label: "hooks",
      type: "hook",
      href: "/hooks",
    });
  }

  if (Object.keys(config.globalSettings.raw).length > 0) {
    globalItems.push({
      id: "global-settings",
      label: "settings.json",
      type: "setting",
      href: "/settings",
    });
  }

  // Build parent-child tree based on path nesting
  const withConfig = config.projects.filter(hasConfig);

  // Sort by path length so parents come before children
  const sorted = [...withConfig].sort(
    (a, b) => a.path.length - b.path.length
  );

  const roots: ProjectNode[] = [];
  const nodeMap = new Map<string, ProjectNode>();

  for (const p of sorted) {
    const node: ProjectNode = {
      name: p.name,
      path: p.path,
      shortPath: shortenHomePath(p.path),
      items: projectItems(p),
      children: [],
    };

    // Find parent: the longest existing path that is a prefix of this one
    let parent: ProjectNode | null = null;
    for (const [existingPath, existingNode] of nodeMap) {
      if (
        p.path.startsWith(existingPath + "/") &&
        (!parent || existingPath.length > parent.path.length)
      ) {
        parent = existingNode;
      }
    }

    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }

    nodeMap.set(p.path, node);
  }

  return { global: globalItems, projects: roots };
}
