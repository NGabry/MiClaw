#!/usr/bin/env node

import { spawn, execSync, execFileSync } from "child_process";
import { existsSync, cpSync, mkdirSync, writeFileSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createServer } from "net";
import { tmpdir } from "os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
const standaloneDir = join(projectRoot, ".next", "standalone");
const standaloneServer = join(standaloneDir, "server.js");

function findOpenPort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

function openBrowser(url) {
  const platform = process.platform;
  const cmd =
    platform === "darwin" ? "open" : platform === "win32" ? "start" : "xdg-open";
  try {
    execSync(`${cmd} ${url}`, { stdio: "ignore" });
  } catch {
    // User can open manually
  }
}

function ensureStaticAssets() {
  // Standalone builds need public/ and .next/static/ copied in
  const publicSrc = join(projectRoot, "public");
  const publicDest = join(standaloneDir, "public");
  if (existsSync(publicSrc) && !existsSync(publicDest)) {
    cpSync(publicSrc, publicDest, { recursive: true });
  }

  const staticSrc = join(projectRoot, ".next", "static");
  const staticDest = join(standaloneDir, ".next", "static");
  if (existsSync(staticSrc) && !existsSync(staticDest)) {
    mkdirSync(join(standaloneDir, ".next"), { recursive: true });
    cpSync(staticSrc, staticDest, { recursive: true });
  }
}

function checkAccessibilityPermission() {
  if (process.platform !== "darwin") return;
  try {
    // Trigger the macOS accessibility permission dialog with a no-op keystroke test
    const scriptPath = join(tmpdir(), "miclaw-perm-check.scpt");
    writeFileSync(scriptPath, [
      'tell application "System Events"',
      '  key code 0 using {}',  // No-op: press nothing
      'end tell',
    ].join("\n"));
    execFileSync("osascript", [scriptPath], { timeout: 5000, stdio: "ignore" });
    try { unlinkSync(scriptPath); } catch {}
  } catch {
    console.log("\n  Note: MiClaw needs Accessibility permission to send messages to terminal sessions.");
    console.log("  Grant access in: System Settings > Privacy & Security > Accessibility\n");
  }
}

async function main() {
  if (!existsSync(standaloneServer)) {
    console.log("  Building MiClaw (first run only)...\n");
    execSync("npx next build", { cwd: projectRoot, stdio: "inherit" });
  }

  ensureStaticAssets();
  checkAccessibilityPermission();

  const port = await findOpenPort();
  console.log(`\n  MiClaw  http://localhost:${port}\n`);

  const server = spawn("node", [standaloneServer], {
    cwd: standaloneDir,
    env: { ...process.env, PORT: String(port), HOSTNAME: "localhost" },
    stdio: "pipe",
  });

  let opened = false;
  const tryOpen = () => {
    if (opened) return;
    opened = true;
    setTimeout(() => openBrowser(`http://localhost:${port}`), 500);
  };

  server.stdout.on("data", (data) => {
    const output = data.toString();
    if (output.includes("Ready") || output.includes("started")) {
      tryOpen();
    }
  });

  setTimeout(tryOpen, 3000);

  server.stderr.on("data", (data) => {
    const msg = data.toString();
    if (!msg.includes("ExperimentalWarning")) {
      process.stderr.write(data);
    }
  });

  process.on("SIGINT", () => { server.kill(); process.exit(0); });
  process.on("SIGTERM", () => { server.kill(); process.exit(0); });
}

main().catch((err) => {
  console.error("  Failed to start MiClaw:", err.message);
  process.exit(1);
});
