import { execSync, execFileSync } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import path from "path";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { pid } = await request.json();

  if (typeof pid !== "number") {
    return new Response(JSON.stringify({ error: "pid required" }), { status: 400 });
  }

  try {
    const tty = execSync(`ps -p ${pid} -o tty=`, { encoding: "utf-8" }).trim();
    if (!tty) {
      return new Response(JSON.stringify({ error: "Could not find TTY" }), { status: 404 });
    }

    const ttyPath = `/dev/${tty}`;

    // Use Terminal.app's "history" property which reliably returns the scrollback text
    const scriptPath = path.join(tmpdir(), `miclaw-screen-${Date.now()}.scpt`);
    writeFileSync(scriptPath, [
      'tell application "Terminal"',
      "  repeat with w in windows",
      "    repeat with t in tabs of w",
      `      if tty of t is "${ttyPath}" then`,
      "        return history of t",
      "      end if",
      "    end repeat",
      "  end repeat",
      '  return "NOT_FOUND"',
      "end tell",
    ].join("\n"));

    try {
      const result = execFileSync("osascript", [scriptPath], {
        encoding: "utf-8",
        timeout: 5000,
        maxBuffer: 10 * 1024 * 1024,
      });

      if (result.trim() === "NOT_FOUND") {
        return new Response(JSON.stringify({ error: "Terminal tab not found" }), { status: 404 });
      }

      return new Response(JSON.stringify({ screen: result }));
    } finally {
      try { unlinkSync(scriptPath); } catch { /* ignore */ }
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
}
