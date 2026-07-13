import type {
  AgentContext,
  AgentResponse
} from "./types";

import type {
  AgentState
} from "./state";

import {
  createPlan
} from "./planner";

import {
  executePlan
} from "./executor";

import {
  bootstrapAgent
} from "./bootstrap";

import {
  chatWithOllama
} from "@/lib/models/ollama";



export async function runAgent(
  context: AgentContext
): Promise<AgentResponse> {


  console.log("AGENT START");



  bootstrapAgent();



  const state: AgentState = {

    messages:
      context.messages,


    workspace:
      context.workspace,


    filesRead:
      context.filesRead,


    filesModified:
      context.filesModified,


    currentTask:
      context.currentTask,


    status:
      "planning",

  };



  console.log("CREATING PLAN");



  const plan =
    await createPlan(context);



  console.log(
    "PLAN CREATED",
    plan
  );



  state.plan =
    plan.steps;



  state.status =
    "executing";



  console.log(
    "EXECUTING PLAN"
  );



  const result =
    await executePlan(
      plan,
      context
    );



  console.log(
    "EXECUTOR RESULT",
    result
  );



  state.status =
    result.success
      ? "complete"
      : "error";




  const ollamaMessages = [

    {
      role:
        "system" as const,

      content:
        `
You are Codexia, a local AI coding assistant.

Answer the user's message directly.

Do not mention:
- internal plans
- execution steps
- agent state
- tool orchestration

Only explain relevant results naturally.
        `.trim(),

    },


    ...context.messages,



    {
      role:
        "user" as const,


      content:
        `
Internal agent information:

Task:
${plan.goal}


Execution summary:
${result.output}


Use this information only to help answer the user.
Do not expose the internal execution process.
        `.trim(),

    },

  ];



  console.log(
    "CALLING OLLAMA",
    ollamaMessages
  );



  const finalResponse =
    await chatWithOllama(
      ollamaMessages
    );



  console.log(
    "OLLAMA RESPONSE",
    finalResponse
  );



  return {

    content:
      finalResponse,

  };

}