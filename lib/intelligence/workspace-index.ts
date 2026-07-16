import { listTree } from "@/lib/fs-safe";

import { analyseFile } from "./file-analyzer";

import type { IndexedFile, WorkspaceIndex } from "./types";

import type { FsNode } from "@/lib/fs-safe";

import {
  compareFingerprints,
  createWorkspaceFingerprint,
} from "./index-fingerprint";

import type { WorkspaceFingerprint } from "./index-fingerprint";

export async function createWorkspaceIndex(
  previous?: WorkspaceIndex,
  previousFingerprint?: WorkspaceFingerprint
): Promise<WorkspaceIndex> {
  const tree = await listTree();

  const files: IndexedFile[] = [];

  const directories: string[] = [];

  const previousFiles = new Map(
    previous?.files.map((file) => [file.path, file]) ?? []
  );

  async function walk(nodes: FsNode[]) {
    for (const node of nodes) {
      if (node.type === "dir") {
        directories.push(node.path);

        if (node.children) {
          await walk(node.children);
        }

        continue;
      }

      if (node.type === "file") {
        const existing = previousFiles.get(node.path);

        if (existing) {
          files.push(existing);
        } else {
          const analysis = await analyseFile(node.path);

          files.push(analysis);
        }
      }
    }
  }

  await walk(tree);

  const index: WorkspaceIndex = {
    files,

    directories,
  };

  if (previous && previousFingerprint) {
    const currentFingerprint = createWorkspaceFingerprint(index);

    const changes = compareFingerprints(
      previousFingerprint,
      currentFingerprint
    );

    if (
      changes.changed.length === 0 &&
      changes.added.length === 0 &&
      changes.removed.length === 0
    ) {
      return previous;
    }
  }

  return index;
}
