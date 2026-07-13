import type { AgentContext, TaskType } from "./types";

export interface TaskAnalysis {
  type: TaskType;

  requiresTools: boolean;
}

export function analyseTask(context: AgentContext): TaskAnalysis {
  const message =
    context.messages[context.messages.length - 1]?.content.toLowerCase() ?? "";

  if (
    message.includes("explain") ||
    message.includes("what") ||
    message.includes("why")
  ) {
    return {
      type: "question",

      requiresTools: true,
    };
  }

  if (
    message.includes("fix") ||
    message.includes("debug") ||
    message.includes("error")
  ) {
    return {
      type: "debug",

      requiresTools: true,
    };
  }

  if (
    message.includes("create") ||
    message.includes("add") ||
    message.includes("new")
  ) {
    return {
      type: "create",

      requiresTools: true,
    };
  }

  if (
    message.includes("change") ||
    message.includes("update") ||
    message.includes("modify") ||
    message.includes("edit")
  ) {
    return {
      type: "modify",

      requiresTools: true,
    };
  }

  return {
    type: "unknown",

    requiresTools: false,
  };
}
