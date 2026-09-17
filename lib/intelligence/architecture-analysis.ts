import { createHash } from "node:crypto";
import ts from "typescript";
import { createDependencyGraph, type DependencyGraph } from "./dependency-graph";
import { createCompilerProject, sourceRange, isWorkspacePath } from "./compiler-project";
import type { WorkspaceIndex } from "./types";
import type { SourceRange } from "./symbols";

export interface LayerRule {
  name: string;
  prefixes: string[];
  allowedDependencies: string[];
}
export interface ArchitectureOptions {
  entryPoints?: string[];
  publicFiles?: string[];
  layers?: LayerRule[];
}
export interface ArchitectureFinding {
  id: string;
  kind: "unused_symbol" | "unused_export" | "unreachable_module" | "unresolved_import" | "dependency_cycle" | "layer_violation";
  severity: "warning" | "information";
  confidence: "high" | "limited";
  file: string;
  range?: SourceRange;
  message: string;
  evidence: string[];
  recommendation: string;
}
export interface ArchitectureReport {
  findings: ArchitectureFinding[];
  graph: DependencyGraph;
  limitations: string[];
}

export function analyseArchitecture(workspace: WorkspaceIndex, options: ArchitectureOptions = {}): ArchitectureReport {
  const graph = createDependencyGraph(workspace);
  const project = createCompilerProject(workspace, { noUnusedLocals: true, noUnusedParameters: true });
  const findings: ArchitectureFinding[] = [];
  const limitations = ["Dead-code findings are candidates, not deletion instructions. External consumers, reflection, and framework conventions may keep symbols live.",
    "Only indexed TS/JS sources and resolvable static module edges are analyzed."];
  const add = (finding: Omit<ArchitectureFinding, "id">): void => {
    const id = createHash("sha256").update(JSON.stringify(finding)).digest("hex");
    findings.push({ id, ...finding });
  };
  try {
    const program = project.service.getProgram();
    const checker = program?.getTypeChecker();
    const known = new Set(graph.nodes.map(node => node.file));
    for (const file of [...(options.entryPoints ?? []), ...(options.publicFiles ?? [])]) {
      if (!isWorkspacePath(file) || !known.has(file)) throw new Error(`Unknown analysis root: ${file}`);
    }
    const layers = options.layers ?? [];
    const names = new Set(layers.map(layer => layer.name));
    if (names.size !== layers.length) throw new Error("Duplicate layer names");
    for (const layer of layers) {
      if (!layer.name || !layer.prefixes.length || layer.prefixes.some(prefix => !isWorkspacePath(prefix.replace(/\/$/, ""))) ||
        layer.allowedDependencies.some(name => !names.has(name))) throw new Error(`Invalid layer rule: ${layer.name}`);
    }
    const layerOf = (file: string): LayerRule | undefined => {
      const matches = layers.filter(layer => layer.prefixes.some(prefix => {
        const base = prefix.replace(/\/$/, "");
        return file === base || file.startsWith(`${base}/`);
      }));
      if (matches.length > 1) throw new Error(`Ambiguous layer membership: ${file}`);
      return matches[0];
    };
    for (const node of graph.nodes) layerOf(node.file);
    for (const [name, source] of project.sources) {
      if (!/\.[jt]sx?$/i.test(name)) continue;
      for (const diagnostic of project.service.getSemanticDiagnostics(name)) {
        if (![6133, 6192, 6196, 6198].includes(diagnostic.code)) continue;
        add({ kind: "unused_symbol", severity: "information", confidence: "limited", file: source.file,
          range: diagnostic.file && diagnostic.start !== undefined ? sourceRange(diagnostic.file, diagnostic.start, diagnostic.length ?? 0) : undefined,
          message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
          evidence: [`TypeScript unused diagnostic ${diagnostic.code}`], recommendation: "Review side effects and public use before removing this declaration." });
      }
      const ast = program?.getSourceFile(name);
      const moduleSymbol = ast && checker?.getSymbolAtLocation(ast);
      if (!ast || !moduleSymbol || !checker || options.publicFiles?.includes(source.file) || options.entryPoints?.includes(source.file)) continue;
      for (const exported of checker.getExportsOfModule(moduleSymbol)) {
        const symbol = exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported;
        const declarations = symbol.getDeclarations() ?? [];
        // Re-export barrels are edges; only assess definitions in their owner file.
        const declaration = declarations.find(declaration => declaration.getSourceFile().fileName === name);
        if (!declaration) continue;
        const named = declaration as ts.NamedDeclaration;
        const start = named.name?.getStart(ast) ?? declaration.getStart(ast);
        const groups = project.service.findReferences(name, start) ?? [];
        const outsideReference = groups.some(group => group.references.some(reference => reference.fileName !== name));
        if (outsideReference) continue;
        add({ kind: "unused_export", severity: "information", confidence: "limited", file: source.file,
          range: sourceRange(ast, start, named.name?.getWidth(ast) ?? 0),
          message: `Export ${exported.name} has no indexed references from other modules.`,
          evidence: ["Compiler symbol reference lookup found no cross-module use."],
          recommendation: "Check package exports and external consumers before changing this API." });
      }
    }
    const byFile = new Map(graph.nodes.map(node => [node.file, node]));
    for (const node of graph.nodes) {
      if (node.dynamicImports) limitations.push(`Dynamic module expression in ${node.file}; reachability is incomplete.`);
      for (const specifier of node.unresolvedImports) add({ kind: "unresolved_import", severity: "warning", confidence: "limited",
        file: node.file, message: `Unresolved workspace import: ${specifier}`, evidence: [specifier],
        recommendation: "Check paths, generated sources, and index coverage." });
      const from = layerOf(node.file);
      if (from) for (const target of node.resolvedImports) {
        const to = layerOf(target);
        if (to && to.name !== from.name && !from.allowedDependencies.includes(to.name)) add({
          kind: "layer_violation", severity: "warning", confidence: "high", file: node.file,
          message: `${from.name} may not depend on ${to.name}.`, evidence: [`${node.file} → ${target}`],
          recommendation: "Move the dependency behind an allowed abstraction or revise the explicit layer rule." });
      }
    }
    // Tarjan strongly connected components; each cycle is reported once.
    let next = 0;
    const indices = new Map<string, number>();
    const lows = new Map<string, number>();
    const stack: string[] = [];
    const active = new Set<string>();
    const visit = (file: string): void => {
      indices.set(file, next); lows.set(file, next++); stack.push(file); active.add(file);
      for (const target of byFile.get(file)?.resolvedImports ?? []) {
        if (!indices.has(target)) { visit(target); lows.set(file, Math.min(lows.get(file)!, lows.get(target)!)); }
        else if (active.has(target)) lows.set(file, Math.min(lows.get(file)!, indices.get(target)!));
      }
      if (lows.get(file) !== indices.get(file)) return;
      const component: string[] = [];
      let current: string;
      do { current = stack.pop()!; active.delete(current); component.push(current); } while (current !== file);
      if (component.length > 1 || byFile.get(file)?.resolvedImports.includes(file)) {
        component.sort();
        add({ kind: "dependency_cycle", severity: "warning", confidence: "high", file: component[0],
          message: `Dependency cycle contains ${component.length} module(s).`, evidence: component,
          recommendation: "Review initialization order and extract shared contracts where appropriate." });
      }
    };
    for (const node of graph.nodes) if (!indices.has(node.file)) visit(node.file);
    if (!options.entryPoints?.length) limitations.push("No entry points supplied; unreachable-module analysis skipped.");
    else {
      const reachable = new Set<string>();
      const pending = [...options.entryPoints, ...(options.publicFiles ?? [])];
      while (pending.length) {
        const file = pending.pop()!;
        if (reachable.has(file)) continue;
        reachable.add(file);
        pending.push(...(byFile.get(file)?.resolvedImports ?? []));
      }
      for (const node of graph.nodes) if (/\.[jt]sx?$/i.test(node.file) && !/\.d\.ts$/i.test(node.file) && !reachable.has(node.file)) {
        add({ kind: "unreachable_module", severity: "information", confidence: "limited", file: node.file,
          message: "No static path from the supplied entry points reaches this module.", evidence: [...options.entryPoints],
          recommendation: "Check framework entry conventions and dynamic loading before removing the module." });
      }
    }
    return { findings: findings.sort((a, b) => a.file.localeCompare(b.file) || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id)),
      graph, limitations: [...new Set(limitations)] };
  } finally { project.dispose(); }
}
