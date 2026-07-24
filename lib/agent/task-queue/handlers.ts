import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { createContext } from "../context";
import { createRuntimeController } from "../runtime";
import { rebuildWorkspaceIndex } from "../../intelligence/workspace-index-manager";
import type {
  TaskQueueHandler,
  TaskQueueHandlers,
  TaskQueueTask,
} from "./types";

const execFileAsync = promisify(execFile);
const DEFAULT_MAX_BUFFER = 10 * 1024 * 1024;
const MAX_PERSISTED_OUTPUT_LENGTH = 100_000;

interface CommandDefinition {
  executable: string;
  args: string[];
  display: string;
}

/** Creates the default adapters for Phase 5.2 queue task categories. */
export function createDefaultTaskQueueHandlers(
  workspace: string
): TaskQueueHandlers {
  return {
    build: commandHandler({
      executable: "npm",
      args: ["run", "build"],
      display: "npm run build",
    }),
    tests: commandHandler({
      executable: "npm",
      args: ["test", "--", "--runInBand"],
      display: "npm test -- --runInBand",
    }),
    lint: commandHandler({
      executable: "npm",
      args: ["run", "lint"],
      display: "npm run lint",
    }),
    documentation: documentationHandler(workspace),
    indexing: indexingHandler(workspace),
  };
}

function commandHandler(command: CommandDefinition): TaskQueueHandler {
  return async (task, context) => {
    throwIfAborted(context.signal);

    const { stdout, stderr } = await execFileAsync(
      command.executable,
      command.args,
      {
        cwd: context.workspace,
        signal: context.signal,
        maxBuffer: DEFAULT_MAX_BUFFER,
      }
    );

    const rawOutput = [stdout, stderr].filter(Boolean).join("\n").trim();
    const output = rawOutput.slice(0, MAX_PERSISTED_OUTPUT_LENGTH);

    return {
      summary: `${task.type} task completed successfully`,
      details: {
        command: command.display,
        output,
        outputTruncated: rawOutput.length > output.length,
      },
    };
  };
}

function documentationHandler(workspace: string): TaskQueueHandler {
  return async (task, context) => {
    throwIfAborted(context.signal);

    const prompt = stringPayload(task, "prompt");
    if (!prompt) {
      throw new Error("Documentation tasks require payload.prompt");
    }

    const runtimeTaskId = `queue-doc-${task.id}`;
    const runtime = createRuntimeController(workspace);
    const abort = () => runtime.cancel(runtimeTaskId, "Queue task cancelled");

    context.signal.addEventListener("abort", abort, { once: true });

    try {
      const agentContext = await createContext(
        [{ role: "user", content: prompt }],
        workspace
      );
      throwIfAborted(context.signal);

      const result = await runtime.start({
        id: runtimeTaskId,
        goal: prompt,
        context: agentContext,
        metadata: {
          queueTaskId: task.id,
          queueTaskType: task.type,
          ...task.metadata,
        },
      });

      if (result.state.status !== "completed") {
        throw new Error(
          `Documentation runtime stopped with status ${result.state.status}`
        );
      }

      return {
        summary: "Documentation task completed successfully",
        details: {
          runtimeTaskId,
          iterations: result.metrics.iterations,
          stopReason: result.state.stopReason,
        },
      };
    } finally {
      context.signal.removeEventListener("abort", abort);
    }
  };
}

function indexingHandler(workspace: string): TaskQueueHandler {
  return async (_task, context) => {
    throwIfAborted(context.signal);
    const index = await rebuildWorkspaceIndex(workspace);
    throwIfAborted(context.signal);

    return {
      summary: "Workspace indexing completed successfully",
      details: {
        files: index.files.length,
        directories: index.directories.length,
      },
    };
  };
}

function stringPayload(
  task: Readonly<TaskQueueTask>,
  key: string
): string | undefined {
  const value = task.payload[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function throwIfAborted(signal: AbortSignal): void {
  if (!signal.aborted) {
    return;
  }

  const error = new Error("Queue task aborted");
  error.name = "AbortError";
  throw error;
}
