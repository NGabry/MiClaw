import { scanHistory } from "@/lib/historyScanner";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const search = url.searchParams.get("q") || undefined;
  const project = url.searchParams.get("project") || undefined;
  const limit = parseInt(url.searchParams.get("limit") || "50", 10);
  const offset = parseInt(url.searchParams.get("offset") || "0", 10);
  const withCost = url.searchParams.get("withCost") !== "false";

  const result = await scanHistory({ search, project, limit, offset, withCost });
  return Response.json(result);
}
