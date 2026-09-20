export type IntegrationErrorCode =
  | "INCOMPATIBLE_VERSION" | "UNKNOWN_CAPABILITY" | "CAPABILITY_DENIED"
  | "WORKSPACE_MISMATCH" | "INVALID_REQUEST" | "RESOURCE_LIMIT"
  | "EVIDENCE_UNAVAILABLE" | "PROVIDER_UNAVAILABLE" | "ADAPTER_FAILURE";

export class IntegrationError extends Error {
  readonly name = "IntegrationError";
  constructor(readonly code: IntegrationErrorCode, message: string, readonly retryable = false) {
    super(message);
  }
  toJSON() { return { code: this.code, message: this.message, retryable: this.retryable }; }
}

const SECRET_PATTERN = /(?:api[-_ ]?key|authorization|bearer|token|password|secret|credential|cookie|private[-_ ]?key|sk-[a-z0-9_-]{8,}|gh[opusr]_[a-z0-9]{8,}|AKIA[A-Z0-9]{12,})/i;

export function redactSecrets<T>(value: T, key = ""): T {
  if (SECRET_PATTERN.test(key)) return "[REDACTED]" as T;
  if (typeof value === "string" && SECRET_PATTERN.test(value)) return "[REDACTED]" as T;
  if (Array.isArray(value)) return value.map(item => redactSecrets(item)) as T;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .map(([entryKey, entryValue]) => [entryKey, redactSecrets(entryValue, entryKey)])) as T;
  return value;
}

/** Boundary-safe adapter failure: never forwards provider bodies, credentials, or stacks. */
export function isolateAdapterFailure(error: unknown, provider = false): IntegrationError {
  if (error instanceof IntegrationError) return error;
  return new IntegrationError(provider ? "PROVIDER_UNAVAILABLE" : "ADAPTER_FAILURE",
    `${provider ? "Provider" : "Integration adapter"} unavailable`, true);
}
