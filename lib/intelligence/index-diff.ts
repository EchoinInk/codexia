import type { WorkspaceFingerprint } from "./index-fingerprint";

import { compareFingerprints } from "./index-fingerprint";

export interface WorkspaceIndexDiff {
  changedFiles: string[];

  addedFiles: string[];

  removedFiles: string[];

  unchangedFiles: string[];

  changedDirectories: string[];

  addedDirectories: string[];

  removedDirectories: string[];

  unchangedDirectories: string[];
}

export function diffWorkspaceIndexes(
  previous: WorkspaceFingerprint,
  current: WorkspaceFingerprint
): WorkspaceIndexDiff {
  const diff =
    compareFingerprints(
      previous,
      current
    );

  return {
    changedFiles:
      diff.changed,

    addedFiles:
      diff.added,

    removedFiles:
      diff.removed,

    unchangedFiles:
      diff.unchanged,

    changedDirectories:
      diff.changedDirectories,

    addedDirectories:
      diff.addedDirectories,

    removedDirectories:
      diff.removedDirectories,

    unchangedDirectories:
      diff.unchangedDirectories,
  };
}
