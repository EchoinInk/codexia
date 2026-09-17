import type { ArchitectureReport } from "@/lib/intelligence/architecture-analysis";

/** Reporter formats findings; it does not analyze or modify the workspace. */
export function formatArchitectureReport(report: ArchitectureReport): string {
  return [
    "# Workspace architecture findings", "",
    `${report.findings.length} findings across ${report.graph.nodes.length} indexed files.`, "",
    ...report.findings.flatMap(finding => [
      `## ${finding.kind}: ${finding.file}`, "", finding.message,
      `Confidence: ${finding.confidence}.`,
      `Evidence: ${finding.evidence.join("; ")}`, finding.recommendation, "",
    ]),
    "## Analysis limits", "", ...report.limitations.map(limit => `- ${limit}`),
  ].join("\n");
}
