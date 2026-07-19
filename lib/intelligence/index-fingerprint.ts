import crypto from "crypto";
import fs from "node:fs/promises";

import {
  listTree,
  safeReadFile,
  safeResolve,
} from "@/lib/fs-safe";

import type {
  IndexedFile,
  WorkspaceIndex,
} from "./types";

import type {
  FsNode,
} from "@/lib/fs-safe";

export interface WorkspaceFingerprint {
  files: Record<string, string>;

  directories?: string[];
}

export interface FingerprintDiff {
  changed: string[];

  added: string[];

  removed: string[];

  unchanged: string[];

  changedDirectories: string[];

  addedDirectories: string[];

  removedDirectories: string[];

  unchangedDirectories: string[];
}

export function createWorkspaceFingerprint(
  index: WorkspaceIndex
): WorkspaceFingerprint {
  return {
    files:
      Object.fromEntries(
        index.files.map(
          file => [
            file.path,
            createFileFingerprint(
              file
            ),
          ]
        )
      ),

    directories:
      [
        ...index.directories,
      ].sort(),
  };
}

export async function createWorkspaceFingerprintFromFilesystem(
  workspace?: string
): Promise<WorkspaceFingerprint> {
  const tree =
    await listTree(
      "",
      workspace
    );

  const files: Record<string, string> = {};

  const directories: string[] = [];

  async function walk(
    nodes: FsNode[]
  ): Promise<void> {
    for (const node of nodes) {
      if (
        node.type === "dir"
      ) {
        directories.push(
          node.path
        );

        if (
          node.children
        ) {
          await walk(
            node.children
          );
        }

        continue;
      }

      if (
        node.type === "file"
      ) {
        files[node.path] =
          await createFilesystemFileFingerprint(
            node.path,
            workspace
          );
      }
    }
  }

  await walk(
    tree
  );

  return {
    files,

    directories:
      directories.sort(),
  };
}

export function createFileFingerprint(
  file: IndexedFile
): string {
  return [
    file.size,
    file.modifiedAt ?? 0,
    file.hash ?? "",
  ].join(
    ":"
  );
}

export function createContentHash(
  content: string
): string {
  return crypto
    .createHash(
      "sha256"
    )
    .update(
      content
    )
    .digest(
      "hex"
    );
}

export function compareFingerprints(
  previous: WorkspaceFingerprint,
  current: WorkspaceFingerprint
): FingerprintDiff {
  const changed: string[] = [];

  const added: string[] = [];

  const removed: string[] = [];

  const unchanged: string[] = [];

  const changedDirectories: string[] = [];

  const addedDirectories: string[] = [];

  const removedDirectories: string[] = [];

  const unchangedDirectories: string[] = [];

  const previousFiles =
    Object.keys(
      previous.files
    );

  const currentFiles =
    Object.keys(
      current.files
    );

  const previousDirectoryList =
    previous.directories ?? [];

  const currentDirectoryList =
    current.directories ?? [];

  for (const file of currentFiles) {
    if (
      !previous.files[file]
    ) {
      added.push(
        file
      );

      continue;
    }

    if (
      previous.files[file] !== current.files[file]
    ) {
      changed.push(
        file
      );

      continue;
    }

    unchanged.push(
      file
    );
  }

  for (const file of previousFiles) {
    if (
      !current.files[file]
    ) {
      removed.push(
        file
      );
    }
  }

  const previousDirectories =
    new Set(
      previousDirectoryList
    );

  const currentDirectories =
    new Set(
      currentDirectoryList
    );

  for (const directory of currentDirectoryList) {
    if (
      !previousDirectories.has(
        directory
      )
    ) {
      addedDirectories.push(
        directory
      );

      continue;
    }

    unchangedDirectories.push(
      directory
    );
  }

  for (const directory of previousDirectoryList) {
    if (
      !currentDirectories.has(
        directory
      )
    ) {
      removedDirectories.push(
        directory
      );
    }
  }

  return {
    changed,

    added,

    removed,

    unchanged,

    changedDirectories,

    addedDirectories,

    removedDirectories,

    unchangedDirectories,
  };
}

async function createFilesystemFileFingerprint(
  path: string,
  workspace?: string
): Promise<string> {
  const content =
    await safeReadFile(
      path,
      workspace
    );

  const stats =
    await fs.stat(
      safeResolve(
        path,
        workspace
      )
    );

  return [
    stats.size,
    stats.mtimeMs,
    createContentHash(
      content
    ),
  ].join(
    ":"
  );
}
