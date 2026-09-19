import { createHash } from "node:crypto";

import type { ArchitectureReport } from "./architecture-analysis";
import type { DiagnosticReport } from "./diagnostics";
import type {
  WorkspaceEvidenceState,
  WorkspaceEvolutionEntry,
  WorkspaceLearningEntry,
  WorkspaceMemorySnapshot,
} from "./workspace-memory";
import type {
  WorkspaceIntelligenceSnapshot,
  WorkspaceIntelligenceStatus,
} from "./workspace-intelligence-snapshot";

export type InsightCategory =
  | "diagnostic"
  | "architecture"
  | "dependency"
  | "evolution"
  | "learning"
  | "refactoring"
  | "maintainability";

export type InsightPriority = "critical" | "high" | "medium" | "low" | "informational";
export type InsightState =
  | WorkspaceIntelligenceStatus
  | "historical"
  | "contradicted"
  | "invalidated";

export interface InsightEvidence {
  source: "diagnostic" | "architecture" | "evolution" | "learning";
  id: string;
  label: string;
  snapshotId?: string;
  state?: WorkspaceEvidenceState;
}

export interface InsightPriorityFactors {
  validity: number;
  sourceSeverity: number;
  impact: number;
  recurrence: number;
  strength: number;
}

export interface EngineeringInsight {
  id: string;
  category: InsightCategory;
  summary: string;
  rationale: string;
  affectedFiles: string[];
  affectedDirectories: string[];
  affectedSymbols: string[];
  evidence: InsightEvidence[];
  provenance: {
    workspace: string;
    snapshotId: string;
    generatedAt: number;
    sources: string[];
  };
  state: InsightState;
  severity: "error" | "warning" | "information";
  priority: InsightPriority;
  priorityFactors: InsightPriorityFactors;
  persistence: {
    observationCount: number;
    distinctSnapshots: number;
    firstObservedAt?: number;
    lastObservedAt?: number;
    repeated: boolean;
  };
  limitations: string[];
  contradictions: string[];
}

export interface EngineeringInsightsInput {
  snapshot: WorkspaceIntelligenceSnapshot;
  diagnostics?: DiagnosticReport;
  architecture?: ArchitectureReport;
  memory?: WorkspaceMemorySnapshot;
}

export interface EngineeringInsightsResult {
  model: "phase-8.3-v1";
  insights: EngineeringInsight[];
  limitations: string[];
}

const MAX_INSIGHTS = 100;
const MAX_EVIDENCE = 8;
const MAX_PATHS = 20;
const MAX_TEXT = 500;

const categoryOrder: Record<InsightCategory, number> = {
  diagnostic: 0,
  dependency: 1,
  architecture: 2,
  maintainability: 3,
  refactoring: 4,
  evolution: 5,
  learning: 6,
};

const stateOrder: Record<InsightState, number> = {
  current: 0,
  stale: 1,
  incomplete: 2,
  historical: 3,
  contradicted: 4,
  invalidated: 5,
  unavailable: 6,
  failed: 7,
};

export function deriveEngineeringInsights(input: EngineeringInsightsInput): EngineeringInsightsResult {
  const { snapshot } = input;
  if (!snapshot.usable || !snapshot.provenance || !snapshot.evidence) {
    return {
      model: "phase-8.3-v1",
      insights: [],
      limitations: [
        snapshot.status === "unavailable"
          ? "Workspace intelligence is unavailable; no ordinary engineering priorities can be derived."
          : snapshot.status === "failed"
            ? "Workspace intelligence refresh failed; no ordinary engineering priorities can be derived."
            : "Workspace intelligence has no usable provenance or evidence.",
      ],
    };
  }

  const records = [
    ...diagnosticInsights(snapshot, input.diagnostics),
    ...architectureInsights(snapshot, input.architecture),
    ...memoryInsights(snapshot, input.memory),
  ];
  const insights = records
    .map(withPriority)
    .sort(compareInsights)
    .slice(0, MAX_INSIGHTS);

  const limitations = [
    ...(input.diagnostics?.providerErrors ?? []).map(error => `Diagnostic provider ${error.provider}: ${error.message}`),
    ...(input.diagnostics?.limitations ?? []),
    ...(input.architecture?.limitations ?? []),
  ];
  if (snapshot.status === "stale") limitations.push("Priorities are derived from a stale snapshot and are demoted until refresh completes.");
  if (snapshot.status === "incomplete") limitations.push("Priorities are derived from incomplete evidence and may omit affected workspace areas.");

  return {
    model: "phase-8.3-v1",
    insights,
    limitations: uniqueSorted(limitations).slice(0, 20),
  };
}

function diagnosticInsights(snapshot: WorkspaceIntelligenceSnapshot, report?: DiagnosticReport): Array<Omit<EngineeringInsight, "priority" | "priorityFactors">> {
  if (!report) return [];
  return report.diagnostics.map(diagnostic => {
    const files = [diagnostic.file, ...diagnostic.relatedFiles];
    return baseInsight(snapshot, "diagnostic", diagnostic.id, diagnostic.severity, diagnostic.message,
      diagnostic.explanation, files, [], diagnostic.range ? [diagnostic.file] : [], [{
        source: "diagnostic", id: diagnostic.id, label: truncate(diagnostic.message), snapshotId: snapshot.provenance?.snapshotId,
      }], []);
  });
}

function architectureInsights(snapshot: WorkspaceIntelligenceSnapshot, report?: ArchitectureReport): Array<Omit<EngineeringInsight, "priority" | "priorityFactors">> {
  if (!report) return [];
  return report.findings.map(finding => {
    const category: InsightCategory = finding.kind === "dependency_cycle" || finding.kind === "unresolved_import"
      ? "dependency" : "architecture";
    return baseInsight(snapshot, category, finding.id, finding.severity, finding.message, finding.recommendation,
      [finding.file, ...finding.evidence], [], [], [{
        source: "architecture", id: finding.id, label: truncate(finding.evidence.join("; ")), snapshotId: snapshot.provenance?.snapshotId,
      }], finding.confidence === "limited" ? ["External consumers or dynamic behavior may not be indexed."] : []);
  });
}

function memoryInsights(snapshot: WorkspaceIntelligenceSnapshot, memory?: WorkspaceMemorySnapshot): Array<Omit<EngineeringInsight, "priority" | "priorityFactors">> {
  if (!memory) return [];
  return [
    ...memory.evolution.map(entry => memoryInsight(snapshot, "evolution", entry)),
    ...memory.learning.map(entry => memoryInsight(snapshot, "learning", entry)),
  ];
}

function memoryInsight(
  snapshot: WorkspaceIntelligenceSnapshot,
  category: "evolution" | "learning",
  entry: WorkspaceEvolutionEntry | WorkspaceLearningEntry
): Omit<EngineeringInsight, "priority" | "priorityFactors"> {
  const evidence: InsightEvidence = {
    source: category,
    id: entry.id,
    label: truncate(entry.summary),
    snapshotId: "snapshotId" in entry ? entry.snapshotId : undefined,
    state: entry.state,
  };
  const files = entry.files;
  const persistence = "evidenceCount" in entry
    ? { observationCount: entry.evidenceCount, distinctSnapshots: 1, firstObservedAt: entry.observedAt, lastObservedAt: entry.observedAt, repeated: entry.evidenceCount > 1 }
    : { observationCount: entry.supportingEvidenceIds.length, distinctSnapshots: entry.supportingEvidenceIds.length, lastObservedAt: entry.observedAt, repeated: entry.supportingEvidenceIds.length > 1 };
  const contradictions = entry.state === "contradicted" || entry.state === "invalidated"
    ? ["Source evidence is contradicted or invalidated; it is not an actionable priority."]
    : [];
  return baseInsight(snapshot, category, entry.id, "information", entry.summary,
    entry.details ?? "Observed from durable workspace evidence; this is not a recommended solution.",
    files, "directories" in entry ? entry.directories : [], [], [evidence], [], contradictions, entry.state, persistence);
}

function baseInsight(
  snapshot: WorkspaceIntelligenceSnapshot,
  category: InsightCategory,
  sourceId: string,
  severity: EngineeringInsight["severity"],
  summary: string,
  rationale: string,
  files: string[],
  directories: string[],
  symbols: string[],
  evidence: InsightEvidence[],
  limitations: string[],
  contradictions: string[] = [],
  sourceState?: WorkspaceEvidenceState,
  persistence?: EngineeringInsight["persistence"],
): Omit<EngineeringInsight, "priority" | "priorityFactors"> {
  const snapshotState: InsightState = snapshot.status;
  const state: InsightState = sourceState === "invalidated" || sourceState === "contradicted"
    ? sourceState
    : sourceState === "historical" ? "historical" : snapshotState;
  const affectedFiles = uniqueSorted(files).slice(0, MAX_PATHS);
  const affectedDirectories = uniqueSorted(directories).slice(0, MAX_PATHS);
  const affectedSymbols = uniqueSorted(symbols).slice(0, MAX_PATHS);
  const boundedEvidence = evidence.slice(0, MAX_EVIDENCE);
  const id = stableId([category, sourceId, summary, ...boundedEvidence.map(item => item.id).sort()]);
  return {
    id,
    category,
    summary: truncate(summary),
    rationale: truncate(rationale),
    affectedFiles,
    affectedDirectories,
    affectedSymbols,
    evidence: boundedEvidence,
    provenance: {
      workspace: snapshot.workspace,
      snapshotId: snapshot.provenance?.snapshotId ?? "",
      generatedAt: snapshot.provenance?.generatedAt ?? 0,
      sources: [...new Set(boundedEvidence.map(item => item.source))].sort(),
    },
    state,
    severity,
    persistence: persistence ?? { observationCount: 1, distinctSnapshots: 1, repeated: false },
    limitations: uniqueSorted(limitations),
    contradictions: uniqueSorted(contradictions),
  };
}

function withPriority(record: Omit<EngineeringInsight, "priority" | "priorityFactors">): EngineeringInsight {
  const validity = record.state === "invalidated" ? 0 : record.state === "contradicted" ? 1 : record.state === "failed" || record.state === "unavailable" ? 0 : record.state === "historical" ? 1 : record.state === "incomplete" ? 2 : record.state === "stale" ? 3 : 4;
  const sourceSeverity = record.severity === "error" ? 3 : record.severity === "warning" ? 2 : 1;
  const impact = Math.min(3, Math.floor((record.affectedFiles.length + record.affectedDirectories.length) / 3));
  const recurrence = Math.min(2, record.persistence.distinctSnapshots > 1 ? 2 : record.persistence.observationCount > 1 ? 1 : 0);
  const strength = record.evidence.some(item => item.state === "contradicted" || item.state === "invalidated") ? 0 : record.category === "diagnostic" || record.category === "architecture" || record.category === "dependency" ? 2 : 1;
  const score = validity + sourceSeverity + impact + recurrence + strength;
  const priority: InsightPriority = validity <= 1 ? "informational" : score >= 11 ? "critical" : score >= 8 ? "high" : score >= 5 ? "medium" : score >= 3 ? "low" : "informational";
  return { ...record, priority, priorityFactors: { validity, sourceSeverity, impact, recurrence, strength } };
}

function compareInsights(a: EngineeringInsight, b: EngineeringInsight): number {
  const aFactors = a.priorityFactors;
  const bFactors = b.priorityFactors;
  for (const key of ["validity", "sourceSeverity", "impact", "recurrence", "strength"] as const) {
    if (aFactors[key] !== bFactors[key]) return bFactors[key] - aFactors[key];
  }
  return categoryOrder[a.category] - categoryOrder[b.category] ||
    stateOrder[a.state] - stateOrder[b.state] ||
    a.summary.localeCompare(b.summary) ||
    a.affectedFiles.join("\0").localeCompare(b.affectedFiles.join("\0")) ||
    a.id.localeCompare(b.id);
}

function stableId(parts: string[]): string {
  return createHash("sha256").update(parts.join("\0")).digest("hex");
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

function truncate(value: string): string {
  return value.length <= MAX_TEXT ? value : `${value.slice(0, MAX_TEXT - 1)}…`;
}
