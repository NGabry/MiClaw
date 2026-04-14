"use client";

import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef, useState } from "react";

const WS_PORT = 3001;

// --- User terminal palette (fetched once, cached module-level) ---
interface TermPalette {
  background: string;
  foreground: string;
  bold: string;
  selection: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

let palettePromise: Promise<TermPalette | null> | null = null;

function fetchPalette(): Promise<TermPalette | null> {
  if (!palettePromise) {
    palettePromise = fetch("/api/sessions/colors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null);
  }
  return palettePromise;
}

function buildTheme(palette: TermPalette | null): import("@xterm/xterm").ITheme {
  const fallback = {
    background: "#2b2a27",
    foreground: "#faf9f5",
    black: "#1a1a1a",
    red: "#eb3321",
    green: "#9fa205",
    yellow: "#eeaf08",
    blue: "#709585",
    magenta: "#d3869b",
    cyan: "#82b462",
    white: "#a79983",
    brightBlack: "#4d463f",
    brightRed: "#eb3321",
    brightGreen: "#9fa205",
    brightYellow: "#eeaf08",
    brightBlue: "#709585",
    brightMagenta: "#d3869b",
    brightCyan: "#82b462",
    brightWhite: "#ebdab2",
  };

  const p = palette ?? fallback;

  return {
    background: p.background ?? fallback.background,
    foreground: p.foreground ?? fallback.foreground,
    cursor: "#d97757",
    selectionBackground: "rgba(217, 119, 87, 0.3)",
    black: p.black ?? fallback.black,
    red: p.red ?? fallback.red,
    green: p.green ?? fallback.green,
    yellow: p.yellow ?? fallback.yellow,
    blue: p.blue ?? fallback.blue,
    magenta: p.magenta ?? fallback.magenta,
    cyan: p.cyan ?? fallback.cyan,
    white: p.white ?? fallback.white,
    brightBlack: p.brightBlack ?? fallback.brightBlack,
    brightRed: p.brightRed ?? fallback.brightRed,
    brightGreen: p.brightGreen ?? fallback.brightGreen,
    brightYellow: p.brightYellow ?? fallback.brightYellow,
    brightBlue: p.brightBlue ?? fallback.brightBlue,
    brightMagenta: p.brightMagenta ?? fallback.brightMagenta,
    brightCyan: p.brightCyan ?? fallback.brightCyan,
    brightWhite: p.brightWhite ?? fallback.brightWhite,
  };
}

// --- Terminal instance cache (survives unmount/remount, same as agent-control-plane) ---
interface CachedTerminal {
  terminal: import("@xterm/xterm").Terminal;
  fitAddon: import("@xterm/addon-fit").FitAddon;
  ws: WebSocket | null;
  batchWrite: (data: string) => void;
}

const terminalCache = new Map<string, CachedTerminal>();

function createWriteBatcher(terminal: import("@xterm/xterm").Terminal) {
  let buffer: string[] = [];
  let scheduled = false;

  return (data: string) => {
    buffer.push(data);
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(() => {
        const batch = buffer.join("");
        buffer = [];
        scheduled = false;
        terminal.write(batch);
      });
    }
  };
}

interface ConnectWsOpts {
  permissionMode?: string;
  model?: string;
  allowedTools?: string;
  appendSystemPrompt?: string;
  worktree?: boolean;
  killPid?: number;
}

const MAX_RECONNECT_ATTEMPTS = 8;

function connectWs(
  sessionId: string,
  cwd: string,
  cached: CachedTerminal,
  resumeId?: string,
  name?: string,
  opts?: ConnectWsOpts,
  reconnectAttempt: number = 0,
) {
  // Close existing connection without triggering auto-reconnect
  if (cached.ws) {
    cached.ws.onclose = null;
    if (cached.ws.readyState !== WebSocket.CLOSED) {
      cached.ws.close();
    }
  }

  const ws = new WebSocket(`ws://127.0.0.1:${WS_PORT}`);
  cached.ws = ws;

  ws.onopen = () => {
    // Successful connection resets the backoff counter
    reconnectAttempt = 0;
    ws.send(JSON.stringify({ type: "session:reconnect", sessionId }));
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);

      if (msg.type === "session:spawned" && msg.sessionId === sessionId) {
        ws.send(JSON.stringify({
          type: "terminal:resize",
          sessionId,
          cols: cached.terminal.cols,
          rows: cached.terminal.rows,
        }));
      } else if (msg.type === "session:not_found" && msg.sessionId === sessionId) {
        ws.send(JSON.stringify({
          type: "session:create",
          sessionId,
          cwd,
          resume: resumeId,
          killPid: opts?.killPid,
          name,
          permissionMode: opts?.permissionMode,
          model: opts?.model,
          allowedTools: opts?.allowedTools,
          appendSystemPrompt: opts?.appendSystemPrompt,
          worktree: opts?.worktree,
        }));
      } else if (msg.type === "session:created") {
        ws.send(JSON.stringify({
          type: "terminal:resize",
          sessionId,
          cols: cached.terminal.cols,
          rows: cached.terminal.rows,
        }));
      } else if (msg.type === "terminal:output") {
        cached.batchWrite(msg.data);
      } else if (msg.type === "session:error" && msg.sessionId === sessionId) {
        cached.terminal.write("\r\n\x1b[1;31m[PTY Error]\x1b[0m \x1b[31m" + (msg.error || "Unknown error") + "\x1b[0m\r\n");
      } else if (msg.type === "session:exited") {
        const code = msg.exitCode ?? "unknown";
        cached.terminal.write("\r\n\x1b[90m[session exited with code " + code + "]\x1b[0m\r\n");
      }
    } catch { /* ignore */ }
  };

  ws.onclose = () => {
    if (!terminalCache.has(sessionId)) return;
    const attempt = reconnectAttempt + 1;
    if (attempt > MAX_RECONNECT_ATTEMPTS) {
      cached.terminal.write("\r\n\x1b[1;31m[MiClaw]\x1b[0m \x1b[31mReconnect failed after " + MAX_RECONNECT_ATTEMPTS + " attempts. Click the terminal to retry.\x1b[0m\r\n");
      return;
    }
    // Exponential backoff: 2s, 4s, 8s, 16s... capped at 30s
    const delay = Math.min(2000 * Math.pow(2, attempt - 1), 30000);
    setTimeout(() => {
      if (terminalCache.has(sessionId)) {
        connectWs(sessionId, cwd, cached, resumeId, name, opts, attempt);
      }
    }, delay);
  };

  ws.onerror = () => {};
}

// --- Component ---
interface MiclawTerminalProps {
  sessionId: string;
  cwd: string;
  resumeId?: string;
  name?: string;
  permissionMode?: string;
  model?: string;
  allowedTools?: string;
  appendSystemPrompt?: string;
  worktree?: boolean;
  killPid?: number;
}

export function MiclawTerminal({ sessionId, cwd, resumeId, name, permissionMode, model, allowedTools, appendSystemPrompt, worktree, killPid }: MiclawTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mountedRef.current) return;
    mountedRef.current = true;

    let cancelled = false;
    let resizeObserver: ResizeObserver | undefined;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    let lastCols = 0;
    let lastRows = 0;

    async function init() {
      // Ensure PTY server is running
      await fetch("/api/tmux/pty-server").catch(() => {});
      await document.fonts.ready;
      if (cancelled) return;

      // Fetch user's terminal palette before checking cache so first creation uses it
      const palette = await fetchPalette();
      if (cancelled) return;

      let cached = terminalCache.get(sessionId);

      if (!cached) {
        // Create new terminal instance
        const { Terminal } = await import("@xterm/xterm");
        const { FitAddon } = await import("@xterm/addon-fit");
        const { Unicode11Addon } = await import("@xterm/addon-unicode11");
        if (cancelled) return;

        const fitAddon = new FitAddon();
        const terminal = new Terminal({
          allowProposedApi: true,
          cursorBlink: true,
          cursorStyle: "block",
          fontSize: 13,
          fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', 'Geist Mono', Menlo, monospace",
          lineHeight: 1.2,
          scrollback: 10000,
          theme: buildTheme(palette),
        });

        terminal.loadAddon(fitAddon);
        terminal.loadAddon(new Unicode11Addon());
        terminal.unicode.activeVersion = "11";

        cached = {
          terminal,
          fitAddon,
          ws: null,
          batchWrite: () => {},
        };
        cached.batchWrite = createWriteBatcher(terminal);
        terminalCache.set(sessionId, cached);

        // Keystrokes -> PTY (registered once, uses cached.ws which updates on reconnect)
        // Send input as a single WS message -- no client-side chunking needed.
        // The PTY server writes in a blocking thread (run_in_executor) so the
        // kernel handles flow control naturally.
        terminal.onData((data) => {
          if (!cached?.ws || cached.ws.readyState !== WebSocket.OPEN) return;
          cached.ws.send(JSON.stringify({ type: "terminal:input", sessionId, data }));
        });

        // Shift+Enter -> CSI u encoding
        // Shift+Space -> MiClaw command mode (intercepted, not sent to PTY)
        terminal.attachCustomKeyEventHandler((e: KeyboardEvent) => {
          if (e.type === "keydown" && e.key === "Enter" && e.shiftKey) {
            e.preventDefault();
            if (cached?.ws?.readyState === WebSocket.OPEN) {
              cached.ws.send(JSON.stringify({ type: "terminal:input", sessionId, data: "\x1b[13;2u" }));
            }
            return false;
          }
          if (e.type === "keydown" && e.key === "Escape" && e.shiftKey) {
            e.preventDefault();
            window.dispatchEvent(new CustomEvent("miclaw:command-mode"));
            return false;
          }
          return true;
        });

        // Open fresh terminal
        terminal.open(container!);
      } else {
        // Reattach cached terminal to new container (survives collapse/expand)
        const isReattach = !!cached.terminal.element;
        if (isReattach && cached.terminal.element) {
          container!.appendChild(cached.terminal.element);
        } else {
          cached.terminal.open(container!);
        }
      }

      const { terminal, fitAddon } = cached;
      // Don't auto-focus: in a multi-pane layout, this would steal focus from
      // whichever terminal the user is typing in. Focus happens on click instead.

      // Wait for renderer to initialize (double rAF)
      await new Promise<void>((r) =>
        requestAnimationFrame(() => requestAnimationFrame(() => r()))
      );
      if (cancelled) return;

      fitAddon.fit();
      lastCols = terminal.cols;
      lastRows = terminal.rows;

      // Connect/reconnect WebSocket if not connected
      const wsOpts: ConnectWsOpts = { permissionMode, model, allowedTools, appendSystemPrompt, worktree, killPid };
      if (!cached.ws || cached.ws.readyState === WebSocket.CLOSED) {
        connectWs(sessionId, cwd, cached, resumeId, name, wsOpts);
      } else {
        // Already connected, just send resize to sync
        cached.ws.send(JSON.stringify({
          type: "terminal:resize",
          sessionId,
          cols: lastCols,
          rows: lastRows,
        }));
      }

      // Resize observer with 150ms debounce
      let resizeReady = false;
      setTimeout(() => { resizeReady = true; }, 1000);

      resizeObserver = new ResizeObserver(() => {
        if (!resizeReady || cancelled) return;
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          fitAddon.fit();
          if (terminal.cols !== lastCols || terminal.rows !== lastRows) {
            lastCols = terminal.cols;
            lastRows = terminal.rows;
            if (cached?.ws?.readyState === WebSocket.OPEN) {
              cached.ws.send(JSON.stringify({
                type: "terminal:resize",
                sessionId,
                cols: lastCols,
                rows: lastRows,
              }));
            }
          }
        }, 150);
      });
      resizeObserver.observe(container!);

      // Fit again after layout settles (for reattach)
      setTimeout(() => {
        if (cancelled) return;
        fitAddon.fit();
        if (terminal.cols !== lastCols || terminal.rows !== lastRows) {
          lastCols = terminal.cols;
          lastRows = terminal.rows;
          if (cached?.ws?.readyState === WebSocket.OPEN) {
            cached.ws.send(JSON.stringify({
              type: "terminal:resize",
              sessionId,
              cols: lastCols,
              rows: lastRows,
            }));
          }
        }
      }, 100);
    }

    init().catch((err) => setError(String(err)));

    return () => {
      cancelled = true;
      mountedRef.current = false;
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeObserver?.disconnect();
      // DON'T dispose terminal or close WS -- they persist in cache
    };
  }, [sessionId, cwd, resumeId, name, permissionMode, model, allowedTools, appendSystemPrompt, worktree, killPid]);

  const [dragOver, setDragOver] = useState(false);

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const cached = terminalCache.get(sessionId);
    if (!cached?.ws || cached.ws.readyState !== WebSocket.OPEN) return;

    function sendToTerminal(text: string) {
      cached!.ws!.send(JSON.stringify({ type: "terminal:input", sessionId, data: text }));
    }

    // Check for image files first -- these need the upload path so Claude
    // Code can read them (sending a raw path isn't enough for screenshots).
    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find((f) => /^image\//i.test(f.type));

    if (imageFile) {
      try {
        const buf = await imageFile.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));

        const res = await fetch("/api/sessions/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: base64, filename: imageFile.name }),
        });

        if (res.ok) {
          const { path } = await res.json();
          sendToTerminal(path);
          return;
        }
      } catch {
        // Fall through to path-based approaches
      }
    }

    // Try file:// URIs (Finder drag gives these in Safari)
    const uriList = e.dataTransfer.getData("text/uri-list");
    if (uriList) {
      const paths = uriList
        .split(/\r?\n/)
        .filter((line) => line.startsWith("file://"))
        .map((uri) => decodeURIComponent(uri.replace("file://", "")));
      if (paths.length > 0) {
        sendToTerminal(paths.join(" "));
        return;
      }
    }

    // Try resolving dropped items via Spotlight (works in Chrome for folders)
    const items = Array.from(e.dataTransfer.items);
    const entries = items
      .map((item) => item.webkitGetAsEntry?.())
      .filter((entry): entry is FileSystemEntry => entry != null);

    if (entries.length > 0) {
      const resolved: string[] = [];
      for (const entry of entries) {
        try {
          const res = await fetch("/api/sessions/resolve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: entry.name, isDirectory: entry.isDirectory }),
          });
          if (res.ok) {
            const { path } = await res.json();
            if (path) resolved.push(path);
          }
        } catch { /* skip */ }
      }
      if (resolved.length > 0) {
        sendToTerminal(resolved.join(" "));
      }
    }
  }

  if (error) {
    return <p className="text-xs font-mono text-red-400 p-4">{error}</p>;
  }

  return (
    <div
      ref={containerRef}
      data-miclaw-terminal
      className={`relative rounded-xl border overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${dragOver ? "border-accent ring-1 ring-accent/30" : "border-white/[0.06]"}`}
      style={{ height: "100%", minHeight: "400px" }}
      onClick={() => {
        containerRef.current?.querySelector("textarea")?.focus();
      }}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    />
  );
}

/** Dispose a terminal and its WebSocket (called when killing a session) */
export function disposeTerminal(sessionId: string) {
  const cached = terminalCache.get(sessionId);
  if (cached) {
    cached.ws?.close();
    cached.terminal.dispose();
    terminalCache.delete(sessionId);
  }
}
