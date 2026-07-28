import { randomUUID } from "node:crypto";
import type { AgentContext } from "../types";
import type { AgentAdvice, AgentRole, MultiAgentConfiguration, MultiAgentDependencies, MultiAgentResult, MultiAgentStage } from "./types";
import { MultiAgentEventBus } from "./events";

const DEFAULT_CONFIGURATION: MultiAgentConfiguration = {
  enableArchitect: true,
  enableRefactorer: true,
  enableTestWriter: true,
  enableDocumentationWriter: true,
  requireReviewerApproval: true,
};

export class MultiAgentCoordinator {
  private readonly events = new MultiAgentEventBus();
  private readonly configuration: MultiAgentConfiguration;
  private readonly now: () => number;
  private readonly createId: () => string;

  constructor(private readonly dependencies: MultiAgentDependencies, configuration: Partial<MultiAgentConfiguration> = {}) {
    this.configuration = { ...DEFAULT_CONFIGURATION, ...configuration };
    this.now = dependencies.now ?? Date.now;
    this.createId = dependencies.createId ?? randomUUID;
  }

  subscribe = this.events.subscribe.bind(this.events);

  async run(task: string, context: AgentContext, signal?: AbortSignal): Promise<MultiAgentResult> {
    const taskId = this.createId();
    const startedAt = this.now();
    this.events.emit({ type: "task_started", taskId, timestamp: startedAt });

    try {
      this.stage(taskId, "consulting");
      const advice: AgentAdvice[] = [];
      if (this.configuration.enableArchitect) advice.push(await this.specialist(taskId, "architect", () => this.dependencies.architect.analyse({ task, context, signal })));

      this.stage(taskId, "planning");
      this.agent(taskId, "planner", "started");
      const planningContext = this.withAdvice(context, task, advice);
      const plan = await this.dependencies.planner.createPlan(planningContext);
      this.agent(taskId, "planner", "completed");

      if (this.configuration.enableRefactorer && /refactor|cleanup|simplif|technical debt/i.test(task)) {
        advice.push(await this.specialist(taskId, "refactorer", () => this.dependencies.refactorer.analyse({ task, context: planningContext, plan, signal })));
      }
      if (this.configuration.enableTestWriter && plan.steps.some(step => step.action === "write" || step.action === "verify")) {
        advice.push(await this.specialist(taskId, "test_writer", () => this.dependencies.testWriter.analyse({ task, context: planningContext, plan, signal })));
      }
      if (this.configuration.enableDocumentationWriter) {
        advice.push(await this.specialist(taskId, "documentation_writer", () => this.dependencies.documentationWriter.analyse({ task, context: planningContext, plan, signal })));
      }

      this.stage(taskId, "executing");
      this.agent(taskId, "executor", "started");
      const executionContext = this.withAdvice(context, task, advice);
      const workflow = await this.dependencies.runWorkflow(plan, executionContext, { signal });
      this.agent(taskId, "executor", "completed");

      this.stage(taskId, "reviewing");
      this.agent(taskId, "reviewer", "started");
      const review = await this.dependencies.reviewer.review({ task, context: workflow.execution.context, plan, workflow, advice, signal });
      this.agent(taskId, "reviewer", "completed");

      const stage: MultiAgentStage = this.configuration.requireReviewerApproval && !review.approved ? "failed" : "complete";
      this.stage(taskId, stage);
      const completedAt = this.now();
      this.events.emit({ type: "task_completed", taskId, approved: review.approved, timestamp: completedAt });
      return { taskId, stage, context: workflow.execution.context, advice, plan, workflow, review, startedAt, completedAt };
    } catch (error) {
      this.stage(taskId, "failed");
      this.events.emit({ type: "task_failed", taskId, error: error instanceof Error ? error.message : String(error), timestamp: this.now() });
      throw error;
    }
  }

  private withAdvice(context: AgentContext, task: string, advice: readonly AgentAdvice[]): AgentContext {
    const guidance = advice.flatMap(item => item.recommendations.map(value => `[${item.role}] ${value}`));
    if (guidance.length === 0) return { ...context, currentTask: task };
    return {
      ...context,
      currentTask: task,
      messages: [...context.messages, { role: "system", content: `Role-specific guidance:\n${guidance.join("\n")}` }],
    };
  }

  private async specialist(taskId: string, role: AgentAdvice["role"], run: () => Promise<AgentAdvice>): Promise<AgentAdvice> {
    this.agent(taskId, role, "started");
    const result = await run();
    this.agent(taskId, role, "completed");
    return result;
  }

  private stage(taskId: string, stage: MultiAgentStage): void {
    this.events.emit({ type: "stage_changed", taskId, stage, timestamp: this.now() });
  }

  private agent(taskId: string, role: AgentRole, state: "started" | "completed"): void {
    this.events.emit({ type: state === "started" ? "agent_started" : "agent_completed", taskId, role, timestamp: this.now() });
  }
}
