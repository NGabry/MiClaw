import { execFileSync } from "child_process";
import path from "path";

export const dynamic = "force-dynamic";

const scriptPath = path.join(process.cwd(), "helpers", "read-terminal-colors.py");

/**
 * Reads Terminal.app's full ANSI color palette from the plist.
 * Returns bg, fg, bold, selection, and all 16 ANSI colors.
 */
export async function POST() {
  try {
    const colorsJson = execFileSync("python3", [scriptPath], {
      encoding: "utf-8",
      timeout: 5000,
    }).trim();

    return new Response(colorsJson, {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
}
