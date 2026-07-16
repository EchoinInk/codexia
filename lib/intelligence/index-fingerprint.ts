import type { IndexedFile, WorkspaceIndex } from "./types";

export interface WorkspaceFingerprint {
  files: Record<string, string>;
}

export interface FingerprintDiff {
  changed: string[];

  added: string[];

  removed: string[];

  unchanged: string[];
}

export function createWorkspaceFingerprint(
  index: WorkspaceIndex
): WorkspaceFingerprint {
  return {
    files: Object.fromEntries(
      index.files.map((file) => [file.path, createFileFingerprint(file)])
    ),
  };
}

export function createFileFingerprint(file: IndexedFile): string {
  return [file.size, file.modifiedAt ?? 0, file.hash ?? ""].join(":");
}

export function compareFingerprints(
  previous: WorkspaceFingerprint,
  current: WorkspaceFingerprint
): FingerprintDiff {
  const changed: string[] = [];

  const added: string[] = [];

  const removed: string[] = [];

  const unchanged: string[] = [];

  const previousFiles = Object.keys(previous.files);

  const currentFiles = Object.keys(current.files);

  for (const file of currentFiles) {
    if (!previous.files[file]) {
      added.push(file);

      continue;
    }

    if (previous.files[file] !== current.files[file]) {
      changed.push(file);

      continue;
    }

    unchanged.push(file);
  }

  for (const file of previousFiles) {
    if (!current.files[file]) {
      removed.push(file);
    }
  }

  return {
    changed,

    added,

    removed,

    unchanged,
  };
}
