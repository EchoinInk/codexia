import type { RuntimeResult } from "../runtime/types";

/** Reporter owns outcome interpretation; no execution or analysis occurs here. */
export function createEngineeringReport(result: RuntimeResult) {
  const session = result.context.engineering;
  if (!session) throw new Error("Engineering session missing");
  const verified = result.state.status === "completed" && session.complete && !!session.review?.approved;
  const tasks = session.tasks.map(state => ({ id: state.task.id, title: state.task.title, status: state.status,
    attempts: state.attempts, reason: state.reason, journal: state.journal, verification: state.verification,
    remainingDependencies: state.task.dependsOn.filter(id => session.tasks.find(task => task.task.id === id)?.status !== "verified") }));
  const acceptance = session.goal.acceptance.map(item => ({ ...item,
    status: verified && session.finalChecks.some(check => check.id === item.checkId && check.success) ? "verified" : "unverified" }));
  const current = session.evidence?.findings ?? [];
  const identity = (finding: typeof current[number]) => JSON.stringify([finding.provider, finding.category, finding.summary, finding.files]);
  const findings = [...new Map([...(session.initialFindings ?? []), ...current].map(finding => [identity(finding), finding])).values()].map(finding => {
    const present = current.some(item => identity(item) === identity(finding));
    const task = session.tasks.find(item => item.task.evidenceIds.includes(finding.id));
    const providerFailed = session.evidence?.providerErrors.some(error => error.startsWith(`${finding.provider}:`));
    const disposition = task?.status === "unsupported" ? "unsupported"
      : task?.status === "deferred" || task?.status === "awaiting_approval" ? "deferred"
      : verified && !present && !providerFailed ? "resolved" : "residual";
    return { ...finding, disposition,
      rationale: disposition === "resolved" ? "No longer reported in fresh evidence and all declared acceptance checks passed; provider coverage limits still apply."
        : task?.reason ?? "Not proven resolved by verified engineering evidence." };
  });
  const report = { taskId: result.state.id, goal: session.goal.title, outcome: verified ? "verified" : result.state.status,
    reason: session.escalation ?? result.state.stopReason, acceptance, tasks, findings,
    changes: result.context.filesModified, baseline: session.baseline, verification: session.finalChecks,
    audit: session.audit, advice: session.advice, review: session.review,
    checkpointId: result.checkpoint?.id,
    limitations: ["Snapshot analysis excludes unindexed external consumers and unsaved buffers.",
      "Verified means the declared checks passed; it does not prove the absence of all defects.",
      ...(session.evidence?.providerErrors ?? [])] };
  return { ...report, markdown: [
    `# ${session.goal.title}`, "", `Outcome: ${report.outcome}`, `Reason: ${report.reason ?? "Acceptance verified"}`, "",
    "## Acceptance", ...acceptance.map(item => `- ${item.description}: ${item.status}`), "",
    "## Tasks", ...tasks.map(task => `- ${task.id}: ${task.status}${task.reason ? ` — ${task.reason}` : ""}`), "",
    "## Changes", ...report.changes.map(file => `- ${file}`), "",
    "## Remaining findings", ...findings.map(finding => `- ${finding.summary} (${finding.provider}, ${finding.disposition})`), "",
    "## Limits", ...report.limitations.map(limit => `- ${limit}`),
  ].join("\n") };
}
