import type { ParsedAst } from "../ast-types";

export interface SourceParser {
  supports(filePath: string): boolean;

  parse(
    filePath: string,
    content: string
  ): ParsedAst | null;
}