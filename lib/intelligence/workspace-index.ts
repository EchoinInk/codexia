import {
  listTree,
  safeReadFile,
} from "@/lib/fs-safe";

import { analyseFile } from "./file-analyzer";
import { createContentHash } from "./index-fingerprint";
import { createRelationshipGraph } from "./relationship-graph";

import type {
  IndexedFile,
  WorkspaceIndex,
} from "./types";

import type {
  FsNode,
} from "@/lib/fs-safe";

export async function createIndexedFile(
  path: string,
  workspace?: string
): Promise<IndexedFile> {
  const content =
    await safeReadFile(
      path,
      workspace
    );

  const analysis =
    await analyseFile(
      path,
      workspace
    );

  return {
    ...analysis,

    hash:
      createContentHash(
        content
      ),
  };
}

export async function createWorkspaceIndex(
  workspace?: string
): Promise<WorkspaceIndex> {
  const tree =
    await listTree(
      "",
      workspace
    );

  const files: IndexedFile[] = [];

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
        files.push(
          await createIndexedFile(
            node.path,
            workspace
          )
        );
      }
    }
  }

  await walk(
    tree
  );

  return {
    files,

    directories,

    relationships:
      createRelationshipGraph(
        files
      ),
  };
}
