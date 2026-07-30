export type SymbolKind =
  | "function"
  | "class"
  | "interface"
  | "type"
  | "enum"
  | "component"
  | "variable";

export interface CodeSymbol {
  name: string;

  kind: SymbolKind;

  exported: boolean;

  line: number;
}