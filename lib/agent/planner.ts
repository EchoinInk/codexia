import type { AgentContext } from "./types";

export interface PlanStep {
  description: string;

  action: "analyze" | "read" | "write" | "verify";

  tool?: string;

  args?: Record<string, unknown>;
}

export interface Plan {
  goal: string;

  steps: PlanStep[];

  files: string[];
}

export async function createPlan(context: AgentContext): Promise<Plan> {
  const lastMessage = context.messages[context.messages.length - 1];

  const goal =
    context.currentTask ?? lastMessage?.content ?? "No task provided";

  return {
    goal,

    steps: [
      {
        description: "Analyze request",

        action: "analyze",
      },

      {
        description: "Inspect workspace files",

        action: "read",

        tool: "list_files",

        args: {},
      },

      {
        description: "Determine required changes",

        action: "analyze",
      },

      {
        description: "Apply changes",

        action: "write",
      },

      {
        description: "Verify result",

        action: "verify",
      },
    ],

    files: [],
  };
}
