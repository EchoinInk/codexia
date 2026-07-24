import type { ImpactAnalysis } from "@/lib/intelligence/impact-analysis";
import type { WorkspaceWatchEventType } from "@/lib/intelligence/workspace-watcher";

/** File-system change accepted by the Phase 5.3 event runtime. */
export interface WorkspaceFileChangedInput {
  workspace: string;
  path: string;
  type: WorkspaceWatchEventType;
  occurredAt: number;
}

/** Stable event-system configuration. */
export interface WorkspaceEventSystemConfiguration {
  historyLimit: number;
}

/** Aggregate event-processing measurements for one workspace. */
export interface WorkspaceEventMetrics {
  received: number;
  processed: number;
  failed: number;
  pending: number;
}

/** Observable status for the workspace event runtime. */
export interface WorkspaceEventSystemStatus {
  workspace: string;
  metrics: WorkspaceEventMetrics;
  lastEventAt?: number;
  lastProcessedAt?: number;
  lastError?: string;
}

interface WorkspaceEventBase {
  id: string;
  workspace: string;
  path: string;
  sourceOccurredAt: number;
  timestamp: number;
}

/** Raw file-system change promoted into the agent event runtime. */
export interface WorkspaceFileChangedEvent extends WorkspaceEventBase {
  type: "file_changed";
  watchType: WorkspaceWatchEventType;
}

/** Notification that the event runtime accepted a change for agent processing. */
export interface WorkspaceAgentNotifiedEvent extends WorkspaceEventBase {
  type: "agent_notified";
  sourceEventId: string;
}

/** Dependency-aware reasoning result for a changed file. */
export interface WorkspaceImpactAnalysedEvent extends WorkspaceEventBase {
  type: "impact_analysed";
  sourceEventId: string;
  impact: ImpactAnalysis;
}

/** Confirmation that workspace activity memory observed the change. */
export interface WorkspaceMemoryUpdatedEvent extends WorkspaceEventBase {
  type: "memory_updated";
  sourceEventId: string;
}

/** Isolated processing failure for a workspace event. */
export interface WorkspaceEventFailedEvent extends WorkspaceEventBase {
  type: "event_failed";
  sourceEventId: string;
  error: string;
}

export type WorkspaceAgentEvent =
  | WorkspaceFileChangedEvent
  | WorkspaceAgentNotifiedEvent
  | WorkspaceImpactAnalysedEvent
  | WorkspaceMemoryUpdatedEvent
  | WorkspaceEventFailedEvent;

export type WorkspaceAgentEventListener = (
  event: Readonly<WorkspaceAgentEvent>
) => void;

/** Runtime dependencies supplied by the workspace intelligence manager. */
export interface WorkspaceEventSystemDependencies {
  getWorkspaceIndex(
    workspace: string
  ): Promise<import("@/lib/intelligence/types").WorkspaceIndex>;

  markWorkspaceDirty(workspace: string): void;
}
