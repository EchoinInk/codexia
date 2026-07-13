import { safeWriteFile } from "@/lib/fs-safe";

import type { DiffResult } from "./diff";

export interface PatchResult {
  applied: string[];

  failed: string[];
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
