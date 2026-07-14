import type { CodeSymbol } from "./symbols";

import type {
  RelationshipGraph,
} from "./relationship-graph";


export interface CodeAnalysis {

  imports: string[];

  exports: string[];

  functions: string[];

  classes: string[];

  components: string[];

  symbols: CodeSymbol[];

}


export interface IndexedFile {

  path: string;

  size: number;

  modifiedAt?: number;

  hash?: string;

  extension: string;

  language: string;

  preview: string;

  code?: CodeAnalysis;

}


export interface WorkspaceIndex {

  files: IndexedFile[];

  directories: string[];

  relationships?: RelationshipGraph;

  intelligence?: IntelligenceSnapshot;

}


export interface IntelligenceSnapshot {

  files: string[];

  relatedFiles: string[];

  dependencies: Record<string, string[]>;

  confidence: number;

}