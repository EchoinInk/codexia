import type {
  RuntimeGoalEvaluator,
  RuntimeLogger,
  RuntimeObserver,
} from "./types";

/** Default observer preserving the latest agent context between iterations. */
export class DefaultRuntimeObserver implements RuntimeObserver {
  async observe(
    input: Parameters<RuntimeObserver["observe"]>[0]
  ): ReturnType<RuntimeObserver["observe"]> {
    if (input.signal.aborted) {
      const error = new Error("Runtime observation aborted");
      error.name = "AbortError";
      throw error;
    }

    return {
      summary: `Runtime iteration ${input.state.iteration + 1} observation`,
      context: input.context,
    };
  }
}

/**
 * Conservative default evaluator. A successful bounded workflow completes the
 * task; callers may inject a semantic evaluator for genuinely multi-step goals.
 */
export class DefaultRuntimeGoalEvaluator implements RuntimeGoalEvaluator {
  async evaluate(
    input: Parameters<RuntimeGoalEvaluator["evaluate"]>[0]
  ): ReturnType<RuntimeGoalEvaluator["evaluate"]> {
    const success =
      input.workflow.execution.success &&
      input.workflow.validation.valid &&
      input.workflow.state.stage === "complete";

    return {
      goalAchieved: success,
      recoverable: !success,
      reason: success
        ? "Bounded workflow completed successfully"
        : "Bounded workflow did not complete successfully",
    };
  }
}

/** Console-backed logger used when an embedding does not supply structured logging. */
export const defaultRuntimeLogger: RuntimeLogger = {
  debug(message, data) {
    console.debug(`[runtime] ${message}`, data ?? {});
  },
  info(message, data) {
    console.info(`[runtime] ${message}`, data ?? {});
  },
  warn(message, data) {
    console.warn(`[runtime] ${message}`, data ?? {});
  },
  error(message, data) {
    console.error(`[runtime] ${message}`, data ?? {});
  },
};
