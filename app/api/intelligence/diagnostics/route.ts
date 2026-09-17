import { getWorkspaceRoot } from "@/lib/fs-safe";
import { getWorkspaceIndex } from "@/lib/intelligence/workspace-index-manager";
import { diagnoseWorkspace, diagnosticCodeActions } from "@/lib/intelligence/diagnostics";
import { explainDiagnostic } from "@/lib/intelligence/diagnostic-advice";
import { ollamaDiagnosticAdvisor } from "@/lib/models/diagnostic-advisor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    return Response.json(await diagnoseWorkspace(await getWorkspaceIndex(getWorkspaceRoot())));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<Response> {
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!body || !["actions", "explain"].includes(body.operation) || typeof body.diagnosticId !== "string") {
    return Response.json({ error: "operation and diagnosticId required" }, { status: 400 });
  }
  try {
    const workspace = await getWorkspaceIndex(getWorkspaceRoot());
    const report = await diagnoseWorkspace(workspace);
    const diagnostic = report.diagnostics.find(item => item.id === body.diagnosticId);
    if (!diagnostic) return Response.json({ error: "Diagnostic no longer available" }, { status: 409 });
    return Response.json(body.operation === "explain"
      ? await explainDiagnostic(workspace, diagnostic, ollamaDiagnosticAdvisor)
      : { actions: diagnosticCodeActions(workspace, diagnostic) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
