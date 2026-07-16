export const AGENT_ACTIONS = [
  "analyze",
  "read",
  "write",
  "verify",
] as const;


export type AgentAction =
  typeof AGENT_ACTIONS[number];