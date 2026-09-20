"use client";
import { useCallback, useEffect, useState } from "react";

type State = {
  enabled: boolean;
  status: "disabled" | "running" | "paused" | "stopped" | "failed";
  currentTaskId?: string;
  stopReason?: string;
  snapshotId?: string;
  lastOutcome?: { status: string; reason: string; at: number };
  decisions: Array<{ insightId: string; eligible: boolean; code: string; reason: string; taskIdentity: string }>;
  queue: Array<{ id: string; status: string; attempt: number; maxAttempts: number;
    attemptBudget: { consumed: number; limit: number }; output?: { summary: string }; error?: { message: string } }>;
};

export function ContinuousEngineering({ active }: { active: boolean }) {
  const [state, setState] = useState<State>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const load = useCallback(async () => {
    const response = await fetch("/api/engineering/continuous", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Unable to read continuous engineering state");
    setState(body); setError(undefined);
  }, []);
  useEffect(() => { if (active) void load().catch(cause => setError(String(cause))); }, [active, load]);
  async function command(operation: string) {
    setBusy(true);
    try {
      const response = await fetch("/api/engineering/continuous", { method: "POST",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? `Unable to ${operation}`);
      setState(body); setError(undefined);
    } catch (cause) { setError(String(cause)); } finally { setBusy(false); }
  }
  return <section className="mt-4 rounded-2xl border border-emerald-200/70 bg-emerald-50/40 p-5 shadow-sm" aria-label="Continuous engineering controls">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="font-semibold text-ink-800">Continuous engineering</h3>
        <p className="mt-1 text-xs leading-5 text-ink-500">Bounded low-risk maintenance through the existing queue, Runtime, approval, verification, and rollback lifecycle.</p>
      </div>
      <span className="rounded-full bg-white px-2 py-1 text-xs font-medium capitalize text-ink-700">{state?.status ?? "loading"}</span>
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
    {state?.stopReason && <p className="mt-3 text-sm text-ink-600">Stop/defer reason: {state.stopReason}</p>}
    {state?.currentTaskId && <p className="mt-2 break-all text-xs text-ink-500">Current task: {state.currentTaskId}</p>}
    {state?.lastOutcome && <p className="mt-2 text-xs text-ink-500">Last outcome: {state.lastOutcome.status} — {state.lastOutcome.reason}</p>}
    <div className="mt-3 flex flex-wrap gap-3 text-sm">
      {!state?.enabled && <button disabled={busy} onClick={() => void command("enable")}>Enable bounded maintenance</button>}
      {state?.enabled && state.status !== "paused" && <button disabled={busy} onClick={() => void command("pause")}>Pause</button>}
      {state?.enabled && state.status === "paused" && <button disabled={busy} onClick={() => void command("resume")}>Resume</button>}
      {state?.enabled && <button disabled={busy} onClick={() => void command("evaluate")}>Evaluate now</button>}
      {state?.enabled && <button disabled={busy} onClick={() => void command("cancel")}>Cancel and disable</button>}
      <button disabled={busy} onClick={() => void load().catch(cause => setError(String(cause)))}>Refresh state</button>
    </div>
    {state?.queue.length ? <div className="mt-4 space-y-2">
      {state.queue.slice(-5).map(task => <div key={task.id} className="rounded-xl border border-white bg-white/70 p-3 text-xs text-ink-600">
        <p className="break-all font-medium">{task.id}</p>
        <p className="mt-1 capitalize">{task.status} · attempt budget {task.attemptBudget.consumed}/{task.attemptBudget.limit}</p>
        {(task.output?.summary || task.error?.message) && <p className="mt-1">{task.output?.summary ?? task.error?.message}</p>}
      </div>)}
    </div> : null}
    {state?.decisions.length ? <details className="mt-4 text-xs text-ink-500"><summary>Eligibility decisions</summary>
      <ul className="mt-2 space-y-1">{state.decisions.slice(0, 10).map(decision => <li key={decision.insightId}>{decision.code}: {decision.reason}</li>)}</ul>
    </details> : null}
  </section>;
}
