import type { WorkspaceFingerprint } from "./index-fingerprint";

import { compareFingerprints } from "./index-fingerprint";

export interface WorkspaceIndexDiff {
  changedFiles: string[];

  addedFiles: string[];

  removedFiles: string[];

  unchangedFiles: string[];
}

export function diffWorkspaceIndexes(
  previous: WorkspaceFingerprint,
  current: WorkspaceFingerprint
): WorkspaceIndexDiff {
  const diff = compareFingerprints(previous, current);

  return {
    changedFiles: diff.changed,

    addedFiles: diff.added,

    removedFiles: diff.removed,

    unchangedFiles: diff.unchanged,
  };
}
