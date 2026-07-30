import type {
  Plan,
} from "./planner";

import type {
  ImpactAnalysis,
} from "@/lib/intelligence/impact-analysis";


export interface FileChange {

  path: string;

  action:
    | "modify"
    | "create"
    | "delete";

  reason: string;

  dependencies: string[];

}


export interface ChangeGroup {

  name: string;

  files: string[];

  reason: string;

}


export interface ChangePlan {

  goal: string;

  changes: FileChange[];

  groups: ChangeGroup[];

  order: string[];

  impact?: ImpactAnalysis;

}


export function createChangePlan(
  plan: Plan,
  impact?: ImpactAnalysis
): ChangePlan {

  const files =
    impact?.affectedFiles ??
    plan.files;


  const changes: FileChange[] =
    files.map(
      file => ({

        path:
          file,

        action:
          "modify",

        reason:
          impact?.reasons[file]?.join(
            ", "
          ) ??
          plan.goal,

        dependencies:
          findDependencies(
            file,
            impact
          ),

      })
    );


  const groups =
    createChangeGroups(
      changes
    );


  return {

    goal:
      plan.goal,

    changes,

    groups,

    order:
      createChangeOrder(
        changes
      ),

    impact,

  };

}


function findDependencies(
  file: string,
  impact?: ImpactAnalysis
): string[] {

  if (!impact) {

    return [];

  }


  return Object.entries(
    impact.reasons
  )
    .filter(
      ([, reasons]) =>
        reasons.some(
          reason =>
            reason.includes(file)
        )
    )
    .map(
      ([path]) =>
        path
    );

}



function createChangeGroups(
  changes: FileChange[]
): ChangeGroup[] {

  if (changes.length === 0) {

    return [];

  }


  return [

    {

      name:
        "Primary modification group",

      files:
        changes.map(
          change =>
            change.path
        ),

      reason:
        "Files affected by planned change",

    },

  ];

}



function createChangeOrder(
  changes: FileChange[]
): string[] {

  return changes
    .sort(
      (a, b) =>
        a.dependencies.length -
        b.dependencies.length
    )
    .map(
      change =>
        change.path
    );

}