import type {
  AgentResponse,
} from "./types";

import {
  createContext,
} from "./context";

import {
  getPlanner,
} from "./planner-index";

import {
  runWorkflow,
} from "./workflow";

import {
  createRepairPlan,
} from "./repair-planner";

import {
  createRetryState,
  canRetry,
  incrementRetry,
} from "./retry-manager";

import {
  auditAgentContext,
} from "./audit";

import {
  createAgentReport,
} from "./report-generator";


export async function runAgent(
  message: string,
  workspace: string
): Promise<AgentResponse> {

  let context =
    await createContext(
      [
        {
          role: "user",
          content: message,
        },
      ],
      workspace
    );


  const planner =
    getPlanner();


  let plan =
    await planner.createPlan(
      context
    );


  let retry =
    createRetryState();


  while (true) {

    const workflow =
      await runWorkflow(
        plan,
        context
      );


    const result =
      workflow.execution;


    context =
      result.context;


    const audit =
      auditAgentContext(
        context
      );


    if (result.success) {

      return {

        content:
          createAgentReport(
            workflow,
            audit
          ),

      };

    }


    if (!canRetry(retry)) {

      return {

        content:
          createAgentReport(
            workflow,
            audit
          ),

      };

    }


    retry =
      incrementRetry(
        retry
      );


    const repair =
      createRepairPlan(
        plan,
        context
      );


    plan = {

      goal:
        repair.originalGoal,

      steps:
        repair.steps,

      files:
        plan.files,

      fileSelection:
        plan.fileSelection,

      impact:
        plan.impact,

      metadata:
        plan.metadata,

    };

  }

}