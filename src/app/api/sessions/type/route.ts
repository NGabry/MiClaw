import { execSync, execFileSync } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { pid, message } = await request.json();

  if (typeof pid !== "number" || typeof message !== "string" || !message.trim()) {
    return new Response(JSON.stringify({ error: "pid and message required" }), { status: 400 });
  }

  try {
    // Find the TTY for the Claude process
    const tty = execSync(`ps -p ${pid} -o tty=`, { encoding: "utf-8" }).trim();
    if (!tty) {
      return new Response(JSON.stringify({ error: "Could not find TTY" }), { status: 404 });
    }

    const ttyPath = `/dev/${tty}`;

    // Escape message for AppleScript string
    const escaped = message
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"');

    // Use "do script" to send text directly to the specific tab
    // This targets the tab by TTY -- no window reindexing, no focus issues
    const scriptPath = `${tmpdir()}/miclaw-type-${Date.now()}.scpt`;
    writeFileSync(scriptPath, [
      'tell application "Terminal"',
      "  repeat with w in windows",
      "    repeat with t in tabs of w",
      `      if tty of t is "${ttyPath}" then`,
      `        do script "${escaped}" in t`,
      '        return "ok"',
      "      end if",
      "    end repeat",
      "  end repeat",
      '  return "not_found"',
      "end tell",
    ].join("\n"));

    try {
      const result = execFileSync("osascript", [scriptPath], {
        encoding: "utf-8",
        timeout: 5000,
      }).trim();

      if (result === "not_found") {
        return new Response(JSON.stringify({ error: `Tab not found for ${ttyPath}` }), { status: 404 });
      }

      return new Response(JSON.stringify({ success: true }));
    } finally {
      try { unlinkSync(scriptPath); } catch { /* ignore */ }
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
}
