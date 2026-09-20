import { configuredRequestWorkspace, localMutationBody, RequestError } from "@/lib/local-request";
import { createContinuousEngineeringService } from "@/lib/agent/maintenance/service";
import { FileNotificationPreferencesStore } from "@/lib/workspace-operations/store";
import { createWorkspaceOperationsService } from "@/lib/workspace-operations/service";
import type { WorkspaceAction, WorkspaceLifecycleSnapshot } from "@/lib/workspace-operations/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
let cached: { workspace: string; service: ReturnType<typeof createWorkspaceOperationsService> } | undefined;

async function service(workspace: string) {
  if (cached?.workspace === workspace) return cached.service;
  const continuous = await createContinuousEngineeringService(workspace);
  const operations = createWorkspaceOperationsService({
    registry: { listAuthorized: () => [{
      workspace,
      label: "Configured workspace",
      snapshot: async (): Promise<WorkspaceLifecycleSnapshot> => {
        const state = await continuous.status();
        const tasks = state.queue.map(task => ({
          id: task.id,
          title: task.type,
          status: task.status,
          budget: { limit: task.attemptBudget.limit, consumed: task.attemptBudget.consumed },
          // Queue records do not carry Runtime checkpoints, Validator results,
          // dependency graphs, or measured progress. Keep those fields absent
          // instead of treating queue timestamps/output as authoritative evidence.
        }));
        const running = tasks.filter(task => task.status === "running").length;
        const queued = tasks.filter(task => task.status === "queued").length;
        const status = running ? "active" : queued ? "queued" : state.status === "failed" ? "failed"
          : state.status === "paused" ? "paused" : state.status === "disabled" ? "paused"
          : state.lastOutcome?.status === "cancelled" ? "cancelled" : state.lastOutcome?.status === "completed" ? "completed" : "paused";
        return { workspace, status, runtimeId: state.currentTaskId,
          tasks, resource: { running, queued },
          evidence: state.snapshotId ? [{ id: state.snapshotId, kind: "workspace-intelligence", status: "current" }] : [],
          audit: state.lastOutcome ? [{ at: state.lastOutcome.at, type: "queue-outcome", detail: state.lastOutcome.reason }] : [] };
      },
      dispatch: async (action, runtimeId, approvalId) => {
        if (runtimeId && runtimeId !== (await continuous.status()).currentTaskId) return { acknowledged: false, detail: "Runtime task is no longer current" };
        if (action === "approve") return { acknowledged: false, detail: `Approval ${approvalId ?? "id"} requires the engineering approval route` };
        const value = action === "pause" ? await continuous.pause() : action === "resume" ? await continuous.resume()
          : action === "cancel" ? await continuous.cancel() : await continuous.evaluate();
        const acknowledged = action === "pause"
          ? value.status === "paused"
          : action === "resume"
            ? value.status === "running"
            : action === "cancel"
              ? value.lastOutcome?.status === "cancelled"
              : value.status === "running" && value.queue.some(task => task.status === "queued" || task.status === "running");
        return { acknowledged, detail: acknowledged
          ? `Runtime acknowledged ${action}: ${value.status}`
          : `Runtime did not acknowledge ${action}; authoritative state is ${value.status}` };
      },
    }] },
    preferences: new FileNotificationPreferencesStore(workspace),
  });
  cached = { workspace, service: operations };
  return operations;
}

export async function GET(request: Request): Promise<Response> {
  try {
    const workspace = configuredRequestWorkspace(new URL(request.url).searchParams.get("workspace") ?? undefined);
    const operations = await service(workspace);
    return Response.json({ workspaces: await operations.projection(), notifications: await operations.notificationPreferences() });
  } catch (error) { return response(error); }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await localMutationBody(request);
    const workspace = configuredRequestWorkspace(body.workspace);
    const operations = await service(workspace);
    if (body.operation === "preferences") {
      return Response.json({ notifications: await operations.setNotificationPreferences(body.preferences as never) });
    }
    if (typeof body.operation !== "string" || !["pause", "resume", "cancel", "retry", "approve"].includes(body.operation)) throw new RequestError("Invalid workspace operation");
    if (body.operation === "approve" && (typeof body.approvalId !== "string" || !body.approvalId)) throw new RequestError("Approval id is required");
    return Response.json(await operations.dispatch(workspace, body.operation as WorkspaceAction, typeof body.runtimeId === "string" ? body.runtimeId : undefined, typeof body.approvalId === "string" ? body.approvalId : undefined));
  } catch (error) { return response(error); }
}

function response(error: unknown): Response {
  if (error instanceof RequestError) return Response.json({ error: error.message }, { status: error.status });
  const message = error instanceof Error ? error.message : String(error);
  return Response.json({ error: message }, { status: /invalid|authorized|workspace/i.test(message) ? 400 : 500 });
}
