import { listTree } from "@/lib/fs-safe";

export interface WorkspaceIndex {
  files: string[];

  directories: string[];
}

export async function createWorkspaceIndex(): Promise<WorkspaceIndex> {
  const tree = await listTree();

  const files: string[] = [];

  const directories: string[] = [];

  function walk(nodes: any[]) {
    for (const node of nodes) {
      if (node.type === "file") {
        files.push(node.path);
      }

      if (node.type === "dir") {
        directories.push(node.path);

        if (node.children) {
          walk(node.children);
        }
      }
    }
  }

  walk(tree);

  return {
    files,

    directories,
  };
}
