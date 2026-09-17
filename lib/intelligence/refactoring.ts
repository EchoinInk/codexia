import ts from "typescript";
import { createCompilerProject } from "./compiler-project";
import { createChangeProposal, compilerChangesToDiff, type ChangeProposal } from "./change-proposal";
import { validateChangeProposal } from "@/lib/agent/change-validator";
import type { WorkspaceIndex } from "./types";
import type { SourcePosition, SourceRange } from "./symbols";

export interface RefactoringResult {
  proposal?: ChangeProposal;
  conflicts: string[];
}

function validated(workspace: WorkspaceIndex, proposal: ChangeProposal): RefactoringResult {
  const validation = validateChangeProposal(workspace, proposal);
  return validation.valid ? { proposal, conflicts: [] } : { conflicts: validation.errors };
}

function validIdentifier(name: string): boolean {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false);
  scanner.setText(name);
  return scanner.scan() === ts.SyntaxKind.Identifier && scanner.getTokenText() === name &&
    scanner.scan() === ts.SyntaxKind.EndOfFileToken;
}

export function planRename(
  workspace: WorkspaceIndex,
  file: string,
  position: SourcePosition,
  newName: string
): RefactoringResult {
  if (!validIdentifier(newName)) return { conflicts: ["New name must be a non-keyword identifier"] };
  const project = createCompilerProject(workspace);
  try {
    const offset = project.position(file, position);
    if (offset === undefined) return { conflicts: ["Invalid rename position"] };
    const fileName = project.fileName(file);
    const info = project.service.getRenameInfo(fileName, offset, { allowRenameOfImportPath: false });
    if (!info.canRename) return { conflicts: [info.localizedErrorMessage] };
    if (info.fileToRename) return { conflicts: ["File renames are not supported"] };
    const locations = project.service.findRenameLocations(fileName, offset, false, false, true);
    if (!locations?.length) return { conflicts: ["No indexed rename locations"] };
    const conflicts = new Set<string>();
    const byFile = new Map<string, ts.TextChange[]>();
    const program = project.service.getProgram();
    const checker = program?.getTypeChecker();
    for (const location of locations) {
      const source = project.sources.get(location.fileName);
      const ast = program?.getSourceFile(location.fileName);
      if (!source || !ast) { conflicts.add("Rename reaches outside indexed sources"); continue; }
      // Conservatively reject existing identifiers in affected files. This also
      // catches capture of currently unrelated references and member collisions.
      const visit = (node: ts.Node): void => {
        if (ts.isIdentifier(node) && node.text === newName) conflicts.add(`Name already exists in ${source.file}: ${newName}`);
        if (node.getStart(ast) <= location.textSpan.start && node.getEnd() > location.textSpan.start) {
          if (ts.isIdentifier(node) && checker?.getSymbolsInScope(node,
            ts.SymbolFlags.Value | ts.SymbolFlags.Type | ts.SymbolFlags.Namespace | ts.SymbolFlags.Alias)
            .some(symbol => symbol.name === newName)) conflicts.add(`Name conflicts in scope: ${newName}`);
        }
        ts.forEachChild(node, visit);
      };
      visit(ast);
      byFile.set(location.fileName, [...(byFile.get(location.fileName) ?? []), {
        span: location.textSpan,
        newText: `${location.prefixText ?? ""}${newName}${location.suffixText ?? ""}`,
      }]);
    }
    if (conflicts.size) return { conflicts: [...conflicts] };
    const diff = compilerChangesToDiff(project, [...byFile].map(([fileName, textChanges]) => ({ fileName, textChanges })));
    return validated(workspace, createChangeProposal(workspace, `Rename ${info.displayName} to ${newName}`, "rename", "typescript", diff,
      ["Only indexed references are covered. Review public API consumers and dynamic property access outside the workspace."]));
  } catch (error) {
    return { conflicts: [error instanceof Error ? error.message : String(error)] };
  } finally { project.dispose(); }
}

export interface RefactoringAction {
  refactor: string;
  action: string;
  description: string;
}

export function availableRefactorings(workspace: WorkspaceIndex, file: string, range: SourceRange): RefactoringAction[] {
  const project = createCompilerProject(workspace);
  try {
    const pos = project.position(file, range.start);
    const end = project.position(file, range.end);
    if (pos === undefined || end === undefined || end < pos) return [];
    return project.service.getApplicableRefactors(project.fileName(file), { pos, end }, {}).flatMap(refactor =>
      refactor.actions.filter(action => !action.notApplicableReason).map(action => ({
        refactor: refactor.name, action: action.name, description: action.description,
      })));
  } finally { project.dispose(); }
}

export function planRefactoring(
  workspace: WorkspaceIndex, file: string, range: SourceRange, refactor: string, action: string
): RefactoringResult {
  const project = createCompilerProject(workspace);
  try {
    const pos = project.position(file, range.start);
    const end = project.position(file, range.end);
    if (pos === undefined || end === undefined || end < pos) return { conflicts: ["Invalid source range"] };
    const available = project.service.getApplicableRefactors(project.fileName(file), { pos, end }, {});
    if (!available.some(item => item.name === refactor && item.actions.some(item => item.name === action && !item.notApplicableReason))) {
      return { conflicts: ["Refactoring is not applicable to this selection"] };
    }
    const edits = project.service.getEditsForRefactor(project.fileName(file), {}, { pos, end }, refactor, action, {});
    if (!edits || edits.commands?.length) return { conflicts: ["Refactoring requires unsupported external operations"] };
    return validated(workspace, createChangeProposal(workspace, action, "refactor", "typescript",
      compilerChangesToDiff(project, edits.edits), ["Review behavior and run project verification before accepting this refactor."]));
  } catch (error) { return { conflicts: [error instanceof Error ? error.message : String(error)] }; }
  finally { project.dispose(); }
}
