import type { Plan, PlanStep } from "./planner";

import type { AgentContext } from "./types";

import { toolRegistry } from "@/lib/tools";

import { createObservation } from "./observation";

import {
  addObservation,
  addToolResult,
  addFileRead,
  addFileModified,
} from "./context";

import { validateExecution } from "./patch-validator";

import { runVerification } from "./verification";

import { analyseFailures } from "./failure-analyzer";

import { createProgress } from "./progress";

import {
  createChangeSummary,
  addAction,
  addVerification,
} from "./change-summary";

import { resolveActionTool } from "./action-resolver";
import { validateToolStep, requiresVerification } from "@/lib/tools/validation";
import { getWorkspaceRoot } from "@/lib/fs-safe";

export interface ExecutionResult {
  success: boolean;

  output: string;

  filesModified: string[];

  context: AgentContext;
}

/** Optional execution controls supplied by a workflow coordinator. */
export interface ExecutionOptions {
  signal?: AbortSignal;
}

export async function executePlan(
  plan: Plan,
  context: AgentContext,
  options: ExecutionOptions = {}
): Promise<ExecutionResult> {
  let updatedContext = { ...context, workspace: getWorkspaceRoot(context.workspace) };
  // Validate the entire plan before any tool or verification script can run.
  try { for (const step of plan.steps) validateToolStep(step); }
  catch (error) {
    const output = error instanceof Error ? error.message : String(error);
    updatedContext = addObservation(updatedContext, createObservation(output, "error"));
    return { success: false, output: `Execution prevented: ${output}`, filesModified: [], context: updatedContext };
  }

  let summary = createChangeSummary();

  const results: string[] = [];

  updatedContext = addObservation(
    updatedContext,
    createObservation(
      createProgress("applying_changes", "Executing plan").message
    )
  );

  for (const step of plan.steps) {
    if (options.signal?.aborted) {
      updatedContext = addObservation(
        updatedContext,
        createObservation("Execution cancelled", "error")
      );
      results.push("Execution cancelled");
      break;
    }

    summary = addAction(summary, step.description);

    const result = await executeStep(step, updatedContext.workspace, options);

    results.push(result.output);

    updatedContext = addObservation(
      updatedContext,
      createObservation(result.output, result.success ? "tool_result" : "error")
    );

    if (result.tool) {
      updatedContext = addToolResult(updatedContext, {
        tool: result.tool,
        success: result.success,
        output: result.output,
      });
    }

    if (
      result.success &&
      result.tool === "read_file" &&
      step.args?.path
    ) {
      updatedContext = addFileRead(
        updatedContext,
        String(step.args.path)
      );
    }

    if (
      result.success &&
      result.tool === "write_file" &&
      step.args?.path
    ) {
      updatedContext = addFileModified(
        updatedContext,
        String(step.args.path)
      );
    }
  }

  const shouldVerify = requiresVerification(plan.steps);

  const verification =
    shouldVerify
      ? await runVerification(options.signal, updatedContext.workspace)
      : [];

  if (shouldVerify) {
    updatedContext = addObservation(
      updatedContext,
      createObservation(
        createProgress("verifying", "Running verification").message
      )
    );
  }

  for (const result of verification) {
    summary = addVerification(
      summary,
      result.success ? `${result.command}: passed` : `${result.command}: failed`
    );
  }

  const failure = analyseFailures(verification);

  if (failure.failed) {
    updatedContext = addObservation(
      updatedContext,
      createObservation(failure.failures.join("\n"), "error")
    );
  }

  const validation = validateExecution(updatedContext);

  return {
    success: validation.valid && !failure.failed,

    output: [
      `Task: ${plan.goal}`,

      ...results,

      shouldVerify
        ? "Verification:"
        : "Verification skipped: read-only plan",

      ...summary.verification,
    ].join("\n"),

    filesModified: updatedContext.filesModified,

    context: updatedContext,
  };
}

async function executeStep(step: PlanStep, workspace: string, options: ExecutionOptions) {
  const toolName = step.tool ?? resolveActionTool(step.action);

  if (!toolName) {
    return {
      success: true,

      output: `Completed: ${step.description}`,
    };
  }

  const tool = toolRegistry.get(toolName);

  if (!tool) {
    return {
      success: false,

      output: `Tool "${toolName}" not found`,
    };
  }

  try {
    validateToolStep(step);
    const output = await tool.execute(step.args ?? {}, { workspace, signal: options.signal });

    return {
      success: true,

      tool: toolName,

      output: JSON.stringify(output),
    };
  } catch (error) {
    return {
      success: false,

      tool: toolName,

      output: error instanceof Error ? error.message : String(error),
    };
  }
}
