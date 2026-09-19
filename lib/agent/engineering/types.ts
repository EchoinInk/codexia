import type { DiffResult } from "../diff";
import type { ChangeProposal } from "@/lib/intelligence/change-proposal";
import type { SourcePosition, SourceRange } from "@/lib/intelligence/symbols";
import type { WorkspaceIndex } from "@/lib/intelligence/types";
import type { ArchitectureOptions } from "@/lib/intelligence/architecture-analysis";
import type { AgentAdvice, AgentReview } from "../multi-agent/types";

export type EngineeringRisk = "low" | "medium" | "high";
export interface EngineeringCheck {
  id: string;
  kind: "typecheck" | "tests" | "lint" | "build" | "benchmark" | "security";
  metric?: { name: string; direction: "lower" | "higher"; maxRegressionPercent: number };
}
export interface EngineeringCheckResult {
  id: string;
  success: boolean;
  output: string;
  provider: string;
  measuredAt: number;
  measurements?: Record<string, number>;
}
export interface EngineeringFinding {
  id: string;
  category: "diagnostic" | "architecture" | "performance" | "security";
  severity: "information" | "warning" | "error" | "critical";
  confidence: number;
  files: string[];
  summary: string;
  provider: string;
  snapshot: string;
  observedAt: number;
  evidence: string[];
  effort: number;
}
export interface EngineeringFindingProvider {
  id: string;
  collect(index: WorkspaceIndex, signal?: AbortSignal): Promise<EngineeringFinding[]>;
}
export type EngineeringOperation =
  | { kind: "repair"; diagnosticId?: string }
  | { kind: "rename"; file: string; position: SourcePosition; newName: string }
  | { kind: "refactor"; file: string; range: SourceRange; refactor: string; action: string }
  | { kind: "patch"; diff: DiffResult }
  | { kind: "verify" };
export interface EngineeringTask {
  id: string;
  title: string;
  dependsOn: string[];
  files: string[];
  operation: EngineeringOperation;
  evidenceIds: string[];
  checkIds?: string[];
  risk: EngineeringRisk;
  obligations: string[];
}
export interface EngineeringGoal {
  title: string;
  mode: "repair" | "migration" | "remediation" | "refactor";
  scope: { files: string[]; maxFilesPerBatch: number; maxRisk: EngineeringRisk };
  checks: EngineeringCheck[];
  acceptance: { id: string; description: string; checkId: string }[];
  compatibilityChecks: string[];
  constraints: string[];
  documentationFiles: string[];
  tasks?: EngineeringTask[];
  architecture?: ArchitectureOptions;
  budgets: { maxIterations: number; maxRepairAttempts: number; timeoutMs: number; noProgressLimit: number };
}
export interface EngineeringApproval {
  goalDigest: string;
  approvedBy: string;
  approvedAt: number;
  expiresAt: number;
  mode: "proposal" | "bounded";
  proposalIds: string[];
}
export interface EngineeringEvidence {
  snapshot: string;
  observedAt: number;
  findings: EngineeringFinding[];
  providerErrors: string[];
  memory: { id: string; source: string; summary: string; files: string[]; relatedFailureId?: string }[];
  dependencyOrder: string[];
}
export interface EngineeringTaskState {
  task: EngineeringTask;
  status: "pending" | "verified" | "failed" | "deferred" | "unsupported" | "awaiting_approval";
  attempts: number;
  proposals: string[];
  /** Durable input to the reviewed workflow; never regenerated on approval resume. */
  pendingProposal?: { proposal: ChangeProposal; invalidatedReason?: string };
  reason?: string;
  verification: EngineeringCheckResult[];
  journal?: string;
}
export interface EngineeringAuditEvent {
  at: number;
  type: string;
  taskId?: string;
  snapshot?: string;
  proposalId?: string;
  detail: string;
  provider?: string;
}
export interface EngineeringSession {
  version: 1;
  goal: EngineeringGoal;
  approval: EngineeringApproval;
  evidence?: EngineeringEvidence;
  initialFindings: EngineeringFinding[];
  expectedSnapshot?: string;
  baseline: EngineeringCheckResult[];
  finalChecks: EngineeringCheckResult[];
  tasks: EngineeringTaskState[];
  audit: EngineeringAuditEvent[];
  advice: AgentAdvice[];
  review?: AgentReview;
  lastProgress?: string;
  noProgress: number;
  escalation?: string;
  inFlight?: { taskId: string; proposalId: string };
  complete: boolean;
}
export interface EngineeringPlanData {
  taskId?: string;
  proposal?: ChangeProposal;
  evidenceIds: string[];
  assumptions: string[];
  constraints: string[];
  escalation?: string;
  finalVerification?: boolean;
}
/** Optional model-provider boundary; output is data, never executable tools. */
export interface EngineeringReasoner {
  id: string;
  propose(input: { task: EngineeringTask; evidence: EngineeringEvidence; index: WorkspaceIndex;
    failures: EngineeringCheckResult[]; signal?: AbortSignal }): Promise<DiffResult | undefined>;
}
export type EngineeringCheckRunner = (checks: EngineeringCheck[], workspace: string, signal?: AbortSignal) => Promise<EngineeringCheckResult[]>;

/** Read-only projection of checkpoint state, never client-owned authority. */
export interface EngineeringPendingProposal {
  runtimeId: string;
  taskId: string;
  proposal: ChangeProposal;
  /** ChangeProposal.id is its SHA-256 content digest, not a separate identity. */
  digest: string;
  workspace: string;
  affectedPaths: string[];
  risk: { task: EngineeringRisk; required: EngineeringRisk; allowed: EngineeringRisk };
  scope: EngineeringGoal["scope"];
  taskFiles: string[];
  approval: { mode: EngineeringApproval["mode"]; goalDigest: string; proposalIds: string[] };
  checks: EngineeringCheck[];
  acceptance: EngineeringGoal["acceptance"];
  constraints: string[];
  obligations: string[];
  status: "awaiting_approval";
  reason: string;
}
