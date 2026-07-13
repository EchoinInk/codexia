import type { AgentContext, AgentResponse } from "./types";

import type { AgentState } from "./state";

import { createPlan } from "./planner";

import { executePlan } from "./executor";

import { bootstrapAgent } from "./bootstrap";

import { chatWithOllama } from "@/lib/models/ollama";

export async function runAgent(context: AgentContext): Promise<AgentResponse> {
  bootstrapAgent();

  const state: AgentState = {
    messages: context.messages,

    workspace: context.workspace,

    filesRead: context.filesRead,

    filesModified: context.filesModified,

    currentTask: context.currentTask,

    completedSteps: [],

    observations: [],

    errors: [],

    status: "planning",
  };

  const plan = await createPlan(context);

  state.plan = plan.steps;

  state.status = "executing";

  const execution = await executePlan(plan, context);

  state.observations = execution.context.observations;

  state.status = execution.success ? "complete" : "error";

  const response = await chatWithOllama([
    {
      role: "system",

      content: `
You are Codexia, a local AI coding assistant.

Respond naturally.

Do not reveal:
- plans
- internal state
- tool orchestration
        `.trim(),
    },

    ...context.messages,

    {
      role: "user",

      content: `
Task:
${plan.goal}


Agent results:
${execution.output}


Use these results to answer the user.
          `.trim(),
    },
  ]);

  return {
    content: response,
  };
}
