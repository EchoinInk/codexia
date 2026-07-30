import { WorkspaceEventSystem } from "./system";

import type {
  WorkspaceAgentEvent,
  WorkspaceAgentEventListener,
  WorkspaceEventSystemDependencies,
  WorkspaceEventSystemStatus,
  WorkspaceFileChangedEvent,
  WorkspaceFileChangedInput,
} from "./types";

const workspaceEventSystem = new WorkspaceEventSystem();

/** Connects the singleton event runtime to workspace intelligence services. */
export function configureWorkspaceEventSystem(
  dependencies: WorkspaceEventSystemDependencies
): void {
  workspaceEventSystem.configure(dependencies);
}

/** Publishes a watched file-system change into the agent event runtime. */
export function notifyWorkspaceFileChanged(
  input: WorkspaceFileChangedInput
): WorkspaceFileChangedEvent {
  return workspaceEventSystem.notifyFileChanged(input);
}

/** Subscribes an agent/runtime observer to workspace lifecycle events. */
export function subscribeWorkspaceEvents(
  listener: WorkspaceAgentEventListener
): () => void {
  return workspaceEventSystem.subscribe(listener);
}

/** Returns bounded recent event history for diagnostics and consumers. */
export function getWorkspaceEventHistory(
  workspace: string
): WorkspaceAgentEvent[] {
  return workspaceEventSystem.getHistory(workspace);
}

/** Returns event processing metrics and the latest processing state. */
export function getWorkspaceEventSystemStatus(
  workspace: string
): WorkspaceEventSystemStatus {
  return workspaceEventSystem.getStatus(workspace);
}

/** Clears in-memory event history and metrics without affecting workspace memory. */
export function clearWorkspaceEventSystem(workspace?: string): void {
  workspaceEventSystem.clear(workspace);
}

export { WorkspaceEventSystem } from "./system";
export { WorkspaceAgentEventBus } from "./events";
export { resolveWorkspaceEventSystemConfiguration } from "./config";
export type {
  WorkspaceAgentEvent,
  WorkspaceAgentEventListener,
  WorkspaceEventMetrics,
  WorkspaceEventSystemConfiguration,
  WorkspaceEventSystemDependencies,
  WorkspaceEventSystemStatus,
  WorkspaceFileChangedEvent,
  WorkspaceFileChangedInput,
} from "./types";
