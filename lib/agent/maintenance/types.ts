import type { EngineeringInsight, InsightCategory } from "@/lib/intelligence/engineering-insights";
import type { WorkspaceIntelligenceSnapshot } from "@/lib/intelligence/workspace-intelligence-snapshot";
import type { EngineeringRisk } from "../engineering/types";
import type { TaskQueueTask } from "../task-queue/types";

export interface AutonomousMaintenancePolicy {
  version: 1;
  maximumEvidenceAgeMs: number;
  allowedCategories: InsightCategory[];
  allowedSeverities: Array<EngineeringInsight["severity"]>;
  maximumRisk: EngineeringRisk;
  maximumFiles: number;
  maximumQueuedTasks: number;
  maxIterations: number;
  maxRepairAttempts: number;
  timeoutMs: number;
  noProgressLimit: number;
}

export type MaintenanceDecisionCode =
  | "eligible" | "disabled" | "runtime_paused" | "snapshot_not_current"
  | "evidence_stale" | "evidence_incomplete" | "evidence_unavailable"
  | "evidence_contradicted" | "unsupported_category" | "unsupported_severity"
  | "scope_unbounded" | "review_required" | "queue_full" | "duplicate";

export interface MaintenanceEligibilityDecision {
  insightId: string;
  eligible: boolean;
  code: MaintenanceDecisionCode;
  reason: string;
  risk: EngineeringRisk;
  evidenceIdentity: string;
  taskIdentity: string;
}

export type ContinuousEngineeringStatus = "disabled" | "running" | "paused" | "stopped" | "failed";

export interface ContinuousEngineeringState {
  version: 1;
  workspace: string;
  enabled: boolean;
  status: ContinuousEngineeringStatus;
  updatedAt: number;
  currentTaskId?: string;
  snapshotId?: string;
  decisions: MaintenanceEligibilityDecision[];
  lastOutcome?: { taskId?: string; status: string; reason: string; at: number };
  stopReason?: string;
  queue: TaskQueueTask[];
}

export interface MaintenanceObservation {
  snapshot: WorkspaceIntelligenceSnapshot;
  insights: EngineeringInsight[];
  limitations: string[];
}
