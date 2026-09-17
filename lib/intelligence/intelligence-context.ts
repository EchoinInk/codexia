import { analyseArchitecture, type ArchitectureOptions, type ArchitectureReport } from "./architecture-analysis";
import { diagnoseWorkspace, type DiagnosticReport } from "./diagnostics";
import { createSemanticNavigation, type SemanticNavigation } from "./semantic-navigation";

import type {
  WorkspaceIndex,
} from "./types";

import type {
  WorkspaceMemorySnapshot,
} from "./workspace-memory";

import {
  createDependencyGraph,
} from "./dependency-graph";

import {
  analyseImpact,
} from "./impact-analysis";

import type {
  ImpactAnalysis,
} from "./impact-analysis";

export interface IntelligenceContext {
  files: string[];
  relatedFiles: string[];
  dependencies: Record<string, string[]>;
  confidence: number;
  dependencyOrder: string[];
  memory?: WorkspaceMemorySnapshot;
  navigation: SemanticNavigation;
  diagnose(): Promise<DiagnosticReport>;
  analyseArchitecture(options?: ArchitectureOptions): ArchitectureReport;
  analyseImpact(files: string[]): ImpactAnalysis;
}

export function createIntelligenceContext(
  workspace: WorkspaceIndex
): IntelligenceContext {
  const graph = createDependencyGraph(workspace);

  const dependencies: Record<string, string[]> = {};

  for (const node of graph.nodes) {
    dependencies[node.file] = [
      ...node.resolvedImports,
    ];
  }

  const relatedFiles = graph.nodes.flatMap(
    node => node.dependents
  );

  const context: IntelligenceContext = {
    navigation: createSemanticNavigation(workspace),
    diagnose: () => diagnoseWorkspace(workspace),
    analyseArchitecture: options => analyseArchitecture(workspace, options),

    files: workspace.files.map(
      file => file.path
    ),

    relatedFiles: [
      ...new Set(relatedFiles),
    ],

    dependencies,

    confidence: calculateConfidence(
      workspace.files.length
    ),

    dependencyOrder: graph.order,

    memory:
      workspace.memory,

    analyseImpact(
      files: string[]
    ): ImpactAnalysis {
      return analyseImpact(
        context,
        files
      );
    },
  };

  return context;
}

export function attachIntelligenceContext(
  workspace: WorkspaceIndex
): WorkspaceIndex {
  return {
    ...workspace,
    intelligence: createIntelligenceContext(workspace),
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
