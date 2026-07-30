import type { WorkspaceEventSystemConfiguration } from "./types";

const DEFAULT_CONFIGURATION: WorkspaceEventSystemConfiguration = {
  historyLimit: 100,
};

/** Resolves safe bounded configuration for the event runtime. */
export function resolveWorkspaceEventSystemConfiguration(
  configuration: Partial<WorkspaceEventSystemConfiguration> = {}
): WorkspaceEventSystemConfiguration {
  return {
    historyLimit: normalisePositiveInteger(
      configuration.historyLimit,
      DEFAULT_CONFIGURATION.historyLimit
    ),
  };
}

function normalisePositiveInteger(
  value: number | undefined,
  fallback: number
): number {
  if (!Number.isFinite(value) || value === undefined || value < 1) {
    return fallback;
  }

  return Math.floor(value);
}
