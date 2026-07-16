import {
  toolRegistry,
} from "@/lib/tools/registry";

import type {
  AgentAction,
} from "./action-types";


export interface PlannerToolDefinition {

  name: string;

  description: string;

  actions: AgentAction[];

}


const TOOL_ACTION_MAP: Record<string, AgentAction[]> = {

  read_file: [
    "read",
  ],

  write_file: [
    "write",
  ],

};


function getToolActions(
  toolName: string
): AgentAction[] {

  return (
    TOOL_ACTION_MAP[toolName] ??
    []
  );

}


export function getPlannerTools(): PlannerToolDefinition[] {

  return toolRegistry
    .list()
    .map(tool => ({

      name:
        tool.name,

      description:
        tool.description ?? "",

      actions:
        getToolActions(
          tool.name
        ),

    }));

}