import type {
  DiffResult,
} from "./diff";

import type {
  AgentContext,
} from "./types";

export interface PatchValidationResult {

  valid: boolean;

  errors: string[];

}



export function validateDiff(
  diff: DiffResult
): PatchValidationResult {

  const errors: string[] = [];


  for (const change of diff.changes) {

    if (!change.path) {

      errors.push(
        "Patch contains missing file path"
      );

    }


    if (change.after === undefined) {

      errors.push(
        `Missing output content for ${change.path}`
      );

    }

  }


  return {

    valid:
      errors.length === 0,

    errors,

  };

}
export function validateExecution(
  context: AgentContext
): PatchValidationResult {

  const errors: string[] = [];


  for (const observation of context.observations) {

    if (observation.type === "error") {

      errors.push(
        observation.summary
      );

    }

  }


  return {

    valid:
      errors.length === 0,

    errors,

  };

}