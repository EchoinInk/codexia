import type { AgentContext } from "../types";
import type { Plan } from "../planner";
import type { WorkflowOptions, WorkflowResult } from "../workflow";
import { applyReviewedChange } from "../change-workflow";
import { validateChangeProposal } from "../change-validator";
import { snapshotId } from "@/lib/intelligence/change-proposal";
import type { WorkspaceIndex } from "@/lib/intelligence/types";
import { authorizeProposal, invalidatePendingProposals } from "./governance";
import { evaluateEngineeringChecks } from "./verification";
import type { EngineeringCheckRunner } from "./types";

export function engineeringWorkflowResult(context: AgentContext, success: boolean, output: string,
  files: string[] = [], errors: string[] = []): WorkflowResult {
  return {
    execution: { context, success, output, filesModified: files },
    review: { success, summary: output, filesModified: files },
    validation: { valid: success, errors },
    state: { stage: success ? "complete" : "failed", approved: success, startedAt: Date.now(), completedAt: Date.now() },
  };
}

export async function runEngineeringWorkflow(plan: Plan, context: AgentContext, options: WorkflowOptions,
  dependencies: { index(): Promise<WorkspaceIndex>; checks: EngineeringCheckRunner }): Promise<WorkflowResult> {
  const session = context.engineering!;
  const data = plan.engineering;
  if (!data) throw new Error("Engineering plan metadata required");
  const taskState = session.tasks.find(task => task.task.id === data.taskId);
  if (data.escalation) {
    session.escalation = data.escalation;
    if (taskState) {
      taskState.status = taskState.pendingProposal && !taskState.pendingProposal.invalidatedReason && data.escalation.includes("Review proposal") ? "awaiting_approval"
        : taskState.attempts > 0 ? "failed" : data.escalation.includes("No safe supported") ? "unsupported" : "deferred";
      taskState.reason = data.escalation;
    }
    return engineeringWorkflowResult(context, false, data.escalation, [], [data.escalation]);
  }
  options.signal?.throwIfAborted();
  const current = await dependencies.index();
  if (session.expectedSnapshot !== snapshotId(current)) {
    session.escalation = "Workspace changed after planning; explicit replanning and review required";
    invalidatePendingProposals(session, session.escalation);
    return engineeringWorkflowResult(context, false, session.escalation, [], [session.escalation]);
  }
  if (data.finalVerification) {
    session.finalChecks = await dependencies.checks(session.goal.checks, context.workspace, options.signal);
    const errors = evaluateEngineeringChecks(session.goal.checks, session.finalChecks, session.baseline);
    if (snapshotId(await dependencies.index()) !== snapshotId(current)) {
      errors.push("Workspace changed during final verification; evidence must be revalidated");
    }
    for (const file of session.goal.documentationFiles) {
      if (!context.filesModified.includes(file)) errors.push(`Documentation obligation unfinished: ${file}`);
    }
    if (session.tasks.some(task => task.status !== "verified")) errors.push("Engineering tasks remain unfinished");
    session.complete = errors.length === 0;
    if (errors.length) session.escalation = errors.join("; ");
    session.audit.push({ at: Date.now(), type: "acceptance", snapshot: session.expectedSnapshot, detail: errors.length ? errors.join("; ") : "All original acceptance checks passed" });
    return engineeringWorkflowResult(context, !errors.length, errors.join("; ") || "Engineering acceptance verified", [], errors);
  }
  if (!taskState) throw new Error("Unknown engineering task");
  const required = new Set([...(taskState.task.checkIds ?? session.goal.checks.map(check => check.id)), ...session.goal.compatibilityChecks]);
  const checks = session.goal.checks.filter(check => required.has(check.id));
  if (!checks.length) throw new Error("A change batch must have verification requirements");
  let checkErrors: string[] = [];
  const verify = async () => {
    taskState.verification = await dependencies.checks(checks, context.workspace, options.signal);
    checkErrors = evaluateEngineeringChecks(checks, taskState.verification, session.baseline);
    return taskState.verification.map(result => ({ success: result.success && !checkErrors.length,
      command: result.id, output: result.output, error: checkErrors.join("; ") || undefined }));
  };
  let success = false;
  let files: string[] = [];
  if (data.proposal) {
    const pending = taskState.pendingProposal;
    const errors = [
      ...(!pending || pending.invalidatedReason || pending.proposal.id !== data.proposal.id
        ? ["Execution must use the exact valid checkpointed proposal"] : []),
      ...authorizeProposal(session.goal, session.approval, taskState.task, data.proposal, current),
      ...validateChangeProposal(current, data.proposal).errors];
    if (errors.length) {
      session.escalation = errors.join("; ");
      invalidatePendingProposals(session, session.escalation);
      return engineeringWorkflowResult(context, false, session.escalation, [], errors);
    }
    taskState.proposals.push(data.proposal.id);
    const result = await applyReviewedChange(context.workspace, data.proposal, data.proposal.id, verify, options.signal);
    // An attempted reviewed change is consumed. Existing bounded repair policy
    // may plan a subsequent attempt; it needs its own proposal approval.
    if (result.status === "rejected") {
      session.escalation = result.errors.join("; ") || "Proposal rejected; explicit replanning required";
      invalidatePendingProposals(session, session.escalation);
    } else taskState.pendingProposal = undefined;
    taskState.journal = result.journal;
    success = result.status === "verified";
    if (success) files = data.proposal.diff.changes.map(change => change.path);
    if (result.status === "rollback_conflict") session.escalation = "Rollback conflict requires explicit recovery before continuing";
    taskState.reason = result.errors.join("; ") || undefined;
    session.audit.push({ at: Date.now(), type: result.status, taskId: taskState.task.id,
      proposalId: data.proposal.id, snapshot: data.proposal.snapshot, provider: data.proposal.origin,
      detail: result.errors.join("; ") || `Verified change; recovery journal ${result.journal}` });
  } else {
    await verify();
    success = checkErrors.length === 0;
    taskState.reason = checkErrors.join("; ") || undefined;
  }
  context.filesModified = [...new Set([...context.filesModified, ...files])];
  taskState.status = success ? "verified" : "failed";
  if (!success && taskState.attempts >= session.goal.budgets.maxRepairAttempts) session.escalation = "Repair budget exhausted";
  const fresh = await dependencies.index();
  const authorizedAfter = data.proposal && success ? {
    ...current,
    files: current.files.map(file => {
      const change = data.proposal!.diff.changes.find(change => change.path === file.path);
      return change ? { ...file, sourceText: change.after } : file;
    }),
  } : current;
  if (snapshotId(fresh) !== snapshotId(authorizedAfter)) {
    session.escalation = "Unexpected workspace changes outside the approved patch; explicit revalidation required";
    success = false;
    taskState.status = "failed";
  }
  session.expectedSnapshot = snapshotId(authorizedAfter);
  session.inFlight = undefined;
  const progress = JSON.stringify([session.expectedSnapshot, session.tasks.filter(task => task.status === "verified").map(task => task.task.id),
    taskState.verification.map(result => [result.id, result.success, result.measurements])]);
  session.noProgress = progress === session.lastProgress ? session.noProgress + 1 : 0;
  session.lastProgress = progress;
  if (session.noProgress >= session.goal.budgets.noProgressLimit) session.escalation = "No measurable progress within the authorized budget";
  const output = success ? `Verified engineering task ${taskState.task.id}` : taskState.reason ?? "Engineering attempt failed";
  return engineeringWorkflowResult(context, success, output, files, success ? [] : [output]);
}
