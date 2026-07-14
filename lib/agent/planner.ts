import type { AgentContext } from "./types";


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
}


export interface Planner {
  createPlan(
    context: AgentContext
  ): Promise<Plan>;
}