import type {
  WorkspaceIndex,
} from "./types";

import {
  createDependencyGraph,
} from "./dependency-graph";


export interface IntelligenceContext {

  files: string[];

  relatedFiles: string[];

  dependencies: Record<string, string[]>;

  confidence: number;

}



export function createIntelligenceContext(
  workspace: WorkspaceIndex
): IntelligenceContext {

  const graph =
    createDependencyGraph(
      workspace
    );


  const dependencies:
    Record<string, string[]> = {};


  for (const node of graph.nodes) {

    dependencies[node.file] = [
      ...node.imports,
    ];

  }


  const relatedFiles =
    graph.nodes.flatMap(
      node =>
        node.dependents
    );


  return {

    files:
      workspace.files.map(
        file =>
          file.path
      ),


    relatedFiles:
      [
        ...new Set(
          relatedFiles
        ),
      ],


    dependencies,


    confidence:
      calculateConfidence(
        workspace.files.length
      ),

  };

}



function calculateConfidence(
  fileCount: number
): number {

  if (fileCount === 0) {
    return 0;
  }


  if (fileCount < 500) {
    return 1;
  }


  if (fileCount < 2000) {
    return 0.8;
  }


  return 0.6;

}