import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  RuntimeCheckpoint,
  RuntimeCheckpointStore,
} from "./types";

/** In-process checkpoint store useful for embedding and tests. */
export class InMemoryRuntimeCheckpointStore
  implements RuntimeCheckpointStore
{
  private readonly checkpoints = new Map<string, RuntimeCheckpoint>();

  async save(checkpoint: RuntimeCheckpoint): Promise<void> {
    this.checkpoints.set(checkpoint.taskId, structuredClone(checkpoint));
  }

  async loadLatest(taskId: string): Promise<RuntimeCheckpoint | undefined> {
    const checkpoint = this.checkpoints.get(taskId);
    return checkpoint ? structuredClone(checkpoint) : undefined;
  }
}

/** JSON checkpoint store using atomic replacement within the workspace. */
export class FileRuntimeCheckpointStore implements RuntimeCheckpointStore {
  private readonly directory: string;

  constructor(workspace: string, directory = ".codexia/runtime/checkpoints") {
    this.directory = path.resolve(workspace, directory);
  }

  async save(checkpoint: RuntimeCheckpoint): Promise<void> {
    await mkdir(this.directory, { recursive: true });

    const target = this.checkpointPath(checkpoint.taskId);
    const temporary = `${target}.${randomUUID()}.tmp`;

    await writeFile(temporary, JSON.stringify(checkpoint, null, 2), "utf8");
    await rename(temporary, target);
  }

  async loadLatest(taskId: string): Promise<RuntimeCheckpoint | undefined> {
    try {
      const content = await readFile(this.checkpointPath(taskId), "utf8");
      return JSON.parse(content) as RuntimeCheckpoint;
    } catch (error) {
      if (isMissingFile(error)) {
        return undefined;
      }

      throw error;
    }
  }

  private checkpointPath(taskId: string): string {
    const safeTaskId = taskId.replace(/[^a-zA-Z0-9_-]/g, "_");
    return path.join(this.directory, `${safeTaskId}.json`);
  }
}

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
