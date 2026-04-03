import { NextResponse } from "next/server";
import { scanActiveSessions, killSession } from "@/lib/sessionScanner";

export const dynamic = "force-dynamic";

export async function GET() {
  const sessions = await scanActiveSessions();
  return NextResponse.json(sessions);
}

export async function DELETE(request: Request) {
  const { pid } = await request.json();
  if (typeof pid !== "number") {
    return NextResponse.json({ error: "Invalid PID" }, { status: 400 });
  }
  const success = await killSession(pid);
  return NextResponse.json({ success });
}
