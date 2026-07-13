export interface WorkspaceContext {
  root: string;

  projectType?: string;

  framework?: string;

  language?: string;

  filesIndexed: number;
}
