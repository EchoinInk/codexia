import { createContext } from "../context";
import { getPlanner } from "../planner-index";
import { runWorkflow } from "../workflow";
import { ArchitectAgent, DefaultReviewerAgent, DocumentationWriterAgent, RefactorerAgent, TestWriterAgent } from "./agents";
import { MultiAgentCoordinator } from "./coordinator";
import type { MultiAgentConfiguration, MultiAgentDependencies } from "./types";

export interface CreateMultiAgentCoordinatorOptions {
  configuration?: Partial<MultiAgentConfiguration>;
  dependencies?: Partial<MultiAgentDependencies>;
}

export function createMultiAgentCoordinator(options: CreateMultiAgentCoordinatorOptions = {}): MultiAgentCoordinator {
  const overrides = options.dependencies;
  return new MultiAgentCoordinator({
    planner: overrides?.planner ?? getPlanner(),
    architect: overrides?.architect ?? new ArchitectAgent(),
    refactorer: overrides?.refactorer ?? new RefactorerAgent(),
    testWriter: overrides?.testWriter ?? new TestWriterAgent(),
    documentationWriter: overrides?.documentationWriter ?? new DocumentationWriterAgent(),
    reviewer: overrides?.reviewer ?? new DefaultReviewerAgent(),
    runWorkflow: overrides?.runWorkflow ?? runWorkflow,
    createId: overrides?.createId,
    now: overrides?.now,
  }, options.configuration);
}

export async function runMultiAgentTask(message: string, workspace: string, options: CreateMultiAgentCoordinatorOptions = {}) {
  const context = await createContext([{ role: "user", content: message }], workspace);
  return createMultiAgentCoordinator(options).run(message, context);
}
