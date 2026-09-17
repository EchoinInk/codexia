import { createHash } from "node:crypto";
import ts from "typescript";
import { createCompilerProject, sourceRange } from "./compiler-project";
import { createChangeProposal, compilerChangesToDiff, type ChangeProposal } from "./change-proposal";
import { validateChangeProposal } from "@/lib/agent/change-validator";
import type { WorkspaceIndex } from "./types";
import type { SourceRange } from "./symbols";

export interface WorkspaceDiagnostic {
  id: string;
  provider: string;
  code: string;
  severity: "error" | "warning" | "information";
  file: string;
  range?: SourceRange;
  message: string;
  explanation: string;
  relatedFiles: string[];
  suggestions: string[];
}

export interface DiagnosticProvider {
  id: string;
  diagnose(workspace: WorkspaceIndex, signal?: AbortSignal): Promise<WorkspaceDiagnostic[]>;
}

export interface DiagnosticReport {
  diagnostics: WorkspaceDiagnostic[];
  providerErrors: { provider: string; message: string }[];
  limitations: string[];
}

function diagnosticId(provider: string, file: string, code: string, start: number): string {
  return createHash("sha256").update(`${provider}:${file}:${code}:${start}`).digest("hex");
}

export const typescriptDiagnosticProvider: DiagnosticProvider = {
  id: "typescript",
  async diagnose(workspace, signal) {
    const project = createCompilerProject(workspace);
    try {
      const result: WorkspaceDiagnostic[] = [];
      for (const [name, source] of project.sources) {
        signal?.throwIfAborted();
        if (!/\.[jt]sx?$/i.test(name)) continue;
        const diagnostics = [
          ...project.service.getSyntacticDiagnostics(name),
          ...project.service.getSemanticDiagnostics(name),
          ...project.service.getSuggestionDiagnostics(name),
        ];
        const imported = workspace.files.find(file => file.path === source.file)?.code?.imports ?? [];
        const relatedFiles = [...new Set(imported.flatMap(specifier => {
          const target = project.resolveModule(source.file, specifier);
          return target ? [target] : [];
        }))];
        for (const diagnostic of diagnostics) {
          const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
          result.push({
            id: diagnosticId("typescript", source.file, String(diagnostic.code), diagnostic.start ?? 0),
            provider: "typescript", code: String(diagnostic.code), file: source.file,
            severity: diagnostic.category === ts.DiagnosticCategory.Error ? "error"
              : diagnostic.category === ts.DiagnosticCategory.Warning ? "warning" : "information",
            range: diagnostic.file && diagnostic.start !== undefined
              ? sourceRange(diagnostic.file, diagnostic.start, diagnostic.length ?? 0) : undefined,
            message,
            explanation: `${message} Reported in ${source.file}. ${relatedFiles.length
              ? `Indexed dependencies: ${relatedFiles.join(", ")}.` : "No indexed dependencies resolved."}`,
            relatedFiles,
            suggestions: diagnostic.code === 2307
              ? ["Check the import path and whether the dependency is included in the index."]
              : ["Inspect the highlighted source and available compiler code actions."],
          });
        }
      }
      for (const diagnostic of project.configurationErrors) {
        const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
        result.push({ id: diagnosticId("typescript", "tsconfig.json", String(diagnostic.code), 0),
          provider: "typescript", code: String(diagnostic.code), file: "tsconfig.json",
          severity: "warning", message, explanation: message, relatedFiles: [], suggestions: ["Review project configuration."] });
      }
      return result;
    } finally { project.dispose(); }
  },
};

export async function diagnoseWorkspace(
  workspace: WorkspaceIndex,
  providers: DiagnosticProvider[] = [typescriptDiagnosticProvider],
  signal?: AbortSignal
): Promise<DiagnosticReport> {
  const diagnostics = new Map<string, WorkspaceDiagnostic>();
  const providerErrors: DiagnosticReport["providerErrors"] = [];
  for (const provider of providers) {
    signal?.throwIfAborted();
    try {
      for (const diagnostic of await provider.diagnose(workspace, signal)) {
        diagnostics.set(`${provider.id}:${diagnostic.id}`, diagnostic);
      }
    } catch (error) {
      if (signal?.aborted) throw error;
      providerErrors.push({ provider: provider.id, message: error instanceof Error ? error.message : String(error) });
    }
  }
  return { diagnostics: [...diagnostics.values()].sort((a, b) =>
    a.file.localeCompare(b.file) || (a.range?.start.line ?? 0) - (b.range?.start.line ?? 0) || a.id.localeCompare(b.id)),
    providerErrors,
    limitations: ["Snapshot diagnostics exclude external packages and standard-library declarations; unresolved names may reflect incomplete indexing.",
      "Unsaved buffers and nested project configurations are not modeled."],
  };
}

export function diagnosticCodeActions(workspace: WorkspaceIndex, diagnostic: WorkspaceDiagnostic): ChangeProposal[] {
  if (diagnostic.provider !== "typescript" || !diagnostic.range || !/^\d+$/.test(diagnostic.code)) return [];
  const project = createCompilerProject(workspace);
  try {
    const start = project.position(diagnostic.file, diagnostic.range.start);
    const end = project.position(diagnostic.file, diagnostic.range.end);
    if (start === undefined || end === undefined) return [];
    const actions = project.service.getCodeFixesAtPosition(project.fileName(diagnostic.file), start, end,
      [Number(diagnostic.code)], {}, {});
    return actions.flatMap(action => {
      if (action.commands?.length) return [];
      try {
        const proposal = createChangeProposal(workspace, action.description, "quickfix", "typescript",
          compilerChangesToDiff(project, action.changes));
        return validateChangeProposal(workspace, proposal).valid ? [proposal] : [];
      } catch { return []; }
    });
  } finally { project.dispose(); }
}
