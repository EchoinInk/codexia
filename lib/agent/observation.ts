import type {
  AgentObservation,
} from "./types";


export function createObservation(
  output: string,
  type:
    | AgentObservation["type"] = "tool_result"
): AgentObservation {

  return {

    type,

    summary:
      output,

  };

}