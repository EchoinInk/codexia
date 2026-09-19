import { randomUUID } from "node:crypto";

import { createIntelligenceContext } from "@/lib/intelligence/intelligence-context";
import { recordWorkspaceFileChange } from "@/lib/intelligence/workspace-memory";

import { resolveWorkspaceEventSystemConfiguration } from "./config";
import { WorkspaceAgentEventBus } from "./events";
import type {
  WorkspaceAgentEvent,
  WorkspaceAgentEventListener,
  WorkspaceEventMetrics,
  WorkspaceEventSystemConfiguration,
  WorkspaceEventSystemDependencies,
  WorkspaceEventSystemStatus,
  WorkspaceFileChangeInput,
  WorkspaceFileChangedEvent,
  WorkspaceFileChangedInput,
} from "./types";

interface WorkspaceEventState {
  metrics: WorkspaceEventMetrics;
  history: WorkspaceAgentEvent[];
  lastEventAt?: number;
  lastProcessedAt?: number;
  lastError?: string;
}

const INITIAL_METRICS: WorkspaceEventMetrics = {
  received: 0,
  processed: 0,
  failed: 0,
  pending: 0,
};

/**
 * Promotes workspace file changes into typed agent events, performs impact
 * reasoning, and updates existing workspace activity memory.
 */
export class WorkspaceEventSystem {
  private readonly configuration: WorkspaceEventSystemConfiguration;
  private readonly events = new WorkspaceAgentEventBus();
  private readonly states = new Map<string, WorkspaceEventState>();
  private readonly processing = new Map<string, Promise<void>>();
  private dependencies?: WorkspaceEventSystemDependencies;

  constructor(
    configuration: Partial<WorkspaceEventSystemConfiguration> = {}
  ) {
    this.configuration = resolveWorkspaceEventSystemConfiguration(configuration);
  }

  /** Supplies integration callbacks without coupling the event system to the index manager. */
  configure(dependencies: WorkspaceEventSystemDependencies): void {
    this.dependencies = dependencies;
  }

  /** Accepts a file change immediately and serialises reasoning per workspace. */
  notifyFileChanged(input: WorkspaceFileChangedInput): WorkspaceFileChangedEvent {
    const changes = normaliseChanges(input);
    const event: WorkspaceFileChangedEvent = {
      id: randomUUID(),
      type: "file_changed",
      workspace: input.workspace,
      changes,
      sourceOccurredAt: earliestOccurrence(changes),
      timestamp: Date.now(),
    };

    const state = this.getState(input.workspace);
    state.metrics.received += 1;
    state.metrics.pending += 1;
    state.lastEventAt = event.timestamp;
    state.lastError = undefined;

    this.record(event);

    const previous = this.processing.get(input.workspace) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(() => this.process(event))
      .finally(() => {
        if (this.processing.get(input.workspace) === next) {
          this.processing.delete(input.workspace);
        }
      });

    this.processing.set(input.workspace, next);

    return cloneEvent(event);
  }

  subscribe(listener: WorkspaceAgentEventListener): () => void {
    return this.events.subscribe(listener);
  }

  getHistory(workspace: string): WorkspaceAgentEvent[] {
    const state = this.states.get(workspace);

    return state
      ? state.history.map(cloneEvent)
      : [];
  }

  getStatus(workspace: string): WorkspaceEventSystemStatus {
    const state = this.getState(workspace);

    return {
      workspace,
      metrics: {
        ...state.metrics,
      },
      lastEventAt: state.lastEventAt,
      lastProcessedAt: state.lastProcessedAt,
      lastError: state.lastError,
    };
  }

  clear(workspace?: string): void {
    if (workspace) {
      this.states.delete(workspace);
      return;
    }

    this.states.clear();
  }

  private async process(source: WorkspaceFileChangedEvent): Promise<void> {
    const state = this.getState(source.workspace);

    try {
      const dependencies = this.dependencies;
      if (!dependencies) {
        throw new Error("Workspace event system has not been configured");
      }

      this.record({
        id: randomUUID(),
        type: "agent_notified",
        workspace: source.workspace,
        changes: source.changes,
        sourceEventId: source.id,
        sourceOccurredAt: earliestOccurrence(source.changes),
        timestamp: Date.now(),
      });

      dependencies.markWorkspaceDirty(source.workspace);

      const workspaceIndex = await dependencies.getWorkspaceIndex(source.workspace);
      const intelligence = createIntelligenceContext(workspaceIndex);
      const paths = source.changes.flatMap(change =>
        change.path ? [change.path] : []
      );
      const impact = intelligence.analyseImpact(paths);

      this.record({
        id: randomUUID(),
        type: "impact_analysed",
        workspace: source.workspace,
        changes: source.changes,
        sourceEventId: source.id,
        sourceOccurredAt: earliestOccurrence(source.changes),
        timestamp: Date.now(),
        impact,
      });

      for (const path of paths) {
        await recordWorkspaceFileChange(source.workspace, path);
      }

      const completedAt = Date.now();
      this.record({
        id: randomUUID(),
        type: "memory_updated",
        workspace: source.workspace,
        changes: source.changes,
        sourceEventId: source.id,
        sourceOccurredAt: earliestOccurrence(source.changes),
        timestamp: completedAt,
      });

      state.metrics.processed += 1;
      state.lastProcessedAt = completedAt;
      state.lastError = undefined;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const failedAt = Date.now();

      state.metrics.failed += 1;
      state.lastProcessedAt = failedAt;
      state.lastError = message;

      this.record({
        id: randomUUID(),
        type: "event_failed",
        workspace: source.workspace,
        changes: source.changes,
        sourceEventId: source.id,
        sourceOccurredAt: earliestOccurrence(source.changes),
        timestamp: failedAt,
        error: message,
      });

      console.warn(
        `Unable to process workspace event for "${source.workspace}": ${message}`
      );
    } finally {
      state.metrics.pending = Math.max(0, state.metrics.pending - 1);
    }

  }

  private getState(workspace: string): WorkspaceEventState {
    const existing = this.states.get(workspace);
    if (existing) {
      return existing;
    }

    const state: WorkspaceEventState = {
      metrics: {
        ...INITIAL_METRICS,
      },
      history: [],
    };

    this.states.set(workspace, state);
    return state;
  }

  private record(event: WorkspaceAgentEvent): void {
    const state = this.getState(event.workspace);
    state.history.push(cloneEvent(event));

    if (state.history.length > this.configuration.historyLimit) {
      state.history.splice(0, state.history.length - this.configuration.historyLimit);
    }

    this.events.emit(cloneEvent(event));
  }
}

function normaliseChanges(
  input: WorkspaceFileChangedInput
): WorkspaceFileChangeInput[] {
  const changes =
    input.changes ??
    (
      input.type &&
      input.occurredAt !== undefined
        ? [{
            path: input.path,
            type: input.type,
            occurredAt: input.occurredAt,
            ambiguous: input.path === undefined,
          }]
        : []
    );

  if (!changes.length) {
    throw new Error("Workspace file change batch must not be empty");
  }

  return [...changes].sort((left, right) =>
    (left.path ?? "").localeCompare(right.path ?? "") ||
    left.type.localeCompare(right.type) ||
    left.occurredAt - right.occurredAt
  );
}

function earliestOccurrence(
  changes: WorkspaceFileChangeInput[]
): number {
  return Math.min(
    ...changes.map(change => change.occurredAt)
  );
}

function cloneEvent<T extends WorkspaceAgentEvent>(event: T): T {
  return structuredClone(event);
}
