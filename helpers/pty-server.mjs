#!/usr/bin/env node
/**
 * MiClaw PTY WebSocket server (Node.js + node-pty).
 *
 * Architecture mirrors agent-control-plane:
 *   1. Client sends session:create  → server registers pending spawn
 *   2. Client sends terminal:resize → server spawns PTY with real dimensions
 *   3. PTY output streams as terminal:output JSON messages
 *   4. Client sends terminal:input  → server writes to PTY (synchronous, no chunking)
 *
 * node-pty handles all PTY buffer management and flow control internally.
 * Broadcasts are fire-and-forget (no await) to prevent backpressure deadlocks.
 */

import { spawn } from 'node-pty';
import { WebSocketServer } from 'ws';
import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { homedir } from 'os';
import { join } from 'path';

const PORT = parseInt(process.argv[2] || '3001', 10);
const MAX_SCROLLBACK = 5_000_000; // ~5MB per session
const SESSIONS_DIR = join(homedir(), '.claude', 'sessions');

// ---------------------------------------------------------------------------
// Session state
// ---------------------------------------------------------------------------

/** @type {Map<string, { process: import('node-pty').IPty, outputBuffer: string[], bufferSize: number, title: string, lastOutputTime: number, activity: string, claudeSessionId: string | null }>} */
const ptys = new Map();

/** @type {Map<string, { cwd: string, resume?: string, name?: string, permissionMode?: string, model?: string, allowedTools?: string, appendSystemPrompt?: string, worktree?: boolean }>} */
const pendingSpawns = new Map();

/** @type {Map<string, Set<import('ws').WebSocket>>} */
const subscriptions = new Map();

/** @type {Set<import('ws').WebSocket>} */
const clients = new Set();

// OSC title regex
const titleRe = /\x1b\]0;([^\x07\x1b]*?)(?:\x07|\x1b\\)/g;

// ---------------------------------------------------------------------------
// Broadcast (fire-and-forget, never blocks reads)
// ---------------------------------------------------------------------------

function broadcast(sessionId, msg) {
  const subs = subscriptions.get(sessionId);
  if (!subs || subs.size === 0) return;
  const payload = JSON.stringify(msg);
  for (const ws of subs) {
    if (ws.readyState === ws.OPEN) {
      ws.send(payload, (err) => {
        if (err) subs.delete(ws);
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Claude session ID discovery
// ---------------------------------------------------------------------------

function discoverClaudeSessionId(session) {
  if (session.claudeSessionId) return;
  const pid = session.process.pid;

  // Check direct PID and child PIDs (shell → claude)
  const pidsToCheck = [pid];
  try {
    const children = execSync(`pgrep -P ${pid}`, { encoding: 'utf-8', timeout: 2000 }).trim();
    for (const line of children.split('\n')) {
      const p = parseInt(line.trim(), 10);
      if (p > 0) pidsToCheck.push(p);
    }
  } catch { /* no children or pgrep failed */ }

  for (const p of pidsToCheck) {
    const pidFile = join(SESSIONS_DIR, `${p}.json`);
    try {
      if (existsSync(pidFile)) {
        const data = JSON.parse(readFileSync(pidFile, 'utf-8'));
        if (data.sessionId) {
          session.claudeSessionId = data.sessionId;
          return;
        }
      }
    } catch { /* skip */ }
  }
}

// ---------------------------------------------------------------------------
// PTY spawning
// ---------------------------------------------------------------------------

function spawnPty(sessionId, opts, cols, rows) {
  const shell = process.env.SHELL || '/bin/zsh';
  const cmdParts = ['claude'];

  if (opts.resume) cmdParts.push('--resume', opts.resume);
  if (opts.name) cmdParts.push('--name', opts.name);
  if (opts.permissionMode) cmdParts.push('--permission-mode', opts.permissionMode);
  if (opts.model) cmdParts.push('--model', opts.model);
  if (opts.allowedTools) cmdParts.push('--allowedTools', opts.allowedTools);
  if (opts.appendSystemPrompt) cmdParts.push('--append-system-prompt', opts.appendSystemPrompt);
  if (opts.worktree) cmdParts.push('--worktree');

  const cwd = opts.cwd || homedir();
  const env = { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor', CLAUDE_CODE_EMIT_SESSION_STATE_EVENTS: '1' };
  delete env.CLAUDECODE;

  const ptyProcess = spawn(shell, ['-c', cmdParts.join(' ')], {
    name: 'xterm-256color',
    cols,
    rows,
    cwd,
    env,
  });

  const session = {
    process: ptyProcess,
    outputBuffer: [],
    bufferSize: 0,
    title: '',
    lastOutputTime: 0,
    activity: 'starting',
    claudeSessionId: null,
  };

  // PTY output → buffer + broadcast (fire-and-forget, never blocks)
  ptyProcess.onData((data) => {
    session.lastOutputTime = Date.now();
    session.activity = 'producing_output';

    // Extract terminal title from OSC sequences
    titleRe.lastIndex = 0;
    let m;
    while ((m = titleRe.exec(data)) !== null) {
      session.title = m[1].trim();
    }

    // Server-side scrollback
    session.outputBuffer.push(data);
    session.bufferSize += data.length;
    while (session.bufferSize > MAX_SCROLLBACK && session.outputBuffer.length > 0) {
      session.bufferSize -= session.outputBuffer.shift().length;
    }

    broadcast(sessionId, { type: 'terminal:output', sessionId, data });
  });

  ptyProcess.onExit(({ exitCode }) => {
    broadcast(sessionId, { type: 'session:exited', sessionId, exitCode });
    ptys.delete(sessionId);
  });

  ptys.set(sessionId, session);

  // Discover Claude session ID in the background
  let attempts = 0;
  const discoveryInterval = setInterval(() => {
    attempts++;
    if (session.claudeSessionId || attempts > 10) {
      clearInterval(discoveryInterval);
      return;
    }
    discoverClaudeSessionId(session);
  }, 1000);

  return session;
}

// ---------------------------------------------------------------------------
// WebSocket handler
// ---------------------------------------------------------------------------

const wss = new WebSocketServer({ port: PORT });
console.error(`MiClaw PTY server on ws://127.0.0.1:${PORT}`);

wss.on('connection', (ws) => {
  clients.add(ws);
  const mySubscriptions = new Set();

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    const t = msg.type || '';
    const sid = msg.sessionId || '';

    switch (t) {
      case 'session:create': {
        pendingSpawns.set(sid, {
          cwd: msg.cwd || '~',
          resume: msg.resume,
          name: msg.name,
          permissionMode: msg.permissionMode,
          model: msg.model,
          allowedTools: msg.allowedTools,
          appendSystemPrompt: msg.appendSystemPrompt,
          worktree: msg.worktree || false,
        });
        const subs = subscriptions.get(sid) || new Set();
        subs.add(ws);
        subscriptions.set(sid, subs);
        mySubscriptions.add(sid);
        ws.send(JSON.stringify({ type: 'session:created', sessionId: sid }));
        break;
      }

      case 'terminal:resize': {
        const cols = msg.cols || 120;
        const rows = msg.rows || 30;

        if (pendingSpawns.has(sid)) {
          const opts = pendingSpawns.get(sid);
          pendingSpawns.delete(sid);
          const session = spawnPty(sid, opts, cols, rows);
          ws.send(JSON.stringify({ type: 'session:spawned', sessionId: sid, pid: session.process.pid }));
        } else {
          const session = ptys.get(sid);
          if (session) session.process.resize(cols, rows);
        }
        break;
      }

      case 'terminal:input': {
        const session = ptys.get(sid);
        if (session) {
          // node-pty handles all flow control internally.
          // Simple synchronous write — no chunking, no threading.
          session.process.write(msg.data || '');
        }
        break;
      }

      case 'session:kill': {
        pendingSpawns.delete(sid);
        const session = ptys.get(sid);
        if (session) session.process.kill();
        break;
      }

      case 'session:reconnect': {
        const subs = subscriptions.get(sid) || new Set();
        subs.add(ws);
        subscriptions.set(sid, subs);
        mySubscriptions.add(sid);
        const session = ptys.get(sid);
        if (session) {
          ws.send(JSON.stringify({ type: 'session:spawned', sessionId: sid, pid: session.process.pid }));
          // Replay scrollback
          for (const chunk of session.outputBuffer) {
            ws.send(JSON.stringify({ type: 'terminal:output', sessionId: sid, data: chunk }));
          }
        } else {
          ws.send(JSON.stringify({ type: 'session:not_found', sessionId: sid }));
        }
        break;
      }

      case 'session:list': {
        const now = Date.now();
        const sessions = [];
        for (const [id, session] of ptys) {
          if (session.activity === 'producing_output' && session.lastOutputTime > 0 && (now - session.lastOutputTime) > 2000) {
            session.activity = 'idle';
          }
          sessions.push({
            sessionId: id,
            pid: session.process.pid,
            alive: true, // If it's in ptys map, it's alive (removed on exit)
            title: session.title,
            activity: session.activity,
            claudeSessionId: session.claudeSessionId,
          });
        }
        ws.send(JSON.stringify({ type: 'session:list', sessions }));
        break;
      }
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    for (const sid of mySubscriptions) {
      const subs = subscriptions.get(sid);
      if (subs) {
        subs.delete(ws);
        if (subs.size === 0) subscriptions.delete(sid);
      }
    }
  });
});
