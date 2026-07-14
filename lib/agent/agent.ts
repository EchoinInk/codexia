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
  executePlan,
} from "./executor";

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

    const result =
      await executePlan(
        plan,
        context
      );


    context = result.context;


    if (result.success) {

      const audit =
        auditAgentContext(
          context
        );


      return {

        content: [

          result.output,

          "",

          "Audit:",

          JSON.stringify(
            audit.metrics,
            null,
            2
          ),

        ].join("\n"),

      };

    }


    if (!canRetry(retry)) {

      const audit =
        auditAgentContext(
          context
        );


      return {

        content: [

          result.output,

          "",

          "Audit:",

          JSON.stringify(
            audit.metrics,
            null,
            2
          ),

        ].join("\n"),

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

      files: [],

    };

  }

}