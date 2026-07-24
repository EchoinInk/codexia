import type {
  RuntimeEvent,
  RuntimeEventListener,
} from "./types";

/** Small typed event publisher with listener isolation. */
export class RuntimeEventBus {
  private readonly listeners = new Set<RuntimeEventListener>();

  subscribe(listener: RuntimeEventListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(event: RuntimeEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Runtime observers must never be able to interrupt task execution.
      }
    }
  }
}
