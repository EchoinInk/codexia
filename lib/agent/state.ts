import type {
  AgentMessage
} from "./types";


export interface AgentState {

  messages: AgentMessage[];


  workspace: string;


  filesRead: string[];


  filesModified: string[];


  currentTask?: string;


  plan?: string[];


  status:
    | "planning"
    | "executing"
    | "complete"
    | "error";

}