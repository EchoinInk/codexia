import type { AgentContext, AgentResponse } from "./types";

import type { AgentState } from "./state";

import { createPlan } from "./planner";

import { executePlan } from "./executor";

import { bootstrapAgent } from "./bootstrap";

export async function runAgent(context: AgentContext): Promise<AgentResponse> {
  bootstrapAgent();

  const state: AgentState = {
    messages: context.messages,

    workspace: context.workspace,

    filesRead: context.filesRead,

    filesModified: context.filesModified,

    currentTask: context.currentTask,

    status: "planning",
  };

  const plan = await createPlan(context);

  state.plan = plan.steps;

  state.status = "executing";

  const result = await executePlan(plan, context);

  state.status = result.success ? "complete" : "error";

  return {
    content: result.output,
  };
}
