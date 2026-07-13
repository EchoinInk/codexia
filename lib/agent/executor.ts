import type { AgentContext } from "./types";

import type { Plan } from "./planner";

export interface ExecutionResult {
  success: boolean;

  output: string;

  filesModified: string[];
}

export async function executePlan(
  plan: Plan,
  context: AgentContext
): Promise<ExecutionResult> {
  const results: string[] = [];

  for (const step of plan.steps) {
    results.push(`Completed: ${step}`);
  }

  return {
    success: true,

    output: [`Task: ${plan.goal}`, ...results].join("\n"),

    filesModified: context.filesModified,
  };
}
