import type { AgentContext } from "../types";
import type { Plan, Planner } from "../planner";
import type { WorkflowOptions, WorkflowResult } from "../workflow";

/** Stable lifecycle states for a long-running task. */
export type RuntimeTaskStatus =
  | "created"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

/** Fine-grained phase currently coordinated by the runtime. */
export type RuntimePhase =
  | "idle"
  | "observing"
  | "planning"
  | "executing"
  | "verifying"
  | "checkpointing"
  | "deciding"
  | "terminal";

/** Machine-readable reasons for stopping a runtime. */
export type RuntimeStopReason =
  | "goal_achieved"
  | "iteration_limit"
  | "timeout"
  | "cancelled"
  | "user_interruption"
  | "unrecoverable_failure"
  | "paused";

/** Runtime progress derived from completed iterations and configured limits. */
export interface RuntimeProgress {
  iterationsCompleted: number;
  iterationLimit: number;
  percentOfIterationLimit: number;
}

/** Serialisable task state persisted in every checkpoint. */
export interface TaskRuntimeState {
  id: string;
  goal: string;
  status: RuntimeTaskStatus;
  phase: RuntimePhase;
  iteration: number;
  progress: RuntimeProgress;
  consecutiveFailures: number;
  startedAt: number;
  updatedAt: number;
  completedAt?: number;
  deadlineAt?: number;
  stopReason?: RuntimeStopReason;
  pauseReason?: string;
  cancellationReason?: string;
  lastError?: RuntimeErrorData;
  metadata?: Record<string, unknown>;
}

/** Runtime limits and checkpoint behaviour. */
export interface RuntimeConfiguration {
  maxIterations: number;
  timeoutMs: number;
  maxConsecutiveFailures: number;
  checkpointAfterEachIteration: boolean;
}

/** Observation supplied to planning at the beginning of an iteration. */
export interface RuntimeObservation {
  summary: string;
  context: AgentContext;
  userInterruption?: boolean;
  metadata?: Record<string, unknown>;
}

/** Result of evaluating one bounded workflow cycle. */
export interface RuntimeIterationEvaluation {
  goalAchieved: boolean;
  recoverable: boolean;
  userInterruption?: boolean;
  reason?: string;
}

/** Complete record of one runtime iteration. */
export interface RuntimeIterationResult {
  iteration: number;
  startedAt: number;
  completedAt: number;
  observation: RuntimeObservation;
  plan: Plan;
  workflow: WorkflowResult;
  evaluation: RuntimeIterationEvaluation;
}

/** Serialisable iteration summary embedded in durable checkpoints. */
export interface RuntimeCheckpointIteration {
  iteration: number;
  startedAt: number;
  completedAt: number;
  observation: Omit<RuntimeObservation, "context">;
  plan: Plan;
  workflow: Omit<WorkflowResult, "execution"> & {
    execution: Omit<WorkflowResult["execution"], "context">;
  };
  evaluation: RuntimeIterationEvaluation;
}

/** Explicit continuation action selected after an iteration or error. */
export type RuntimeContinuationAction =
  | "continue"
  | "stop"
  | "retry"
  | "fail";

/** Decision returned by a continuation policy. */
export interface RuntimeContinuationDecision {
  action: RuntimeContinuationAction;
  reason?: RuntimeStopReason;
  detail?: string;
}

/** Aggregate runtime measurements maintained without coupling to reporting. */
export interface RuntimeMetrics {
  iterations: number;
  successfulIterations: number;
  failedIterations: number;
  retries: number;
  checkpoints: number;
  startedAt: number;
  completedAt?: number;
  durationMs: number;
}

/** Serialisable subset of AgentContext used for durable continuation. */
export type RuntimeContextSnapshot = Omit<AgentContext, "intelligence">;

/** Durable checkpoint for pause, recovery, and resume. */
export interface RuntimeCheckpoint {
  id: string;
  taskId: string;
  createdAt: number;
  state: TaskRuntimeState;
  context: RuntimeContextSnapshot;
  metrics: RuntimeMetrics;
  lastIteration?: RuntimeCheckpointIteration;
}

/** Final or paused result returned by the controller. */
export interface RuntimeResult {
  state: TaskRuntimeState;
  context: AgentContext;
  metrics: RuntimeMetrics;
  lastIteration?: RuntimeIterationResult;
  checkpoint?: RuntimeCheckpoint;
}

/** Input required to begin a new long-running task. */
export interface RuntimeTaskInput {
  goal: string;
  context: AgentContext;
  id?: string;
  metadata?: Record<string, unknown>;
}

/** Context passed to observer implementations. */
export interface RuntimeObserverInput {
  state: Readonly<TaskRuntimeState>;
  context: AgentContext;
  signal: AbortSignal;
}

/** Produces a fresh workspace/task observation before each plan. */
export interface RuntimeObserver {
  observe(input: RuntimeObserverInput): Promise<RuntimeObservation>;
}

/** Determines whether the bounded workflow achieved the wider task goal. */
export interface RuntimeGoalEvaluator {
  evaluate(input: {
    state: Readonly<TaskRuntimeState>;
    observation: RuntimeObservation;
    plan: Plan;
    workflow: WorkflowResult;
  }): Promise<RuntimeIterationEvaluation>;
}

/** Records durable workspace learning from completed runtime iterations. */
export interface RuntimeMemoryRecorder {
  recordIteration(input: {
    state: Readonly<TaskRuntimeState>;
    context: AgentContext;
    plan: Plan;
    workflow: WorkflowResult;
    evaluation: RuntimeIterationEvaluation;
    success: boolean;
  }): Promise<void>;
}


/** Applies stop limits and task-specific continuation semantics. */
export interface RuntimeContinuationPolicy {
  decide(input: {
    state: Readonly<TaskRuntimeState>;
    evaluation: RuntimeIterationEvaluation;
    configuration: Readonly<RuntimeConfiguration>;
    now: number;
  }): RuntimeContinuationDecision;
}

/** Persistence boundary for runtime checkpoints. */
export interface RuntimeCheckpointStore {
  save(checkpoint: RuntimeCheckpoint): Promise<void>;
  loadLatest(taskId: string): Promise<RuntimeCheckpoint | undefined>;
}

/** Rehydrates durable task context before a resume. */
export type RuntimeContextRestorer = (
  snapshot: RuntimeContextSnapshot
) => Promise<AgentContext>;

/** Minimal logger contract used by the runtime orchestration layer. */
export interface RuntimeLogger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
}

/** Typed events emitted while a task progresses. */
export type RuntimeEvent =
  | { type: "task_started"; taskId: string; timestamp: number }
  | { type: "task_resumed"; taskId: string; timestamp: number }
  | { type: "phase_changed"; taskId: string; phase: RuntimePhase; timestamp: number }
  | { type: "iteration_started"; taskId: string; iteration: number; timestamp: number }
  | { type: "iteration_completed"; taskId: string; iteration: number; success: boolean; timestamp: number }
  | { type: "checkpoint_saved"; taskId: string; checkpointId: string; timestamp: number }
  | { type: "pause_requested"; taskId: string; reason?: string; timestamp: number }
  | { type: "cancellation_requested"; taskId: string; reason?: string; timestamp: number }
  | { type: "task_stopped"; taskId: string; reason: RuntimeStopReason; timestamp: number }
  | { type: "runtime_error"; taskId: string; error: RuntimeErrorData; timestamp: number };

/** Listener for runtime lifecycle events. */
export type RuntimeEventListener = (event: RuntimeEvent) => void;

/** Serializable error representation safe to store in checkpoints. */
export interface RuntimeErrorData {
  name: string;
  message: string;
  code: RuntimeErrorCode;
  recoverable: boolean;
  cause?: string;
}

/** Runtime-specific failure categories. */
export type RuntimeErrorCode =
  | "observation_failed"
  | "planning_failed"
  | "workflow_failed"
  | "checkpoint_failed"
  | "resume_failed"
  | "aborted"
  | "unknown";

/** Injectable boundaries used by RuntimeController. */
export interface RuntimeDependencies {
  observer: RuntimeObserver;
  planner: Planner;
  goalEvaluator: RuntimeGoalEvaluator;
  continuationPolicy: RuntimeContinuationPolicy;
  checkpointStore: RuntimeCheckpointStore;
  restoreContext: RuntimeContextRestorer;
  runWorkflow: (
    plan: Plan,
    context: AgentContext,
    options?: WorkflowOptions
  ) => Promise<WorkflowResult>;
  memoryRecorder?: RuntimeMemoryRecorder;
  logger?: RuntimeLogger;
  now?: () => number;
  createId?: () => string;
}
