import type {
  Plan,
  PlanStep,
} from "./planner";

import {
  toolRegistry,
} from "../tools/registry";


const VALID_ACTIONS = [
  "analyze",
  "inspect",
  "dependency_analysis",
  "read",
  "write",
  "delete",
  "verify",
  "list",
  "list_files",
  "git",
] as const;


function isValidAction(
  action: unknown
): action is PlanStep["action"] {

  return (
    typeof action === "string" &&
    VALID_ACTIONS.includes(
      action as PlanStep["action"]
    )
  );

}


function validateTool(
  step: PlanStep
) {

  if (
    !step.tool ||
    step.tool === "None" ||
    step.tool === "none"
  ) {
    return;
  }


  const tool =
    toolRegistry.get(
      step.tool
    );


  if (!tool) {

    throw new Error(
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

    throw new Error(
      "Invalid plan"
    );

  }


  if (
    typeof plan.goal !== "string" ||
    !plan.goal.trim()
  ) {

    throw new Error(
      "Plan missing goal"
    );

  }


  if (
    !Array.isArray(plan.steps)
  ) {

    throw new Error(
      "Plan steps must be an array"
    );

  }


  const steps =
    plan.steps.map(
      (step) => {


        if (
          !step.description
        ) {

          throw new Error(
            "Plan step missing description"
          );

        }


        if (
          !isValidAction(
            step.action
          )
        ) {

          throw new Error(
            `Invalid plan action: ${step.action}`
          );

        }


        validateTool(step);


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