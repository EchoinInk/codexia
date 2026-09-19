import type { AgentContext } from "../types";
import type { Planner, Plan } from "../planner";
import { planRename, planRefactoring } from "@/lib/intelligence/refactoring";
import { diagnoseWorkspace, diagnosticCodeActions } from "@/lib/intelligence/diagnostics";
import { createChangeProposal, type ChangeProposal } from "@/lib/intelligence/change-proposal";
import type { WorkspaceIndex } from "@/lib/intelligence/types";
import { validateChangeProposal } from "../change-validator";
import { authorizeProposal, validateEngineeringTasks } from "./governance";
import type { EngineeringGoal, EngineeringEvidence, EngineeringTask, EngineeringReasoner } from "./types";

export function decomposeEngineeringGoal(goal: EngineeringGoal, evidence: EngineeringEvidence): EngineeringTask[] {
  if (goal.tasks?.length) { validateEngineeringTasks(goal, goal.tasks); return structuredClone(goal.tasks); }
  if (goal.mode === "migration" || goal.mode === "refactor") throw new Error("Migration/refactor goals require explicit bounded stages");
  const findings = evidence.findings.filter(finding => finding.files.length && finding.files.every(file => goal.scope.files.includes(file)) &&
    (goal.mode !== "repair" || (finding.category === "diagnostic" && finding.severity === "error")));
  const tasks: EngineeringTask[] = [];
  const grouped = new Set<string>();
  for (const finding of findings) {
    const key = finding.files.join("\0");
    if (grouped.has(key)) continue;
    grouped.add(key);
    tasks.push({ id: `task-${tasks.length + 1}`, title: finding.summary, dependsOn: [], files: finding.files,
      operation: { kind: "repair", diagnosticId: finding.category === "diagnostic" ? finding.id : undefined },
      evidenceIds: [finding.id], risk: finding.category === "diagnostic" ? "low" : "high",
      obligations: ["Verify the acceptance checks and preserve compatibility constraints."] });
  }
  if (!tasks.length) tasks.push({ id: "investigate", title: goal.title, dependsOn: [],
    files: goal.scope.files.slice(0, goal.scope.maxFilesPerBatch), operation: { kind: "repair" },
    evidenceIds: [], risk: "low", obligations: ["Correlate failing checks with current source evidence."] });
  validateEngineeringTasks(goal, tasks);
  return tasks;
}

export class EngineeringPlanner implements Planner {
  constructor(private readonly index: () => WorkspaceIndex, private readonly reasoner?: EngineeringReasoner,
    private readonly signal?: () => AbortSignal | undefined) {}

  async createPlan(context: AgentContext): Promise<Plan> {
    const session = context.engineering;
    if (!session?.evidence) throw new Error("Engineering evidence required before planning");
    const base: Plan = { goal: session.goal.title, steps: [], files: [], engineering: {
      evidenceIds: [], assumptions: ["Evidence covers indexed saved files, not external consumers or unsaved buffers."],
      constraints: [...session.goal.constraints],
    } };
    if (session.escalation) return { ...base, engineering: { ...base.engineering!, escalation: session.escalation } };
    if (session.tasks.every(task => task.status === "verified")) return {
      ...base, steps: [{ action: "verify", description: "Evaluate every original acceptance criterion" }],
      engineering: { ...base.engineering!, finalVerification: true },
    };
    const ready = session.tasks.filter(candidate => candidate.status !== "verified" &&
      candidate.task.dependsOn.every(id => session.tasks.find(task => task.task.id === id)?.status === "verified"));
    const rank = (task: EngineeringTask): number => Math.min(...task.files.map(file => {
      const index = session.evidence!.dependencyOrder.indexOf(file);
      return index < 0 ? Number.MAX_SAFE_INTEGER : index;
    }));
    // Explicit stage dependencies are mandatory; dependency order breaks ties.
    ready.sort((a, b) => rank(a.task) - rank(b.task));
    const taskState = ready[0];
    if (!taskState) return { ...base, engineering: { ...base.engineering!, escalation: "No dependency-ready task; migration remains incomplete" } };
    if (taskState.attempts >= session.goal.budgets.maxRepairAttempts) return {
      ...base, engineering: { ...base.engineering!, taskId: taskState.task.id, escalation: "Repair budget exhausted; a newly authorized goal is required" },
    };
    if (session.noProgress >= session.goal.budgets.noProgressLimit) return {
      ...base, engineering: { ...base.engineering!, escalation: "No-progress budget exhausted; a newly authorized goal is required" },
    };
    const task = taskState.task;
    const index = this.index();
    // Checkpointed proposals survive approval renewal and process restart. Never
    // ask a reasoner to replace work that the user is currently reviewing.
    if (taskState.pendingProposal?.invalidatedReason ||
      (taskState.status === "awaiting_approval" && !taskState.pendingProposal)) {
      return { ...base, engineering: { ...base.engineering!, taskId: task.id,
        escalation: taskState.pendingProposal?.invalidatedReason ?? "Pending proposal missing; explicit replanning required" } };
    }
    let proposal: ChangeProposal | undefined = taskState.pendingProposal?.proposal;
    let conflict: string | undefined;
    if (!proposal) {
      if (task.operation.kind === "rename") {
        const result = planRename(index, task.operation.file, task.operation.position, task.operation.newName);
        proposal = result.proposal; conflict = result.conflicts.join("; ");
      } else if (task.operation.kind === "refactor") {
        const op = task.operation;
        const result = planRefactoring(index, op.file, op.range, op.refactor, op.action);
        proposal = result.proposal; conflict = result.conflicts.join("; ");
      } else if (task.operation.kind === "patch") {
        proposal = createChangeProposal(index, task.title, "refactor", "authorized-stage", task.operation.diff);
      } else if (task.operation.kind === "repair") {
        const report = await diagnoseWorkspace(index, undefined, this.signal?.());
        const diagnostics = report.diagnostics.filter(diagnostic => task.files.includes(diagnostic.file));
        const exact = diagnostics.find(diagnostic => diagnostic.id === (task.operation.kind === "repair" ? task.operation.diagnosticId : undefined));
        const actions = (exact ? [exact, ...diagnostics.filter(item => item !== exact)] : diagnostics)
          .flatMap(diagnostic => diagnosticCodeActions(index, diagnostic));
        proposal = actions.find(action => !taskState.proposals.includes(action.id) &&
          action.diff.changes.every(change => task.files.includes(change.path)));
        if (!proposal && this.reasoner) {
          const diff = await this.reasoner.propose({ task, evidence: session.evidence, index,
            failures: taskState.verification.length ? taskState.verification : session.baseline, signal: this.signal?.() });
          if (diff) proposal = createChangeProposal(index, task.title, "quickfix", this.reasoner.id, diff,
            ["Model-authored changes need behavior verification and authorized risk coverage."]);
        }
        if (!proposal) conflict = "No safe supported repair; additional provider or user input required";
      }
    }
    if (proposal) {
      const validation = validateChangeProposal(index, proposal);
      const authorization = authorizeProposal(session.goal, session.approval, task, proposal, index);
      const errors = [...(conflict ? [conflict] : []), ...validation.errors, ...authorization];
      if (taskState.proposals.includes(proposal.id)) errors.push("Repeated proposal made no progress");
      taskState.pendingProposal ??= { proposal: structuredClone(proposal) };
      // Missing exact approval is resumable. Invalid source, identity, risk or
      // scope is not: a new explicitly planned goal must replace this proposal.
      const invalid = errors.filter(error => error !== `Review proposal ${proposal.id} before application`);
      if (invalid.length) taskState.pendingProposal.invalidatedReason = invalid.join("; ");
      conflict = errors.join("; ");
    }
    return {
      ...base, files: proposal?.diff.changes.map(change => change.path) ?? task.files,
      steps: proposal ? [
        { action: "write", description: task.title },
        { action: "verify", description: "Run required checks without weakening acceptance criteria" },
      ] : [{ action: "verify", description: task.title }],
      impact: context.intelligence?.analyseImpact(task.files),
      engineering: { ...base.engineering!, taskId: task.id, proposal, evidenceIds: task.evidenceIds,
        escalation: conflict || undefined },
    };
  }
}
