import { spawn } from "child_process";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { sessionId, cwd, message } = await request.json();

  if (!sessionId || !message) {
    return new Response(JSON.stringify({ error: "sessionId and message required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const proc = spawn("claude", [
        "--resume", sessionId,
        "--print", message,
        "--output-format", "stream-json",
        "--verbose",
        "--permission-mode", "acceptEdits",
      ], {
        cwd: cwd || process.env.HOME,
        env: { ...process.env },
        stdio: ["pipe", "pipe", "pipe"],
      });

      // Close stdin immediately to prevent the "no stdin data" warning
      proc.stdin.end();

      let buffer = "";
      let sentResult = false;

      proc.stdout.on("data", (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            // Only send assistant text content, skip result to avoid duplication
            if (event.type === "assistant" && event.message?.content) {
              for (const block of event.message.content) {
                if (block.type === "text" && block.text) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text", text: block.text })}\n\n`));
                  sentResult = true;
                }
              }
            } else if (event.type === "result" && !sentResult) {
              // Only use result if we didn't get streamed content
              if (event.result) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text", text: event.result })}\n\n`));
              }
            }
          } catch {
            // Skip non-JSON lines (warnings, debug output from --verbose)
          }
        }
      });

      proc.stderr.on("data", (chunk: Buffer) => {
        const text = chunk.toString().trim();
        // Filter out noise
        if (!text || text.includes("Warning:") || text.includes("stdin")) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", text })}\n\n`));
      });

      proc.on("close", () => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "end" })}\n\n`));
        controller.close();
      });

      proc.on("error", (err) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", text: err.message })}\n\n`));
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
