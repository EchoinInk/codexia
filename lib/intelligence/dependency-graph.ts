import type { WorkspaceIndex } from "./types";


export interface DependencyNode {
  file: string;

  imports: string[];

  dependents: string[];
}


export interface DependencyGraph {
  nodes: DependencyNode[];
}


export function createDependencyGraph(
  workspace: WorkspaceIndex
): DependencyGraph {

  const nodes: DependencyNode[] = workspace.files.map(
    file => ({
      file: file.path,

      imports: file.code?.imports ?? [],

      dependents: [],
    })
  );


  for (const node of nodes) {

    for (const imported of node.imports) {

      const target = nodes.find(
        item =>
          item.file.includes(imported)
      );


      if (target) {

        target.dependents.push(
          node.file
        );

      }
    }
  }


  return {
    nodes,
  };
}