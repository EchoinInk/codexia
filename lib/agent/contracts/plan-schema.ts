import type {
  AgentAction,
} from "./action-types";


export interface AgentPlanStep {

  description:string;

  action:AgentAction;

  tool?:string;

  args?:Record<string, unknown>;

}


export interface AgentPlan {

  goal:string;

  steps:AgentPlanStep[];

  files:string[];

}