import ts from "typescript";
import { createCompilerProject } from "./compiler-project";
import type { WorkspaceIndex } from "./types";

export interface DependencyNode {
  file: string;
  imports: string[];
  resolvedImports: string[];
  unresolvedImports: string[];
  externalImports: string[];
  dynamicImports: boolean;
  dependents: string[];
}
export interface DependencyGraph {
  nodes: DependencyNode[];
  order: string[];
}

/** Extend the existing graph using the same indexed compiler view as navigation. */
export function createDependencyGraph(workspace: WorkspaceIndex): DependencyGraph {
  const project = createCompilerProject(workspace);
  try {
    const nodes: DependencyNode[] = workspace.files.map(file => {
      const imports = new Set(file.code?.imports ?? []);
      let dynamicImports = false;
      const ast = project.service.getProgram()?.getSourceFile(project.fileName(file.path));
      if (ast) {
        const visit = (node: ts.Node): void => {
          if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier &&
            ts.isStringLiteralLike(node.moduleSpecifier)) imports.add(node.moduleSpecifier.text);
          if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference) &&
            node.moduleReference.expression && ts.isStringLiteralLike(node.moduleReference.expression)) imports.add(node.moduleReference.expression.text);
          if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
            (ts.isIdentifier(node.expression) && node.expression.text === "require"))) {
            const argument = node.arguments[0];
            if (argument && ts.isStringLiteralLike(argument)) imports.add(argument.text);
            else dynamicImports = true;
          }
          ts.forEachChild(node, visit);
        };
        visit(ast);
      }
      const resolvedImports: string[] = [];
      const unresolvedImports: string[] = [];
      const externalImports: string[] = [];
      for (const specifier of imports) {
        const target = project.resolveModule(file.path, specifier);
        if (target) resolvedImports.push(target);
        else if (specifier.startsWith(".") || Object.keys(project.options.paths ?? {}).some(pattern => {
          const [prefix, suffix] = pattern.split("*");
          return pattern.includes("*") ? specifier.startsWith(prefix) && specifier.endsWith(suffix) : specifier === pattern;
        })) unresolvedImports.push(specifier);
        else externalImports.push(specifier);
      }
      return { file: file.path, imports: [...imports], resolvedImports: [...new Set(resolvedImports)],
        unresolvedImports, externalImports, dynamicImports, dependents: [] };
    });
    const byFile = new Map(nodes.map(node => [node.file, node]));
    for (const node of nodes) {
      for (const target of node.resolvedImports) byFile.get(target)?.dependents.push(node.file);
    }
    const order: string[] = [];
    const visited = new Set<string>();
    const visit = (file: string): void => {
      if (visited.has(file)) return;
      visited.add(file);
      for (const target of byFile.get(file)?.resolvedImports ?? []) visit(target);
      order.push(file);
    };
    for (const node of nodes) visit(node.file);
    return { nodes, order };
  } finally { project.dispose(); }
}
