import type { TaskQueueEvent, TaskQueueEventListener } from "./types";

/** Isolated event bus so observers cannot interfere with queue execution. */
export class TaskQueueEventBus {
  private readonly listeners = new Set<TaskQueueEventListener>();

  subscribe(listener: TaskQueueEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: TaskQueueEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Queue observers are intentionally isolated from execution.
      }
    }
  }
}
