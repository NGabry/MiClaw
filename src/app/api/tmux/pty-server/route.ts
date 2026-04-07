import { execSync } from "child_process";

export const dynamic = "force-dynamic";

const PTY_PORT = 3001;

function isRunning(): boolean {
  try {
    execSync(`lsof -ti:${PTY_PORT}`, { encoding: "utf-8", timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

function startServer(): void {
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
