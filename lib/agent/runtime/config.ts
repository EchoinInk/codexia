import type { RuntimeConfiguration } from "./types";

/** Conservative defaults prevent an unattended runtime from looping indefinitely. */
export const DEFAULT_RUNTIME_CONFIGURATION: RuntimeConfiguration = {
  maxIterations: 10,
  timeoutMs: 30 * 60 * 1000,
  maxConsecutiveFailures: 2,
  checkpointAfterEachIteration: true,
};

/** Validates and resolves partial runtime configuration. */
export function resolveRuntimeConfiguration(
  configuration: Partial<RuntimeConfiguration> = {}
): RuntimeConfiguration {
  const resolved = {
    ...DEFAULT_RUNTIME_CONFIGURATION,
    ...configuration,
  };

  assertPositiveInteger(resolved.maxIterations, "maxIterations");
  assertPositiveInteger(
    resolved.maxConsecutiveFailures,
    "maxConsecutiveFailures"
  );

  if (!Number.isFinite(resolved.timeoutMs) || resolved.timeoutMs <= 0) {
    throw new Error("Runtime configuration timeoutMs must be greater than zero");
  }

  return resolved;
}

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Runtime configuration ${name} must be a positive integer`);
  }
}
