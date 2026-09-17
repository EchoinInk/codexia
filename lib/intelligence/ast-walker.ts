import ts from "typescript";

import type { CodeSymbol, SymbolKind } from "./symbols";

export interface AstAnalysis {
  imports: string[];
  exports: string[];
  symbols: CodeSymbol[];
}

export function analyseAst(
  sourceFile: ts.SourceFile
): AstAnalysis {
  const imports: string[] = [];
  const exports: string[] = [];
  const symbols: CodeSymbol[] = [];

  function addSymbol(
    name: ts.Node,
    kind: SymbolKind,
    exported: boolean,
    container?: string
  ): string {
    const text = ts.isIdentifier(name) || ts.isStringLiteral(name)
      ? name.text
      : name.getText(sourceFile);
    const start = sourceFile.getLineAndCharacterOfPosition(name.getStart(sourceFile));
    const end = sourceFile.getLineAndCharacterOfPosition(name.getEnd());
    symbols.push({
      name: text,
      kind,
      exported,
      line: start.line + 1,
      container,
      range: {
        start: { line: start.line + 1, column: start.character + 1 },
        end: { line: end.line + 1, column: end.character + 1 },
      },
    });
    if (exported) exports.push(text);
    return container ? `${container}.${text}` : text;
  }

  function addBinding(
    name: ts.BindingName,
    exported: boolean,
    container?: string
  ): void {
    if (ts.isIdentifier(name)) {
      // Preserve the existing component classification convention.
      addSymbol(name, /^[A-Z]/.test(name.text) ? "component" : "variable", exported, container);
      return;
    }
    for (const element of name.elements) {
      if (ts.isBindingElement(element)) addBinding(element.name, exported, container);
    }
  }

  function visit(node: ts.Node, container?: string): void {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push(node.moduleSpecifier.text);
    }

    let childContainer = container;
    if (ts.isFunctionDeclaration(node) && node.name) {
      childContainer = addSymbol(node.name, "function", hasExportModifier(node), container);
    } else if (ts.isClassDeclaration(node) && node.name) {
      childContainer = addSymbol(node.name, "class", hasExportModifier(node), container);
    } else if (ts.isInterfaceDeclaration(node)) {
      childContainer = addSymbol(node.name, "interface", hasExportModifier(node), container);
    } else if (ts.isTypeAliasDeclaration(node)) {
      childContainer = addSymbol(node.name, "type", hasExportModifier(node), container);
    } else if (ts.isEnumDeclaration(node)) {
      childContainer = addSymbol(node.name, "enum", hasExportModifier(node), container);
    } else if (ts.isVariableDeclaration(node)) {
      const statement = ts.isVariableDeclarationList(node.parent) ? node.parent.parent : undefined;
      addBinding(node.name, !!statement && ts.isVariableStatement(statement) &&
        hasExportModifier(statement), container);
      if (ts.isIdentifier(node.name)) {
        childContainer = container ? `${container}.${node.name.text}` : node.name.text;
      }
    } else if (ts.isMethodDeclaration(node) || ts.isMethodSignature(node) ||
      ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)) {
      childContainer = addSymbol(node.name, "method", false, container);
    } else if (ts.isPropertyDeclaration(node) || ts.isPropertySignature(node)) {
      childContainer = addSymbol(node.name, "property", false, container);
    }

    ts.forEachChild(node, child => visit(child, childContainer));
  }

  visit(sourceFile);
  return { imports, exports: [...new Set(exports)], symbols };
}

function hasExportModifier(node: ts.Node): boolean {
  return ts.canHaveModifiers(node) && !!ts.getModifiers(node)?.some(
    modifier => modifier.kind === ts.SyntaxKind.ExportKeyword
  );
}
