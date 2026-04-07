import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import os from "os";

export const dynamic = "force-dynamic";

/**
 * POST /api/sessions/upload
 * Accepts a base64-encoded image, writes it to a temp file,
 * and returns the file path. Claude Code's tryReadImageFromPath()
 * will detect the image extension and read it when the path is
 * typed/pasted into the terminal.
 */
export async function POST(request: Request) {
  try {
    const { data, filename } = await request.json();
    if (typeof data !== "string" || !data) {
      return NextResponse.json({ error: "Missing image data" }, { status: 400 });
    }

    // Strip data URL prefix if present
    const base64 = data.replace(/^data:image\/\w+;base64,/, "");
    const buf = Buffer.from(base64, "base64");

    // Determine extension from filename or default to png
    const ext = filename
      ? path.extname(filename).toLowerCase() || ".png"
      : ".png";

    const tmpDir = path.join(os.tmpdir(), "miclaw-uploads");
    await fs.mkdir(tmpDir, { recursive: true });

    const tmpFile = path.join(tmpDir, `drop-${Date.now()}${ext}`);
    await fs.writeFile(tmpFile, buf);

    return NextResponse.json({ path: tmpFile });
  } catch {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
