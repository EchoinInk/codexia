import { ollamaEngineeringReasoner } from "@/lib/models/engineering-reasoner";
import { configuredRequestWorkspace, localMutationBody, RequestError } from "@/lib/local-request";
import type { EngineeringGoal, EngineeringApproval } from "@/lib/agent/engineering/types";
import { markWorkspaceDirty } from "@/lib/intelligence/workspace-index-manager";
import { createEngineeringRuntime } from "@/lib/agent/engineering/runtime";
import { createEngineeringReport } from "@/lib/agent/engineering/report";

export const runtime = "nodejs";
const runtimes = new Map<string, ReturnType<typeof createEngineeringRuntime>>();

function engineeringErrorResponse(error: unknown): Response {
  if (error instanceof RequestError) return Response.json({ error: error.message }, { status: error.status });
  const message = error instanceof Error ? error.message : "";
  if (/already active|already exists|workspace changed|stale|invalidated|pending proposal missing/i.test(message)) {
    return Response.json({ error: message }, { status: 409 });
  }
  if (/^(invalid |unknown scope file|engineering .* required|measurable acceptance|obligation outside|duplicate engineering|operation outside|current explicit approval)/i.test(message)) {
    return Response.json({ error: message }, { status: 400 });
  }
  return Response.json({ error: "Internal engineering error" }, { status: 500 });
}

/** Local programmatic surface; deployment authentication remains host-owned. */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = await localMutationBody(request);
    if (typeof body.operation !== "string" || !["preview", "start", "resume", "pause", "cancel", "status"].includes(body.operation)) {
      throw new RequestError("Invalid engineering operation");
    }
    const workspace = configuredRequestWorkspace(body.workspace);
    let engine = runtimes.get(workspace);
    if (!engine) { engine = createEngineeringRuntime(workspace, { reasoner: ollamaEngineeringReasoner }); runtimes.set(workspace, engine); }
    if (body.operation === "preview") return Response.json(await engine.preview(body.goal as EngineeringGoal));
    if (body.operation !== "start" && (typeof body.taskId !== "string" || !/^[a-zA-Z0-9_-]+$/.test(body.taskId))) {
      return Response.json({ error: "Valid taskId required" }, { status: 400 });
    }
    if (body.operation === "pause" || body.operation === "cancel") {
      return Response.json({ accepted: engine[body.operation as "pause" | "cancel"](body.taskId as string, "Requested by user") });
    }
    if (body.operation === "status") {
      const checkpoint = await engine.checkpoint(body.taskId as string);
      if (!checkpoint) return Response.json({ error: "Task not found" }, { status: 404 });
      return Response.json(createEngineeringReport({ state: checkpoint.state, context: checkpoint.context,
        metrics: checkpoint.metrics, checkpoint }));
    }
    const result = body.operation === "start"
      ? await engine.start(body.goal as EngineeringGoal, body.approval as EngineeringApproval, body.taskId as string | undefined)
      : await engine.resume(body.taskId as string, body.approval as EngineeringApproval | undefined);
    markWorkspaceDirty(workspace);
    return Response.json(createEngineeringReport(result));
  } catch (error) {
    return engineeringErrorResponse(error);
  }
}
