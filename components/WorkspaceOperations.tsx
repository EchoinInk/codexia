"use client";
import { useEffect, useState } from "react";

type Projection = { workspace: string; label?: string; status: string; progress?: number; runtimeId?: string; tasks: Array<{ id: string; title: string; status: string; budget?: { limit: number; consumed: number }; checkpoint?: string; verification?: Array<{ success: boolean }> }>; pendingApprovals?: number; resource?: { running: number; queued: number }; checkpoints?: Array<{ id: string; at: number; phase?: string }>; audit?: Array<{ at: number; type: string; detail: string }>; outcome?: { status: string; reason?: string } };
type Preferences = { enabled: boolean; events: string[] };

export function WorkspaceOperations({ active }: { active: boolean }) {
  const [workspaces, setWorkspaces] = useState<Projection[]>([]);
  const [error, setError] = useState<string>(); const [preferences, setPreferences] = useState<Preferences>({ enabled: true, events: ["progress", "action_required", "approval", "completed", "failed", "recovery", "developer_action"] }); const [pending, setPending] = useState<Record<string, string>>({}); const [acknowledged, setAcknowledged] = useState<Record<string, string>>({});
  const refresh = async () => {
    try { const response = await fetch("/api/workspaces", { cache: "no-store" }); const body = await response.json(); if (!response.ok) throw new Error(body.error); setWorkspaces(body.workspaces); if (body.notifications) setPreferences(body.notifications); setError(undefined); } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  };
  useEffect(() => { if (!active) return; void refresh(); const timer = setInterval(() => void refresh(), 2000); return () => clearInterval(timer); }, [active]);
  const control = async (operation: string, workspace: string, runtimeId?: string, approvalId?: string) => {
    setPending(current => ({ ...current, [workspace]: operation }));
    const response = await fetch("/api/workspaces", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ operation, workspace, runtimeId, approvalId }) });
    if (!response.ok) { const body = await response.json(); setError(body.error); setPending(current => { const next = { ...current }; delete next[workspace]; return next; }); return; }
    const result = await response.json(); setAcknowledged(current => ({ ...current, [workspace]: result.acknowledged ? operation : `not acknowledged: ${result.detail ?? "unknown"}` })); setPending(current => { const next = { ...current }; delete next[workspace]; return next; }); await refresh();
  };
  const savePreferences = async (next: Preferences) => {
    setPreferences(next);
    const response = await fetch("/api/workspaces", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ operation: "preferences", preferences: next }) });
    if (!response.ok) setError((await response.json()).error);
  };
  return <div className="h-full overflow-auto p-5">
    <div className="mb-5"><h2 className="text-base font-semibold text-ink-900">Workspace Control Centre</h2><p className="mt-1 text-sm text-ink-500">Authoritative lifecycle projection across authorized workspaces.</p></div>
    {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <section className="mb-4 rounded-2xl border border-ink-400/10 bg-white/80 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><b className="text-sm text-ink-800">Lifecycle notifications</b><label className="text-xs text-ink-600"><input type="checkbox" checked={preferences.enabled} onChange={event => void savePreferences({ ...preferences, enabled: event.target.checked })} /> Enabled</label></div><div className="mt-3 flex flex-wrap gap-2">{["progress", "action_required", "approval", "completed", "failed", "recovery", "developer_action"].map(event => <label key={event} className="text-xs text-ink-600"><input type="checkbox" checked={preferences.events.includes(event)} onChange={change => void savePreferences({ ...preferences, events: change.target.checked ? [...preferences.events, event] : preferences.events.filter(item => item !== event) })} /> {event.replace("_", " ")}</label>)}</div></section>
    <div className="grid gap-4 lg:grid-cols-2">{workspaces.map(workspace => <section key={workspace.workspace} className="rounded-2xl border border-ink-400/10 bg-white/80 p-4">
      <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-ink-800">{workspace.label ?? workspace.workspace}</h3><p className="mt-1 truncate text-xs text-ink-400">{workspace.workspace}</p></div><span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700">{workspace.status}</span></div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs"><div className="rounded-lg bg-ink-50 p-2"><b className="block text-sm text-ink-800">{workspace.tasks.length}</b>tasks</div><div className="rounded-lg bg-ink-50 p-2"><b className="block text-sm text-ink-800">{workspace.pendingApprovals ?? "Unavailable"}</b>approvals</div><div className="rounded-lg bg-ink-50 p-2"><b className="block text-sm text-ink-800">{workspace.resource?.running ?? 0}/{workspace.resource?.queued ?? 0}</b>run/queued</div></div>
      <div className="mt-4 text-xs text-ink-500">{pending[workspace.workspace] ? `Requested: ${pending[workspace.workspace]}…` : acknowledged[workspace.workspace] ? `Acknowledged: ${acknowledged[workspace.workspace]}` : "No pending control request"}</div>
      <div className="mt-2 flex flex-wrap gap-2">{(["pause", "resume", "cancel", "retry"] as const).map(action => <button key={action} onClick={() => void control(action, workspace.workspace, workspace.runtimeId)} className="rounded-lg border border-ink-400/15 px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50">{action}</button>)}{(workspace.pendingApprovals ?? 0) > 0 && <button onClick={() => void control("approve", workspace.workspace, workspace.runtimeId, workspace.tasks.find(task => task.status === "awaiting_approval")?.id)} className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white">approve</button>}</div>
      {(workspace.checkpoints?.length || workspace.audit?.length || workspace.outcome) ? <details className="mt-4 text-xs text-ink-600"><summary className="cursor-pointer font-medium">Audit & recovery details</summary>{workspace.outcome && <p className="mt-2">Outcome: {workspace.outcome.status} — {workspace.outcome.reason}</p>}{workspace.checkpoints?.map(checkpoint => <p key={checkpoint.id}>Checkpoint {checkpoint.id}: {checkpoint.phase} ({new Date(checkpoint.at).toLocaleString()})</p>)}{workspace.audit?.map((event, index) => <p key={`${event.at}-${index}`}>{event.type}: {event.detail}</p>)}</details> : null}
    </section>)}</div>
  </div>;
}
