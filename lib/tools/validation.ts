import type { PlanStep } from "@/lib/agent/planner";
import { resolveActionTool } from "@/lib/agent/action-resolver";
import { toolRegistry } from "./registry";
import type { Tool } from "./types";

export function stepTool(step: PlanStep): Tool | undefined {
  const name = step.tool ?? resolveActionTool(step.action);
  if (!name) return undefined;
  const tool = toolRegistry.get(name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  return tool;
}

export function validateToolStep(step: PlanStep): Tool | undefined {
  if (!step || !["read", "write", "analyze", "verify"].includes(step.action)) throw new Error("Invalid plan action");
  const tool = stepTool(step);
  if (!tool) return undefined; // verify remains a Workflow stage, never a tool.
  if (!tool.actions?.includes(step.action)) throw new Error(`Tool ${tool.name} cannot execute as ${step.action}`);
  const args = step.args ?? {};
  if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error(`Invalid arguments for ${tool.name}`);
  tool.validate(args);
  if (tool.capability !== "read" || tool.requiresConfirmation) {
    throw new Error(`Tool ${tool.name} requires reviewed authority; use the existing reviewed change Workflow. Legacy mutations are unavailable.`);
  }
  return tool;
}

export function requiresVerification(steps: PlanStep[]): boolean {
  return steps.some(step => {
    const tool = stepTool(step);
    return step.action === "verify" || (tool !== undefined && tool.capability !== "read");
  });
}
