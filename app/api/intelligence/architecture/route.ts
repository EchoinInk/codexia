import { getWorkspaceRoot } from "@/lib/fs-safe";
import { getWorkspaceIndex } from "@/lib/intelligence/workspace-index-manager";
import { analyseArchitecture, type ArchitectureOptions } from "@/lib/intelligence/architecture-analysis";
import { formatArchitectureReport } from "@/lib/agent/architecture-report";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const strings = (value: unknown): boolean => Array.isArray(value) && value.every(item => typeof item === "string");
  if (!body || typeof body !== "object" ||
    (body.entryPoints !== undefined && !strings(body.entryPoints)) ||
    (body.publicFiles !== undefined && !strings(body.publicFiles)) ||
    (body.layers !== undefined && (!Array.isArray(body.layers) || body.layers.some((layer: Record<string, unknown>) =>
      !layer || typeof layer.name !== "string" || !strings(layer.prefixes) || !strings(layer.allowedDependencies))))) {
    return Response.json({ error: "Invalid architecture options" }, { status: 400 });
  }
  try {
    const report = analyseArchitecture(await getWorkspaceIndex(getWorkspaceRoot()), body as ArchitectureOptions);
    return Response.json({ ...report, markdown: formatArchitectureReport(report) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
