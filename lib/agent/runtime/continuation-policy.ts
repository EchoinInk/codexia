import type {
  RuntimeContinuationDecision,
  RuntimeContinuationPolicy,
} from "./types";

/** Default bounded policy for deciding whether another workflow cycle may run. */
export class DefaultRuntimeContinuationPolicy
  implements RuntimeContinuationPolicy
{
  decide(
    input: Parameters<RuntimeContinuationPolicy["decide"]>[0]
  ): RuntimeContinuationDecision {
    const { state, evaluation, configuration, now } = input;

    if (evaluation.userInterruption) {
      return {
        action: "stop",
        reason: "user_interruption",
        detail: evaluation.reason,
      };
    }

    if (evaluation.goalAchieved) {
      return {
        action: "stop",
        reason: "goal_achieved",
        detail: evaluation.reason,
      };
    }

    if (state.deadlineAt !== undefined && now >= state.deadlineAt) {
      return { action: "fail", reason: "timeout" };
    }

    if (state.iteration >= configuration.maxIterations) {
      return { action: "fail", reason: "iteration_limit" };
    }

    if (!evaluation.recoverable) {
      return {
        action: "fail",
        reason: "unrecoverable_failure",
        detail: evaluation.reason,
      };
    }

    if (state.consecutiveFailures >= configuration.maxConsecutiveFailures) {
      return {
        action: "fail",
        reason: "unrecoverable_failure",
        detail: "Maximum consecutive workflow failures reached",
      };
    }

    if (state.consecutiveFailures > 0) {
      return { action: "retry", detail: evaluation.reason };
    }

    return { action: "continue", detail: evaluation.reason };
  }
}
