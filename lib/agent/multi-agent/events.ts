import type { MultiAgentEvent, MultiAgentEventListener } from "./types";

export class MultiAgentEventBus {
  private readonly listeners = new Set<MultiAgentEventListener>();

  subscribe(listener: MultiAgentEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: MultiAgentEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Observers cannot interrupt coordination.
      }
    }
  }
}
