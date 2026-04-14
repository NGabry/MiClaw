import { execSync } from "child_process";

export const dynamic = "force-dynamic";

const PTY_PORT = 3001;

function isRunning(): boolean {
  try {
    // lsof returns ALL PIDs with an fd on this port — the PTY server itself
    // plus any WebSocket clients (e.g. Next.js API routes). Check ALL of them
    // so we don't mistake a client PID for a missing server and nuke sessions.
    const pids = execSync(`lsof -ti:${PTY_PORT}`, { encoding: "utf-8", timeout: 2000 }).trim();
    if (!pids) return false;
    for (const line of pids.split("\n")) {
      const pid = line.trim();
      if (!pid) continue;
      try {
        const cmd = execSync(`ps -p ${pid} -o command=`, { encoding: "utf-8", timeout: 2000 }).trim();
        if (cmd.includes("pty-server.mjs")) return true;
      } catch { /* pid vanished between lsof and ps */ }
    }
    return false;
  } catch {
    return false;
  }
}

function ensureSpawnHelper(): void {
  // Bun may strip +x from node-pty's spawn-helper during install.
  // Fix it before starting the PTY server.
  try {
    execSync(
      'find node_modules/node-pty/prebuilds -name spawn-helper -exec chmod +x {} \\; 2>/dev/null; ' +
      'chmod +x node_modules/node-pty/build/Release/spawn-helper 2>/dev/null; true',
      { timeout: 3000, stdio: "ignore" },
    );
  } catch { /* best-effort */ }
}

function killStaleServer(): void {
  try {
    const pids = execSync(`lsof -ti:${PTY_PORT}`, { encoding: "utf-8", timeout: 2000 }).trim();
    for (const pid of pids.split("\n")) {
      if (pid) execSync(`kill ${pid}`, { timeout: 2000, stdio: "ignore" });
    }
  } catch { /* nothing on port */ }
}

function startServer(): void {
  killStaleServer();
  ensureSpawnHelper();
  // Use execSync to launch detached — avoids Turbopack tracing spawn() arguments
  const root = process.cwd();
  execSync(
    `node "${root}/helpers/pty-server.mjs" ${PTY_PORT} &`,
    { shell: "/bin/sh", timeout: 5000, stdio: "ignore" },
  );
}

export async function GET() {
  if (!isRunning()) {
    try {
      startServer();
      await new Promise((r) => setTimeout(r, 800));
    } catch (err) {
      return Response.json({ error: String(err), running: false }, { status: 500 });
    }
  }

  return Response.json({ running: true, port: PTY_PORT });
}
