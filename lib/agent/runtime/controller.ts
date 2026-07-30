import { randomUUID } from "node:crypto";

import type { AgentContext } from "../types";
import type { Plan } from "../planner";
import type { WorkflowResult } from "../workflow";
import { resolveRuntimeConfiguration } from "./config";
import {
  createRuntimeMetrics,
  createRuntimeProgress,
  mergeRestoredRuntimeContext,
  recordIterationMetrics,
  snapshotRuntimeContext,
  snapshotRuntimeIteration,
} from "./context";
import {
  RuntimeError,
  normaliseRuntimeError,
  serialiseRuntimeError,
} from "./errors";
import { RuntimeEventBus } from "./events";
import {
  transitionRuntimePhase,
  transitionRuntimeStatus,
} from "./lifecycle";
import type {
  RuntimeCheckpoint,
  RuntimeConfiguration,
  RuntimeContinuationDecision,
  RuntimeDependencies,
  RuntimeEventListener,
  RuntimeIterationEvaluation,
  RuntimeIterationResult,
  RuntimeMetrics,
  RuntimeResult,
  RuntimeStopReason,
  RuntimeTaskInput,
  TaskRuntimeState,
} from "./types";

interface RuntimeControl {
  abortController: AbortController;
  pauseReason?: string;
  cancellationReason?: string;
}

/**
 * Coordinates repeated bounded workflows while preserving planner, executor,
 * validator, reporter, intelligence, and workflow boundaries.
 */
export class RuntimeController {
  private readonly configuration: RuntimeConfiguration;
  private readonly dependencies: RuntimeDependencies;
  private readonly events = new RuntimeEventBus();
  private readonly controls = new Map<string, RuntimeControl>();

  constructor(
    dependencies: RuntimeDependencies,
    configuration: Partial<RuntimeConfiguration> = {}
  ) {
    this.dependencies = dependencies;
    this.configuration = resolveRuntimeConfiguration(configuration);
  }

  /** Subscribes to task lifecycle events. */
  subscribe(listener: RuntimeEventListener): () => void {
    return this.events.subscribe(listener);
  }

  /** Starts a new autonomous task. */
  async start(input: RuntimeTaskInput): Promise<RuntimeResult> {
    const now = this.now();
    const id = input.id ?? this.createId();

    if (this.controls.has(id)) {
      throw new RuntimeError(`Runtime task ${id} is already active`, "unknown");
    }

    const state: TaskRuntimeState = {
      id,
      goal: input.goal,
      status: "created",
      phase: "idle",
      iteration: 0,
      progress: createRuntimeProgress(0, this.configuration.maxIterations),
      consecutiveFailures: 0,
      startedAt: now,
      updatedAt: now,
      deadlineAt: now + this.configuration.timeoutMs,
      metadata: input.metadata,
    };

    this.events.emit({ type: "task_started", taskId: id, timestamp: now });

    return this.run(state, input.context, createRuntimeMetrics(now));
  }

  /** Resumes the latest durable checkpoint for a paused task. */
  async resume(taskId: string): Promise<RuntimeResult> {
    if (this.controls.has(taskId)) {
      throw new RuntimeError(
        `Runtime task ${taskId} is already active`,
        "resume_failed"
      );
    }

    let checkpoint: RuntimeCheckpoint | undefined;

    try {
      checkpoint = await this.dependencies.checkpointStore.loadLatest(taskId);
    } catch (error) {
      throw normaliseRuntimeError(error, "resume_failed", false);
    }

    if (!checkpoint) {
      throw new RuntimeError(
        `No checkpoint exists for runtime task ${taskId}`,
        "resume_failed"
      );
    }

    if (checkpoint.state.status !== "paused") {
      throw new RuntimeError(
        `Runtime task ${taskId} cannot resume from ${checkpoint.state.status}`,
        "resume_failed"
      );
    }

    const now = this.now();
    const pausedFor = Math.max(0, now - checkpoint.state.updatedAt);
    let state = transitionRuntimeStatus(checkpoint.state, "running", now);

    state = {
      ...state,
      phase: "idle",
      deadlineAt:
        state.deadlineAt === undefined
          ? now + this.configuration.timeoutMs
          : state.deadlineAt + pausedFor,
      pauseReason: undefined,
      stopReason: undefined,
    };

    const restoredBase = await this.dependencies.restoreContext(checkpoint.context);
    const restoredContext = mergeRestoredRuntimeContext(
      checkpoint.context,
      restoredBase
    );

    this.events.emit({ type: "task_resumed", taskId, timestamp: now });

    return this.run(state, restoredContext, checkpoint.metrics);
  }

  /** Requests a safe pause at the next runtime boundary. */
  pause(taskId: string, reason?: string): boolean {
    const control = this.controls.get(taskId);
    if (!control || control.cancellationReason !== undefined) {
      return false;
    }

    control.pauseReason = reason ?? "Pause requested";
    this.events.emit({
      type: "pause_requested",
      taskId,
      reason,
      timestamp: this.now(),
    });
    return true;
  }

  /** Requests cancellation and aborts the active bounded workflow where supported. */
  cancel(taskId: string, reason?: string): boolean {
    const control = this.controls.get(taskId);
    if (!control) {
      return false;
    }

    control.cancellationReason = reason ?? "Cancellation requested";
    control.abortController.abort(control.cancellationReason);
    this.events.emit({
      type: "cancellation_requested",
      taskId,
      reason,
      timestamp: this.now(),
    });
    return true;
  }

  private async run(
    initialState: TaskRuntimeState,
    initialContext: AgentContext,
    initialMetrics: RuntimeMetrics
  ): Promise<RuntimeResult> {
    let state =
      initialState.status === "running"
        ? initialState
        : transitionRuntimeStatus(initialState, "running", this.now());
    let context = initialContext;
    let metrics = { ...initialMetrics };
    let lastIteration: RuntimeIterationResult | undefined;
    let latestCheckpoint: RuntimeCheckpoint | undefined;
    const control: RuntimeControl = { abortController: new AbortController() };
    this.controls.set(state.id, control);

    const remainingMs = Math.max(
      0,
      (state.deadlineAt ?? this.now()) - this.now()
    );
    const timeout = setTimeout(() => {
      control.abortController.abort("Runtime timeout reached");
    }, remainingMs);

    this.dependencies.logger?.info("Runtime task running", { taskId: state.id });

    try {
      while (true) {
        const boundary = this.boundaryDecision(state, control);
        if (boundary) {
          ({ state, metrics, latestCheckpoint } = await this.stop(
            state,
            context,
            metrics,
            boundary,
            lastIteration
          ));
          break;
        }

        const iterationStartedAt = this.now();
        this.events.emit({
          type: "iteration_started",
          taskId: state.id,
          iteration: state.iteration + 1,
          timestamp: iterationStartedAt,
        });

        try {
          state = this.phase(state, "observing");
          const observation = await this.dependencies.observer.observe({
            state,
            context,
            signal: control.abortController.signal,
          });
          context = observation.context;

          state = this.phase(state, "planning");
          const plan = await this.dependencies.planner.createPlan(context);

          state = this.phase(state, "executing");
          const workflow = await this.dependencies.runWorkflow(plan, context, {
            signal: control.abortController.signal,
          });
          context = workflow.execution.context;

          state = this.phase(state, "verifying");
          const evaluation = await this.dependencies.goalEvaluator.evaluate({
            state,
            observation,
            plan,
            workflow,
          });

          const completedAt = this.now();
          const success =
            workflow.execution.success && workflow.validation.valid;
          const nextIteration = state.iteration + 1;
          state = {
            ...state,
            iteration: nextIteration,
            progress: createRuntimeProgress(
              nextIteration,
              this.configuration.maxIterations
            ),
            consecutiveFailures: success ? 0 : state.consecutiveFailures + 1,
            updatedAt: completedAt,
            lastError: undefined,
          };
          metrics = recordIterationMetrics(metrics, success, completedAt);
          lastIteration = this.iterationResult(
            state,
            iterationStartedAt,
            completedAt,
            observation,
            plan,
            workflow,
            evaluation
          );

          this.events.emit({
            type: "iteration_completed",
            taskId: state.id,
            iteration: state.iteration,
            success,
            timestamp: completedAt,
          });

          if (this.dependencies.memoryRecorder) {
            try {
              await this.dependencies.memoryRecorder.recordIteration({
                state,
                context,
                plan,
                workflow,
                evaluation,
                success,
              });
            } catch (error) {
              this.dependencies.logger?.warn(
                "Unable to record runtime workspace memory",
                {
                  taskId: state.id,
                  error:
                    error instanceof Error
                      ? error.message
                      : String(error),
                }
              );
            }
          }

          if (this.configuration.checkpointAfterEachIteration) {
            ({ state, metrics, checkpoint: latestCheckpoint } =
              await this.saveCheckpoint(state, context, metrics, lastIteration));
          }

          const requestedStop = this.boundaryDecision(state, control);
          state = this.phase(state, "deciding");
          const continuation =
            requestedStop ??
            this.dependencies.continuationPolicy.decide({
              state,
              evaluation,
              configuration: this.configuration,
              now: this.now(),
            });

          if (continuation.action === "stop" || continuation.action === "fail") {
            ({ state, metrics, latestCheckpoint } = await this.stop(
              state,
              context,
              metrics,
              continuation,
              lastIteration
            ));
            break;
          }

          if (continuation.action === "retry") {
            metrics = {
              ...metrics,
              retries: metrics.retries + 1,
            };
          }
        } catch (error) {
          const boundary = this.boundaryDecision(state, control);

          if (boundary) {
            ({ state, metrics, latestCheckpoint } = await this.stop(
              state,
              context,
              metrics,
              boundary,
              lastIteration
            ));
            break;
          }

          const runtimeError = this.classifyStageError(error, state);
          const now = this.now();
          const nextIteration = state.iteration + 1;
          state = {
            ...state,
            iteration: nextIteration,
            progress: createRuntimeProgress(
              nextIteration,
              this.configuration.maxIterations
            ),
            consecutiveFailures: state.consecutiveFailures + 1,
            updatedAt: now,
            lastError: serialiseRuntimeError(runtimeError),
          };
          metrics = recordIterationMetrics(metrics, false, now);
          this.events.emit({
            type: "runtime_error",
            taskId: state.id,
            error: serialiseRuntimeError(runtimeError),
            timestamp: now,
          });
          this.dependencies.logger?.error("Runtime iteration failed", {
            taskId: state.id,
            error: runtimeError.message,
          });

          const evaluation: RuntimeIterationEvaluation = {
            goalAchieved: false,
            recoverable: runtimeError.recoverable,
            reason: runtimeError.message,
          };
          const continuation = this.dependencies.continuationPolicy.decide({
            state,
            evaluation,
            configuration: this.configuration,
            now,
          });

          if (continuation.action === "stop" || continuation.action === "fail") {
            ({ state, metrics, latestCheckpoint } = await this.stop(
              state,
              context,
              metrics,
              continuation,
              lastIteration
            ));
            break;
          }

          if (continuation.action === "retry") {
            metrics = {
              ...metrics,
              retries: metrics.retries + 1,
            };
          }

          ({ state, metrics, checkpoint: latestCheckpoint } =
            await this.saveCheckpoint(state, context, metrics, lastIteration));
        }
      }
    } finally {
      clearTimeout(timeout);
      this.controls.delete(state.id);
    }

    return {
      state,
      context,
      metrics,
      lastIteration,
      checkpoint: latestCheckpoint,
    };
  }

  private boundaryDecision(
    state: TaskRuntimeState,
    control: RuntimeControl
  ): RuntimeContinuationDecision | undefined {
    if (control.cancellationReason !== undefined) {
      return {
        action: "stop",
        reason: "cancelled",
        detail: control.cancellationReason,
      };
    }

    if (control.pauseReason !== undefined) {
      return {
        action: "stop",
        reason: "paused",
        detail: control.pauseReason,
      };
    }

    if (state.deadlineAt !== undefined && this.now() >= state.deadlineAt) {
      return { action: "fail", reason: "timeout" };
    }

    if (control.abortController.signal.aborted) {
      return { action: "fail", reason: "timeout" };
    }

    return undefined;
  }

  private async stop(
    state: TaskRuntimeState,
    context: AgentContext,
    metrics: RuntimeMetrics,
    decision: RuntimeContinuationDecision,
    lastIteration?: RuntimeIterationResult
  ): Promise<{
    state: TaskRuntimeState;
    metrics: RuntimeMetrics;
    latestCheckpoint: RuntimeCheckpoint;
  }> {
    const reason = decision.reason ?? "unrecoverable_failure";
    const now = this.now();
    const status = statusForReason(reason);
    let stoppedState = transitionRuntimeStatus(state, status, now);
    stoppedState = {
      ...transitionRuntimePhase(stoppedState, "terminal", now),
      stopReason: reason,
      pauseReason:
        reason === "paused" || reason === "user_interruption"
          ? decision.detail
          : undefined,
      cancellationReason: reason === "cancelled" ? decision.detail : undefined,
      completedAt:
        reason === "paused" || reason === "user_interruption"
          ? undefined
          : now,
    };
    const stoppedMetrics = {
      ...metrics,
      completedAt:
        reason === "paused" || reason === "user_interruption"
          ? undefined
          : now,
      durationMs: now - metrics.startedAt,
    };

    const saved = await this.saveCheckpoint(
      stoppedState,
      context,
      stoppedMetrics,
      lastIteration
    );

    this.events.emit({
      type: "task_stopped",
      taskId: state.id,
      reason,
      timestamp: now,
    });
    this.dependencies.logger?.info("Runtime task stopped", {
      taskId: state.id,
      reason,
    });

    return {
      state: saved.state,
      metrics: saved.metrics,
      latestCheckpoint: saved.checkpoint,
    };
  }

  private async saveCheckpoint(
    state: TaskRuntimeState,
    context: AgentContext,
    metrics: RuntimeMetrics,
    lastIteration?: RuntimeIterationResult
  ): Promise<{
    state: TaskRuntimeState;
    metrics: RuntimeMetrics;
    checkpoint: RuntimeCheckpoint;
  }> {
    const now = this.now();
    const terminal = state.phase === "terminal";
    const checkpointState = terminal
      ? state
      : transitionRuntimePhase(state, "checkpointing", now);
    const checkpointMetrics = {
      ...metrics,
      checkpoints: metrics.checkpoints + 1,
    };
    const checkpoint: RuntimeCheckpoint = {
      id: this.createId(),
      taskId: state.id,
      createdAt: now,
      state: checkpointState,
      context: snapshotRuntimeContext(context),
      metrics: checkpointMetrics,
      lastIteration: lastIteration
        ? snapshotRuntimeIteration(lastIteration)
        : undefined,
    };

    try {
      await this.dependencies.checkpointStore.save(checkpoint);
    } catch (error) {
      throw normaliseRuntimeError(error, "checkpoint_failed", false);
    }

    this.events.emit({
      type: "checkpoint_saved",
      taskId: state.id,
      checkpointId: checkpoint.id,
      timestamp: now,
    });

    return {
      state: checkpointState,
      metrics: checkpointMetrics,
      checkpoint,
    };
  }

  private phase(
    state: TaskRuntimeState,
    phase: TaskRuntimeState["phase"]
  ): TaskRuntimeState {
    const updated = transitionRuntimePhase(state, phase, this.now());
    this.events.emit({
      type: "phase_changed",
      taskId: state.id,
      phase,
      timestamp: updated.updatedAt,
    });
    return updated;
  }

  private classifyStageError(
    error: unknown,
    state: TaskRuntimeState
  ): RuntimeError {
    if (state.phase === "observing") {
      return normaliseRuntimeError(error, "observation_failed", true);
    }
    if (state.phase === "planning") {
      return normaliseRuntimeError(error, "planning_failed", true);
    }
    if (state.phase === "executing" || state.phase === "verifying") {
      return normaliseRuntimeError(error, "workflow_failed", true);
    }
    return normaliseRuntimeError(error);
  }

  private iterationResult(
    state: TaskRuntimeState,
    startedAt: number,
    completedAt: number,
    observation: RuntimeIterationResult["observation"],
    plan: Plan,
    workflow: WorkflowResult,
    evaluation: RuntimeIterationEvaluation
  ): RuntimeIterationResult {
    return {
      iteration: state.iteration,
      startedAt,
      completedAt,
      observation,
      plan,
      workflow,
      evaluation,
    };
  }

  private now(): number {
    return this.dependencies.now?.() ?? Date.now();
  }

  private createId(): string {
    return this.dependencies.createId?.() ?? randomUUID();
  }
}

function statusForReason(reason: RuntimeStopReason): TaskRuntimeState["status"] {
  switch (reason) {
    case "goal_achieved":
      return "completed";
    case "cancelled":
      return "cancelled";
    case "paused":
    case "user_interruption":
      return "paused";
    case "iteration_limit":
    case "timeout":
    case "unrecoverable_failure":
      return "failed";
  }
}
