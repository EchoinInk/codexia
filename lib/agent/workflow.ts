import type {
  AgentContext,
} from "./types";

import type {
  Plan,
} from "./planner";

import {
  executePlan,
  type ExecutionResult,
} from "./executor";

import {
  validateWorkflow,
  type WorkflowValidation,
} from "./workflow-validator";


export type WorkflowStage =
  | "planning"
  | "approval"
  | "execution"
  | "review"
  | "validation"
  | "complete"
  | "failed";


export interface WorkflowState {

  stage: WorkflowStage;

  approved: boolean;

  startedAt: number;

  completedAt?: number;

}



export interface WorkflowReview {

  success: boolean;

  summary: string;

  filesModified: string[];

}



export interface WorkflowResult {

  execution:
    ExecutionResult;

  review:
    WorkflowReview;

  validation:
    WorkflowValidation;

  state:
    WorkflowState;

}



function createWorkflowState(): WorkflowState {

  return {

    stage:
      "planning",

    approved:
      false,

    startedAt:
      Date.now(),

  };

}



function approveWorkflow(
  state: WorkflowState
): WorkflowState {

  return {

    ...state,

    stage:
      "execution",

    approved:
      true,

  };

}



function reviewWorkflow(
  state: WorkflowState
): WorkflowState {

  return {

    ...state,

    stage:
      "review",

  };

}



function validationWorkflow(
  state: WorkflowState
): WorkflowState {

  return {

    ...state,

    stage:
      "validation",

  };

}



function completeWorkflow(
  state: WorkflowState
): WorkflowState {

  return {

    ...state,

    stage:
      "complete",

    completedAt:
      Date.now(),

  };

}



function failWorkflow(
  state: WorkflowState
): WorkflowState {

  return {

    ...state,

    stage:
      "failed",

    completedAt:
      Date.now(),

  };

}



function createWorkflowReview(
  execution: ExecutionResult
): WorkflowReview {

  return {

    success:
      execution.success,

    summary:
      execution.success
        ? "Execution completed successfully"
        : "Execution failed during verification or validation",

    filesModified:
      execution.filesModified,

  };

}



export async function runWorkflow(
  plan: Plan,
  context: AgentContext
): Promise<WorkflowResult> {

  let state =
    createWorkflowState();



  state =
    approveWorkflow(
      state
    );



  const execution =
    await executePlan(
      plan,
      context
    );



  state =
    reviewWorkflow(
      state
    );



  const review =
    createWorkflowReview(
      execution
    );



  state =
    validationWorkflow(
      state
    );



  const validation =
    validateWorkflow(
      state,
      review
    );



  state =
    execution.success &&
    validation.valid
      ? completeWorkflow(state)
      : failWorkflow(state);



  return {

    execution,

    review,

    validation,

    state,

  };

}