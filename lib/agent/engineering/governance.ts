import { createHash } from "node:crypto";
import { isWorkspacePath } from "@/lib/intelligence/compiler-project";
import { snapshotId } from "@/lib/intelligence/change-proposal";
import type { ChangeProposal } from "@/lib/intelligence/change-proposal";
import type { EngineeringApproval, EngineeringGoal, EngineeringTask, EngineeringRisk } from "./types";
import type { WorkspaceIndex } from "@/lib/intelligence/types";

const risk: Record<EngineeringRisk, number> = { low: 0, medium: 1, high: 2 };
export function goalDigest(goal: EngineeringGoal): string {
  return createHash("sha256").update(JSON.stringify(goal)).digest("hex");
}
export function validateEngineeringGoal(goal: EngineeringGoal): void {
  if (!goal || typeof goal.title !== "string" || !goal.title.trim() ||
    !["repair", "migration", "remediation", "refactor"].includes(goal.mode)) throw new Error("Invalid engineering goal");
  if (!goal.scope || !Array.isArray(goal.scope.files) || !goal.scope.files.length ||
    goal.scope.files.some(file => typeof file !== "string" || !isWorkspacePath(file)) ||
    new Set(goal.scope.files).size !== goal.scope.files.length || !Object.prototype.hasOwnProperty.call(risk, goal.scope.maxRisk) ||
    !Number.isInteger(goal.scope.maxFilesPerBatch) || goal.scope.maxFilesPerBatch < 1 || goal.scope.maxFilesPerBatch > 100) throw new Error("Invalid bounded scope");
  if (!goal.budgets || Object.values(goal.budgets).some(value => !Number.isInteger(value) || value < 1) ||
    !goal.budgets.maxIterations || goal.budgets.maxIterations > 100 || !goal.budgets.maxRepairAttempts ||
    !goal.budgets.noProgressLimit || !goal.budgets.timeoutMs || goal.budgets.timeoutMs > 86400000) throw new Error("Invalid engineering budgets");
  if (!Array.isArray(goal.checks) || !goal.checks.length || goal.checks.some(check => !check.id ||
    !["typecheck", "tests", "lint", "build", "benchmark", "security"].includes(check.kind) ||
    (check.metric && (!check.metric.name || !["lower", "higher"].includes(check.metric.direction) ||
      !Number.isFinite(check.metric.maxRegressionPercent) || check.metric.maxRegressionPercent < 0)))) throw new Error("Invalid verification requirements");
  const checks = new Set(goal.checks.map(check => check.id));
  if (checks.size !== goal.checks.length || !Array.isArray(goal.acceptance) || !goal.acceptance.length ||
    goal.acceptance.some(item => !item.id || !item.description || !checks.has(item.checkId)) ||
    new Set(goal.acceptance.map(item => item.id)).size !== goal.acceptance.length) throw new Error("Measurable acceptance criteria required");
  for (const list of [goal.constraints, goal.documentationFiles, goal.compatibilityChecks]) {
    if (!Array.isArray(list) || list.some(value => typeof value !== "string")) throw new Error("Invalid engineering constraints");
  }
  if (goal.documentationFiles.some(file => !goal.scope.files.includes(file)) ||
    goal.compatibilityChecks.some(id => !checks.has(id))) throw new Error("Obligation outside authorized scope");
  if (goal.tasks) validateEngineeringTasks(goal, goal.tasks);
}
export function validateEngineeringTasks(goal: EngineeringGoal, tasks: EngineeringTask[]): void {
  if (!Array.isArray(tasks) || tasks.length > 100) throw new Error("Invalid task decomposition");
  const ids = new Set(tasks.map(task => task.id));
  if (ids.size !== tasks.length) throw new Error("Duplicate engineering task ids");
  for (const task of tasks) {
    if (!task.id || !task.title || !Object.prototype.hasOwnProperty.call(risk, task.risk) || !Array.isArray(task.files) ||
      task.files.some(file => !goal.scope.files.includes(file)) || task.files.length > goal.scope.maxFilesPerBatch ||
      !Array.isArray(task.dependsOn) || task.dependsOn.some(id => !ids.has(id) || id === task.id) ||
      !Array.isArray(task.obligations) || !Array.isArray(task.evidenceIds) ||
      (task.checkIds && task.checkIds.some(id => !goal.checks.some(check => check.id === id))) ||
      !task.operation || !["repair", "rename", "refactor", "patch", "verify"].includes(task.operation.kind)) throw new Error(`Invalid task: ${task.id}`);
    if ((task.operation.kind === "rename" || task.operation.kind === "refactor") && !task.files.includes(task.operation.file)) throw new Error("Operation outside task scope");
  }
  const visited = new Set<string>();
  const active = new Set<string>();
  const visit = (id: string): void => {
    if (active.has(id)) throw new Error("Engineering task dependency cycle");
    if (visited.has(id)) return;
    active.add(id);
    for (const dependency of tasks.find(task => task.id === id)!.dependsOn) visit(dependency);
    active.delete(id); visited.add(id);
  };
  tasks.forEach(task => visit(task.id));
}
export function validateEngineeringApproval(goal: EngineeringGoal, approval: EngineeringApproval, now = Date.now()): void {
  if (!approval || approval.goalDigest !== goalDigest(goal) || typeof approval.approvedBy !== "string" || !approval.approvedBy.trim() ||
    !Number.isFinite(approval.approvedAt) || !Number.isFinite(approval.expiresAt) || approval.approvedAt > now || approval.expiresAt <= now ||
    !["proposal", "bounded"].includes(approval.mode) || !Array.isArray(approval.proposalIds) ||
    approval.proposalIds.some(id => typeof id !== "string")) throw new Error("Current explicit approval for the exact goal is required");
}
export function authorizeProposal(goal: EngineeringGoal, approval: EngineeringApproval, task: EngineeringTask,
  proposal: ChangeProposal, index: WorkspaceIndex): string[] {
  const errors: string[] = [];
  try { validateEngineeringApproval(goal, approval); } catch (error) { errors.push(String(error)); }
  if (proposal.snapshot !== snapshotId(index)) errors.push("Proposal evidence is stale");
  const intrinsicRisk = proposal.origin !== "typescript" ? risk.high
    : proposal.kind !== "quickfix" || proposal.diff.changes.length > 1 ? risk.medium : risk.low;
  if (Math.max(risk[task.risk], intrinsicRisk) > risk[goal.scope.maxRisk]) errors.push("Task risk exceeds approval");
  if (proposal.diff.changes.length > goal.scope.maxFilesPerBatch) errors.push("Change batch exceeds authorized size");
  for (const change of proposal.diff.changes) {
    if (!goal.scope.files.includes(change.path) || !task.files.includes(change.path)) errors.push(`Scope expansion requires approval: ${change.path}`);
  }
  if (approval.mode === "proposal" && !approval.proposalIds.includes(proposal.id)) errors.push(`Review proposal ${proposal.id} before application`);
  return errors;
}
