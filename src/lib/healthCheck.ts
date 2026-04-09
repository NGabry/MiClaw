import { execFileSync } from "child_process";
import { existsSync, accessSync, constants, chmodSync } from "fs";
import { join } from "path";

export interface HealthStatus {
  claude: { ok: boolean; path?: string; error?: string };
  nodePty: { ok: boolean; error?: string };
  ptyServer: { ok: boolean; port: number; error?: string };
  nodeVersion: { ok: boolean; version: string; error?: string };
}

/**
 * Check if the `claude` CLI is installed and reachable.
 */
export function checkClaude(): HealthStatus["claude"] {
  try {
    const out = execFileSync("which", ["claude"], {
      encoding: "utf-8",
      timeout: 3000,
    }).trim();
    if (out) return { ok: true, path: out };
    return { ok: false, error: "claude CLI not found in PATH" };
  } catch {
    return {
      ok: false,
      error: "claude CLI not found. Install: npm install -g @anthropic-ai/claude-code",
    };
  }
}

/**
 * Check that node-pty's spawn-helper is present and executable.
 * Attempts to fix permissions if they're wrong.
 */
export function checkNodePty(): HealthStatus["nodePty"] {
  try {
    const platform = process.platform;
    const arch = process.arch;

    // Search common locations for node-pty's spawn-helper.
    // createRequire doesn't work reliably under Turbopack bundling,
    // so we check known paths relative to cwd and node_modules.
    const roots = [
      join(process.cwd(), "node_modules", "node-pty"),
    ];

    const helperPaths: string[] = [];
    for (const root of roots) {
      helperPaths.push(
        join(root, "prebuilds", `${platform}-${arch}`, "spawn-helper"),
        join(root, "build", "Release", "spawn-helper"),
      );
    }

    for (const helperPath of helperPaths) {
      if (!existsSync(helperPath)) continue;

      // Check if executable
      try {
        accessSync(helperPath, constants.X_OK);
        return { ok: true };
      } catch {
        // Try to fix
        try {
          chmodSync(helperPath, 0o755);
          return { ok: true };
        } catch (fixErr) {
          return {
            ok: false,
            error: `spawn-helper not executable: run chmod +x ${helperPath}`,
          };
        }
      }
    }

    return { ok: false, error: "node-pty spawn-helper not found. Try: bun install" };
  } catch (err) {
    return { ok: false, error: `node-pty check failed: ${err}` };
  }
}

/**
 * Check if the PTY server is running on the expected port.
 */
export function checkPtyServer(port = 3001): HealthStatus["ptyServer"] {
  try {
    const out = execFileSync("lsof", ["-ti:" + port], {
      encoding: "utf-8",
      timeout: 2000,
    }).trim();
    if (out) return { ok: true, port };
    return { ok: false, port, error: "PTY server not running" };
  } catch {
    return { ok: false, port, error: "PTY server not running on port " + port };
  }
}

/**
 * Check Node.js version meets minimum requirement.
 */
export function checkNodeVersion(minMajor = 20): HealthStatus["nodeVersion"] {
  const version = process.version; // e.g. "v20.19.4"
  const major = parseInt(version.slice(1).split(".")[0], 10);
  if (major >= minMajor) {
    return { ok: true, version };
  }
  return {
    ok: false,
    version,
    error: `Node.js ${minMajor}+ required, running ${version}`,
  };
}

/**
 * Run all health checks and return combined status.
 */
export function runHealthCheck(): HealthStatus {
  return {
    claude: checkClaude(),
    nodePty: checkNodePty(),
    ptyServer: checkPtyServer(),
    nodeVersion: checkNodeVersion(),
  };
}
