export interface AgentMessage {
  role: "system" | "user" | "assistant" | "tool";

  content: string;

  name?: string;
}

export interface AgentContext {
  messages: AgentMessage[];

  workspace: string;

  filesRead: string[];

  filesModified: string[];

  currentTask?: string;
}

export interface AgentResponse {
  content: string;

  toolUsed?: string;
}

export type Msg = AgentMessage;
