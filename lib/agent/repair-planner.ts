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


    // A retry may repeat or narrow read-only inspection, but it can never
    // manufacture a placeholder write or verification command.
    steps: [
      ...plan.steps.filter(step => step.action === "read"),
      { description: "Analyse previous read-only failure", action: "analyze" },
    ],

  };

}
