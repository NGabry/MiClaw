import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { scanActiveSessions, killSession } from "@/lib/sessionScanner";

export const dynamic = "force-dynamic";

/**
 * Get PIDs of Claude processes spawned by the MiClaw PTY server.
 * These should be filtered from "detected" sessions.
 */
function getMiclawSpawnedPids(): Set<number> {
  const pids = new Set<number>();
  try {
    // Find the PTY server process
    const ptyServerPids = execSync("lsof -ti:3001 2>/dev/null", { encoding: "utf-8", timeout: 2000 }).trim();
    if (!ptyServerPids) return pids;

    // Get all child processes of the PTY server (the forked claude processes)
    for (const ppid of ptyServerPids.split("\n")) {
      try {
        const children = execSync(`pgrep -P ${ppid.trim()} 2>/dev/null`, { encoding: "utf-8", timeout: 2000 }).trim();
        for (const child of children.split("\n")) {
          const pid = parseInt(child.trim(), 10);
          if (pid) {
            pids.add(pid);
            // Also get grandchildren (shell -> claude)
            try {
              const grandchildren = execSync(`pgrep -P ${pid} 2>/dev/null`, { encoding: "utf-8", timeout: 2000 }).trim();
              for (const gc of grandchildren.split("\n")) {
                const gcPid = parseInt(gc.trim(), 10);
                if (gcPid) pids.add(gcPid);
              }
            } catch { /* no grandchildren */ }
          }
        }
      } catch { /* no children */ }
    }
  } catch { /* PTY server not running */ }
  return pids;
}

export async function GET() {
  const sessions = await scanActiveSessions();
  const miclawPids = getMiclawSpawnedPids();
  const filtered = sessions.filter((s) => !miclawPids.has(s.pid));
  return NextResponse.json(filtered);
}

export async function DELETE(request: Request) {
  const { pid } = await request.json();
  if (typeof pid !== "number") {
    return NextResponse.json({ error: "Invalid PID" }, { status: 400 });
  }
  const success = await killSession(pid);
  return NextResponse.json({ success });
}
