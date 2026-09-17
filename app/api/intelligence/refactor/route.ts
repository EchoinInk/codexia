import { getWorkspaceRoot } from "@/lib/fs-safe";
import { getWorkspaceIndex, markWorkspaceDirty } from "@/lib/intelligence/workspace-index-manager";
import { planRename, planRefactoring, availableRefactorings } from "@/lib/intelligence/refactoring";
import { validateChangeProposal } from "@/lib/agent/change-validator";
import { applyReviewedChange, recoverChange } from "@/lib/agent/change-workflow";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Origin mismatch" }, { status: 403 });
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!body || typeof body.operation !== "string") return Response.json({ error: "operation required" }, { status: 400 });
  const point = (value: unknown): boolean => {
    if (!value || typeof value !== "object") return false;
    const p = value as { line?: number; column?: number };
    return Number.isInteger(p.line) && Number.isInteger(p.column) && p.line! > 0 && p.column! > 0;
  };
  try {
    const workspace = getWorkspaceRoot();
    if (body.operation === "apply") {
      if (typeof body.reviewedId !== "string" || !body.proposal) return Response.json({ error: "Reviewed proposal required" }, { status: 400 });
      const result = await applyReviewedChange(workspace, body.proposal, body.reviewedId);
      markWorkspaceDirty(workspace);
      return Response.json(result, { status: result.status === "verified" ? 200 : 409 });
    }
    if (body.operation === "recover") {
      if (typeof body.journalName !== "string") return Response.json({ error: "journalName required" }, { status: 400 });
      const result = await recoverChange(workspace, body.journalName);
      markWorkspaceDirty(workspace);
      return Response.json(result, { status: result.status === "rolled_back" ? 200 : 409 });
    }
    const index = await getWorkspaceIndex(workspace);
    if (body.operation === "validate") return Response.json(validateChangeProposal(index, body.proposal));
    if (typeof body.file !== "string") return Response.json({ error: "file required" }, { status: 400 });
    if (body.operation === "rename") {
      if (!point(body.position) || typeof body.newName !== "string") return Response.json({ error: "position and newName required" }, { status: 400 });
      return Response.json(planRename(index, body.file, body.position, body.newName));
    }
    if (!body.range || !point(body.range.start) || !point(body.range.end)) return Response.json({ error: "range required" }, { status: 400 });
    if (body.operation === "list") return Response.json({ actions: availableRefactorings(index, body.file, body.range) });
    if (body.operation === "refactor" && typeof body.refactor === "string" && typeof body.action === "string") {
      return Response.json(planRefactoring(index, body.file, body.range, body.refactor, body.action));
    }
    return Response.json({ error: "Invalid refactoring operation" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
