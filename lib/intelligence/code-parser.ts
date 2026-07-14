import { createAst } from "./ast";
import { analyseAst } from "./ast-walker";

import type { CodeAnalysis } from "./types";


export function parseCode(
  content: string,
  language: string,
  filePath = "unknown.ts"
): CodeAnalysis {

  if (
    language !== "typescript" &&
    language !== "typescript-react" &&
    language !== "javascript" &&
    language !== "javascript-react"
  ) {

    return {
      imports: [],
      exports: [],
      functions: [],
      classes: [],
      components: [],
      symbols: [],
    };

  }


  const ast =
    createAst(
      filePath,
      content
    );


  if (!ast) {

    return {
      imports: [],
      exports: [],
      functions: [],
      classes: [],
      components: [],
      symbols: [],
    };

  }


  const analysis =
    analyseAst(
      ast.sourceFile
    );


  return {

    imports:
      analysis.imports,

    exports:
      analysis.exports,

    functions:
      analysis.symbols
        .filter(
          symbol =>
            symbol.kind === "function"
        )
        .map(
          symbol =>
            symbol.name
        ),

    classes:
      analysis.symbols
        .filter(
          symbol =>
            symbol.kind === "class"
        )
        .map(
          symbol =>
            symbol.name
        ),

    components:
      analysis.symbols
        .filter(
          symbol =>
            symbol.kind === "component"
        )
        .map(
          symbol =>
            symbol.name
        ),

    symbols:
      analysis.symbols,

  };

}