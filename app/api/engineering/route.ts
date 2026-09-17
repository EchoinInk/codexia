import { ollamaEngineeringReasoner } from "@/lib/models/engineering-reasoner";
import { getWorkspaceRoot } from "@/lib/fs-safe";
import { markWorkspaceDirty } from "@/lib/intelligence/workspace-index-manager";
import { createEngineeringRuntime } from "@/lib/agent/engineering/runtime";
import { createEngineeringReport } from "@/lib/agent/engineering/report";

export const runtime = "nodejs";
const runtimes = new Map<string, ReturnType<typeof createEngineeringRuntime>>();

/** Local programmatic surface; deployment authentication remains host-owned. */
export async function POST(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Origin mismatch" }, { status: 403 });
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!body || !["preview", "start", "resume", "pause", "cancel", "status"].includes(body.operation)) {
    return Response.json({ error: "Invalid engineering operation" }, { status: 400 });
  }
  try {
    const workspace = getWorkspaceRoot();
    let engine = runtimes.get(workspace);
    if (!engine) { engine = createEngineeringRuntime(workspace, { reasoner: ollamaEngineeringReasoner }); runtimes.set(workspace, engine); }
    if (body.operation === "preview") return Response.json(await engine.preview(body.goal));
    if (body.operation !== "start" && (typeof body.taskId !== "string" || !/^[a-zA-Z0-9_-]+$/.test(body.taskId))) {
      return Response.json({ error: "Valid taskId required" }, { status: 400 });
    }
    if (body.operation === "pause" || body.operation === "cancel") {
      return Response.json({ accepted: engine[body.operation as "pause" | "cancel"](body.taskId, "Requested by user") });
    }
    if (body.operation === "status") {
      const checkpoint = await engine.checkpoint(body.taskId);
      if (!checkpoint) return Response.json({ error: "Task not found" }, { status: 404 });
      return Response.json(createEngineeringReport({ state: checkpoint.state, context: checkpoint.context,
        metrics: checkpoint.metrics, checkpoint }));
    }
    const result = body.operation === "start"
      ? await engine.start(body.goal, body.approval, body.taskId)
      : await engine.resume(body.taskId, body.approval);
    markWorkspaceDirty(workspace);
    return Response.json(createEngineeringReport(result));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
