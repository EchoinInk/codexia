import { diagnoseWorkspace } from "@/lib/intelligence/diagnostics";
import { analyseArchitecture } from "@/lib/intelligence/architecture-analysis";
import { snapshotId } from "@/lib/intelligence/change-proposal";
import type { WorkspaceIndex } from "@/lib/intelligence/types";
import type { EngineeringEvidence, EngineeringFinding, EngineeringFindingProvider, EngineeringGoal } from "./types";

export async function collectEngineeringEvidence(index: WorkspaceIndex, goal: EngineeringGoal,
  providers: EngineeringFindingProvider[] = [], signal?: AbortSignal): Promise<EngineeringEvidence> {
  signal?.throwIfAborted();
  const snapshot = snapshotId(index);
  const observedAt = Date.now();
  const diagnostics = await diagnoseWorkspace(index, undefined, signal);
  const architecture = analyseArchitecture(index, goal.architecture);
  const findings: EngineeringFinding[] = [
    ...diagnostics.diagnostics.map(item => ({ id: item.id, category: "diagnostic" as const,
      severity: item.severity, confidence: 0.8, files: [item.file], summary: item.message,
      provider: item.provider, snapshot, observedAt, evidence: [item.explanation], effort: 1 })),
    ...architecture.findings.map(item => ({ id: item.id, category: "architecture" as const,
      severity: item.severity, confidence: item.confidence === "high" ? 1 : 0.5, files: [item.file],
      summary: item.message, provider: "architecture", snapshot, observedAt, evidence: item.evidence, effort: 3 })),
  ];
  const providerErrors = diagnostics.providerErrors.map(error => `${error.provider}: ${error.message}`);
  for (const provider of providers) {
    signal?.throwIfAborted();
    try {
      for (const finding of await provider.collect(index, signal)) {
        if (!finding || !finding.id || finding.provider !== provider.id || finding.snapshot !== snapshot ||
          !["performance", "security", "architecture", "diagnostic"].includes(finding.category) ||
          !["critical", "error", "warning", "information"].includes(finding.severity) ||
          !Number.isFinite(finding.confidence) || finding.confidence < 0 || finding.confidence > 1 ||
          !Number.isFinite(finding.effort) || finding.effort <= 0 || !Number.isFinite(finding.observedAt) ||
          finding.observedAt > Date.now() || Date.now() - finding.observedAt > 300000 ||
          !Array.isArray(finding.files) || finding.files.some(file => !index.files.some(item => item.path === file)) ||
          typeof finding.summary !== "string" || !Array.isArray(finding.evidence) || !finding.evidence.length ||
          finding.evidence.some(item => typeof item !== "string")) throw new Error("Invalid or stale finding provenance");
        findings.push(finding);
      }
    } catch (error) {
      if (signal?.aborted) throw error;
      providerErrors.push(`${provider.id}: ${String(error)}`);
    }
  }
  const severity = { information: 1, warning: 2, error: 3, critical: 4 };
  const score = (finding: EngineeringFinding): number => {
    const impact = finding.files.reduce((total, file) => total + (architecture.graph.nodes.find(node => node.file === file)?.dependents.length ?? 0), 0);
    return severity[finding.severity] * finding.confidence * (1 + impact) / finding.effort;
  };
  findings.sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id));
  const memory = index.memory ? Object.values(index.memory.knowledge).flat().filter(entry =>
    entry.confidence >= 0.5 && entry.source && entry.files.some((file: string) => goal.scope.files.includes(file))) : [];
  return { snapshot, observedAt, findings, providerErrors, dependencyOrder: architecture.graph.order,
    memory: memory.map(entry => ({ id: entry.id, source: entry.source, summary: entry.summary,
      files: entry.files, relatedFailureId: entry.relatedFailureId })) };
}
