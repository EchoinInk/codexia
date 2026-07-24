import type { TaskQueueConfiguration } from "./types";

const DEFAULT_CONFIGURATION: TaskQueueConfiguration = {
  concurrency: 1,
  defaultMaxAttempts: 2,
  retryDelayMs: 250,
  autoStart: true,
};

/** Resolves queue configuration while enforcing safe lower bounds. */
export function resolveTaskQueueConfiguration(
  configuration: Partial<TaskQueueConfiguration> = {}
): TaskQueueConfiguration {
  return {
    concurrency: positiveInteger(
      configuration.concurrency,
      DEFAULT_CONFIGURATION.concurrency
    ),
    defaultMaxAttempts: positiveInteger(
      configuration.defaultMaxAttempts,
      DEFAULT_CONFIGURATION.defaultMaxAttempts
    ),
    retryDelayMs: nonNegativeInteger(
      configuration.retryDelayMs,
      DEFAULT_CONFIGURATION.retryDelayMs
    ),
    autoStart: configuration.autoStart ?? DEFAULT_CONFIGURATION.autoStart,
  };
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return Number.isInteger(value) && value !== undefined && value > 0
    ? value
    : fallback;
}

function nonNegativeInteger(
  value: number | undefined,
  fallback: number
): number {
  return Number.isInteger(value) && value !== undefined && value >= 0
    ? value
    : fallback;
}
