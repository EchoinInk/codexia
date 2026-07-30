import ts from "typescript";

import type {
  CodeSymbol,
} from "./symbols";


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


  function visit(
    node: ts.Node
  ) {

    if (
      ts.isImportDeclaration(node)
      &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {

      imports.push(
        node.moduleSpecifier.text
      );

    }


    if (
      hasExportModifier(node)
      &&
      hasNamedDeclaration(node)
    ) {

      const name =
        getDeclarationName(node);


      if (name) {

        exports.push(name);

      }

    }


    const symbol =
      extractSymbol(node);


    if (symbol) {

      symbols.push(symbol);

    }


    ts.forEachChild(
      node,
      visit
    );

  }


  visit(sourceFile);


  return {
    imports,

    exports,

    symbols,
  };
}


function extractSymbol(
  node: ts.Node
): CodeSymbol | null {

  const line =
    node.getSourceFile()
      .getLineAndCharacterOfPosition(
        node.getStart()
      )
      .line + 1;


  if (
    ts.isFunctionDeclaration(node)
    &&
    node.name
  ) {

    return {
      name: node.name.text,
      kind: "function",
      exported: hasExportModifier(node),
      line,
    };

  }


  if (
    ts.isClassDeclaration(node)
    &&
    node.name
  ) {

    return {
      name: node.name.text,
      kind: "class",
      exported: hasExportModifier(node),
      line,
    };

  }


  if (
    ts.isInterfaceDeclaration(node)
  ) {

    return {
      name: node.name.text,
      kind: "interface",
      exported: hasExportModifier(node),
      line,
    };

  }


  if (
    ts.isTypeAliasDeclaration(node)
  ) {

    return {
      name: node.name.text,
      kind: "type",
      exported: hasExportModifier(node),
      line,
    };

  }


  if (
    ts.isEnumDeclaration(node)
  ) {

    return {
      name: node.name.text,
      kind: "enum",
      exported: hasExportModifier(node),
      line,
    };

  }


  if (
    ts.isVariableStatement(node)
  ) {

    const declaration =
      node.declarationList
        .declarations[0];


    if (
      declaration?.name
      &&
      ts.isIdentifier(
        declaration.name
      )
    ) {

      const name =
        declaration.name.text;


      return {
        name,
        kind:
          /^[A-Z]/.test(name)
            ? "component"
            : "variable",
        exported:
          hasExportModifier(node),
        line,
      };

    }

  }


  return null;
}


function hasExportModifier(
  node: ts.Node
): boolean {

  if (
    !ts.canHaveModifiers(node)
  ) {
    return false;
  }


  return !!(
    ts.getModifiers(node)
      ?.some(
        modifier =>
          modifier.kind === ts.SyntaxKind.ExportKeyword
      )
  );

}


function hasNamedDeclaration(
  node: ts.Node
): boolean {

  return (
    ts.isFunctionDeclaration(node)
    ||
    ts.isClassDeclaration(node)
    ||
    ts.isVariableStatement(node)
    ||
    ts.isInterfaceDeclaration(node)
    ||
    ts.isTypeAliasDeclaration(node)
    ||
    ts.isEnumDeclaration(node)
  );

}


function getDeclarationName(
  node: ts.Node
): string | null {

  if (
    (
      ts.isFunctionDeclaration(node)
      ||
      ts.isClassDeclaration(node)
      ||
      ts.isInterfaceDeclaration(node)
      ||
      ts.isTypeAliasDeclaration(node)
      ||
      ts.isEnumDeclaration(node)
    )
    &&
    node.name
  ) {

    return node.name.text;

  }


  if (
    ts.isVariableStatement(node)
  ) {

    const declaration =
      node.declarationList
        .declarations[0];


    if (
      declaration
      &&
      ts.isIdentifier(
        declaration.name
      )
    ) {

      return declaration.name.text;

    }

  }


  return null;

}