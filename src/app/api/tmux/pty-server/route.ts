import { spawn, execSync } from "child_process";
import path from "path";

export const dynamic = "force-dynamic";

const PTY_PORT = 3001;
const cwd = process.cwd();
const serverScript = path.join(cwd, "helpers", "pty-server.mjs");

function isRunning(): boolean {
  try {
    execSync(`lsof -ti:${PTY_PORT}`, { encoding: "utf-8", timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

function startServer(): void {
  const proc = spawn("node", [serverScript, String(PTY_PORT)], {
    stdio: "ignore",
    detached: true,
    cwd,
  });
  proc.unref();
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
