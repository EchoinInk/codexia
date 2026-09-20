import { randomUUID } from "node:crypto";

import { resolveTaskQueueConfiguration } from "./config";
import { TaskQueueEventBus } from "./events";
import type {
  TaskQueueConfiguration,
  TaskQueueEventListener,
  TaskQueueHandlers,
  TaskQueueMetrics,
  TaskQueuePriority,
  TaskQueueSnapshot,
  TaskQueueStore,
  TaskQueueTask,
  TaskQueueTaskError,
  TaskQueueTaskInput,
} from "./types";

interface ActiveTask {
  controller: AbortController;
}

const PRIORITY_WEIGHT: Record<TaskQueuePriority, number> = {
  low: 0,
  normal: 1,
  high: 2,
  critical: 3,
};

const INITIAL_METRICS: TaskQueueMetrics = {
  queued: 0,
  running: 0,
  completed: 0,
  failed: 0,
  cancelled: 0,
  retries: 0,
};

/**
 * Coordinates durable background work while delegating execution to the
 * subsystem responsible for each task category.
 */
export class TaskQueue {
  private readonly configuration: TaskQueueConfiguration;
  private readonly handlers: TaskQueueHandlers;
  private readonly store: TaskQueueStore;
  private readonly events = new TaskQueueEventBus();
  private readonly active = new Map<string, ActiveTask>();
  private readonly tasks = new Map<string, TaskQueueTask>();
  private metrics: TaskQueueMetrics = { ...INITIAL_METRICS };
  private processing = false;
  private hydrated = false;
  private drainEmitted = false;
  private persistChain: Promise<void> = Promise.resolve();

  constructor(
    private readonly workspace: string,
    handlers: TaskQueueHandlers,
    store: TaskQueueStore,
    configuration: Partial<TaskQueueConfiguration> = {}
  ) {
    this.handlers = handlers;
    this.store = store;
    this.configuration = resolveTaskQueueConfiguration(configuration);
  }

  /** Restores persisted queue state and recovers interrupted running tasks. */
  async initialize(): Promise<void> {
    if (this.hydrated) {
      return;
    }

    const loaded = await this.store.load();
    const snapshot = loaded ? normaliseSnapshot(loaded) : undefined;
    if (snapshot) {
      for (const persisted of snapshot.tasks) {
        const interrupted = persisted.status === "running";
        const exhausted = persisted.attemptBudget.consumed >= persisted.attemptBudget.limit;
        const task = interrupted
          ? {
              ...persisted,
              status: (exhausted ? "failed" : "queued") as "failed" | "queued",
              startedAt: undefined,
              completedAt: exhausted ? Date.now() : undefined,
              updatedAt: Date.now(),
              error: exhausted ? {
                name: "AttemptBudgetExhausted",
                message: "Interrupted task exhausted its durable attempt budget before restart",
              } : persisted.error,
            }
          : persisted;
        this.tasks.set(task.id, task);
      }
      this.recalculateMetrics(snapshot.metrics.retries);
    }

    this.hydrated = true;
    await this.persist();

    if (this.configuration.autoStart) {
      this.start();
    }
  }

  /** Adds a typed task and schedules processing according to priority. */
  async enqueue(input: TaskQueueTaskInput): Promise<TaskQueueTask> {
    await this.ensureInitialized();

    const now = Date.now();
    const id = input.id ?? randomUUID();
    if (this.tasks.has(id)) {
      throw new Error(`Queue task ${id} already exists`);
    }

    const task: TaskQueueTask = {
      id,
      type: input.type,
      status: "queued",
      priority: input.priority ?? "normal",
      payload: input.payload ? structuredClone(input.payload) : {},
      metadata: input.metadata ? structuredClone(input.metadata) : undefined,
      attempt: 0,
      maxAttempts: normaliseAttempts(
        input.maxAttempts,
        this.configuration.defaultMaxAttempts
      ),
      attemptBudget: {
        limit: normaliseAttempts(input.maxAttempts, this.configuration.defaultMaxAttempts),
        consumed: 0,
      },
      queuedAt: now,
      updatedAt: now,
    };

    this.tasks.set(id, task);
    this.recalculateMetrics();
    this.drainEmitted = false;
    await this.persist();
    this.events.emit({ type: "task_enqueued", task: clone(task), timestamp: now });

    if (this.configuration.autoStart || this.processing) {
      this.start();
    }

    return clone(task);
  }

  /** Starts or resumes queue processing. */
  start(): void {
    this.processing = true;
    void this.pump();
  }

  /** Stops scheduling new work without interrupting active tasks. */
  stop(): void {
    this.processing = false;
  }

  /** Cancels queued work or aborts a currently running task. */
  async cancel(taskId: string): Promise<boolean> {
    await this.ensureInitialized();
    const task = this.tasks.get(taskId);
    if (!task || isTerminal(task.status)) {
      return false;
    }

    const active = this.active.get(taskId);
    if (active) {
      active.controller.abort("Queue task cancelled");
      return true;
    }

    const now = Date.now();
    const cancelled: TaskQueueTask = {
      ...task,
      status: "cancelled",
      updatedAt: now,
      completedAt: now,
      error: undefined,
    };
    this.tasks.set(taskId, cancelled);
    this.recalculateMetrics();
    await this.persist();
    this.events.emit({
      type: "task_cancelled",
      task: clone(cancelled),
      timestamp: now,
    });
    this.emitDrainIfNeeded();
    return true;
  }

  get(taskId: string): TaskQueueTask | undefined {
    const task = this.tasks.get(taskId);
    return task ? clone(task) : undefined;
  }

  list(): TaskQueueTask[] {
    return [...this.tasks.values()]
      .sort(compareTasks)
      .map(clone);
  }

  getMetrics(): TaskQueueMetrics {
    return { ...this.metrics };
  }

  subscribe(listener: TaskQueueEventListener): () => void {
    return this.events.subscribe(listener);
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.hydrated) {
      await this.initialize();
    }
  }

  private async pump(): Promise<void> {
    if (!this.processing || !this.hydrated) {
      return;
    }

    while (
      this.processing &&
      this.active.size < this.configuration.concurrency
    ) {
      const task = this.nextQueuedTask();
      if (!task) {
        this.emitDrainIfNeeded();
        return;
      }

      void this.runTask(task);
    }
  }

  private nextQueuedTask(): TaskQueueTask | undefined {
    return [...this.tasks.values()]
      .filter(task => task.status === "queued" && !this.active.has(task.id))
      .sort(compareTasks)[0];
  }

  private async runTask(task: TaskQueueTask): Promise<void> {
    if (this.active.has(task.id) || task.attemptBudget.consumed >= task.attemptBudget.limit) {
      if (!this.active.has(task.id)) await this.failExhausted(task);
      return;
    }
    const controller = new AbortController();
    this.active.set(task.id, { controller });

    const now = Date.now();
    let running: TaskQueueTask = {
      ...task,
      status: "running",
      attempt: task.attemptBudget.consumed + 1,
      attemptBudget: {
        ...task.attemptBudget,
        consumed: task.attemptBudget.consumed + 1,
        lastConsumedAt: now,
      },
      startedAt: now,
      completedAt: undefined,
      updatedAt: now,
      output: undefined,
      error: undefined,
    };
    // Persist the consumed claim before publishing "running" or dispatching
    // the handler. The active map is the in-process claim lock while the
    // atomic store write is pending.
    await this.persist(running);
    this.tasks.set(task.id, running);
    this.recalculateMetrics();
    this.events.emit({ type: "task_started", task: clone(running), timestamp: now });

    try {
      if (controller.signal.aborted) {
        await this.finishCancelled(running);
        return;
      }
      const handler = this.handlers[running.type];
      const output = await handler(running, {
        workspace: this.workspace,
        signal: controller.signal,
      });

      if (controller.signal.aborted) {
        await this.finishCancelled(running);
        return;
      }

      const completedAt = Date.now();
      running = {
        ...running,
        status: "completed",
        output,
        completedAt,
        updatedAt: completedAt,
      };
      this.tasks.set(running.id, running);
      this.recalculateMetrics();
      await this.persist();
      this.events.emit({
        type: "task_completed",
        task: clone(running),
        timestamp: completedAt,
      });
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error)) {
        await this.finishCancelled(running);
        return;
      }

      const taskError = serialiseError(error);
      if (running.attemptBudget.consumed < running.attemptBudget.limit) {
        const retryAt = Date.now();
        running = {
          ...running,
          status: "queued",
          updatedAt: retryAt,
          startedAt: undefined,
          error: taskError,
        };
        this.tasks.set(running.id, running);
        this.metrics.retries += 1;
        this.recalculateMetrics(this.metrics.retries);
        await this.persist();
        this.events.emit({
          type: "task_retrying",
          task: clone(running),
          timestamp: retryAt,
        });
        await delay(this.configuration.retryDelayMs);
        if (controller.signal.aborted) {
          await this.finishCancelled(running);
          return;
        }
      } else {
        const failedAt = Date.now();
        running = {
          ...running,
          status: "failed",
          error: taskError,
          completedAt: failedAt,
          updatedAt: failedAt,
        };
        this.tasks.set(running.id, running);
        this.recalculateMetrics();
        await this.persist();
        this.events.emit({
          type: "task_failed",
          task: clone(running),
          timestamp: failedAt,
        });
      }
    } finally {
      this.active.delete(task.id);
      this.recalculateMetrics();
      await this.persist();
      void this.pump();
    }
  }

  private async finishCancelled(task: TaskQueueTask): Promise<void> {
    const cancelledAt = Date.now();
    const cancelled: TaskQueueTask = {
      ...task,
      status: "cancelled",
      updatedAt: cancelledAt,
      completedAt: cancelledAt,
      error: undefined,
    };
    this.tasks.set(cancelled.id, cancelled);
    this.recalculateMetrics();
    await this.persist();
    this.events.emit({
      type: "task_cancelled",
      task: clone(cancelled),
      timestamp: cancelledAt,
    });
  }

  private async failExhausted(task: TaskQueueTask): Promise<void> {
    const failedAt = Date.now();
    const failed: TaskQueueTask = { ...task, status: "failed", updatedAt: failedAt,
      completedAt: failedAt, error: { name: "AttemptBudgetExhausted", message: "Durable attempt budget exhausted" } };
    this.tasks.set(task.id, failed);
    this.recalculateMetrics();
    await this.persist();
    this.events.emit({ type: "task_failed", task: clone(failed), timestamp: failedAt });
  }

  private recalculateMetrics(retries = this.metrics.retries): void {
    const metrics: TaskQueueMetrics = {
      ...INITIAL_METRICS,
      retries,
    };

    for (const task of this.tasks.values()) {
      metrics[task.status] += 1;
    }

    this.metrics = metrics;
  }

  private async persist(replacement?: TaskQueueTask): Promise<void> {
    const save = this.persistChain.then(() => {
      const tasks = [...this.tasks.values()].map(task =>
        clone(replacement?.id === task.id ? replacement : task)
      );
      const metrics = replacement
        ? metricsFor(tasks, this.metrics.retries)
        : { ...this.metrics };
      const snapshot: TaskQueueSnapshot = { version: 2, tasks, metrics };
      return this.store.save(snapshot);
    });
    this.persistChain = save.catch(() => undefined);
    await save;
  }

  private emitDrainIfNeeded(): void {
    const hasPending = [...this.tasks.values()].some(
      task => task.status === "queued" || task.status === "running"
    );
    if (hasPending || this.active.size > 0 || this.drainEmitted) {
      return;
    }

    this.drainEmitted = true;
    this.events.emit({ type: "queue_drained", timestamp: Date.now() });
  }
}

function metricsFor(tasks: TaskQueueTask[], retries: number): TaskQueueMetrics {
  const metrics: TaskQueueMetrics = { ...INITIAL_METRICS, retries };
  for (const task of tasks) metrics[task.status] += 1;
  return metrics;
}

function normaliseSnapshot(snapshot: Awaited<ReturnType<TaskQueueStore["load"]>>): TaskQueueSnapshot {
  if (!snapshot || (snapshot.version !== 1 && snapshot.version !== 2) || !Array.isArray(snapshot.tasks)) {
    throw new Error("Corrupt task queue snapshot: unsupported or incomplete state");
  }
  const tasks = snapshot.tasks.map(raw => {
    if (!raw || !Number.isInteger(raw.attempt) || raw.attempt < 0 ||
      !Number.isInteger(raw.maxAttempts) || raw.maxAttempts < 1 || raw.attempt > raw.maxAttempts) {
      throw new Error("Corrupt task queue snapshot: attempt budget evidence is incomplete");
    }
    const evidence = "attemptBudget" in raw ? raw.attemptBudget : {
      limit: raw.maxAttempts, consumed: raw.attempt,
    };
    if (!evidence || !Number.isInteger(evidence.limit) || !Number.isInteger(evidence.consumed) ||
      evidence.limit !== raw.maxAttempts || evidence.consumed !== raw.attempt ||
      evidence.consumed < 0 || evidence.consumed > evidence.limit) {
      throw new Error("Corrupt task queue snapshot: non-monotonic attempt budget evidence");
    }
    return { ...raw, attemptBudget: { ...evidence } } as TaskQueueTask;
  });
  return { version: 2, tasks, metrics: { ...snapshot.metrics } };
}

function compareTasks(left: TaskQueueTask, right: TaskQueueTask): number {
  const priority = PRIORITY_WEIGHT[right.priority] - PRIORITY_WEIGHT[left.priority];
  if (priority !== 0) {
    return priority;
  }

  return left.queuedAt - right.queuedAt;
}

function clone(task: TaskQueueTask): TaskQueueTask {
  return structuredClone(task);
}

function isTerminal(status: TaskQueueTask["status"]): boolean {
  return status === "completed" || status === "failed" || status === "cancelled";
}

function normaliseAttempts(value: number | undefined, fallback: number): number {
  return Number.isInteger(value) && value !== undefined && value > 0
    ? value
    : fallback;
}

function serialiseError(error: unknown): TaskQueueTaskError {
  return {
    name: error instanceof Error ? error.name : "Error",
    message: truncate(error instanceof Error ? error.message : String(error), 100_000),
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function delay(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise(resolve => setTimeout(resolve, ms));
}
