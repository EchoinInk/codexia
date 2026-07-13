import type { AgentMessage, AgentObservation } from "./types";

import type { PlanStep } from "./planner";

export interface AgentState {
  messages: AgentMessage[];

  workspace: string;

  filesRead: string[];

  filesModified: string[];

  currentTask?: string;

  plan?: PlanStep[];

  currentStep?: number;

  completedSteps: number[];

  observations: AgentObservation[];

  errors: string[];

  status: "planning" | "executing" | "complete" | "error";
}
