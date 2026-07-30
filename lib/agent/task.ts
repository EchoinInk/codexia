import type { AgentContext, TaskType } from "./types";

export interface TaskAnalysis {
  type: TaskType;

  requiresTools: boolean;
}

export function analyseTask(context: AgentContext): TaskAnalysis {
  const message =
    context.messages[context.messages.length - 1]?.content.toLowerCase() ?? "";

  const mentionsWorkspace =
    message.includes("workspace") ||
    message.includes("codebase") ||
    message.includes("repository") ||
    message.includes("repo") ||
    message.includes("project");

  const requestsWorkspaceAnalysis =
    mentionsWorkspace &&
    (
      message.includes("analyse") ||
      message.includes("analyze") ||
      message.includes("explain") ||
      message.includes("inspect") ||
      message.includes("scan") ||
      message.includes("summarise") ||
      message.includes("summarize") ||
      message.includes("files")
    );

  if (requestsWorkspaceAnalysis) {
    return {
      type: "analysis",

      requiresTools: true,
    };
  }

  const requestsFileList =
    (
      message.includes("what files") ||
      message.includes("list files") ||
      message.includes("show files")
    ) &&
    (
      mentionsWorkspace ||
      message.includes("here")
    );

  if (requestsFileList) {
    return {
      type: "analysis",

      requiresTools: true,
    };
  }

  if (
    message.endsWith("?") ||
    message.includes("would you like") ||
    message.includes("do you want") ||
    message.includes("should i")
  ) {
    return {
      type: "question",

      requiresTools: false,
    };
  }

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
