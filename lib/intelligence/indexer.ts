import crypto from "crypto";

import { analyseFile } from "./file-analyzer";
import { createRelationshipGraph } from "./relationship-graph";

import type { WorkspaceIndex, IndexedFile } from "./types";

import { listTree, safeReadFile, type FsNode } from "@/lib/fs-safe";

function createHash(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

export async function createWorkspaceIndex(): Promise<WorkspaceIndex> {
  const tree = await listTree();

  const files: IndexedFile[] = [];

  const directories: string[] = [];

  async function walk(nodes: FsNode[]) {
    for (const node of nodes) {
      if (node.type === "file") {
        const content = await safeReadFile(node.path);

        const analysis = await analyseFile(node.path);

        files.push({
          ...analysis,

          hash: createHash(content),

          modifiedAt: Date.now(),
        });
      }

      if (node.type === "dir") {
        directories.push(node.path);

        if (node.children) {
          await walk(node.children);
        }
      }
    }
  }

  await walk(tree);

  return {
    files,

    directories,

    relationships: createRelationshipGraph(files),
  };
}
