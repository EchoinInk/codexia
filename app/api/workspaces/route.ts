import { configuredRequestWorkspace, localMutationBody, RequestError } from "@/lib/local-request";
import { createContinuousEngineeringService } from "@/lib/agent/maintenance/service";
import { FileNotificationPreferencesStore } from "@/lib/workspace-operations/store";
import { createWorkspaceOperationsService } from "@/lib/workspace-operations/service";
import type { WorkspaceAction, WorkspaceLifecycleSnapshot } from "@/lib/workspace-operations/types";
import { getWorkspaceIntelligenceSnapshot } from "@/lib/intelligence/workspace-intelligence-snapshot";
import { getWorkspaceEventHistory, getWorkspaceEventSystemStatus } from "@/lib/agent/event-system";
import { buildControlCentreProjection } from "@/lib/control-centre/projection";

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
          updatedAt: task.updatedAt,
          error: task.error?.message,
          recoveryAvailable: task.status === "failed" && task.attemptBudget.consumed < task.attemptBudget.limit,
          // Queue records do not carry Runtime checkpoints, Validator results,
          // dependency graphs, or measured progress. Keep those fields absent
          // instead of treating queue timestamps/output as authoritative evidence.
        }));
        const running = tasks.filter(task => task.status === "running").length;
        const queued = tasks.filter(task => task.status === "queued").length;
        const status = running ? "active" : queued ? "queued" : state.status === "failed" ? "failed"
          : state.status === "paused" ? "paused" : state.status === "disabled" ? "paused"
          : state.lastOutcome?.status === "cancelled" ? "cancelled" : state.lastOutcome?.status === "completed" ? "completed" : "paused";
        return { workspace, label: "Configured workspace", status, runtimeId: state.currentTaskId,
          tasks, resource: { running, queued },
          evidence: state.snapshotId ? [{ id: state.snapshotId, kind: "workspace-intelligence", status: "current" }] : [],
          audit: state.lastOutcome ? [{ at: state.lastOutcome.at, type: "queue-outcome", detail: state.lastOutcome.reason }] : [],
          outcome: state.lastOutcome ? { status: state.lastOutcome.status, reason: state.lastOutcome.reason, at: state.lastOutcome.at } : undefined,
          capabilities: { pause: state.status === "running", resume: state.enabled && state.status === "paused",
            cancel: state.enabled || !!state.currentTaskId, retry: state.status === "failed", approve: false } };
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
    const workspaces = await operations.projection();
    const controlCentres = await Promise.all(workspaces.map(async lifecycle => {
      let intelligence;
      try {
        const snapshot = await getWorkspaceIntelligenceSnapshot(lifecycle.workspace);
        intelligence = { status: snapshot.status, usable: snapshot.usable, generatedAt: snapshot.provenance?.generatedAt,
          snapshotId: snapshot.provenance?.snapshotId, fileCount: snapshot.evidence?.files.length,
          findingCount: snapshot.evidence?.memory?.learning?.length, failure: snapshot.failure?.message };
      } catch (cause) {
        intelligence = { status: "failed" as const, usable: false, failure: cause instanceof Error ? cause.message : String(cause) };
      }
      const eventStatus = getWorkspaceEventSystemStatus(lifecycle.workspace);
      const activity = getWorkspaceEventHistory(lifecycle.workspace).map(event => ({ id: event.id, type: event.type,
        detail: event.type === "event_failed" ? event.error : `${event.changes.length} workspace change(s)`, at: event.timestamp,
        failed: event.type === "event_failed" }));
      return buildControlCentreProjection({ lifecycle, intelligence, activity, observedAt: Date.now(),
        eventRuntime: { pending: eventStatus.metrics.pending, failed: eventStatus.metrics.failed,
          lastProcessedAt: eventStatus.lastProcessedAt, lastError: eventStatus.lastError } });
    }));
    return Response.json({ workspaces, controlCentres, notifications: await operations.notificationPreferences() });
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
