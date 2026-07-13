import type {
  AgentMessage
} from "./types";


import type {
  PlanStep
} from "./planner";


export interface AgentState {

  messages: AgentMessage[];

  workspace: string;

  filesRead: string[];

  filesModified: string[];

  currentTask?: string;

  plan?: PlanStep[];

  status:
    | "planning"
    | "executing"
    | "complete"
    | "error";

}