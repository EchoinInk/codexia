import type {
  WorkspaceIndex,
} from "./types";


export interface DependencyNode {

  file: string;

  imports: string[];

  dependents: string[];

}



export interface DependencyGraph {

  nodes: DependencyNode[];

  order: string[];

}



export function createDependencyGraph(
  workspace: WorkspaceIndex
): DependencyGraph {


  const nodes:
    DependencyNode[] =
      workspace.files.map(
        file => ({

          file:
            file.path,

          imports:
            file.code?.imports ?? [],

          dependents:
            [],

        })
      );



  for (const node of nodes) {


    for (const imported of node.imports) {


      const target =
        nodes.find(
          candidate =>
            candidate.file.endsWith(
              imported
            )
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

    order:
      createDependencyOrder(
        nodes
      ),

  };


}



function createDependencyOrder(
  nodes: DependencyNode[]
): string[] {


  const visited =
    new Set<string>();


  const order:
    string[] = [];



  function visit(
    node: DependencyNode
  ) {


    if (
      visited.has(
        node.file
      )
    ) {

      return;

    }



    visited.add(
      node.file
    );



    for (const dependency of node.imports) {


      const target =
        nodes.find(
          candidate =>
            candidate.file.endsWith(
              dependency
            )
        );



      if (target) {

        visit(
          target
        );

      }


    }



    order.push(
      node.file
    );


  }



  for (const node of nodes) {

    visit(
      node
    );

  }



  return order;

}