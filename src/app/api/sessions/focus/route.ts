import { execSync, execFileSync } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import path from "path";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { pid } = await request.json();

  if (typeof pid !== "number") {
    return new Response(JSON.stringify({ error: "Invalid PID" }), { status: 400 });
  }

  try {
    const tty = execSync(`ps -p ${pid} -o tty=`, { encoding: "utf-8" }).trim();
    if (!tty) {
      return new Response(JSON.stringify({ error: "Could not find TTY" }), { status: 404 });
    }

    const ttyPath = `/dev/${tty}`;

    const scriptPath = path.join(tmpdir(), `miclaw-focus-${Date.now()}.scpt`);
    const script = [
      'tell application "Terminal"',
      "  repeat with w in windows",
      "    repeat with t in tabs of w",
      `      if tty of t is "${ttyPath}" then`,
      "        set selected tab of w to t",
      "        set index of w to 1",
      "        activate",
      '        return "ok"',
      "      end if",
      "    end repeat",
      "  end repeat",
      '  return "not found"',
      "end tell",
    ].join("\n");

    writeFileSync(scriptPath, script, "utf-8");

    try {
      const result = execFileSync("osascript", [scriptPath], { encoding: "utf-8" }).trim();

      if (result === "ok") {
        return new Response(JSON.stringify({ success: true }));
      }

      return new Response(JSON.stringify({ error: "Terminal tab not found" }), { status: 404 });
    } finally {
      try { unlinkSync(scriptPath); } catch { /* ignore */ }
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
}
