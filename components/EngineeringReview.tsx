"use client";
import { useSyncExternalStore } from "react";
import { EngineeringSessionClient } from "@/lib/engineering/session";
import { DiffView } from "./DiffView";
import { Markdown } from "./Markdown";

const labels = {
  idle: "", starting: "Starting engineering", running: "Engineering running", resuming: "Revalidating and executing reviewed proposal",
  awaiting_approval: "Awaiting your approval", completed: "Completed and verified", failed: "Engineering failed",
  paused: "Engineering paused", cancelled: "Engineering cancelled", rolled_back: "Verification failed — changes rolled back",
  invalidated: "Proposal invalidated — explicit new request required", unknown: "Engineering status unknown — refresh required",
};
export function EngineeringReview({ session }: { session: EngineeringSessionClient }) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  if (!state.runtimeId) return null;
  const report = state.report;
  const pending = state.phase === "awaiting_approval" && !state.busy && !state.dismissed ? report?.pendingProposal : undefined;
  return <section className="rounded-xl border border-ink-400/20 bg-brand-50/40 p-4 space-y-3" aria-label="Engineering review">
    <h2 className="font-semibold">{state.dismissed ? "Engineering review closed" : labels[state.phase]}</h2>
    <p className="text-xs break-all">Runtime: {state.runtimeId}</p>
    {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
    {state.notice && <p className="text-sm">{state.notice}</p>}
    {report?.lastChangeOutcome === "rolled_back" && <p role="status">The previous attempt failed verification and was rolled back. Any new proposal needs separate approval.</p>}
    {report?.lastChangeOutcome === "rollback_conflict" && <p role="alert">Rollback conflict: manual recovery is required. This request did not succeed.</p>}
    {pending && <>
      <p className="text-sm">{pending.reason}</p>
      <p className="text-xs break-all">Proposal / digest: <code>{pending.digest}</code></p>
      <p className="text-sm">Risk: {pending.risk.required}. Scope: {pending.taskFiles.join(", ")} (maximum {pending.scope.maxFilesPerBatch} files).</p>
      {pending.proposal.warnings.map((warning, i) => <p key={i} className="text-sm text-amber-800">{warning}</p>)}
      {pending.proposal.diff.changes.map(change => <div key={change.path}>
        <h3 className="font-mono text-sm my-2">{change.path}</h3>
        <DiffView oldText={change.before} newText={change.after} />
      </div>)}
      <p className="text-sm">Verification: {pending.checks.map(check => check.id).join(", ")}</p>
      <ul className="list-disc pl-5 text-sm">{pending.acceptance.map(item => <li key={item.id}>{item.description}</li>)}</ul>
      <button className="rounded-lg bg-brand text-white px-3 py-2 text-sm" onClick={() => void session.approve(pending.proposal.id)}>Approve this exact proposal</button>
    </>}
    {report && !pending && !state.busy && <Markdown>{report.markdown}</Markdown>}
    <div className="flex gap-3 text-sm">
      <button onClick={() => void session.refresh()}>Refresh status</button>
      {state.dismissed && <button onClick={() => void session.reopen()}>Reopen review</button>}
      {!state.dismissed && (state.busy || state.phase === "awaiting_approval" || state.phase === "paused") &&
        <button onClick={() => void session.decline()}>{state.busy ? "Request cancellation" : "Decline / close review"}</button>}
    </div>
  </section>;
}
