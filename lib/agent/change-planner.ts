import type {
  Plan,
} from "./planner";


export interface FileChange {

  path: string;

  action:
    | "modify"
    | "create"
    | "delete";

  reason: string;

}


export interface ChangePlan {

  goal: string;

  changes: FileChange[];

}



export function createChangePlan(
  plan: Plan
): ChangePlan {

  const changes: FileChange[] =
    plan.files.map(
      file => ({
        path: file,

        action:
          plan.steps.some(
            step =>
              step.action === "write"
          )
            ? "modify"
            : "modify",

        reason:
          plan.goal,
      })
    );


  return {

    goal:
      plan.goal,

    changes,

  };

}