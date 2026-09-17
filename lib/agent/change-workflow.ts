import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createWorkspaceIndex } from "@/lib/intelligence/workspace-index";
import type { ChangeProposal } from "@/lib/intelligence/change-proposal";
import { validateChangeProposal } from "./change-validator";
import { applyGuardedPatch } from "./apply-patch";
import { guardedRead, guardedReplace } from "./guarded-files";
import { runVerification, type VerificationResult } from "./verification";

export interface ChangeWorkflowResult {
  status: "rejected" | "verified" | "rolled_back" | "rollback_conflict";
  errors: string[];
  verification: VerificationResult[];
  journal?: string;
}
interface Journal {
  version: 1;
  proposal: ChangeProposal;
  applied: string[];
  state: string;
}
const busy = new Set<string>();

async function journalDirectory(workspace: string): Promise<string> {
  const root = path.resolve(workspace);
  if (await fs.realpath(root) !== root) throw new Error("Workspace root must be canonical");
  let folder = root;
  for (const segment of [".codexia", "changes"]) {
    folder = path.join(folder, segment);
    try { await fs.mkdir(folder); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
    const stat = await fs.lstat(folder);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("Unsafe change journal directory");
  }
  return folder;
}
async function saveJournal(file: string, journal: Journal): Promise<void> {
  const temporary = `${file}.${randomUUID()}.tmp`;
  const handle = await fs.open(temporary, "wx", 0o600);
  try { await handle.writeFile(JSON.stringify(journal, null, 2)); await handle.sync(); }
  finally { await handle.close(); }
  await fs.rename(temporary, file);
}
async function rollback(workspace: string, journal: Journal): Promise<string[]> {
  const conflicts: string[] = [];
  // Inspect all targets: a process can fail after writing but before journaling.
  for (const change of [...journal.proposal.diff.changes].reverse()) {
    try {
      const current = await guardedRead(workspace, change.path);
      if (current === change.before) continue;
      if (current !== change.after) { conflicts.push(`Manual recovery required: ${change.path}`); continue; }
      await guardedReplace(workspace, change.path, change.after, change.before);
    } catch (error) { conflicts.push(error instanceof Error ? error.message : String(error)); }
  }
  return conflicts;
}

/** Coordinates Validator → Executor → verification → rollback/report. */
export async function applyReviewedChange(
  workspace: string,
  proposal: ChangeProposal,
  reviewedId: string,
  verify: () => Promise<VerificationResult[]> = () => runVerification(undefined, workspace),
  signal?: AbortSignal
): Promise<ChangeWorkflowResult> {
  const key = path.resolve(workspace);
  const result: ChangeWorkflowResult = { status: "rejected", errors: [], verification: [] };
  if (busy.has(key)) return { ...result, errors: ["Workspace change already in progress"] };
  busy.add(key);
  let journal: Journal | undefined;
  try {
    signal?.throwIfAborted();
    if (!proposal || reviewedId !== proposal.id) throw new Error("Review the exact proposal before application");
    const fresh = await createWorkspaceIndex(workspace);
    const validation = validateChangeProposal(fresh, proposal);
    if (!validation.valid) return { ...result, errors: validation.errors };
    // Preflight all paths before writing the journal or source.
    for (const change of proposal.diff.changes) await guardedRead(workspace, change.path);
    const directory = await journalDirectory(workspace);
    result.journal = `${directory}/${randomUUID()}.json`;
    journal = { version: 1, proposal, applied: [], state: "prepared" };
    await saveJournal(result.journal, journal);
    await applyGuardedPatch(workspace, proposal.diff, async file => {
      journal!.applied.push(file);
      journal!.state = "applying";
      await saveJournal(result.journal!, journal!);
    }, signal);
    signal?.throwIfAborted();
    result.verification = await verify();
    signal?.throwIfAborted();
    if (!result.verification.length || result.verification.some(check => !check.success)) throw new Error("Post-application verification failed");
    for (const change of proposal.diff.changes) {
      if (await guardedRead(workspace, change.path) !== change.after) {
        throw new Error(`Source changed during verification: ${change.path}`);
      }
    }
    journal.state = "verified";
    await saveJournal(result.journal, journal);
    result.status = "verified";
    return result;
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : String(error));
    if (journal) {
      const conflicts = await rollback(workspace, journal);
      result.errors.push(...conflicts);
      result.status = conflicts.length ? "rollback_conflict" : "rolled_back";
      journal.state = result.status;
      try { await saveJournal(result.journal!, journal); }
      catch (error) { result.errors.push(`Journal update failed: ${String(error)}`); }
    }
    return result;
  } finally { busy.delete(key); }
}

/** Explicit crash recovery; journal paths cannot select files outside .codexia. */
export async function recoverChange(workspace: string, journalName: string): Promise<ChangeWorkflowResult> {
  const key = path.resolve(workspace);
  if (busy.has(key) || !/^[0-9a-f-]+\.json$/.test(journalName)) {
    return { status: "rejected", errors: ["Invalid recovery request or busy workspace"], verification: [] };
  }
  busy.add(key);
  try {
    const file = path.join(await journalDirectory(workspace), journalName);
    if ((await fs.lstat(file)).isSymbolicLink()) throw new Error("Unsafe journal path");
    const journal = JSON.parse(await fs.readFile(file, "utf8")) as Journal;
    // Validate shape and source safety against the original snapshot representation.
    const current = await createWorkspaceIndex(workspace);
    if (journal.version !== 1 || !journal.proposal?.diff?.changes?.length) throw new Error("Invalid journal");
    const restored = { ...current, files: current.files.map(source => {
      const change = journal.proposal.diff.changes.find(change => change.path === source.path);
      return change ? { ...source, sourceText: change.before } : source;
    }) };
    const validation = validateChangeProposal(restored, journal.proposal);
    if (!validation.valid) throw new Error(`Recovery validation failed: ${validation.errors.join("; ")}`);
    if (journal.state === "verified") throw new Error("Verified changes cannot be crash-recovered");
    const errors = await rollback(workspace, journal);
    journal.state = errors.length ? "rollback_conflict" : "rolled_back";
    await saveJournal(file, journal);
    return { status: errors.length ? "rollback_conflict" : "rolled_back", errors, verification: [], journal: file };
  } catch (error) {
    return { status: "rejected", errors: [error instanceof Error ? error.message : String(error)], verification: [] };
  } finally { busy.delete(key); }
}
