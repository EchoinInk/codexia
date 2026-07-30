import { createDefaultTaskQueueHandlers } from "./handlers";
import { TaskQueue } from "./queue";
import { FileTaskQueueStore } from "./store";
import type {
  TaskQueueConfiguration,
  TaskQueueHandlers,
  TaskQueueStore,
} from "./types";

export interface CreateTaskQueueOptions {
  configuration?: Partial<TaskQueueConfiguration>;
  handlers?: Partial<TaskQueueHandlers>;
  store?: TaskQueueStore;
}

/** Creates and hydrates a task queue wired to Codexia's existing subsystems. */
export async function createTaskQueue(
  workspace: string,
  options: CreateTaskQueueOptions = {}
): Promise<TaskQueue> {
  const defaults = createDefaultTaskQueueHandlers(workspace);
  const handlers: TaskQueueHandlers = {
    ...defaults,
    ...options.handlers,
  };

  const queue = new TaskQueue(
    workspace,
    handlers,
    options.store ?? new FileTaskQueueStore(workspace),
    options.configuration
  );
  await queue.initialize();
  return queue;
}
