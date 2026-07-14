import type { AgentContext } from "./types";

import {
  selectRelevantFiles,
} from "@/lib/intelligence/file-selector";


export interface PlanStep {
  description: string;

  action:
    | "analyze"
    | "read"
    | "write"
    | "verify";

  tool?: string;

  args?: Record<string, unknown>;
}


export interface Plan {
  goal: string;

  steps: PlanStep[];

  files: string[];

  fileSelection?: {
    files: string[];

    reason: string;
  };
}


export interface Planner {

  createPlan(
    context: AgentContext
  ): Promise<Plan>;

}



export function getRelevantFiles(
  context: AgentContext,
  task: string
) {

  if (!context.intelligence) {
    return undefined;
  }


  return selectRelevantFiles(
    context.intelligence,
    task
  );

}