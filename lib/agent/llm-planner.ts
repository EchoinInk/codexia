import type { AgentContext } from "./types";

import type {
  Plan,
  Planner,
} from "./planner";

import {
  chatWithOllama,
} from "@/lib/models/ollama";

import {
  validatePlan,
  validatePlanContract,
} from "./plan-validator";

import {
  getRelevantFiles,
  getImpactAnalysis,
  addPlanMetadata,
} from "./planner";

import {
  toolRegistry,
} from "@/lib/tools/registry";

import {
  AGENT_ACTIONS,
} from "./contracts/action-types";


const SYSTEM_PROMPT = `
You are Codexia's planning system.

Your job is to convert user requests into execution plans.

Return ONLY valid JSON.
Do not include markdown.
Do not include explanations.

A plan contains ACTIONS and optional TOOLS.

IMPORTANT:

"action" describes the high-level operation.

Valid actions are ONLY:

${AGENT_ACTIONS.join(", ")}

Never put tool names into "action".

Tools are separate execution helpers.

Examples:

VALID:

{
  "description": "Inspect workspace files",
  "action": "read",
  "tool": "list_files",
  "args": {}
}

VALID:

{
  "description": "Read a source file",
  "action": "read",
  "tool": "read_file",
  "args": {
    "path": "lib/example.ts"
  }
}

INVALID:

{
  "description": "Inspect workspace files",
  "action": "list_files"
}

INVALID:

{
  "description": "Read source",
  "action": "read_file"
}


Plan format:

{
  "goal": "string",
  "steps": [
    {
      "description": "string",
      "action": "${AGENT_ACTIONS.join(" | ")}",
      "tool": "optional tool name",
      "args": {}
    }
  ],
  "files": []
}


Rules:

- Do not execute actions.
- Do not modify files.
- Consider workspace architecture.
- Consider dependency relationships.
- Prefer inspection before modification.
- Keep plans minimal.
- Never use read_file on directories.
- Use list_files before reading unknown paths.
- Workspace roots must be inspected with list_files.
- Filesystem tools belong in "tool", never "action".

Available actions:
${AGENT_ACTIONS.join(", ")}

`.trim();


function getAvailableTools() {

  return toolRegistry.list().map((tool) => ({

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

              workspace: {

                root:
                  context.workspace,

                filesRead:
                  context.filesRead,

                filesModified:
                  context.filesModified,

              },

              intelligence:
                context.intelligence,

              availableTools:
                tools,

            }),

        },

      ]);


    let json: unknown;


    try {

      const cleaned =
        response
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();


      const match =
        cleaned.match(/\{[\s\S]*\}/);


      if (!match) {

        throw new Error(
          "No JSON object found in LLM response"
        );

      }


      json =
        JSON.parse(
          match[0]
        );


    } catch {

      console.error(
        "[LLM Planner] Invalid JSON response:",
        response
      );


      throw new Error(
        "LLM planner returned invalid JSON"
      );

    }


    const contractValidated =
      validatePlanContract(
        json
      );


    const validated =
      validatePlan(
        contractValidated
      );


    const fileSelection =
      getRelevantFiles(
        context,
        validated.goal
      );


    const files =
      fileSelection?.files ??
      validated.files;


    const impact =
      getImpactAnalysis(
        context,
        files
      );


    return addPlanMetadata({

      ...validated,

      files,

      fileSelection,

      impact,

    });

  },

};