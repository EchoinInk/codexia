import type {
  WorkflowState,
  WorkflowReview,
} from "./workflow";


export interface WorkflowValidation {

  valid: boolean;

  errors: string[];

}



export function validateWorkflow(
  state: WorkflowState,
  review: WorkflowReview
): WorkflowValidation {

  const errors: string[] = [];


  if (
    state.stage === "complete" &&
    !review.success
  ) {

    errors.push(
      "Workflow completed with unsuccessful review"
    );

  }


  if (
    state.stage === "execution" &&
    state.completedAt
  ) {

    errors.push(
      "Workflow completed timestamp set before completion"
    );

  }


  if (
    !state.approved
  ) {

    errors.push(
      "Workflow was not approved before execution"
    );

  }


  return {

    valid:
      errors.length === 0,

    errors,

  };

}