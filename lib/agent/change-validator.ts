import ts from "typescript";
import { validateDiff } from "./patch-validator";
import { createCompilerProject, isWorkspacePath } from "@/lib/intelligence/compiler-project";
import { snapshotId, proposalId, type ChangeProposal } from "@/lib/intelligence/change-proposal";
import type { WorkspaceIndex } from "@/lib/intelligence/types";

export interface ChangeValidation {
  valid: boolean;
  errors: string[];
}

function compilerErrors(workspace: WorkspaceIndex): Map<string, number> {
  const project = createCompilerProject(workspace);
  const counts = new Map<string, number>();
  try {
    for (const [name, source] of project.sources) {
      if (!/\.[jt]sx?$/i.test(name)) continue;
      for (const diagnostic of [...project.service.getSyntacticDiagnostics(name), ...project.service.getSemanticDiagnostics(name)]) {
        if (diagnostic.category !== ts.DiagnosticCategory.Error) continue;
        const key = `${source.file}:${diagnostic.code}:${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    return counts;
  } finally { project.dispose(); }
}

/** Validate untrusted proposals before they cross into execution. */
export function validateChangeProposal(workspace: WorkspaceIndex, input: unknown): ChangeValidation {
  const errors: string[] = [];
  if (!input || typeof input !== "object") return { valid: false, errors: ["Missing change proposal"] };
  const proposal = input as ChangeProposal;
  if (!proposal.diff || !Array.isArray(proposal.diff.changes) || !proposal.diff.changes.length ||
    typeof proposal.title !== "string" || typeof proposal.origin !== "string" ||
    !["quickfix", "rename", "refactor"].includes(proposal.kind) || !Array.isArray(proposal.warnings) ||
    !proposal.warnings.every(warning => typeof warning === "string")) {
    return { valid: false, errors: ["Malformed or empty change proposal"] };
  }
  if (proposal.snapshot !== snapshotId(workspace)) errors.push("Workspace changed since proposal generation");
  const { id, ...body } = proposal;
  if (id !== proposalId(body)) errors.push("Proposal content does not match its identifier");
  const paths = new Set<string>();
  for (const change of proposal.diff.changes) {
    if (!change || typeof change.path !== "string" || !isWorkspacePath(change.path) ||
      !/\.(?:[jt]sx?|md)$/i.test(change.path) || typeof change.before !== "string" || typeof change.after !== "string") {
      errors.push("Changes must target existing workspace-relative TS/JS or Markdown sources");
      continue;
    }
    if (paths.has(change.path)) errors.push(`Duplicate file change: ${change.path}`);
    paths.add(change.path);
    const current = workspace.files.find(file => file.path === change.path);
    if (current?.sourceText === undefined || current.sourceText !== change.before) errors.push(`Stale source: ${change.path}`);
    if (change.before === change.after) errors.push(`Empty change: ${change.path}`);
  }
  if (errors.length) return { valid: false, errors };
  errors.push(...validateDiff(proposal.diff).errors);
  const changes = new Map(proposal.diff.changes.map(change => [change.path, change.after]));
  const updated = { ...workspace, files: workspace.files.map(file => changes.has(file.path)
    ? { ...file, sourceText: changes.get(file.path)! } : file) };
  const before = compilerErrors(workspace);
  for (const [key, count] of compilerErrors(updated)) {
    if (count > (before.get(key) ?? 0)) errors.push(`New compiler error: ${key}`);
  }
  return { valid: errors.length === 0, errors };
}
