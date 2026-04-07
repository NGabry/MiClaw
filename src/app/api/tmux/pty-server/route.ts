import { spawn, execSync } from "child_process";
import path from "path";
import { existsSync } from "fs";

export const dynamic = "force-dynamic";

const PTY_PORT = 3001;
const cwd = process.cwd();
const venvDir = path.join(cwd, ".venv");
const venvPython = path.join(venvDir, "bin", "python3");
const serverScript = path.join(cwd, "helpers", "pty-server.py");

function isRunning(): boolean {
  try {
    execSync(`lsof -ti:${PTY_PORT}`, { encoding: "utf-8", timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

function ensureVenv(): void {
  if (existsSync(venvPython)) return;

  // Create venv and install websockets
  execSync(`python3 -m venv "${venvDir}"`, { timeout: 30000 });
  execSync(`"${venvPython}" -m pip install websockets -q`, { timeout: 30000 });
}

function startServer(): void {
  ensureVenv();

  const proc = spawn(venvPython, [serverScript, String(PTY_PORT)], {
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
