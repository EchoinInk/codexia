import type { AgentObservation } from "./types";

export function createObservation(value: unknown): AgentObservation {
  if (typeof value === "object" && value !== null && "content" in value) {
    return {
      type: "file_read",

      summary: "File contents were read",

      data: value,
    };
  }

  return {
    type: "tool_result",

    summary: "Tool execution completed",

    data: value,
  };
}
