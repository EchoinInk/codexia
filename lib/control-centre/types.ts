import type { WorkspaceLifecycleSnapshot, WorkspaceTaskProjection } from "@/lib/workspace-operations/types";
import type { WorkspaceIntelligenceStatus } from "@/lib/intelligence/workspace-intelligence-snapshot";

export type ControlCentreHealthState = "healthy" | "degraded" | "unavailable" | "stale" | "failed" | "unknown";
export type ControlCentreMissionState = WorkspaceLifecycleSnapshot["status"] | "planned" | "running" | "recovering";
export type ControlCentreTaskState = "pending" | "queued" | "running" | "blocked" | "failed" | "cancelled" | "complete" | "unknown";
export type ControlCentreAgentState = "active" | "idle" | "queued" | "unavailable" | "failed";

export interface ControlCentreIntelligenceSource {
  status: WorkspaceIntelligenceStatus;
  usable: boolean;
  generatedAt?: number;
  snapshotId?: string;
  fileCount?: number;
  findingCount?: number;
  failure?: string;
}

export interface ControlCentreActivitySource {
  id: string;
  type: string;
  detail: string;
  at: number;
  failed?: boolean;
}

export interface ControlCentreSource {
  lifecycle: WorkspaceLifecycleSnapshot;
  intelligence?: ControlCentreIntelligenceSource;
  activity?: ControlCentreActivitySource[];
  eventRuntime?: { pending: number; failed: number; lastProcessedAt?: number; lastError?: string };
  observedAt: number;
}

export interface ControlCentreProjection {
  workspace: { root: string; label: string; status: WorkspaceLifecycleSnapshot["status"]; observedAt: number };
  mission?: { id: string; title: string; status: ControlCentreMissionState; progress?: number; updatedAt?: number };
  tasks: Array<WorkspaceTaskProjection & { state: ControlCentreTaskState }>;
  taskSummary: Record<ControlCentreTaskState, number>;
  agents: {
    items: Array<{ id: string; label: string; state: ControlCentreAgentState; assignedWork?: string; detail: string }>;
    active: number;
    idle: number;
    queued: number;
    unavailable: number;
    failed: number;
  };
  health: {
    overall: ControlCentreHealthState;
    signals: Array<{ id: string; label: string; state: ControlCentreHealthState; detail: string }>;
  };
  intelligence: ControlCentreIntelligenceSource & { state: ControlCentreHealthState };
  approvals: Array<{ id: string; taskId: string; label: string; runtimeId?: string }>;
  notifications: Array<{ id: string; kind: "approval" | "failure" | "recovery" | "stale" | "unavailable"; title: string; detail: string; taskId?: string }>;
  failures: Array<{ id: string; title: string; detail: string; recoverable: boolean; taskId?: string }>;
  activity: ControlCentreActivitySource[];
  capabilities: { pause: boolean; resume: boolean; cancel: boolean; retry: boolean; approve: boolean };
}
