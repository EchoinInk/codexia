import path from "node:path";
import { getWorkspaceRoot } from "@/lib/fs-safe";
import { defaultNotificationPreferences } from "./store";
import type {
  AuthorizedWorkspaceSource, NotificationPreferences, WorkspaceAction, WorkspaceActionResult,
  WorkspaceLifecycleSnapshot, WorkspaceOperationsOptions,
} from "./types";

/** Read-only, multi-workspace projection and control boundary. Execution remains owned by Runtime/Queue. */
export class WorkspaceOperationsService {
  private readonly sources: Map<string, AuthorizedWorkspaceSource>;
  private readonly actionAudit = new Map<string, Array<{ at: number; type: string; detail: string }>>();
  private readonly inFlight = new Set<string>();
  private readonly observed = new Map<string, { status: WorkspaceLifecycleSnapshot["status"]; pendingApprovals?: number; progress?: number }>();
  private readonly now: () => number;
  private preferences?: NotificationPreferences;
  private loading?: Promise<void>;
  constructor(private readonly options: WorkspaceOperationsOptions) {
    this.now = options.now ?? Date.now;
    this.sources = new Map();
    for (const source of options.registry.listAuthorized()) {
      const root = getWorkspaceRoot(source.workspace);
      if (this.sources.has(root)) throw new Error("Duplicate authorized workspace");
      this.sources.set(root, { ...source, workspace: root });
    }
  }
  private async loadPreferences() {
    if (!this.preferences) {
      this.loading ??= (async () => {
        this.preferences = (await this.options.preferences?.load()) ?? defaultNotificationPreferences();
      })();
      await this.loading;
    }
    return this.preferences!;
  }
  async projection(signal?: AbortSignal): Promise<WorkspaceLifecycleSnapshot[]> {
    const values = await Promise.all([...this.sources.values()].map(async source => {
      const snapshot = await source.snapshot(signal);
      if (path.resolve(snapshot.workspace) !== source.workspace) throw new Error("Workspace source identity mismatch");
      const projected = structuredClone({ ...snapshot, workspace: source.workspace, label: snapshot.label ?? source.label,
        audit: [...(snapshot.audit ?? []), ...(this.actionAudit.get(source.workspace) ?? [])] });
      const previous = this.observed.get(source.workspace);
      this.observed.set(source.workspace, { status: projected.status, pendingApprovals: projected.pendingApprovals, progress: projected.progress });
      if (previous) {
        const event = projected.pendingApprovals !== undefined &&
          (previous.pendingApprovals === undefined || projected.pendingApprovals > previous.pendingApprovals) ? "action_required"
          : projected.status !== previous.status && projected.status === "completed" ? "completed"
          : projected.status !== previous.status && projected.status === "failed" ? "failed"
          : projected.status !== previous.status && projected.status === "paused" ? "recovery"
          : projected.progress !== previous.progress || projected.status !== previous.status ? "progress" : undefined;
        if (event) await this.emit(source.workspace, event, `Lifecycle changed to ${projected.status}`);
      }
      return projected;
    }));
    return values;
  }
  async get(workspace: string): Promise<WorkspaceLifecycleSnapshot> {
    const root = getWorkspaceRoot(workspace);
    const source = this.sources.get(root);
    if (!source) throw new Error("Workspace is not authorized");
    return (await this.projection()).find(item => item.workspace === root)!;
  }
  async dispatch(workspace: string, action: WorkspaceAction, runtimeId?: string, approvalId?: string): Promise<WorkspaceActionResult> {
    if (!["pause", "resume", "cancel", "retry", "approve"].includes(action)) throw new Error("Invalid workspace action");
    const root = getWorkspaceRoot(workspace);
    const source = this.sources.get(root);
    if (!source) throw new Error("Workspace is not authorized");
    if (this.inFlight.has(root)) throw new Error("Workspace control action already in progress");
    const at = this.now();
    const requested = { action, workspace: root, runtimeId, approvalId, at };
    // Never mutate the projection optimistically: acknowledgement comes from the
    // existing Runtime/Queue adapter, then the source is read again.
    this.inFlight.add(root);
    let result: { acknowledged: boolean; detail?: string };
    try {
      result = source.dispatch ? await source.dispatch(action, runtimeId, approvalId) : { acknowledged: false, detail: "No Runtime/Queue control adapter registered" };
    } catch (error) {
      this.actionAudit.set(root, [...(this.actionAudit.get(root) ?? []), { at, type: "action_requested", detail: `${action}: ${error instanceof Error ? error.message : String(error)}` }]);
      throw error;
    } finally { this.inFlight.delete(root); }
    this.actionAudit.set(root, [...(this.actionAudit.get(root) ?? []), { at, type: result!.acknowledged ? "action_acknowledged" : "action_requested", detail: `${action}: ${result!.detail ?? "no detail"}` }]);
    const projection = await this.get(root);
    await this.emit(root, "developer_action", result.detail ?? `${action} ${result.acknowledged ? "acknowledged" : "not acknowledged"}`, at);
    if (action === "resume") await this.emit(root, "recovery", result.detail ?? "Recovery requested", at);
    return { requested, acknowledged: result.acknowledged, detail: result.detail, projection };
  }
  private async emit(workspace: string, event: NotificationPreferences["events"][number], message: string, at = this.now()) {
    const preferences = await this.loadPreferences();
    if (preferences.enabled && preferences.events.includes(event) && this.options.notify) {
      await this.options.notify({ workspace, event, message, at });
    }
  }
  async notificationPreferences(): Promise<NotificationPreferences> { return structuredClone(await this.loadPreferences()); }
  async setNotificationPreferences(preferences: NotificationPreferences): Promise<NotificationPreferences> {
    if (!preferences || typeof preferences.enabled !== "boolean" || !Array.isArray(preferences.events) ||
      preferences.events.some(event => !["progress", "action_required", "approval", "completed", "failed", "recovery", "developer_action"].includes(event))) {
      throw new Error("Invalid notification preferences");
    }
    this.preferences = structuredClone(preferences);
    await this.options.preferences?.save(this.preferences);
    return structuredClone(this.preferences);
  }
}

export function createWorkspaceOperationsService(options: WorkspaceOperationsOptions): WorkspaceOperationsService {
  return new WorkspaceOperationsService(options);
}
