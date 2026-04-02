import { homedir } from "os";
import path from "path";

export const HOME_DIR = homedir();
export const CLAUDE_DIR = path.join(HOME_DIR, ".claude");
export const GLOBAL_AGENTS_DIR = path.join(CLAUDE_DIR, "agents");
export const GLOBAL_SKILLS_DIR = path.join(CLAUDE_DIR, "skills");
export const GLOBAL_OUTPUT_STYLES_DIR = path.join(CLAUDE_DIR, "output-styles");
export const GLOBAL_SETTINGS_PATH = path.join(CLAUDE_DIR, "settings.json");
export const GLOBAL_KEYBINDINGS_PATH = path.join(CLAUDE_DIR, "keybindings.json");
export const GLOBAL_CLAUDE_JSON_PATH = path.join(HOME_DIR, ".claude.json");
export const PROJECTS_DIR = path.join(CLAUDE_DIR, "projects");

export const INSTRUCTION_FILE_NAMES = [
  "AGENTS.md",
  "CLAUDE.md",
  ".clauderules",
] as const;

export const PROJECT_INSTRUCTION_FILES = [
  ...INSTRUCTION_FILE_NAMES,
  ".claude/rules.md",
] as const;

export function shortenHomePath(fullPath: string): string {
  if (fullPath.startsWith(HOME_DIR)) {
    return "~" + fullPath.slice(HOME_DIR.length);
  }
  return fullPath;
}
