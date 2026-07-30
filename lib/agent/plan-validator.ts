import type {
  Plan,
  PlanStep,
} from "./planner";

import {
  AGENT_ACTIONS,
} from "./contracts/action-types";

import {
  toolRegistry,
} from "@/lib/tools/registry";


export class PlanValidationError extends Error {

  constructor(
    message: string
  ) {

    super(message);

    this.name =
      "PlanValidationError";

  }

}


export function isValidAction(
  action: unknown
): action is PlanStep["action"] {

  return (

    typeof action === "string" &&

    AGENT_ACTIONS.includes(
      action as typeof AGENT_ACTIONS[number]
    )

  );

}



export function validatePlanContract(
  plan: unknown
): Plan {

  if (
    !plan ||
    typeof plan !== "object"
  ) {

    throw new PlanValidationError(
      "Invalid plan contract"
    );

  }


  const candidate =
    plan as Partial<Plan>;



  if (
    typeof candidate.goal !== "string" ||
    !candidate.goal.trim()
  ) {

    throw new PlanValidationError(
      "Plan contract missing goal"
    );

  }



  if (
    !Array.isArray(candidate.steps)
  ) {

    throw new PlanValidationError(
      "Plan contract steps must be an array"
    );

  }



  const steps =
    candidate.steps.map(
      (step) => {

        if (
          !step ||
          typeof step !== "object"
        ) {

          throw new PlanValidationError(
            "Invalid plan step"
          );

        }



        const item =
          step as PlanStep;



        if (
          !item.description
        ) {

          throw new PlanValidationError(
            "Plan step missing description"
          );

        }



        if (
          !isValidAction(
            item.action
          )
        ) {

          throw new PlanValidationError(
            `Invalid plan action: ${String(item.action)}`
          );

        }



        return {

          ...item,

          args:
            item.args ?? {},

        };

      }
    );



  return {

    goal:
      candidate.goal,

    steps,

    files:
      Array.isArray(candidate.files)
        ? candidate.files
        : [],

  };

}



function validateTool(
  step: PlanStep
) {

  if (
    !step.tool
  ) {

    return;

  }



  const tool =
    toolRegistry.get(
      step.tool
    );



  if (
    !tool
  ) {

    throw new PlanValidationError(
      `Unknown tool: ${step.tool}`
    );

  }

}



export function validatePlan(
  plan: Plan
): Plan {

  if (
    !plan ||
    typeof plan !== "object"
  ) {

    throw new PlanValidationError(
      "Invalid plan"
    );

  }



  if (
    typeof plan.goal !== "string" ||
    !plan.goal.trim()
  ) {

    throw new PlanValidationError(
      "Plan missing goal"
    );

  }



  if (
    !Array.isArray(plan.steps)
  ) {

    throw new PlanValidationError(
      "Plan steps must be an array"
    );

  }



  const steps =
    plan.steps.map(
      (step) => {


        if (
          !isValidAction(
            step.action
          )
        ) {

          throw new PlanValidationError(
            `Invalid plan action: ${String(step.action)}`
          );

        }



        if (
          !step.description
        ) {

          throw new PlanValidationError(
            "Plan step missing description"
          );

        }



        validateTool(
          step
        );



        return {

          ...step,

          args:
            step.args ?? {},

        };

      }
    );



  return {

    goal:
      plan.goal,

    steps,

    files:
      plan.files ?? [],

  };

}