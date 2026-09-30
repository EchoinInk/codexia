import type { WorkspaceTaskProjection } from "@/lib/workspace-operations/types";
import type {
  ControlCentreAgentState, ControlCentreHealthState, ControlCentreMissionState,
  ControlCentreProjection, ControlCentreSource, ControlCentreTaskState,
} from "./types";

const TASK_STATES: Record<string, ControlCentreTaskState> = {
  pending: "pending", queued: "queued", running: "running", blocked: "blocked",
  awaiting_approval: "blocked", paused: "blocked", failed: "failed", cancelled: "cancelled",
  complete: "complete", completed: "complete", verified: "complete",
};

export function controlCentreTaskState(status: string): ControlCentreTaskState {
  return TASK_STATES[status] ?? "unknown";
}

export function controlCentreMissionState(status: string): ControlCentreMissionState {
  if (status === "active") return "running";
  if (status === "paused") return "paused";
  if (["queued", "awaiting_approval", "failed", "cancelled", "completed"].includes(status)) return status as ControlCentreMissionState;
  return "planned";
}

function intelligenceHealth(source?: ControlCentreSource["intelligence"]): ControlCentreHealthState {
  if (!source) return "unknown";
  if (source.status === "current") return "healthy";
  if (source.status === "stale") return "stale";
  if (source.status === "failed") return "failed";
  if (source.status === "unavailable") return "unavailable";
  return "degraded";
}

function runtimeHealth(source: ControlCentreSource): ControlCentreHealthState {
  const status = source.lifecycle.status;
  if (status === "failed") return "failed";
  if (status === "paused" || status === "cancelled" || status === "awaiting_approval") return "degraded";
  if (["active", "queued", "completed"].includes(status)) return "healthy";
  return "unknown";
}

function overallHealth(states: ControlCentreHealthState[]): ControlCentreHealthState {
  if (states.includes("failed")) return "failed";
  if (states.includes("unavailable")) return "unavailable";
  if (states.includes("stale")) return "stale";
  if (states.includes("degraded")) return "degraded";
  if (states.length > 0 && states.every(state => state === "healthy")) return "healthy";
  return "unknown";
}

function taskSummary(tasks: Array<WorkspaceTaskProjection & { state: ControlCentreTaskState }>) {
  const summary = { pending: 0, queued: 0, running: 0, blocked: 0, failed: 0, cancelled: 0, complete: 0, unknown: 0 };
  for (const task of tasks) summary[task.state] += 1;
  return summary;
}

function agentProjection(source: ControlCentreSource, tasks: Array<WorkspaceTaskProjection & { state: ControlCentreTaskState }>) {
  const running = tasks.find(task => task.state === "running");
  const failed = tasks.find(task => task.state === "failed");
  const queued = tasks.find(task => task.state === "queued");
  const state: ControlCentreAgentState = running ? "active" : failed ? "failed" : queued ? "queued" : "idle";
  const items = [{
    id: "runtime-coordinator", label: "Runtime coordinator", state,
    assignedWork: running?.title ?? queued?.title,
    detail: running ? "Executing authoritative workflow work" : queued ? "Work is queued by the runtime" : failed ? "Assigned work failed" : "No assigned runtime work",
  }, {
    id: "specialist-projection", label: "Specialist agents", state: "unavailable" as const,
    detail: "The coordinator does not expose a durable live-agent registry.",
  }];
  return {
    items,
    active: items.filter(item => item.state === "active").length,
    idle: items.filter(item => item.state === "idle").length,
    queued: items.filter(item => item.state === "queued").length,
    unavailable: items.filter(item => item.state === "unavailable").length,
    failed: items.filter(item => item.state === "failed").length,
  };
}

export function buildControlCentreProjection(source: ControlCentreSource): ControlCentreProjection {
  const lifecycle = source.lifecycle;
  const tasks = lifecycle.tasks.map(task => ({ ...task, state: controlCentreTaskState(task.status) }));
  const approvals = tasks.filter(task => task.pendingApproval || task.status === "awaiting_approval").map(task => ({
    id: `approval-${task.id}`, taskId: task.id, label: task.title, runtimeId: lifecycle.runtimeId,
  }));
  const failures: ControlCentreProjection["failures"] = tasks.filter(task => task.state === "failed").map(task => ({
    id: `failure-${task.id}`, taskId: task.id, title: `${task.title} failed`, detail: task.error ?? "No failure detail was projected.",
    recoverable: !!task.recoveryAvailable,
  }));
  if (lifecycle.status === "failed" && failures.length === 0) failures.push({
    id: "runtime-failure", title: "Runtime failure", detail: lifecycle.outcome?.reason ?? "No failure detail was projected.", recoverable: lifecycle.capabilities?.retry ?? false,
  });
  const intelligenceState = intelligenceHealth(source.intelligence);
  const eventState: ControlCentreHealthState = source.eventRuntime?.lastError || source.eventRuntime?.failed ? "failed"
    : source.eventRuntime ? source.eventRuntime.pending ? "degraded" : "healthy" : "unknown";
  const signals = [
    { id: "runtime", label: "Runtime", state: runtimeHealth(source), detail: `Lifecycle is ${lifecycle.status}.` },
    { id: "intelligence", label: "Intelligence", state: intelligenceState, detail: source.intelligence ? `Evidence is ${source.intelligence.status}.` : "No intelligence projection is available." },
    { id: "events", label: "Workspace events", state: eventState, detail: source.eventRuntime?.lastError ?? (source.eventRuntime ? `${source.eventRuntime.pending} pending event(s).` : "No event-runtime signal is available.") },
    { id: "providers", label: "Model providers", state: "unknown" as const, detail: "No authoritative provider-health projection is exposed." },
  ];
  const notifications: ControlCentreProjection["notifications"] = [
    ...approvals.map(item => ({ id: item.id, kind: "approval" as const, title: "Approval required", detail: item.label, taskId: item.taskId })),
    ...failures.map(item => ({ id: `notice-${item.id}`, kind: "failure" as const, title: item.title, detail: item.detail, taskId: item.taskId })),
  ];
  if (intelligenceState === "stale") notifications.push({ id: "intelligence-stale", kind: "stale", title: "Intelligence is stale", detail: "Refresh is required before relying on current workspace evidence." });
  if (intelligenceState === "unavailable" || intelligenceState === "failed") notifications.push({ id: "intelligence-unavailable", kind: "unavailable", title: "Intelligence unavailable", detail: source.intelligence?.failure ?? "Workspace evidence cannot currently be read." });
  if (lifecycle.status === "paused" && lifecycle.checkpoints?.length) notifications.push({ id: "recovery-available", kind: "recovery", title: "Interrupted work can be resumed", detail: "An authoritative runtime checkpoint is available." });
  const missionTask = tasks.find(task => ["running", "blocked", "queued", "failed"].includes(task.state)) ?? tasks.at(0);
  const hasMission = !!(lifecycle.runtimeId || missionTask || lifecycle.outcome);
  return {
    workspace: { root: lifecycle.workspace, label: lifecycle.label ?? lifecycle.workspace.split(/[\\/]/).filter(Boolean).at(-1) ?? lifecycle.workspace, status: lifecycle.status, observedAt: source.observedAt },
    mission: hasMission ? { id: lifecycle.runtimeId ?? missionTask?.id ?? "recent-mission", title: missionTask?.title ?? "Recent workspace mission", status: controlCentreMissionState(lifecycle.status), progress: lifecycle.progress, updatedAt: lifecycle.outcome?.at } : undefined,
    tasks, taskSummary: taskSummary(tasks), agents: agentProjection(source, tasks),
    health: { overall: overallHealth(signals.map(signal => signal.state)), signals },
    intelligence: { status: source.intelligence?.status ?? "unavailable", usable: source.intelligence?.usable ?? false,
      generatedAt: source.intelligence?.generatedAt, snapshotId: source.intelligence?.snapshotId, fileCount: source.intelligence?.fileCount,
      findingCount: source.intelligence?.findingCount, failure: source.intelligence?.failure, state: intelligenceState },
    approvals, notifications, failures,
    activity: [...(source.activity ?? []), ...(lifecycle.audit ?? []).map((event, index) => ({ id: `audit-${event.at}-${index}`, type: event.type, detail: event.detail, at: event.at, failed: /fail|error|interrupt/i.test(event.type) }))]
      .sort((a, b) => b.at - a.at).slice(0, 12),
    capabilities: lifecycle.capabilities ?? {
      pause: lifecycle.status === "active", resume: lifecycle.status === "paused", cancel: ["active", "queued", "paused"].includes(lifecycle.status),
      retry: lifecycle.status === "failed", approve: approvals.length > 0,
    },
  };
}
