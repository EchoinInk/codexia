import type { AgentContext } from "./types";

import type { Plan, PlanStep } from "./planner";

import { toolRegistry } from "@/lib/tools";

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
    const result = await executeStep(step);

    results.push(result);
  }

  return {
    success: true,

    output: [`Task: ${plan.goal}`, ...results].join("\n"),

    filesModified: context.filesModified,
  };
}

async function executeStep(step: PlanStep): Promise<string> {
  if (!step.tool) {
    return `Completed: ${step.description}`;
  }

  const tool = toolRegistry.get(step.tool);

  if (!tool) {
    return `Skipped ${step.description}: ` + `Tool "${step.tool}" not found`;
  }

  const result = await tool.execute(step.args ?? {});

  return `${step.description}: ` + JSON.stringify(result);
}
