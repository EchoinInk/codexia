import { createHash } from "node:crypto";
import path from "node:path";
import type { EngineeringInsight } from "@/lib/intelligence/engineering-insights";
import type { WorkspaceIntelligenceSnapshot } from "@/lib/intelligence/workspace-intelligence-snapshot";
import type { TaskQueueTask } from "../task-queue/types";
import type { AutonomousMaintenancePolicy, MaintenanceEligibilityDecision } from "./types";

export const DEFAULT_AUTONOMOUS_MAINTENANCE_POLICY: AutonomousMaintenancePolicy = {
  version: 1,
  maximumEvidenceAgeMs: 5 * 60 * 1000,
  allowedCategories: ["diagnostic"],
  allowedSeverities: ["error", "warning"],
  maximumRisk: "low",
  maximumFiles: 1,
  maximumQueuedTasks: 1,
  maxIterations: 4,
  maxRepairAttempts: 1,
  timeoutMs: 5 * 60 * 1000,
  noProgressLimit: 1,
};

export function evaluateMaintenanceEligibility(input: {
  workspace: string;
  enabled: boolean;
  paused: boolean;
  snapshot: WorkspaceIntelligenceSnapshot;
  insight: EngineeringInsight;
  queue: TaskQueueTask[];
  policy?: AutonomousMaintenancePolicy;
  now?: number;
}): MaintenanceEligibilityDecision {
  const policy = input.policy ?? DEFAULT_AUTONOMOUS_MAINTENANCE_POLICY;
  const now = input.now ?? Date.now();
  const evidenceIdentity = stable([input.snapshot.provenance?.snapshotId ?? "none", input.insight.id]);
  const taskIdentity = `maintenance-${stable([path.resolve(input.workspace), evidenceIdentity, String(policy.version)]).slice(0, 32)}`;
  const decision = (eligible: boolean, code: MaintenanceEligibilityDecision["code"], reason: string): MaintenanceEligibilityDecision =>
    ({ insightId: input.insight.id, eligible, code, reason, risk: "low", evidenceIdentity, taskIdentity });
  if (!input.enabled) return decision(false, "disabled", "Continuous engineering is disabled");
  if (input.paused) return decision(false, "runtime_paused", "Continuous engineering is paused");
  if (!input.snapshot.usable || !input.snapshot.provenance) return decision(false, "evidence_unavailable", "No authoritative workspace evidence is available");
  if (input.snapshot.status !== "current" || input.snapshot.dirty || input.snapshot.pending) {
    const code = input.snapshot.status === "incomplete" ? "evidence_incomplete" : "snapshot_not_current";
    return decision(false, code, `Workspace evidence is ${input.snapshot.status}`);
  }
  if (now - input.snapshot.provenance.generatedAt > policy.maximumEvidenceAgeMs) return decision(false, "evidence_stale", "Workspace evidence exceeds the policy freshness window");
  if (input.insight.state !== "current" || input.insight.contradictions.length ||
    input.insight.evidence.some(item => item.state === "contradicted" || item.state === "invalidated")) {
    return decision(false, "evidence_contradicted", "Insight evidence is not current and uncontradicted");
  }
  if (!policy.allowedCategories.includes(input.insight.category)) return decision(false, "unsupported_category", "Insight category is advisory only under the maintenance policy");
  if (!policy.allowedSeverities.includes(input.insight.severity)) return decision(false, "unsupported_severity", "Insight severity is outside the maintenance policy");
  if (input.insight.affectedFiles.length < 1 || input.insight.affectedFiles.length > policy.maximumFiles ||
    input.insight.affectedDirectories.length > 0 || input.insight.affectedFiles.some(file => path.isAbsolute(file) || file.includes(".."))) {
    return decision(false, "scope_unbounded", "Affected scope is not a single bounded workspace file");
  }
  if (!input.insight.evidence.some(item => item.source === "diagnostic" && item.snapshotId === input.snapshot.provenance?.snapshotId)) {
    return decision(false, "review_required", "Priority alone is insufficient; current direct diagnostic evidence is required");
  }
  if (input.queue.some(task => task.id === taskIdentity)) return decision(false, "duplicate", "The same evidence is already queued or recorded");
  if (input.queue.filter(task => task.status === "queued" || task.status === "running").length >= policy.maximumQueuedTasks) {
    return decision(false, "queue_full", "The bounded maintenance queue is full");
  }
  return decision(true, "eligible", "Current direct diagnostic evidence satisfies the bounded low-risk policy");
}

function stable(parts: string[]): string {
  return createHash("sha256").update(parts.join("\0")).digest("hex");
}
