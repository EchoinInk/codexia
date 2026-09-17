export type SymbolKind =
  | "function"
  | "class"
  | "interface"
  | "type"
  | "enum"
  | "component"
  | "variable"
  | "method"
  | "property";

export interface CodeSymbol {
  name: string;

  kind: SymbolKind;

  exported: boolean;

  line: number;

  range?: SourceRange;

  container?: string;
}

export interface SourcePosition {
  line: number;
  column: number;
}

export interface SourceRange {
  start: SourcePosition;
  end: SourcePosition;
}
