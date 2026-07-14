export interface CodeAnalysis {
  imports: string[];

  exports: string[];

  functions: string[];

  classes: string[];

  components: string[];
}


export interface IndexedFile {
  path: string;

  size: number;

  extension: string;

  language: string;

  preview: string;

  code?: CodeAnalysis;
}


export interface WorkspaceIndex {
  files: IndexedFile[];

  directories: string[];
}