export type WorkspaceOperationStatus = "queued" | "active" | "paused" | "awaiting_approval" | "completed" | "failed" | "cancelled";
export type WorkspaceAction = "pause" | "resume" | "cancel" | "retry" | "approve";

export interface WorkspaceTaskProjection {
  id: string;
  title: string;
  status: string;
  progress?: number;
  dependsOn?: string[];
  budget?: { limit: number; consumed: number };
  checkpoint?: string;
  pendingApproval?: boolean;
  verification?: Array<{ id: string; success: boolean; output?: string }>;
}

export interface WorkspaceLifecycleSnapshot {
  workspace: string;
  label?: string;
  runtimeId?: string;
  status: WorkspaceOperationStatus;
  progress?: number;
  tasks: WorkspaceTaskProjection[];
  pendingApprovals?: number;
  resource?: { running: number; queued: number; concurrency?: number; memoryMb?: number };
  evidence?: Array<{ id: string; kind: string; status: "current" | "stale" | "missing"; detail?: string }>;
  checkpoints?: Array<{ id: string; at: number; phase?: string }>;
  audit?: Array<{ at: number; type: string; detail: string }>;
  outcome?: { status: string; reason?: string; at: number };
  control?: { requested?: { action: WorkspaceAction; at: number }; acknowledged?: { action: WorkspaceAction; at: number } };
}

export interface AuthorizedWorkspaceSource {
  workspace: string;
  label?: string;
  snapshot(signal?: AbortSignal): Promise<WorkspaceLifecycleSnapshot>;
  dispatch?(action: WorkspaceAction, runtimeId?: string, approvalId?: string): Promise<{ acknowledged: boolean; detail?: string }>;
}

export interface WorkspaceOperationsRegistry {
  listAuthorized(): readonly AuthorizedWorkspaceSource[];
}

export interface NotificationPreferences {
  enabled: boolean;
  events: Array<"progress" | "action_required" | "approval" | "completed" | "failed" | "recovery" | "developer_action">;
}

export interface NotificationPreferencesStore {
  load(): Promise<NotificationPreferences | undefined>;
  save(preferences: NotificationPreferences): Promise<void>;
}

export interface WorkspaceOperationsNotification {
  workspace: string;
  event: NotificationPreferences["events"][number];
  message: string;
  at: number;
}

export interface WorkspaceOperationsOptions {
  registry: WorkspaceOperationsRegistry;
  preferences?: NotificationPreferencesStore;
  notify?: (notification: WorkspaceOperationsNotification) => Promise<void> | void;
  now?: () => number;
}

export interface WorkspaceActionResult {
  requested: { action: WorkspaceAction; workspace: string; runtimeId?: string; approvalId?: string; at: number };
  acknowledged: boolean;
  detail?: string;
  projection: WorkspaceLifecycleSnapshot;
}
