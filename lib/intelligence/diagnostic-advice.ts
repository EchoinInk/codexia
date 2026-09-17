import type { DiagnosticAdvisor } from "@/lib/models/diagnostic-advisor";
import type { WorkspaceDiagnostic } from "./diagnostics";
import type { WorkspaceIndex } from "./types";
import { createChangeProposal, type ChangeProposal } from "./change-proposal";
import { validateChangeProposal } from "@/lib/agent/change-validator";

export async function explainDiagnostic(
  workspace: WorkspaceIndex,
  diagnostic: WorkspaceDiagnostic,
  advisor: DiagnosticAdvisor
): Promise<{ explanation: string; suggestions: string[]; actions: ChangeProposal[]; rejected: string[] }> {
  const source = workspace.files.find(file => file.path === diagnostic.file)?.sourceText;
  if (source === undefined) throw new Error("Diagnostic source is not indexed");
  if (source.length > 60000) throw new Error("Source exceeds AI explanation context limit");
  const input = await advisor.advise({ message: diagnostic.message, file: diagnostic.file,
    source, relatedFiles: diagnostic.relatedFiles });
  if (!input || typeof input !== "object") throw new Error("Invalid model advice");
  const advice = input as Record<string, unknown>;
  if (typeof advice.explanation !== "string" || !Array.isArray(advice.suggestions) ||
    !advice.suggestions.every(value => typeof value === "string")) throw new Error("Invalid model advice");
  const actions: ChangeProposal[] = [];
  const rejected: string[] = [];
  if (advice.replacement !== undefined) {
    if (typeof advice.replacement !== "string") rejected.push("Replacement must be source text");
    else {
      const proposal = createChangeProposal(workspace, `Suggested fix: ${diagnostic.message}`, "quickfix", "model", {
        changes: [{ path: diagnostic.file, before: source, after: advice.replacement }],
      }, ["AI suggestion: review behavior and intent before applying."]);
      const validation = validateChangeProposal(workspace, proposal);
      if (validation.valid) actions.push(proposal);
      else rejected.push(...validation.errors);
    }
  }
  return { explanation: advice.explanation, suggestions: advice.suggestions as string[], actions, rejected };
}
