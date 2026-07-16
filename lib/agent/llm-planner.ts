import type { AgentContext } from "./types";

import type { Plan, Planner } from "./planner";

import { chatWithOllama } from "@/lib/models/ollama";

import { validatePlan, validatePlanContract } from "./plan-validator";

import {
  getRelevantFiles,
  getImpactAnalysis,
  addPlanMetadata,
} from "./planner";

import { toolRegistry } from "@/lib/tools/registry";

import { AGENT_ACTIONS } from "./contracts/action-types";

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
      "action": "one of the available actions provided below",
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
${AGENT_ACTIONS.join(", ")}

`.trim();

function getAvailableTools() {
  return toolRegistry.list().map((tool) => ({
    name: tool.name,

    description: tool.description ?? "",
  }));
}

export const llmPlanner: Planner = {
  async createPlan(context: AgentContext): Promise<Plan> {
    const tools = getAvailableTools();

    const response = await chatWithOllama([
      {
        role: "system",

        content: SYSTEM_PROMPT,
      },

      {
        role: "user",

        content: JSON.stringify({
          task: context.currentTask,

          messages: context.messages,

          workspace: {
            root: context.workspace,

            filesRead: context.filesRead,

            filesModified: context.filesModified,
          },

          intelligence: context.intelligence,

          availableTools: tools,
        }),
      },
    ]);

    let json: unknown;

    try {
      const cleaned = response
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      const match = cleaned.match(/\{[\s\S]*\}/);

      if (!match) {
        throw new Error("No JSON object found in LLM response");
      }

      json = JSON.parse(match[0]);
    } catch {
      console.error("[LLM Planner] Invalid JSON response:", response);

      throw new Error("LLM planner returned invalid JSON");
    }

    const contractValidated = validatePlanContract(json);

    const validated = validatePlan(contractValidated);

    const fileSelection = getRelevantFiles(context, validated.goal);

    const files = fileSelection?.files ?? validated.files;

    const impact = getImpactAnalysis(context, files);

    return addPlanMetadata({
      ...validated,

      files,

      fileSelection,

      impact,
    });
  },
};
