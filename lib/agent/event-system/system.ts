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
    const event: WorkspaceFileChangedEvent = {
      id: randomUUID(),
      type: "file_changed",
      workspace: input.workspace,
      path: input.path,
      watchType: input.type,
      sourceOccurredAt: input.occurredAt,
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
        path: source.path,
        sourceEventId: source.id,
        sourceOccurredAt: source.sourceOccurredAt,
        timestamp: Date.now(),
      });

      dependencies.markWorkspaceDirty(source.workspace);

      const workspaceIndex = await dependencies.getWorkspaceIndex(source.workspace);
      const intelligence = createIntelligenceContext(workspaceIndex);
      const impact = intelligence.analyseImpact([source.path]);

      this.record({
        id: randomUUID(),
        type: "impact_analysed",
        workspace: source.workspace,
        path: source.path,
        sourceEventId: source.id,
        sourceOccurredAt: source.sourceOccurredAt,
        timestamp: Date.now(),
        impact,
      });

      await recordWorkspaceFileChange(source.workspace, source.path);

      const completedAt = Date.now();
      this.record({
        id: randomUUID(),
        type: "memory_updated",
        workspace: source.workspace,
        path: source.path,
        sourceEventId: source.id,
        sourceOccurredAt: source.sourceOccurredAt,
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
        path: source.path,
        sourceEventId: source.id,
        sourceOccurredAt: source.sourceOccurredAt,
        timestamp: failedAt,
        error: message,
      });

      console.warn(
        `Unable to process workspace event for "${source.path}": ${message}`
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

function cloneEvent<T extends WorkspaceAgentEvent>(event: T): T {
  return structuredClone(event);
}
