import type { AgentContext } from "../types";
import type {
  RuntimeCheckpointIteration,
  RuntimeContextSnapshot,
  RuntimeIterationResult,
  RuntimeMetrics,
  RuntimeProgress,
} from "./types";

/** Removes workspace intelligence from checkpoint state so it can be rebuilt on resume. */
export function snapshotRuntimeContext(
  context: AgentContext
): RuntimeContextSnapshot {
  return structuredClone({
    messages: context.messages,
    workspace: context.workspace,
    filesRead: context.filesRead,
    filesModified: context.filesModified,
    observations: context.observations,
    toolResults: context.toolResults,
    currentTask: context.currentTask,
    taskType: context.taskType,
    memory: context.memory,
  });
}

/** Merges a durable context snapshot with freshly rehydrated workspace intelligence. */
export function mergeRestoredRuntimeContext(
  snapshot: RuntimeContextSnapshot,
  restored: AgentContext
): AgentContext {
  return {
    ...structuredClone(snapshot),
    intelligence: restored.intelligence,
  };
}

/** Creates the initial metrics record for a task. */
export function createRuntimeMetrics(startedAt: number): RuntimeMetrics {
  return {
    iterations: 0,
    successfulIterations: 0,
    failedIterations: 0,
    retries: 0,
    checkpoints: 0,
    startedAt,
    durationMs: 0,
  };
}

/** Creates a bounded progress snapshot from the current iteration count. */
export function createRuntimeProgress(
  iterationsCompleted: number,
  iterationLimit: number
): RuntimeProgress {
  return {
    iterationsCompleted,
    iterationLimit,
    percentOfIterationLimit: Math.min(
      100,
      Math.round((iterationsCompleted / iterationLimit) * 100)
    ),
  };
}

/** Returns an immutable metrics update for a completed iteration. */
export function recordIterationMetrics(
  metrics: RuntimeMetrics,
  success: boolean,
  now: number,
  retry = false
): RuntimeMetrics {
  return {
    ...metrics,
    iterations: metrics.iterations + 1,
    successfulIterations:
      metrics.successfulIterations + (success ? 1 : 0),
    failedIterations: metrics.failedIterations + (success ? 0 : 1),
    retries: metrics.retries + (retry ? 1 : 0),
    durationMs: now - metrics.startedAt,
  };
}

/** Removes live AgentContext references from an iteration before persistence. */
export function snapshotRuntimeIteration(
  iteration: RuntimeIterationResult
): RuntimeCheckpointIteration {
  return structuredClone({
    iteration: iteration.iteration,
    startedAt: iteration.startedAt,
    completedAt: iteration.completedAt,
    observation: {
      summary: iteration.observation.summary,
      userInterruption: iteration.observation.userInterruption,
      metadata: iteration.observation.metadata,
    },
    workflow: {
      review: iteration.workflow.review,
      validation: iteration.workflow.validation,
      state: iteration.workflow.state,
      execution: {
        success: iteration.workflow.execution.success,
        output: iteration.workflow.execution.output,
        filesModified: iteration.workflow.execution.filesModified,
      },
    },
    plan: iteration.plan,
    evaluation: iteration.evaluation,
  });
}
