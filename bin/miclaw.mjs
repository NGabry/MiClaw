#!/usr/bin/env node

import { spawn, execSync } from "child_process";
import { existsSync, cpSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createServer } from "net";

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

async function main() {
  if (!existsSync(standaloneServer)) {
    console.log("  Building MiClaw (first run only)...\n");
    execSync("npx next build", { cwd: projectRoot, stdio: "inherit" });
  }

  ensureStaticAssets();

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
