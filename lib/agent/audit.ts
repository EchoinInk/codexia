import type {
  AgentContext,
} from "./types";


export interface AgentAuditResult {

  healthy: boolean;

  warnings: string[];

  metrics: {

    messages: number;

    observations: number;

    toolsUsed: number;

    filesRead: number;

    filesModified: number;

  };

}



export function auditAgentContext(
  context: AgentContext
): AgentAuditResult {

  const warnings: string[] = [];


  if (
    context.messages.length === 0
  ) {

    warnings.push(
      "Agent has no messages"
    );

  }


  if (
    context.observations.length === 0
  ) {

    warnings.push(
      "No execution observations recorded"
    );

  }


  if (
    context.toolResults.length === 0
  ) {

    warnings.push(
      "No tool execution results recorded"
    );

  }


  return {

    healthy:
      warnings.length === 0,


    warnings,


    metrics: {

      messages:
        context.messages.length,


      observations:
        context.observations.length,


      toolsUsed:
        context.toolResults.length,


      filesRead:
        context.filesRead.length,


      filesModified:
        context.filesModified.length,

    },

  };

}