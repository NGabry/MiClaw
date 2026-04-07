import { execFileSync } from "child_process";
import { randomBytes } from "crypto";
import { homedir } from "os";

const SESSION_PREFIX = "miclaw-";

export interface TmuxSession {
  name: string;
  displayName: string;
  created: number;
  attached: boolean;
  paneWidth: number;
  paneHeight: number;
  panePid: number;
}

export function listMiclawSessions(): TmuxSession[] {
  try {
    // Use tab as delimiter to avoid conflicts with pane_title content
    const delim = "\t";
    const fmt = [
      "#{session_name}", "#{session_created}", "#{session_attached}",
      "#{window_width}", "#{window_height}", "#{pane_pid}", "#{pane_title}",
    ].join(delim);

    const raw = execFileSync("tmux", [
      "list-panes", "-a", "-F", fmt,
    ], { encoding: "utf-8", timeout: 3000 }).trim();

    if (!raw) return [];

    return raw.split("\n")
      .filter((line) => line.startsWith(SESSION_PREFIX))
      .map((line) => {
        const parts = line.split(delim);
        const [name, created, attached, width, height, panePid] = parts;
        const paneTitle = parts.slice(6).join(delim).trim();
        // Pane title often gets set to generic things like "Claude Code" by the app.
        // Prefer the user-given name from the tmux session name, but show pane title
        // if user used /rename (pane title won't match generic patterns).
        const sessionSuffix = name.slice(SESSION_PREFIX.length);
        const genericTitles = ["claude code", "claude", "bash", "zsh", "sh", ""];
        const isGenericTitle = genericTitles.includes(paneTitle.replace(/^[✳✻⏺●]\s*/, "").toLowerCase());
        const displayName = isGenericTitle ? sessionSuffix : paneTitle;
        return {
          name,
          displayName,
          created: parseInt(created, 10),
          attached: attached !== "0",
          paneWidth: parseInt(width, 10) || 80,
          paneHeight: parseInt(height, 10) || 24,
          panePid: parseInt(panePid, 10) || 0,
        };
      });
  } catch {
    // tmux server not running = no sessions
    return [];
  }
}

/**
 * Returns PIDs of all processes running inside miclaw tmux sessions.
 * Used to filter these from detected Terminal.app sessions.
 */
export function getMiclawPids(): Set<number> {
  try {
    const sessions = listMiclawSessions();
    const pids = new Set<number>();
    for (const s of sessions) {
      if (s.panePid) {
        pids.add(s.panePid);
        // Also get child processes (claude is a child of the shell in tmux)
        try {
          const children = execFileSync("pgrep", ["-P", String(s.panePid)], {
            encoding: "utf-8",
            timeout: 2000,
          }).trim();
          for (const line of children.split("\n")) {
            const pid = parseInt(line, 10);
            if (pid) pids.add(pid);
          }
        } catch { /* no children */ }
      }
    }
    return pids;
  } catch {
    return new Set();
  }
}

export function createSession(displayName?: string, cwd?: string): TmuxSession {
  const id = displayName?.replace(/[^a-zA-Z0-9_-]/g, "-") || randomBytes(4).toString("hex");
  const name = `${SESSION_PREFIX}${id}`;

  const args = ["new-session", "-d", "-s", name, "-x", "120", "-y", "30"];
  const resolvedCwd = cwd?.replace(/^~/, homedir()) ?? homedir();
  args.push("-c", resolvedCwd);
  args.push("claude");

  execFileSync("tmux", args, { encoding: "utf-8", timeout: 5000 });

  // Disable status bar and set UTF-8 for clean rendering
  try {
    execFileSync("tmux", ["set-option", "-t", name, "status", "off"], { encoding: "utf-8", timeout: 2000 });
    execFileSync("tmux", ["set-option", "-t", name, "default-terminal", "xterm-256color"], { encoding: "utf-8", timeout: 2000 });
  } catch { /* ignore */ }

  // Get the pane PID of the newly created session
  let panePid = 0;
  try {
    panePid = parseInt(execFileSync("tmux", [
      "list-panes", "-t", name, "-F", "#{pane_pid}",
    ], { encoding: "utf-8", timeout: 2000 }).trim(), 10) || 0;
  } catch { /* ignore */ }

  return {
    name,
    displayName: id,
    created: Math.floor(Date.now() / 1000),
    attached: false,
    paneWidth: 120,
    paneHeight: 30,
    panePid,
  };
}

export function killSession(sessionName: string): void {
  if (!sessionName.startsWith(SESSION_PREFIX)) {
    throw new Error("Can only kill miclaw sessions");
  }
  execFileSync("tmux", ["kill-session", "-t", sessionName], {
    encoding: "utf-8",
    timeout: 3000,
  });
}

export function capturePane(sessionName: string): string {
  return execFileSync("tmux", [
    "capture-pane", "-p", "-e", "-t", sessionName,
  ], { encoding: "utf-8", timeout: 3000 });
}

export function sendKeys(sessionName: string, data: string): void {
  if (!sessionName.startsWith(SESSION_PREFIX)) {
    throw new Error("Can only send to miclaw sessions");
  }
  // Send literal text
  execFileSync("tmux", ["send-keys", "-t", sessionName, "-l", data], {
    encoding: "utf-8",
    timeout: 3000,
  });
}

export function sendSpecialKey(sessionName: string, key: string): void {
  if (!sessionName.startsWith(SESSION_PREFIX)) {
    throw new Error("Can only send to miclaw sessions");
  }

  const keyMap: Record<string, string> = {
    Enter: "Enter",
    Tab: "Tab",
    Backspace: "BSpace",
    Escape: "Escape",
    ArrowUp: "Up",
    ArrowDown: "Down",
    ArrowLeft: "Left",
    ArrowRight: "Right",
    Delete: "DC",
    Home: "Home",
    End: "End",
    PageUp: "PPage",
    PageDown: "NPage",
    "Ctrl+C": "C-c",
    "Ctrl+D": "C-d",
    "Ctrl+Z": "C-z",
    "Ctrl+L": "C-l",
  };

  const tmuxKey = keyMap[key];
  if (!tmuxKey) return;

  execFileSync("tmux", ["send-keys", "-t", sessionName, tmuxKey], {
    encoding: "utf-8",
    timeout: 3000,
  });
}

export function resizeSession(sessionName: string, cols: number, rows: number): void {
  if (!sessionName.startsWith(SESSION_PREFIX)) return;
  try {
    execFileSync("tmux", [
      "resize-window", "-t", sessionName, "-x", String(cols), "-y", String(rows),
    ], { encoding: "utf-8", timeout: 3000 });
  } catch {
    // Resize can fail if window is too small, ignore
  }
}

export function sessionExists(sessionName: string): boolean {
  try {
    execFileSync("tmux", ["has-session", "-t", sessionName], { timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}
