import type {
  WorkspaceAgentEvent,
  WorkspaceAgentEventListener,
} from "./types";

/** Observer boundary that prevents listeners from affecting event processing. */
export class WorkspaceAgentEventBus {
  private readonly listeners = new Set<WorkspaceAgentEventListener>();

  subscribe(listener: WorkspaceAgentEventListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(event: WorkspaceAgentEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Event observers must never interrupt workspace processing.
      }
    }
  }
}
