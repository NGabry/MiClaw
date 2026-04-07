#!/usr/bin/env python3
"""
MiClaw PTY WebSocket server.
Mirrors agent-control-plane's deferred spawn pattern:
  1. Client sends session:create -> server registers pending spawn
  2. Client sends terminal:resize -> server spawns PTY with those exact dimensions
  3. PTY output streams as terminal:output JSON messages
  4. Client sends terminal:input -> server writes to PTY

All messages are JSON strings over WebSocket.
"""

import asyncio
import json
import os
import pty
import re
import fcntl
import struct
import termios
import signal
import sys

try:
    import websockets
    from websockets.asyncio.server import serve
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "websockets", "-q"])
    import websockets
    from websockets.asyncio.server import serve

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 3001


MAX_SCROLLBACK = 5_000_000  # ~5MB of terminal output history per session


class PtyProcess:
    def __init__(self, session_id: str, cwd: str, cols: int, rows: int,
                 resume_id: str | None = None, name: str | None = None):
        self.session_id = session_id
        self.master_fd, slave_fd = pty.openpty()
        self.alive = True
        self.exit_code: int | None = None
        self.output_buffer: list[str] = []  # Server-side scrollback
        self.buffer_size = 0
        self.title: str = ""  # Terminal title set by Claude Code via OSC
        self.last_output_time: float = 0  # For activity tracking
        self.activity: str = "starting"  # starting | producing_output | idle

        winsize = struct.pack("HHHH", rows, cols, 0, 0)
        fcntl.ioctl(slave_fd, termios.TIOCSWINSZ, winsize)

        self.pid = os.fork()
        if self.pid == 0:
            # Child process: become claude
            os.close(self.master_fd)
            os.setsid()
            fcntl.ioctl(slave_fd, termios.TIOCSCTTY, 0)
            os.dup2(slave_fd, 0)
            os.dup2(slave_fd, 1)
            os.dup2(slave_fd, 2)
            if slave_fd > 2:
                os.close(slave_fd)

            os.environ["TERM"] = "xterm-256color"
            os.environ["COLORTERM"] = "truecolor"
            os.environ["LANG"] = "en_US.UTF-8"
            os.environ["LC_ALL"] = "en_US.UTF-8"
            # Remove nesting guard (same as agent-control-plane)
            os.environ.pop("CLAUDECODE", None)

            resolved = os.path.expanduser(cwd)
            if os.path.isdir(resolved):
                os.chdir(resolved)

            # Build command: use shell -c "claude ..." (same as agent-control-plane)
            shell = os.environ.get("SHELL", "/bin/zsh")
            cmd_parts = ["claude"]
            if resume_id:
                cmd_parts.extend(["--resume", resume_id])
            if name:
                cmd_parts.extend(["--name", name])
            os.execlp(shell, shell, "-c", " ".join(cmd_parts))
        else:
            os.close(slave_fd)
            flags = fcntl.fcntl(self.master_fd, fcntl.F_GETFL)
            fcntl.fcntl(self.master_fd, fcntl.F_SETFL, flags | os.O_NONBLOCK)

    def write(self, data: str):
        try:
            os.write(self.master_fd, data.encode("utf-8", errors="surrogateescape"))
        except OSError:
            pass

    def resize(self, cols: int, rows: int):
        try:
            winsize = struct.pack("HHHH", rows, cols, 0, 0)
            fcntl.ioctl(self.master_fd, termios.TIOCSWINSZ, winsize)
        except OSError:
            pass

    def __init_read_buffer(self):
        if not hasattr(self, '_read_buf'):
            self._read_buf = b""

    def read(self) -> str | None:
        self.__init_read_buffer()
        try:
            data = os.read(self.master_fd, 65536)
            if not data:
                return None
            self._read_buf += data
            # Decode as much valid UTF-8 as possible, keep partial bytes
            try:
                result = self._read_buf.decode("utf-8")
                self._read_buf = b""
                return result
            except UnicodeDecodeError:
                # Find the last valid UTF-8 boundary
                for i in range(len(self._read_buf) - 1, max(len(self._read_buf) - 4, -1), -1):
                    try:
                        result = self._read_buf[:i].decode("utf-8")
                        self._read_buf = self._read_buf[i:]
                        return result if result else None
                    except UnicodeDecodeError:
                        continue
                # Can't decode anything, force it
                result = self._read_buf.decode("utf-8", errors="replace")
                self._read_buf = b""
                return result
        except BlockingIOError:
            return None
        except OSError:
            return None

    def check_alive(self) -> bool:
        if not self.alive:
            return False
        try:
            pid, status = os.waitpid(self.pid, os.WNOHANG)
            if pid != 0:
                self.exit_code = os.WEXITSTATUS(status) if os.WIFEXITED(status) else -1
                self.alive = False
            return self.alive
        except ChildProcessError:
            self.alive = False
            return False

    def kill(self):
        self.alive = False
        try:
            os.kill(self.pid, signal.SIGTERM)
        except OSError:
            pass
        try:
            os.close(self.master_fd)
        except OSError:
            pass


# Active PTY processes (persist across WebSocket reconnects)
ptys: dict[str, PtyProcess] = {}

# Pending spawns (waiting for first resize with real dimensions)
pending_spawns: dict[str, dict] = {}

# WebSocket subscriptions per session
subscriptions: dict[str, set] = {}


async def broadcast(session_id: str, msg: dict):
    subs = subscriptions.get(session_id, set())
    dead = set()
    for ws in subs:
        try:
            await ws.send(json.dumps(msg))
        except Exception:
            dead.add(ws)
    subs -= dead


async def read_loop(session_id: str):
    """Background task: read PTY output and broadcast."""
    p = ptys.get(session_id)
    if not p:
        return

    # Regex to extract OSC title: \x1b]0;title\x07 or \x1b]0;title\x1b\\
    title_re = re.compile(r'\x1b\]0;([^\x07\x1b]*?)(?:\x07|\x1b\\)')

    loop = asyncio.get_event_loop()
    while p.check_alive():
        data = await loop.run_in_executor(None, p.read)
        if data:
            # Track activity (2s idle = waiting for input, same as agent-control-plane)
            import time
            p.last_output_time = time.monotonic()
            p.activity = "producing_output"

            # Extract terminal title from OSC sequences
            for m in title_re.finditer(data):
                p.title = m.group(1).strip()

            # Store in server-side scrollback buffer
            p.output_buffer.append(data)
            p.buffer_size += len(data)
            # Trim if over limit
            while p.buffer_size > MAX_SCROLLBACK and p.output_buffer:
                removed = p.output_buffer.pop(0)
                p.buffer_size -= len(removed)

            await broadcast(session_id, {
                "type": "terminal:output",
                "sessionId": session_id,
                "data": data,
            })
        else:
            await asyncio.sleep(0.005)

    await broadcast(session_id, {
        "type": "session:exited",
        "sessionId": session_id,
        "exitCode": p.exit_code,
    })
    ptys.pop(session_id, None)


def do_spawn(session_id: str, opts: dict, cols: int, rows: int):
    """Actually spawn the PTY with real dimensions."""
    p = PtyProcess(
        session_id,
        opts.get("cwd", "~"),
        cols, rows,
        opts.get("resume"),
        opts.get("name"),
    )
    ptys[session_id] = p
    asyncio.get_event_loop().create_task(read_loop(session_id))
    return p


async def handle_client(websocket):
    my_subscriptions: set[str] = set()

    try:
        async for raw in websocket:
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue

            t = msg.get("type", "")
            sid = msg.get("sessionId", "")

            if t == "session:create":
                # Register pending spawn (don't spawn yet -- wait for resize)
                pending_spawns[sid] = {
                    "cwd": msg.get("cwd", "~"),
                    "resume": msg.get("resume"),
                    "name": msg.get("name"),
                }
                # Subscribe
                subscriptions.setdefault(sid, set()).add(websocket)
                my_subscriptions.add(sid)
                await websocket.send(json.dumps({
                    "type": "session:created",
                    "sessionId": sid,
                }))

            elif t == "terminal:resize":
                cols = msg.get("cols", 120)
                rows = msg.get("rows", 30)

                # If pending spawn, trigger it now with real dimensions
                if sid in pending_spawns:
                    opts = pending_spawns.pop(sid)
                    p = do_spawn(sid, opts, cols, rows)
                    await websocket.send(json.dumps({
                        "type": "session:spawned",
                        "sessionId": sid,
                        "pid": p.pid,
                    }))
                elif sid in ptys:
                    ptys[sid].resize(cols, rows)

            elif t == "terminal:input":
                p = ptys.get(sid)
                if p and p.alive:
                    p.write(msg.get("data", ""))

            elif t == "session:kill":
                pending_spawns.pop(sid, None)
                p = ptys.get(sid)
                if p:
                    p.kill()

            elif t == "session:reconnect":
                # Reconnect to existing PTY (e.g. after page refresh)
                subscriptions.setdefault(sid, set()).add(websocket)
                my_subscriptions.add(sid)
                p = ptys.get(sid)
                if p and p.check_alive():
                    await websocket.send(json.dumps({
                        "type": "session:spawned",
                        "sessionId": sid,
                        "pid": p.pid,
                    }))
                    # Replay buffered output so client gets full history
                    for chunk in p.output_buffer:
                        await websocket.send(json.dumps({
                            "type": "terminal:output",
                            "sessionId": sid,
                            "data": chunk,
                        }))
                else:
                    await websocket.send(json.dumps({
                        "type": "session:not_found",
                        "sessionId": sid,
                    }))

            elif t == "session:list":
                import time
                now = time.monotonic()
                result = []
                for s, p in ptys.items():
                    # Update activity: idle if no output for 2+ seconds
                    if p.activity == "producing_output" and p.last_output_time > 0 and (now - p.last_output_time) > 2:
                        p.activity = "idle"
                    result.append({
                        "sessionId": s,
                        "pid": p.pid,
                        "alive": p.check_alive(),
                        "title": p.title,
                        "activity": p.activity,
                    })
                active = result
                await websocket.send(json.dumps({
                    "type": "session:list",
                    "sessions": active,
                }))

    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        for sid in my_subscriptions:
            subs = subscriptions.get(sid, set())
            subs.discard(websocket)


async def main():
    async with serve(handle_client, "127.0.0.1", PORT, max_size=None):
        print(f"MiClaw PTY server on ws://127.0.0.1:{PORT}", file=sys.stderr)
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
