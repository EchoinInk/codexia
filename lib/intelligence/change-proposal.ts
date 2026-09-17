import { createHash } from "node:crypto";
import ts from "typescript";
import type { DiffResult } from "@/lib/agent/diff";
import type { WorkspaceIndex } from "./types";
import type { CompilerProject } from "./compiler-project";

export interface ChangeProposal {
  id: string;
  title: string;
  kind: "quickfix" | "rename" | "refactor";
  origin: string;
  snapshot: string;
  diff: DiffResult;
  warnings: string[];
}

export function snapshotId(workspace: WorkspaceIndex): string {
  return createHash("sha256").update(JSON.stringify(workspace.files.map(file => [
    file.path, file.sourceText ?? file.hash ?? file.preview,
  ]).sort((a, b) => a[0].localeCompare(b[0])))).digest("hex");
}

export function proposalId(proposal: Omit<ChangeProposal, "id">): string {
  return createHash("sha256").update(JSON.stringify(proposal)).digest("hex");
}

export function createChangeProposal(
  workspace: WorkspaceIndex,
  title: string,
  kind: ChangeProposal["kind"],
  origin: string,
  diff: DiffResult,
  warnings: string[] = []
): ChangeProposal {
  const proposal = { title, kind, origin, snapshot: snapshotId(workspace), diff, warnings };
  return { id: proposalId(proposal), ...proposal };
}

/** Only replacements of existing indexed source files are supported. */
export function compilerChangesToDiff(project: CompilerProject, changes: readonly ts.FileTextChanges[]): DiffResult {
  const grouped = new Map<string, ts.TextChange[]>();
  for (const change of changes) {
    if (change.isNewFile || !project.sources.has(change.fileName)) {
      throw new Error("Changes outside existing indexed source files are not supported");
    }
    grouped.set(change.fileName, [...(grouped.get(change.fileName) ?? []), ...change.textChanges]);
  }
  return { changes: [...grouped].map(([fileName, edits]) => {
    const source = project.sources.get(fileName)!;
    let after = source.text;
    let previousStart = source.text.length + 1;
    // Compiler fixes can insert several fragments at the same offset.
    const merged: ts.TextChange[] = [];
    for (const edit of edits) {
      const insertion = edit.span.length === 0
        ? merged.find(item => item.span.length === 0 && item.span.start === edit.span.start)
        : undefined;
      if (insertion) insertion.newText += edit.newText;
      else merged.push({ span: { ...edit.span }, newText: edit.newText });
    }
    for (const edit of merged.sort((a, b) => b.span.start - a.span.start)) {
      const { start, length } = edit.span;
      if (!Number.isInteger(start) || !Number.isInteger(length) || start < 0 || length < 0 ||
        start + length > source.text.length || start + length > previousStart || start === previousStart) {
        throw new Error("Invalid or overlapping source edits");
      }
      after = after.slice(0, start) + edit.newText + after.slice(start + length);
      previousStart = start;
    }
    return { path: source.file, before: source.text, after };
  }).filter(change => change.before !== change.after) };
}
