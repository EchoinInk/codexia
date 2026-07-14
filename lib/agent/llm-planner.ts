import type {
  AgentContext,
} from "./types";

import type {
  Plan,
  Planner,
} from "./planner";

import {
  chatWithOllama,
} from "@/lib/models/ollama";

import {
  validatePlan,
} from "./plan-validator";

import {
  getRelevantFiles,
} from "./planner";

import {
  toolRegistry,
} from "@/lib/tools/registry";


const SYSTEM_PROMPT = `
You are Codexia's planning system.

Convert user requests into execution plans.

Return ONLY valid JSON.

Format:

{
  "goal": "string",
  "steps": [
    {
      "description": "string",
      "action": "analyze | read | write | verify",
      "tool": "optional tool name",
      "args": {}
    }
  ],
  "files": []
}

Rules:

- Do not execute actions.
- Do not modify files.
- Use only available tools.
- Consider workspace context.
- Consider previous memory.
- Avoid repeating completed work.
- Prefer inspection before modification.
- Keep plans minimal.
`.trim();


function getAvailableTools() {

  return toolRegistry
    .list()
    .map((tool) => ({
      name: tool.name,

      description:
        tool.description ?? "",
    }));

}


export const llmPlanner: Planner = {

  async createPlan(
    context: AgentContext
  ): Promise<Plan> {


    const tools =
      getAvailableTools();


    const response =
      await chatWithOllama([

        {
          role: "system",

          content:
            SYSTEM_PROMPT,
        },


        {
          role: "user",

          content:
            JSON.stringify({

              task:
                context.currentTask,


              messages:
                context.messages,


              workspace:
                {
                  root:
                    context.workspace,

                  filesRead:
                    context.filesRead,

                  filesModified:
                    context.filesModified,
                },


              memory:
{
  currentTask:
    context.currentTask,

  filesRead:
    context.filesRead,

  filesModified:
    context.filesModified,

  messageCount:
    context.messages.length,
},


              availableTools:
                tools,

            }),
        },

      ]);


    let json: unknown;


    try {

      json =
        JSON.parse(response);

    } catch {

      throw new Error(
        "LLM planner returned invalid JSON"
      );

    }


    const plan =
      validatePlan(
        json as Plan
      );


    const fileSelection =
      getRelevantFiles(
        context,
        plan.goal
      );


    return {
      ...plan,

      files:
        fileSelection?.files ?? plan.files,

      fileSelection,
    };

  },

};