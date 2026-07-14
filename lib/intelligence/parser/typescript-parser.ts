import path from "path";
import ts from "typescript";

import type { ParsedAst } from "../ast-types";
import type { SourceParser } from "./parser";

const supportedExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
]);

export class TypeScriptParser
  implements SourceParser {

  supports(filePath: string): boolean {

    return supportedExtensions.has(
      path.extname(filePath).toLowerCase()
    );

  }

  parse(
    filePath: string,
    content: string
  ): ParsedAst | null {

    if (!this.supports(filePath)) {
      return null;
    }

    const extension = path.extname(filePath);

    const scriptKind =
      extension === ".tsx"
        ? ts.ScriptKind.TSX
        : extension === ".jsx"
          ? ts.ScriptKind.JSX
          : extension === ".js"
            ? ts.ScriptKind.JS
            : ts.ScriptKind.TS;

    return {

      language:
        extension === ".js" ||
        extension === ".jsx"
          ? "javascript"
          : "typescript",

      sourceFile: ts.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.Latest,
        true,
        scriptKind
      ),

    };
  }
}