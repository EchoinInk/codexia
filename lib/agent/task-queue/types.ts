/** Queue-supported maintenance and autonomous task categories. */
export type TaskQueueTaskType =
  | "build"
  | "tests"
  | "lint"
  | "documentation"
  | "indexing";

/** Stable lifecycle states for queued work. */
export type TaskQueueTaskStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

/** Relative scheduling priority. Higher priorities run first. */
export type TaskQueuePriority = "low" | "normal" | "high" | "critical";

/** Task-specific input accepted by the queue. */
export interface TaskQueueTaskInput {
  type: TaskQueueTaskType;
  priority?: TaskQueuePriority;
  payload?: Record<string, unknown>;
  maxAttempts?: number;
  metadata?: Record<string, unknown>;
  id?: string;
}

/** Serialisable output returned by queue handlers. */
export interface TaskQueueTaskOutput {
  summary: string;
  details?: Record<string, unknown>;
}

/** Serialisable error captured for failed attempts. */
export interface TaskQueueTaskError {
  name: string;
  message: string;
}

/** Durable task record managed by the queue. */
export interface TaskQueueTask {
  id: string;
  type: TaskQueueTaskType;
  status: TaskQueueTaskStatus;
  priority: TaskQueuePriority;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  attempt: number;
  maxAttempts: number;
  queuedAt: number;
  updatedAt: number;
  startedAt?: number;
  completedAt?: number;
  output?: TaskQueueTaskOutput;
  error?: TaskQueueTaskError;
}

/** Queue scheduling and retry behaviour. */
export interface TaskQueueConfiguration {
  concurrency: number;
  defaultMaxAttempts: number;
  retryDelayMs: number;
  autoStart: boolean;
}

/** Aggregate queue measurements. */
export interface TaskQueueMetrics {
  queued: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
  retries: number;
}

/** Observable queue lifecycle events. */
export type TaskQueueEvent =
  | { type: "task_enqueued"; task: TaskQueueTask; timestamp: number }
  | { type: "task_started"; task: TaskQueueTask; timestamp: number }
  | { type: "task_completed"; task: TaskQueueTask; timestamp: number }
  | { type: "task_failed"; task: TaskQueueTask; timestamp: number }
  | { type: "task_retrying"; task: TaskQueueTask; timestamp: number }
  | { type: "task_cancelled"; task: TaskQueueTask; timestamp: number }
  | { type: "queue_drained"; timestamp: number };

export type TaskQueueEventListener = (event: TaskQueueEvent) => void;

/** Execution context supplied to a queue task handler. */
export interface TaskQueueHandlerContext {
  workspace: string;
  signal: AbortSignal;
}

/** Subsystem adapter responsible for one task category. */
export type TaskQueueHandler = (
  task: Readonly<TaskQueueTask>,
  context: TaskQueueHandlerContext
) => Promise<TaskQueueTaskOutput>;

export type TaskQueueHandlers = Record<TaskQueueTaskType, TaskQueueHandler>;

/** Persisted queue state used to recover pending work after restart. */
export interface TaskQueueSnapshot {
  version: 1;
  tasks: TaskQueueTask[];
  metrics: TaskQueueMetrics;
}

/** Persistence boundary for queued work. */
export interface TaskQueueStore {
  load(): Promise<TaskQueueSnapshot | undefined>;
  save(snapshot: TaskQueueSnapshot): Promise<void>;
}
