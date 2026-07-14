import { listTree } from "@/lib/fs-safe";

import { analyseFile } from "./file-analyzer";

import type { WorkspaceIndex, IndexedFile } from "./types";


export async function createWorkspaceIndex(): Promise<WorkspaceIndex> {

  const tree = await listTree();


  const files: IndexedFile[] = [];

  const directories: string[] = [];


  async function walk(nodes: any[]) {

    for (const node of nodes) {

      if (node.type === "file") {

        const analysis = await analyseFile(node.path);

        files.push(analysis);

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
  };
}