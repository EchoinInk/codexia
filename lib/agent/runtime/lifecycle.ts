import type {
  RuntimePhase,
  RuntimeTaskStatus,
  TaskRuntimeState,
} from "./types";

const ALLOWED_TRANSITIONS: Record<RuntimeTaskStatus, RuntimeTaskStatus[]> = {
  created: ["running", "cancelled", "failed"],
  running: ["paused", "completed", "failed", "cancelled"],
  paused: ["running", "cancelled", "failed"],
  completed: [],
  failed: [],
  cancelled: [],
};

/** Applies and validates a task lifecycle status transition. */
export function transitionRuntimeStatus(
  state: TaskRuntimeState,
  status: RuntimeTaskStatus,
  now: number
): TaskRuntimeState {
  if (state.status === status) {
    return { ...state, updatedAt: now };
  }

  if (!ALLOWED_TRANSITIONS[state.status].includes(status)) {
    throw new Error(
      `Invalid runtime status transition: ${state.status} -> ${status}`
    );
  }

  return {
    ...state,
    status,
    updatedAt: now,
  };
}

/** Updates the active orchestration phase without changing lifecycle ownership. */
export function transitionRuntimePhase(
  state: TaskRuntimeState,
  phase: RuntimePhase,
  now: number
): TaskRuntimeState {
  return {
    ...state,
    phase,
    updatedAt: now,
  };
}
