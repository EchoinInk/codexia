import type { AgentContext } from "../types";
import type { Plan } from "../planner";
import type { WorkflowResult } from "../workflow";
import type { AgentAdvice, ReviewerAgent, SpecialistAgent } from "./types";

function memoryRecommendations(context: AgentContext, category: string): string[] {
  const memory = context.intelligence?.memory;
  if (!memory) return [];
  const entries = memory.knowledge[category as keyof typeof memory.knowledge];
  return Array.isArray(entries)
    ? entries.slice(0, 5).map(entry => entry.summary)
    : [];
}

abstract class BaseSpecialist implements SpecialistAgent {
  abstract readonly role: AgentAdvice["role"];
  protected abstract createRecommendations(task: string, context: AgentContext, plan?: Plan): string[];

  async analyse(input: { task: string; context: AgentContext; plan?: Plan; signal?: AbortSignal }): Promise<AgentAdvice> {
    if (input.signal?.aborted) throw new Error(`${this.role} analysis cancelled`);
    const recommendations = this.createRecommendations(input.task, input.context, input.plan);
    return {
      role: this.role,
      summary: recommendations.length > 0
        ? `${this.role} produced ${recommendations.length} recommendation(s).`
        : `${this.role} found no additional action required.`,
      recommendations,
      risks: [],
    };
  }
}

export class ArchitectAgent extends BaseSpecialist {
  readonly role = "architect" as const;
  protected createRecommendations(_task: string, context: AgentContext): string[] {
    return memoryRecommendations(context, "architecture");
  }
}

export class RefactorerAgent extends BaseSpecialist {
  readonly role = "refactorer" as const;
  protected createRecommendations(_task: string, context: AgentContext, plan?: Plan): string[] {
    const files = plan?.files ?? [];
    return [
      ...memoryRecommendations(context, "preferredPatterns"),
      ...(files.length > 10 ? ["Keep the refactor incremental; split unrelated file groups into separate tasks."] : []),
    ];
  }
}

export class TestWriterAgent extends BaseSpecialist {
  readonly role = "test_writer" as const;
  protected createRecommendations(_task: string, _context: AgentContext, plan?: Plan): string[] {
    const writes = plan?.steps.filter(step => step.action === "write").length ?? 0;
    return writes > 0
      ? ["Add or update tests for changed behaviour and cover failure paths."]
      : [];
  }
}

export class DocumentationWriterAgent extends BaseSpecialist {
  readonly role = "documentation_writer" as const;
  protected createRecommendations(task: string, _context: AgentContext, plan?: Plan): string[] {
    const architectural = /architecture|runtime|workflow|contract|roadmap/i.test(task);
    return architectural || (plan?.files.some(file => file.startsWith("lib/")) ?? false)
      ? ["Update affected architecture or roadmap documentation so it matches implementation."]
      : [];
  }
}

export class DefaultReviewerAgent implements ReviewerAgent {
  readonly role = "reviewer" as const;

  async review(input: {
    task: string;
    context: AgentContext;
    plan: Plan;
    workflow: WorkflowResult;
    advice: readonly AgentAdvice[];
    signal?: AbortSignal;
  }) {
    if (input.signal?.aborted) throw new Error("review cancelled");
    const findings: string[] = [];
    if (!input.workflow.execution.success) findings.push("Execution did not complete successfully.");
    if (!input.workflow.validation.valid) findings.push(...input.workflow.validation.errors);
    const approved = findings.length === 0;
    return {
      role: "reviewer" as const,
      approved,
      summary: approved ? "Reviewer approved the bounded workflow result." : "Reviewer found blocking issues.",
      findings,
      requiredActions: approved ? [] : findings.map(finding => `Resolve: ${finding}`),
    };
  }
}
