import { execSync, execFileSync } from "child_process";
import { existsSync } from "fs";
import { homedir } from "os";
import path from "path";

export const dynamic = "force-dynamic";

// Resolve helper path at module level
const HELPER_PATHS = [
  path.join(process.cwd(), "helpers", "type-to-terminal"),
  path.join(homedir(), "Desktop", "MiClaw", "helpers", "type-to-terminal"),
];

function findHelper(): string | null {
  for (const p of HELPER_PATHS) {
    if (existsSync(p)) return p;
  }
  return null;
}

export async function POST(request: Request) {
  const { pid, message } = await request.json();

  if (typeof pid !== "number" || typeof message !== "string" || !message.trim()) {
    return new Response(JSON.stringify({ error: "pid and message required" }), { status: 400 });
  }

  const helperPath = findHelper();
  if (!helperPath) {
    return new Response(JSON.stringify({ error: "Swift helper not found. Run: cd helpers && swiftc -O type-to-terminal.swift -o type-to-terminal" }), { status: 500 });
  }

  try {
    // Find Terminal.app's PID
    const terminalPID = execSync("ps aux | grep '[T]erminal.app' | awk '{print $2}' | head -1", { encoding: "utf-8" }).trim();
    if (!terminalPID) {
      return new Response(JSON.stringify({ error: "Terminal.app not running" }), { status: 404 });
    }

    // Find the TTY for the Claude process and select its tab
    const tty = execSync(`ps -p ${pid} -o tty=`, { encoding: "utf-8" }).trim();
    if (tty) {
      const ttyPath = `/dev/${tty}`;
      try {
        execSync(
          `osascript -e 'tell application "Terminal" to repeat with w in windows\nrepeat with t in tabs of w\nif tty of t is "${ttyPath}" then\nset selected tab of w to t\nend if\nend repeat\nend repeat'`,
          { encoding: "utf-8", timeout: 3000, stdio: "ignore" }
        );
      } catch {
        // Tab selection failed, continue anyway
      }
    }

    // Type via Swift helper (no focus steal)
    const result = execFileSync(helperPath, [terminalPID, message], {
      encoding: "utf-8",
      timeout: 10000,
    }).trim();

    return new Response(JSON.stringify({ success: true, result }));
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
}
