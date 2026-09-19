import { randomUUID } from "node:crypto";
import { createWorkspaceIndex } from "@/lib/intelligence/workspace-index";
import { safeReadFile } from "@/lib/fs-safe";
import { goalDigest, validateEngineeringGoal } from "./governance";
import type { ChatResponse } from "./chat-contract";
import type { EngineeringCheck, EngineeringGoal } from "./types";

/** Admission adapter only: the existing EngineeringPlanner still creates proposals. */
export async function engineeringChatRequest(message: string, workspace: string): Promise<ChatResponse> {
  const unsupported = (content: string): ChatResponse => ({ kind: "unsupported", content });
  if (/\b(delete|remove\s+(?:the\s+)?file|publish|deploy|push|commit|install|dependencies)\b/i.test(message)) {
    return unsupported("This Chat engineering path supports reviewed edits to existing source files only. Deletion, publication and dependency changes are unavailable.");
  }
  const index = await createWorkspaceIndex(workspace);
  // Require explicit paths, not model-selected scope or fuzzy substring matches.
  const mentioned = message.match(/[\w@./-]+\.(?:tsx?|jsx?|md)\b/gi) ?? [];
  const files = [...new Set(mentioned.map(file => file.replace(/^\.\//, "")))];
  if (!files.length || files.length > 3 || files.some(file => !index.files.some(source => source.path === file && source.sourceText !== undefined))) {
    return unsupported("Name one to three existing workspace-relative TS, JS or Markdown files to edit. Creating new files or inferring a wider scope is not supported here.");
  }
  let scripts: Record<string, unknown>;
  try { scripts = JSON.parse(await safeReadFile("package.json", workspace)).scripts ?? {}; }
  catch { return unsupported("Engineering needs configured project verification. No readable package.json scripts were found; no runtime was started."); }
  const checks: EngineeringCheck[] = [];
  for (const [script, kind] of [["test", "tests"], ["lint", "lint"], ["build", "build"]] as const) {
    if (typeof scripts[script] === "string" && (scripts[script] as string).trim()) checks.push({ id: kind, kind });
  }
  if (!checks.length) return unsupported("Configure a test, lint or build script before requesting engineering changes. No safe verification operation is available.");
  const goal: EngineeringGoal = {
    title: message, mode: "repair", scope: { files, maxFilesPerBatch: files.length, maxRisk: "high" },
    checks, acceptance: checks.map(check => ({ id: check.id, checkId: check.id, description: `${check.id} must pass after the reviewed change` })),
    compatibilityChecks: checks.map(check => check.id), constraints: ["Implement only the explicit request in the named files; preserve unrelated behavior."],
    documentationFiles: [], budgets: { maxIterations: 8, maxRepairAttempts: 2, timeoutMs: 300000, noProgressLimit: 2 },
    tasks: [{ id: "chat-edit", title: message, files, dependsOn: [], operation: { kind: "repair" },
      evidenceIds: [], risk: "high", obligations: ["Review the exact proposal before any source change."] }],
  };
  validateEngineeringGoal(goal);
  return { kind: "engineering", content: "Starting a governed engineering request. Source changes require review of the exact proposal.",
    taskId: randomUUID(), goal, goalDigest: goalDigest(goal) };
}
