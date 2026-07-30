import type {
  AgentContext,
} from "./types";

import type {
  Plan,
  PlanStep,
} from "./planner";


export interface RepairPlan {

  originalGoal: string;

  reason: string;

  steps: PlanStep[];

}



export function createRepairPlan(
  plan: Plan,
  context: AgentContext
): RepairPlan {


  const failures =
    context.observations
      .filter(
        observation =>
          observation.type === "error"
      )
      .map(
        observation =>
          observation.summary
      );



  return {

    originalGoal:
      plan.goal,


    reason:
      failures.length > 0
        ? failures.join("\n")
        : "Unknown execution failure",


    steps: [

      {

        description:
          "Analyse previous failure",

        action:
          "analyze",

      },

      {

        description:
          "Apply corrective changes",

        action:
          "write",

      },

      {

        description:
          "Verify repaired implementation",

        action:
          "verify",

      },

    ],

  };

}