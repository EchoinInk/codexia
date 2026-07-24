import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import type { TaskQueueSnapshot, TaskQueueStore } from "./types";

/** In-process store useful for tests and embedded queue instances. */
export class InMemoryTaskQueueStore implements TaskQueueStore {
  private snapshot?: TaskQueueSnapshot;

  async load(): Promise<TaskQueueSnapshot | undefined> {
    return this.snapshot ? structuredClone(this.snapshot) : undefined;
  }

  async save(snapshot: TaskQueueSnapshot): Promise<void> {
    this.snapshot = structuredClone(snapshot);
  }
}

/** Atomic JSON queue persistence under the local Codexia workspace. */
export class FileTaskQueueStore implements TaskQueueStore {
  private readonly filePath: string;

  constructor(workspace: string, file = ".codexia/runtime/task-queue.json") {
    this.filePath = path.resolve(workspace, file);
  }

  async load(): Promise<TaskQueueSnapshot | undefined> {
    try {
      const content = await readFile(this.filePath, "utf8");
      return JSON.parse(content) as TaskQueueSnapshot;
    } catch (error) {
      if (isMissingFile(error)) {
        return undefined;
      }

      throw error;
    }
  }

  async save(snapshot: TaskQueueSnapshot): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });

    const temporary = `${this.filePath}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(snapshot, null, 2), "utf8");
    await rename(temporary, this.filePath);
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
