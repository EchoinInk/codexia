import type { ParsedAst } from "./ast-types";

import { parseSource } from "./parser";

export function createAst(
  filePath: string,
  content: string
): ParsedAst | null {

  return parseSource(
    filePath,
    content
  );

}