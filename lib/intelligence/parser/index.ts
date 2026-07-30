import type { ParsedAst } from "../ast-types";

import { TypeScriptParser } from "./typescript-parser";

const parsers = [
  new TypeScriptParser(),
];

export function parseSource(
  filePath: string,
  content: string
): ParsedAst | null {

  const parser = parsers.find(parser =>
    parser.supports(filePath)
  );

  if (!parser) {
    return null;
  }

  return parser.parse(
    filePath,
    content
  );
}

export * from "./parser";
export * from "./typescript-parser";