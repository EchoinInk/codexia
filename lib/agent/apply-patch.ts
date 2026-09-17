import { safeWriteFile } from "@/lib/fs-safe";

import type {
  DiffResult,
  FilePatch,
} from "./diff";

export interface PatchResult {
  applied: string[];

  failed: string[];
}

export function validatePatch(
  patch: FilePatch
): boolean {

  return Boolean(
    patch.path &&
    patch.after !== undefined
  );

}

export async function applyPatch(diff: DiffResult): Promise<PatchResult> {
  const applied: string[] = [];

  const failed: string[] = [];

  for (const change of diff.changes) {
    try {
      await safeWriteFile(change.path, change.after);

      applied.push(change.path);
    } catch {
      failed.push(change.path);
    }
  }

  return {
    applied,

    failed,
  };
}

/** Executor boundary for reviewed IDE changes; workflow owns validation/rollback. */
export async function applyGuardedPatch(
  workspace: string,
  diff: DiffResult,
  onApplied: (file: string) => Promise<void>,
  signal?: AbortSignal
): Promise<void> {
  const { guardedRead, guardedReplace } = await import("./guarded-files");
  for (const change of diff.changes) {
    if (await guardedRead(workspace, change.path) !== change.before) {
      throw new Error(`Concurrent source change: ${change.path}`);
    }
  }
  for (const change of diff.changes) {
    signal?.throwIfAborted();
    await guardedReplace(workspace, change.path, change.before, change.after);
    await onApplied(change.path);
  }
}
