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

  messages: AgentMessage[];

  workspace: string;

  intelligence?: IntelligenceContext;


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