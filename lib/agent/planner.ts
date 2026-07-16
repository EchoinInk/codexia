import type { AgentContext } from "./types";

import { selectRelevantFiles } from "@/lib/intelligence/file-selector";

import type { ImpactAnalysis } from "@/lib/intelligence/impact-analysis";

import type { AgentAction } from "./contracts/action-types";

export interface PlanStep {
  description: string;

  action: AgentAction;

  tool?: string;

  args?: Record<string, unknown>;
}

export interface Plan {
  goal: string;

  steps: PlanStep[];

  files: string[];

  fileSelection?: {
    files: string[];

    reason: string;
  };

  impact?: ImpactAnalysis;

  metadata?: {
    complexity: "low" | "medium" | "high";

    architectureAware: boolean;
  };
}

export interface Planner {
  createPlan(context: AgentContext): Promise<Plan>;
}

export function getRelevantFiles(context: AgentContext, task: string) {
  if (!context.intelligence) {
    return undefined;
  }

  return selectRelevantFiles(context.intelligence, task);
}

export function getImpactAnalysis(context: AgentContext, files: string[]) {
  if (!context.intelligence) {
    return undefined;
  }

  return context.intelligence.analyseImpact(files);
}

export function addPlanMetadata(plan: Plan): Plan {
  const complexity =
    plan.files.length > 20 ? "high" : plan.files.length > 5 ? "medium" : "low";

  return {
    ...plan,

    metadata: {
      complexity,

      architectureAware: true,
    },
  };
}
