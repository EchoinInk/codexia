import type { EngineeringSession } from "./engineering/types";
import type {
  IntelligenceContext,
} from "@/lib/intelligence/intelligence-context";


export interface AgentMessage {
  role: "system" | "user" | "assistant" | "tool";

  content: string;

  name?: string;
}


export type TaskType =
  | "question"
  | "analysis"
  | "modify"
  | "create"
  | "debug"
  | "unknown";


export interface AgentObservation {
  type:
    | "file_read"
    | "file_write"
    | "tool_result"
    | "error";

  summary: string;

  data?: unknown;
}


export interface ToolResult {
  tool: string;

  success: boolean;

  output: unknown;
}


export interface AgentContext {

  engineering?: EngineeringSession;

  messages: AgentMessage[];

  workspace: string;

  intelligence?: IntelligenceContext;

  /** Explicit read-only file context selected by the user in the visible app. */
  contextualFile?: {
    path: string;
    content: string;
  };


  filesRead: string[];

  filesModified: string[];


  observations: AgentObservation[];

  toolResults: ToolResult[];


  currentTask?: string;

  taskType?: TaskType;


  memory?: AgentObservation[];

}


export interface AgentResponse {

  content: string;

  toolUsed?: string;

}


export interface PlannerContext {

  plannerSource?:
    | "rule"
    | "llm"
    | "hybrid";


  plannerFallback?: boolean;


  plannerFallbackReason?: string;

}


export type Msg = AgentMessage;
