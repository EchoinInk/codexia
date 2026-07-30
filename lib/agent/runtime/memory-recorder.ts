import {
  loadWorkspaceMemorySnapshot,
  rememberWorkspaceFailure,
  rememberWorkspaceFix,
} from "@/lib/intelligence/workspace-memory";

import type {
  RuntimeMemoryRecorder,
} from "./types";


const DETAILS_LIMIT = 2_000;


/**
 * Bridges runtime outcomes into durable Workspace Memory without moving
 * learning responsibilities into the bounded Workflow.
 */
export class WorkspaceRuntimeMemoryRecorder implements RuntimeMemoryRecorder {
  async recordIteration(
    input: Parameters<RuntimeMemoryRecorder["recordIteration"]>[0]
  ): ReturnType<RuntimeMemoryRecorder["recordIteration"]> {
    const workspace =
      input.context.workspace;

    if (!input.success) {
      await rememberWorkspaceFailure(
        workspace,
        {
          summary:
            getFailureSummary(
              input
            ),

          details:
            truncate(
              input.workflow.execution.output
            ),

          files:
            input.workflow.execution.filesModified,

          source:
            "runtime",

          confidence:
            1,

          metadata: {
            goal:
              input.state.goal,

            iteration:
              input.state.iteration,
          },
        }
      );

      return;
    }

    const memory =
      await loadWorkspaceMemorySnapshot(
        workspace
      );

    const previousFailure =
      memory.knowledge.previousFailures.find(
        entry =>
          !entry.resolvedAt &&
          entry.metadata?.goal === input.state.goal
      );

    if (!previousFailure) {
      return;
    }

    await rememberWorkspaceFix(
      workspace,
      {
        summary:
          `Resolved runtime failure for: ${input.state.goal}`,

        details:
          truncate(
            input.workflow.execution.output
          ),

        files:
          input.workflow.execution.filesModified,

        source:
          "runtime",

        confidence:
          1,

        relatedFailureId:
          previousFailure.id,

        metadata: {
          goal:
            input.state.goal,

          iteration:
            input.state.iteration,
        },
      }
    );
  }
}


function getFailureSummary(
  input: Parameters<RuntimeMemoryRecorder["recordIteration"]>[0]
): string {
  const errors =
    input.context.observations
      .filter(
        observation =>
          observation.type === "error"
      )
      .map(
        observation =>
          observation.summary.trim()
      )
      .filter(Boolean);

  if (errors.length > 0) {
    return truncate(
      errors[
        errors.length - 1
      ],
      500
    );
  }

  return input.evaluation.reason ??
    `Runtime iteration failed for: ${input.state.goal}`;
}


function truncate(
  value: string,
  limit = DETAILS_LIMIT
): string {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, limit - 1)}…`;
}
