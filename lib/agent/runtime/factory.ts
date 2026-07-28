import { createContext } from "../context";
import { getPlanner } from "../planner-index";
import { runWorkflow } from "../workflow";
import { FileRuntimeCheckpointStore } from "./checkpoint-store";
import { RuntimeController } from "./controller";
import {
  DefaultRuntimeGoalEvaluator,
  DefaultRuntimeObserver,
  defaultRuntimeLogger,
} from "./defaults";
import { DefaultRuntimeContinuationPolicy } from "./continuation-policy";
import { WorkspaceRuntimeMemoryRecorder } from "./memory-recorder";
import type {
  RuntimeConfiguration,
  RuntimeContextSnapshot,
  RuntimeDependencies,
  RuntimeResult,
  RuntimeTaskInput,
} from "./types";

/** Overrides for embedding the runtime in another Codexia surface. */
export interface CreateRuntimeControllerOptions {
  configuration?: Partial<RuntimeConfiguration>;
  dependencies?: Partial<RuntimeDependencies>;
}

/** Creates a controller wired to the current bounded workflow pipeline. */
export function createRuntimeController(
  workspace: string,
  options: CreateRuntimeControllerOptions = {}
): RuntimeController {
  const overrides = options.dependencies;
  const dependencies: RuntimeDependencies = {
    observer: overrides?.observer ?? new DefaultRuntimeObserver(),
    planner: overrides?.planner ?? getPlanner(),
    goalEvaluator:
      overrides?.goalEvaluator ?? new DefaultRuntimeGoalEvaluator(),
    continuationPolicy:
      overrides?.continuationPolicy ?? new DefaultRuntimeContinuationPolicy(),
    checkpointStore:
      overrides?.checkpointStore ?? new FileRuntimeCheckpointStore(workspace),
    restoreContext: overrides?.restoreContext ?? restoreContext,
    runWorkflow: overrides?.runWorkflow ?? runWorkflow,
    memoryRecorder:
      overrides?.memoryRecorder ?? new WorkspaceRuntimeMemoryRecorder(),
    logger: overrides?.logger ?? defaultRuntimeLogger,
    now: overrides?.now,
    createId: overrides?.createId,
  };

  return new RuntimeController(dependencies, options.configuration);
}

/** Runs a long-running task using the existing context, planner, and workflow. */
export async function runLongRunningTask(
  message: string,
  workspace: string,
  options: CreateRuntimeControllerOptions & {
    id?: string;
    metadata?: RuntimeTaskInput["metadata"];
  } = {}
): Promise<RuntimeResult> {
  const context = await createContext(
    [{ role: "user", content: message }],
    workspace
  );
  const controller = createRuntimeController(workspace, options);

  return controller.start({
    id: options.id,
    goal: message,
    context,
    metadata: options.metadata,
  });
}

async function restoreContext(
  snapshot: RuntimeContextSnapshot
) {
  return createContext(snapshot.messages, snapshot.workspace);
}
