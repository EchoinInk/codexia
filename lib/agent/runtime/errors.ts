import type {
  RuntimeErrorCode,
  RuntimeErrorData,
} from "./types";

/** Error carrying runtime classification and recovery semantics. */
export class RuntimeError extends Error {
  readonly code: RuntimeErrorCode;
  readonly recoverable: boolean;
  readonly cause?: unknown;

  constructor(
    message: string,
    code: RuntimeErrorCode = "unknown",
    recoverable = false,
    cause?: unknown
  ) {
    super(message);
    this.name = "RuntimeError";
    this.code = code;
    this.recoverable = recoverable;
    this.cause = cause;
  }
}

/** Normalises arbitrary thrown values into a durable runtime error. */
export function normaliseRuntimeError(
  error: unknown,
  code: RuntimeErrorCode = "unknown",
  recoverable = false
): RuntimeError {
  if (error instanceof RuntimeError) {
    return error;
  }

  if (isAbortError(error)) {
    return new RuntimeError(
      error instanceof Error ? error.message : "Runtime operation aborted",
      "aborted",
      false,
      error
    );
  }

  return new RuntimeError(
    error instanceof Error ? error.message : String(error),
    code,
    recoverable,
    error
  );
}

/** Converts a RuntimeError to its serialisable checkpoint representation. */
export function serialiseRuntimeError(error: RuntimeError): RuntimeErrorData {
  return {
    name: error.name,
    message: error.message,
    code: error.code,
    recoverable: error.recoverable,
    cause:
      error.cause instanceof Error
        ? error.cause.message
        : error.cause === undefined
          ? undefined
          : String(error.cause),
  };
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.message.toLowerCase().includes("aborted"))
  );
}
