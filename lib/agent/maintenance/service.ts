import { getWorkspaceRoot } from "@/lib/fs-safe";
import { analyseArchitecture } from "@/lib/intelligence/architecture-analysis";
import { diagnoseWorkspace } from "@/lib/intelligence/diagnostics";
import { deriveEngineeringInsights } from "@/lib/intelligence/engineering-insights";
import { getWorkspaceIntelligenceSnapshot } from "@/lib/intelligence/workspace-intelligence-snapshot";
import { goalDigest } from "../engineering/governance";
import type { EngineeringApproval, EngineeringGoal } from "../engineering/types";
import { createTaskQueue } from "../task-queue/factory";
import type { TaskQueue } from "../task-queue/queue";
import { DEFAULT_AUTONOMOUS_MAINTENANCE_POLICY, evaluateMaintenanceEligibility } from "./policy";
import { ContinuousEngineeringStore } from "./store";
import type { AutonomousMaintenancePolicy, ContinuousEngineeringState, MaintenanceObservation } from "./types";

export interface ContinuousEngineeringOptions {
  policy?: AutonomousMaintenancePolicy;
  observe?: () => Promise<MaintenanceObservation>;
  queue?: TaskQueue;
  now?: () => number;
}

export async function createContinuousEngineeringService(workspace: string, options: ContinuousEngineeringOptions = {}) {
  const root = getWorkspaceRoot(workspace);
  const policy = options.policy ?? DEFAULT_AUTONOMOUS_MAINTENANCE_POLICY;
  const now = options.now ?? Date.now;
  const store = new ContinuousEngineeringStore(root);
  const queue = options.queue ?? await createTaskQueue(root, { configuration: { autoStart: false } });
  const state = await store.load() ?? initialState(root, now());
  if (state.workspace !== root) throw new Error("Continuous-engineering workspace mismatch");
  let cycling = false;
  const observe = options.observe ?? (async () => {
    const snapshot = await getWorkspaceIntelligenceSnapshot(root);
    if (!snapshot.evidence) return { snapshot, insights: [], limitations: ["Workspace evidence unavailable"] };
    const diagnostics = await diagnoseWorkspace(snapshot.evidence.index);
    const architecture = analyseArchitecture(snapshot.evidence.index);
    const result = deriveEngineeringInsights({ snapshot, diagnostics, architecture, memory: snapshot.evidence.memory });
    return { snapshot, insights: result.insights, limitations: result.limitations };
  });
  queue.subscribe(event => {
    if (event.type === "task_started" && event.task.type === "engineering") {
      state.currentTaskId = event.task.id;
      void persist();
    }
    if (["task_completed", "task_failed", "task_cancelled"].includes(event.type) && "task" in event && event.task.type === "engineering") {
      state.currentTaskId = undefined;
      state.lastOutcome = { taskId: event.task.id, status: event.task.status,
        reason: event.task.output?.summary ?? event.task.error?.message ?? event.task.status, at: now() };
      void persist().then(() => { if (state.enabled && state.status === "running") void cycle(); });
    }
  });

  async function persist() {
    state.updatedAt = now();
    state.queue = queue.list().filter(task => task.type === "engineering");
    await store.save(state);
  }
  async function cycle(): Promise<ContinuousEngineeringState> {
    if (cycling) return snapshot();
    cycling = true;
    try {
      if (!state.enabled || state.status === "paused") return snapshot();
      const observation = await observe();
      state.snapshotId = observation.snapshot.provenance?.snapshotId;
      const existing = queue.list();
      state.decisions = observation.insights.map(insight => evaluateMaintenanceEligibility({
        workspace: root, enabled: state.enabled, paused: state.status === "paused",
        snapshot: observation.snapshot, insight, queue: existing, policy, now: now(),
      }));
      const candidate = state.decisions.find(item => item.eligible);
      if (!candidate) {
        state.status = "stopped";
        state.stopReason = observation.limitations[0] ?? state.decisions[0]?.reason ?? "No eligible maintenance work";
        await persist();
        return snapshot();
      }
      const insight = observation.insights.find(item => item.id === candidate.insightId)!;
      const goal = goalFor(insight, policy);
      const issuedAt = now();
      const approval: EngineeringApproval = { goalDigest: goalDigest(goal), approvedBy: "configured-continuous-maintenance-policy",
        approvedAt: issuedAt, expiresAt: issuedAt + policy.timeoutMs, mode: "bounded", proposalIds: [] };
      await queue.enqueue({ id: candidate.taskIdentity, type: "engineering", priority: "normal", maxAttempts: 1,
        payload: { goal, approval }, metadata: { maintenance: true, insightId: insight.id,
          evidenceIdentity: candidate.evidenceIdentity, snapshotId: observation.snapshot.provenance?.snapshotId } });
      state.status = "running";
      state.stopReason = undefined;
      await persist();
      queue.start();
      return snapshot();
    } catch (error) {
      state.status = "failed";
      state.stopReason = error instanceof Error ? error.message : String(error);
      await persist();
      return snapshot();
    } finally { cycling = false; }
  }
  function snapshot(): ContinuousEngineeringState {
    return structuredClone({ ...state, queue: queue.list().filter(task => task.type === "engineering") });
  }
  return {
    status: async () => snapshot(),
    async enable() { state.enabled = true; state.status = "running"; state.stopReason = undefined; await persist(); return cycle(); },
    async evaluate() { return cycle(); },
    async pause() { state.status = "paused"; queue.stop(); await persist(); return snapshot(); },
    async resume() { if (!state.enabled) throw new Error("Continuous engineering is disabled"); state.status = "running"; await persist(); queue.start(); return cycle(); },
    async disable() { state.enabled = false; state.status = "disabled"; state.stopReason = "Disabled by user"; queue.stop(); await persist(); return snapshot(); },
    async cancel() { if (state.currentTaskId) await queue.cancel(state.currentTaskId); state.enabled = false; state.status = "disabled"; state.stopReason = "Cancelled by user"; await persist(); return snapshot(); },
  };
}

function initialState(workspace: string, now: number): ContinuousEngineeringState {
  return { version: 1, workspace, enabled: false, status: "disabled", updatedAt: now,
    decisions: [], queue: [], stopReason: "Continuous engineering is disabled" };
}

function goalFor(insight: MaintenanceObservation["insights"][number], policy: AutonomousMaintenancePolicy): EngineeringGoal {
  const file = insight.affectedFiles[0];
  const diagnostic = insight.evidence.find(item => item.source === "diagnostic")!;
  return {
    title: `Autonomous maintenance: ${insight.summary}`,
    mode: "repair",
    scope: { files: [file], maxFilesPerBatch: 1, maxRisk: policy.maximumRisk },
    checks: [{ id: "typecheck", kind: "typecheck" }],
    acceptance: [{ id: "diagnostic-repair-verifies", description: "TypeScript verification passes after the bounded repair", checkId: "typecheck" }],
    compatibilityChecks: ["typecheck"], constraints: ["Do not expand scope or change the task objective"], documentationFiles: [],
    budgets: { maxIterations: policy.maxIterations, maxRepairAttempts: policy.maxRepairAttempts,
      timeoutMs: policy.timeoutMs, noProgressLimit: policy.noProgressLimit },
    tasks: [{ id: `repair-${insight.id.slice(0, 16)}`, title: insight.summary, dependsOn: [], files: [file],
      operation: { kind: "repair", diagnosticId: diagnostic.id }, evidenceIds: [diagnostic.id],
      checkIds: ["typecheck"], risk: "low", obligations: [] }],
  };
}
