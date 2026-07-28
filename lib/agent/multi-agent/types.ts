import type { AgentContext } from "../types";
import type { Plan, Planner } from "../planner";
import type { WorkflowOptions, WorkflowResult } from "../workflow";

export type AgentRole =
  | "architect"
  | "planner"
  | "executor"
  | "reviewer"
  | "refactorer"
  | "test_writer"
  | "documentation_writer";

export type MultiAgentStage =
  | "idle"
  | "consulting"
  | "planning"
  | "executing"
  | "reviewing"
  | "complete"
  | "failed";

export interface AgentAdvice {
  role: Exclude<AgentRole, "planner" | "executor" | "reviewer">;
  summary: string;
  recommendations: string[];
  risks: string[];
  metadata?: Record<string, unknown>;
}

export interface AgentReview {
  role: "reviewer";
  approved: boolean;
  summary: string;
  findings: string[];
  requiredActions: string[];
}

export interface MultiAgentResult {
  taskId: string;
  stage: MultiAgentStage;
  context: AgentContext;
  advice: AgentAdvice[];
  plan: Plan;
  workflow: WorkflowResult;
  review: AgentReview;
  startedAt: number;
  completedAt: number;
}

export interface SpecialistAgent {
  readonly role: AgentAdvice["role"];
  analyse(input: {
    task: string;
    context: AgentContext;
    plan?: Plan;
    signal?: AbortSignal;
  }): Promise<AgentAdvice>;
}

export interface ReviewerAgent {
  readonly role: "reviewer";
  review(input: {
    task: string;
    context: AgentContext;
    plan: Plan;
    workflow: WorkflowResult;
    advice: readonly AgentAdvice[];
    signal?: AbortSignal;
  }): Promise<AgentReview>;
}

export interface MultiAgentConfiguration {
  enableArchitect: boolean;
  enableRefactorer: boolean;
  enableTestWriter: boolean;
  enableDocumentationWriter: boolean;
  requireReviewerApproval: boolean;
}

export interface MultiAgentDependencies {
  planner: Planner;
  architect: SpecialistAgent;
  refactorer: SpecialistAgent;
  testWriter: SpecialistAgent;
  documentationWriter: SpecialistAgent;
  reviewer: ReviewerAgent;
  runWorkflow: (
    plan: Plan,
    context: AgentContext,
    options?: WorkflowOptions
  ) => Promise<WorkflowResult>;
  createId?: () => string;
  now?: () => number;
}

export type MultiAgentEvent =
  | { type: "task_started"; taskId: string; timestamp: number }
  | { type: "stage_changed"; taskId: string; stage: MultiAgentStage; timestamp: number }
  | { type: "agent_started"; taskId: string; role: AgentRole; timestamp: number }
  | { type: "agent_completed"; taskId: string; role: AgentRole; timestamp: number }
  | { type: "task_completed"; taskId: string; approved: boolean; timestamp: number }
  | { type: "task_failed"; taskId: string; error: string; timestamp: number };

export type MultiAgentEventListener = (event: MultiAgentEvent) => void;
