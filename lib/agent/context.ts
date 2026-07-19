import type {
  AgentContext,
  AgentMessage,
  AgentObservation,
  ToolResult,
} from "./types";

import {
  getWorkspaceIndex,
  markWorkspaceDirty,
} from "@/lib/intelligence/workspace-index-manager";

import { createIntelligenceContext } from "@/lib/intelligence/intelligence-context";

export async function createContext(
  messages: AgentMessage[],
  workspace: string
): Promise<AgentContext> {
  const workspaceIndex = await getWorkspaceIndex(workspace);

  const intelligence = createIntelligenceContext(workspaceIndex);

  return {
    messages,

    workspace,

    intelligence,

    filesRead: [],

    filesModified: [],

    observations: [],

    toolResults: [],

    memory: [],
  };
}

export function addObservation(
  context: AgentContext,
  observation: AgentObservation
): AgentContext {
  return {
    ...context,

    observations: [...context.observations, observation],
  };
}

export function addToolResult(
  context: AgentContext,
  result: ToolResult
): AgentContext {
  return {
    ...context,

    toolResults: [...context.toolResults, result],
  };
}

export function addFileRead(context: AgentContext, path: string): AgentContext {
  return {
    ...context,

    filesRead: context.filesRead.includes(path)
      ? context.filesRead
      : [...context.filesRead, path],
  };
}

export function addFileModified(
  context: AgentContext,
  path: string
): AgentContext {
  markWorkspaceDirty(
    context.workspace
  );

  return {
    ...context,

    filesModified: context.filesModified.includes(path)
      ? context.filesModified
      : [...context.filesModified, path],
  };
}
