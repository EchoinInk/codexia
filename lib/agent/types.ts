export interface AgentMessage {
  role:
    | "user"
    | "assistant"
    | "system"
    | "tool";

  content: string;

  name?: string;
}



export interface AgentContext {

  messages: AgentMessage[];

  workspace: string;

  filesRead: string[];

  filesModified: string[];

}



export interface AgentResponse {

  content: string;

  toolUsed?: string;

}



export type Msg = AgentMessage;