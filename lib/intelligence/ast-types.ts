import ts from "typescript";

export type SupportedLanguage =
  | "typescript"
  | "javascript";

export interface ParsedAst {
  language: SupportedLanguage;

  sourceFile: ts.SourceFile;
}