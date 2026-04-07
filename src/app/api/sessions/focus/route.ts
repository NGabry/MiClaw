import { execSync, execFileSync } from "child_process";

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

    const result = execFileSync("osascript", [
      "-e", 'tell application "Terminal"',
      "-e", "  repeat with w in windows",
      "-e", "    repeat with t in tabs of w",
      "-e", `      if tty of t is "${ttyPath}" then`,
      "-e", "        set selected tab of w to t",
      "-e", "        set index of w to 1",
      "-e", "        activate",
      "-e", '        return "ok"',
      "-e", "      end if",
      "-e", "    end repeat",
      "-e", "  end repeat",
      "-e", '  return "not found"',
      "-e", "end tell",
    ], { encoding: "utf-8", timeout: 5000 }).trim();

    if (result === "ok") {
      return new Response(JSON.stringify({ success: true }));
    }

    return new Response(JSON.stringify({ error: "Terminal tab not found" }), { status: 404 });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
}
