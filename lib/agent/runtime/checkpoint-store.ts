import { randomUUID } from "node:crypto";
import { mkdir, lstat, realpath, open, rename } from "node:fs/promises";
import { constants } from "node:fs";
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
  private readonly workspace: string;

  constructor(workspace: string, directory = ".codexia/runtime/checkpoints") {
    this.workspace = path.resolve(workspace);
    this.directory = path.resolve(workspace, directory);
    if (!this.directory.startsWith(this.workspace + path.sep)) throw new Error("Checkpoint directory escapes workspace");
  }

  async save(checkpoint: RuntimeCheckpoint): Promise<void> {
    await this.checkDirectory(true);

    const target = this.checkpointPath(checkpoint.taskId);
    const temporary = `${target}.${randomUUID()}.tmp`;

    const handle = await open(temporary, "wx", 0o600);
    try { await handle.writeFile(JSON.stringify(checkpoint, null, 2), "utf8"); await handle.sync(); }
    finally { await handle.close(); }
    await rename(temporary, target);
  }

  async loadLatest(taskId: string): Promise<RuntimeCheckpoint | undefined> {
    try {
      await this.checkDirectory(false);
      const handle = await open(this.checkpointPath(taskId), constants.O_RDONLY | constants.O_NOFOLLOW);
      try { return JSON.parse(await handle.readFile("utf8")) as RuntimeCheckpoint; }
      finally { await handle.close(); }
    } catch (error) {
      if (isMissingFile(error)) {
        return undefined;
      }

      throw error;
    }
  }

  private async checkDirectory(create: boolean): Promise<void> {
    if (await realpath(this.workspace) !== this.workspace) throw new Error("Checkpoint workspace must be canonical");
    let directory = this.workspace;
    for (const part of path.relative(this.workspace, this.directory).split(path.sep)) {
      directory = path.join(directory, part);
      if (create) {
        try { await mkdir(directory); } catch (error) {
          if (!(typeof error === "object" && error && "code" in error && error.code === "EEXIST")) throw error;
        }
      }
      const stat = await lstat(directory);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("Unsafe runtime checkpoint directory");
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
