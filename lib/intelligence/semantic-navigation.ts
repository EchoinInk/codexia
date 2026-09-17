import { createCompilerProject, normalizeFile } from "./compiler-project";

import type { CodeSymbol, SourcePosition, SourceRange, SymbolKind } from "./symbols";
import type { WorkspaceIndex } from "./types";

export interface SymbolLocation {
  file: string;
  range: SourceRange;
}

export interface WorkspaceSymbol extends SymbolLocation {
  name: string;
  kind: SymbolKind;
  exported: boolean;
  container?: string;
}

export interface SymbolSearchOptions {
  mode?: "exact" | "prefix" | "fuzzy";
  caseSensitive?: boolean;
  kind?: SymbolKind;
  file?: string;
  exportedOnly?: boolean;
  limit?: number;
}

export interface SemanticNavigation {
  searchSymbols(query: string, options?: SymbolSearchOptions): WorkspaceSymbol[];
  documentSymbols(file: string): WorkspaceSymbol[];
  definitions(file: string, position: SourcePosition): SymbolLocation[];
  references(file: string, position: SourcePosition): SymbolLocation[];
  implementations(file: string, position: SourcePosition): SymbolLocation[];
}

function symbolLocation(file: string, symbol: CodeSymbol): WorkspaceSymbol {
  return {
    file,
    name: symbol.name,
    kind: symbol.kind,
    exported: symbol.exported,
    container: symbol.container,
    range: symbol.range ?? {
      start: { line: symbol.line, column: 1 },
      end: { line: symbol.line, column: 1 },
    },
  };
}

function matchScore(name: string, query: string, mode: string): number {
  if (name === query) return 0;
  if (mode === "exact") return -1;
  if (name.startsWith(query)) return 1;
  if (mode === "prefix") return -1;

  let offset = 0;
  for (const character of query) {
    const found = name.indexOf(character, offset);
    if (found < 0) return -1;
    offset = found + 1;
  }
  return 2 + offset - query.length;
}

/** Read-only queries over one immutable workspace-index snapshot. */
export function createSemanticNavigation(
  workspace: WorkspaceIndex
): SemanticNavigation {
  function documentSymbols(file: string): WorkspaceSymbol[] {
    const normalized = normalizeFile(file);
    return (workspace.files.find(candidate =>
      normalizeFile(candidate.path) === normalized
    )?.code?.symbols ?? []).map(symbol => symbolLocation(normalized, symbol));
  }

  function searchSymbols(
    query: string,
    options: SymbolSearchOptions = {}
  ): WorkspaceSymbol[] {
    const limit = options.limit ?? 100;
    if (!Number.isFinite(limit) || limit <= 0) return [];
    const text = options.caseSensitive ? query : query.toLowerCase();
    return workspace.files.flatMap(file => {
      const name = normalizeFile(file.path);
      if (options.file && name !== normalizeFile(options.file)) return [];
      return (file.code?.symbols ?? []).flatMap(symbol => {
        if (options.kind && symbol.kind !== options.kind) return [];
        if (options.exportedOnly && !symbol.exported) return [];
        const score = matchScore(
          options.caseSensitive ? symbol.name : symbol.name.toLowerCase(),
          text,
          options.mode ?? "fuzzy"
        );
        return score < 0 ? [] : [{ score, symbol: symbolLocation(name, symbol) }];
      });
    }).sort((a, b) =>
      a.score - b.score ||
      a.symbol.name.localeCompare(b.symbol.name) ||
      a.symbol.file.localeCompare(b.symbol.file) ||
      a.symbol.range.start.line - b.symbol.range.start.line ||
      a.symbol.range.start.column - b.symbol.range.start.column
    ).slice(0, Math.floor(limit)).map(result => result.symbol);
  }

  function navigate(
    operation: "definitions" | "references" | "implementations",
    file: string,
    position: SourcePosition
  ): SymbolLocation[] {
    const project = createCompilerProject(workspace);
    const { service, sources } = project;
    const fileName = project.fileName(file);
    const offset = project.position(file, position);
    if (offset === undefined) {
      project.dispose();
      return [];
    }
    try {
      const entries = operation === "definitions"
        ? service.getDefinitionAtPosition(fileName, offset)
        : operation === "references"
          ? service.getReferencesAtPosition(fileName, offset)
          : service.getImplementationAtPosition(fileName, offset);
      const locations = new Map<string, SymbolLocation>();
      for (const entry of entries ?? []) {
        const target = sources.get(entry.fileName);
        if (!target) continue;
        const ast = service.getProgram()?.getSourceFile(entry.fileName);
        if (!ast) continue;
        const start = ast.getLineAndCharacterOfPosition(entry.textSpan.start);
        const end = ast.getLineAndCharacterOfPosition(entry.textSpan.start + entry.textSpan.length);
        const location: SymbolLocation = {
          file: target.file,
          range: {
            start: { line: start.line + 1, column: start.character + 1 },
            end: { line: end.line + 1, column: end.character + 1 },
          },
        };
        locations.set(`${target.file}:${entry.textSpan.start}:${entry.textSpan.length}`, location);
      }
      return [...locations.values()].sort((a, b) =>
        a.file.localeCompare(b.file) || a.range.start.line - b.range.start.line ||
        a.range.start.column - b.range.start.column
      );
    } finally {
      service.dispose();
    }
  }

  return {
    searchSymbols,
    documentSymbols,
    definitions: (file, position) => navigate("definitions", file, position),
    references: (file, position) => navigate("references", file, position),
    implementations: (file, position) => navigate("implementations", file, position),
  };
}
