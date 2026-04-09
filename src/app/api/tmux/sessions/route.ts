import { listSessions, createSession, removeSession, updateSession } from "@/lib/miclawSessions";
import { getSessionCost } from "@/lib/sessionScanner";
import WebSocket from "ws";

export const dynamic = "force-dynamic";

const PTY_PORT = 3001;

interface PtySessionInfo {
  sessionId: string;
  alive: boolean;
  title: string;
  activity: string;
  claudeSessionId?: string;
}

/** Query the PTY server for session status and titles */
async function getPtySessionInfo(): Promise<Map<string, PtySessionInfo>> {
  return new Promise((resolve) => {
    try {
      const ws = new WebSocket(`ws://127.0.0.1:${PTY_PORT}`);
      const timeout = setTimeout(() => { ws.close(); resolve(new Map()); }, 2000);

      ws.on("open", () => {
        ws.send(JSON.stringify({ type: "session:list" }));
      });

      ws.on("message", (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === "session:list") {
            clearTimeout(timeout);
            const map = new Map<string, PtySessionInfo>();
            for (const s of msg.sessions as PtySessionInfo[]) {
              map.set(s.sessionId, s);
            }
            ws.close();
            resolve(map);
          }
        } catch { /* ignore */ }
      });

      ws.on("error", () => { clearTimeout(timeout); resolve(new Map()); });
    } catch {
      resolve(new Map());
    }
  });
}

export async function GET() {
  const sessions = listSessions();
  const ptyInfo = await getPtySessionInfo();

  const annotated = await Promise.all(sessions.map(async (s) => {
    const info = ptyInfo.get(s.id);

    // If the PTY server discovered the Claude session ID and we don't have
    // it stored yet, persist it so cost tracking works across restarts.
    let claudeSessionId = s.claudeSessionId;
    if (!claudeSessionId && info?.claudeSessionId) {
      claudeSessionId = info.claudeSessionId;
      updateSession(s.id, { claudeSessionId });
    }

    const cost = claudeSessionId ? await getSessionCost(claudeSessionId) : {};
    return {
      ...s,
      claudeSessionId,
      alive: info?.alive ?? false,
      displayName: (info?.title && info.title !== "") ? info.title : s.displayName,
      activity: info?.activity ?? "unknown",
      costUSD: cost.costUSD,
      inputTokens: cost.inputTokens,
      outputTokens: cost.outputTokens,
    };
  }));

  return Response.json(annotated);
}

export async function POST(request: Request) {
  const { name, cwd, resumeId, killPid, permissionMode, model, allowedTools, appendSystemPrompt, worktree } = await request.json();

  try {
    const session = createSession(name || undefined, cwd || undefined, resumeId || undefined, {
      killPid: killPid || undefined,
      permissionMode: permissionMode || undefined,
      model: model || undefined,
      allowedTools: allowedTools || undefined,
      appendSystemPrompt: appendSystemPrompt || undefined,
      worktree: worktree || undefined,
    });
    return Response.json(session);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { id } = await request.json();

  if (typeof id !== "string") {
    return Response.json({ error: "session id required" }, { status: 400 });
  }

  try {
    removeSession(id);
    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
