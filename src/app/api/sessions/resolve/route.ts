import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { stat } from "fs/promises";
import { homedir } from "os";

export const dynamic = "force-dynamic";

/**
 * POST /api/sessions/resolve
 * Resolves a dropped filename to its full filesystem path using macOS Spotlight.
 * Accepts { name: string, isDirectory?: boolean }.
 * Returns { path: string } or 404 if not found.
 */
export async function POST(request: Request) {
  try {
    const { name, isDirectory } = await request.json();
    if (typeof name !== "string" || !name) {
      return NextResponse.json({ error: "Missing name" }, { status: 400 });
    }

    // Use mdfind (Spotlight) to locate the item by exact name
    const path = await findByName(name, !!isDirectory);
    if (!path) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ path });
  } catch {
    return NextResponse.json({ error: "Resolve failed" }, { status: 500 });
  }
}

function findByName(name: string, isDirectory: boolean): Promise<string | null> {
  return new Promise((resolve) => {
    // Search under home directory first for speed, with a short timeout
    const home = homedir();
    execFile(
      "mdfind",
      [
        "-name", name,
        "-onlyin", home,
      ],
      { timeout: 3000 },
      async (err, stdout) => {
        if (err || !stdout.trim()) {
          resolve(null);
          return;
        }

        const candidates = stdout.trim().split("\n");

        // Find the best match: exact basename match, correct type (file vs dir)
        for (const candidate of candidates) {
          const basename = candidate.split("/").pop();
          if (basename !== name) continue;
          try {
            const s = await stat(candidate);
            if (isDirectory && s.isDirectory()) {
              resolve(candidate);
              return;
            }
            if (!isDirectory && s.isFile()) {
              resolve(candidate);
              return;
            }
          } catch {
            continue;
          }
        }

        resolve(null);
      },
    );
  });
}
