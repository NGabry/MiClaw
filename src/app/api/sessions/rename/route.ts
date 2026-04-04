import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { PROJECTS_DIR } from "@/lib/constants";

export const dynamic = "force-dynamic";

async function findJsonlPath(sessionId: string): Promise<string | null> {
  try {
    const projectDirs = await fs.readdir(PROJECTS_DIR, { withFileTypes: true });
    for (const dir of projectDirs) {
      if (!dir.isDirectory()) continue;
      const jsonlPath = path.join(PROJECTS_DIR, dir.name, `${sessionId}.jsonl`);
      try {
        await fs.stat(jsonlPath);
        return jsonlPath;
      } catch {
        // Not in this directory
      }
    }
  } catch {
    // PROJECTS_DIR doesn't exist
  }
  return null;
}

export async function POST(request: Request) {
  const { sessionId, name } = await request.json();

  if (typeof sessionId !== "string" || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Invalid sessionId or name" }, { status: 400 });
  }

  const jsonlPath = await findJsonlPath(sessionId);
  if (!jsonlPath) {
    return NextResponse.json({ error: "Session JSONL file not found" }, { status: 404 });
  }

  const entry = JSON.stringify({
    type: "custom-title",
    customTitle: name.trim(),
    sessionId,
    timestamp: new Date().toISOString(),
  });

  await fs.appendFile(jsonlPath, "\n" + entry);

  return NextResponse.json({ success: true });
}
