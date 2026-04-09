import { runHealthCheck } from "@/lib/healthCheck";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = runHealthCheck();
  const allOk = status.claude.ok && status.nodePty.ok && status.nodeVersion.ok;
  // PTY server may not be running yet (started on demand), so don't fail on that
  return Response.json({ ...status, healthy: allOk });
}
