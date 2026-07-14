import type {
  AgentContext,
  AgentMessage,
  AgentObservation,
  ToolResult,
} from "./types";


import {
  createWorkspaceIndex,
} from "@/lib/intelligence/workspace-index";


import {
  createIntelligenceContext,
} from "@/lib/intelligence/intelligence-context";


import {
  createMemory,
} from "./memory";


import type {
  AgentProgress,
} from "./progress";


import type {
  ChangeSummary,
} from "./change-summary";



export async function createContext(
  messages: AgentMessage[],
  workspace: string
): Promise<AgentContext> {


  const workspaceIndex =
    await createWorkspaceIndex();


  const intelligence =
    createIntelligenceContext(
      workspaceIndex
    );


  return {

    messages,

    workspace,

    intelligence,

    filesRead: [],

    filesModified: [],

    observations: [],

    toolResults: [],

    memory:
      [],

  };

}



export function addObservation(
  context: AgentContext,
  observation: AgentObservation
): AgentContext {

  return {

    ...context,

    observations: [
      ...context.observations,
      observation,
    ],

  };

}



export function addToolResult(
  context: AgentContext,
  result: ToolResult
): AgentContext {

  return {

    ...context,

    toolResults: [
      ...context.toolResults,
      result,
    ],

  };

}