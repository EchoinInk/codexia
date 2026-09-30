"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, Bot, ChevronRight, CirclePause, Clock3, HeartPulse, Play, RotateCcw, ShieldCheck, Square, Target, Workflow } from "lucide-react";
import type { EngineeringSessionClient, EngineeringSessionView } from "@/lib/engineering/session";
import type { ControlCentreProjection } from "@/lib/control-centre/types";
import { codierPoses } from "@/lib/design-system/assets";
import { ControlPanel, StateMessage, StatusBadge } from "./ControlCentrePrimitives";

type LoadState = "loading" | "ready" | "empty" | "error" | "permission";

function relativeTime(at?: number) {
  if (!at) return "time unavailable";
  const seconds = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

function metric(label: string, value: string | number, detail: string, Icon: typeof Activity, tone = "text-intelligence") {
  return <div className="rounded-card border border-subtle bg-surface-subtle p-3 sm:p-4"><div className="flex items-start justify-between gap-2"><div><p className="text-xs text-ink-500">{label}</p><p className="mt-1 text-2xl font-semibold text-starlight">{value}</p></div><Icon size={19} className={tone} /></div><p className="mt-2 truncate text-xs text-ink-400">{detail}</p></div>;
}

export function ControlCentre({ active, workspace, engineering, engineeringState, onOpenMission }: {
  active: boolean;
  workspace?: string;
  engineering: EngineeringSessionClient;
  engineeringState: EngineeringSessionView;
  onOpenMission: () => void;
}) {
  const [projection, setProjection] = useState<ControlCentreProjection>();
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState<string>();
  const [actionNotice, setActionNotice] = useState<string>();
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/workspaces", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) { setLoadState(response.status === 401 || response.status === 403 ? "permission" : "error"); throw new Error(body.error ?? `Request failed (${response.status})`); }
      const next = (body.controlCentres as ControlCentreProjection[] | undefined)?.find(item => !workspace || item.workspace.root === workspace) ?? body.controlCentres?.[0];
      setProjection(next); setLoadState(next ? "ready" : "empty"); setError(undefined);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); setLoadState(current => current === "permission" ? current : "error"); }
  }, [workspace]);
  useEffect(() => { if (!active) return; setLoadState("loading"); void refresh(); const timer = setInterval(() => void refresh(), 4000); return () => clearInterval(timer); }, [active, refresh]);

  const control = async (operation: "pause" | "resume" | "cancel" | "retry") => {
    if (!projection) return;
    setPending(operation); setActionNotice(undefined);
    try {
      const response = await fetch("/api/workspaces", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ operation, workspace: projection.workspace.root, runtimeId: projection.mission?.id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Control request failed");
      setActionNotice(result.acknowledged ? `${operation} acknowledged by the runtime.` : `${operation} was not acknowledged: ${result.detail ?? "authoritative state did not change"}`);
      await refresh();
    } catch (cause) { setActionNotice(cause instanceof Error ? cause.message : String(cause)); } finally { setPending(undefined); }
  };

  const activeReport = engineeringState.report;
  const pendingProposal = activeReport?.pendingProposal;
  const tasks = useMemo(() => {
    if (!projection) return [];
    const reportTasks = activeReport?.tasks.map(task => ({ id: task.id, title: task.title, state: task.status === "verified" ? "complete" : task.status === "awaiting_approval" ? "blocked" : task.status, status: task.status, reason: task.reason })) ?? [];
    return reportTasks.length ? reportTasks : projection.tasks;
  }, [projection, activeReport]);

  if (loadState === "loading") return <div aria-busy="true" aria-label="Loading Control Centre" className="grid h-full gap-3 overflow-hidden xl:grid-cols-[minmax(0,1fr)_20rem]"> <div className="animate-pulse rounded-panel border border-subtle bg-surface-elevated/60" /><div className="hidden animate-pulse rounded-panel border border-subtle bg-surface-elevated/60 xl:block" /></div>;
  if (loadState === "empty") return <div className="flex h-full items-center justify-center"><StateMessage title="No configured workspace" detail="Configure an authorized local workspace before opening the operational overview." /></div>;
  if (loadState === "permission") return <div className="flex h-full items-center justify-center"><StateMessage tone="danger" title="Workspace access denied" detail={error ?? "The configured workspace cannot be projected with the current permissions."} /></div>;
  if (loadState === "error" || !projection) return <div className="flex h-full items-center justify-center"><StateMessage tone="danger" title="Control Centre unavailable" detail={error ?? "The workspace projection could not be loaded."} action={<button onClick={() => void refresh()} className="rounded-button border border-subtle px-3 py-2 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">Retry</button>} /></div>;

  const activeMission = activeReport ? { id: activeReport.taskId, title: activeReport.goal, status: engineeringState.phase, progress: undefined } : projection.mission;
  const approvalCount = projection.approvals.length + (pendingProposal ? 1 : 0);
  const failureCount = projection.failures.length + (engineeringState.error ? 1 : 0);
  return <div className="h-full overflow-y-auto overflow-x-hidden pr-0.5">
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_20rem] 2xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-3">
        <section aria-labelledby="workspace-overview-heading" className="rounded-panel border border-active bg-panel-gradient p-4 shadow-panel sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><p className="text-caption font-semibold uppercase tracking-[0.16em] text-intelligence">Current workspace</p><h2 id="workspace-overview-heading" className="mt-1 truncate text-xl font-semibold text-starlight">{projection.workspace.label}</h2><p className="mt-1 truncate text-xs text-ink-500">{projection.workspace.root}</p></div><div className="flex items-center gap-2"><StatusBadge state={projection.workspace.status} /><StatusBadge state={projection.health.overall}>{projection.health.overall}</StatusBadge></div></div>
          <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-5">
            {metric("Missions", activeMission ? 1 : 0, activeMission ? String(activeMission.status).replaceAll("_", " ") : "No active mission", Target)}
            {metric("Tasks", tasks.length, `${tasks.filter(task => task.state === "running").length} running`, Workflow, "text-brand-300")}
            {metric("Agents", projection.agents.active, `${projection.agents.unavailable} unavailable`, Bot, "text-codier-violet")}
            {metric("Approvals", approvalCount, approvalCount ? "Action required" : "None pending", ShieldCheck, approvalCount ? "text-status-warning" : "text-status-success")}
            {metric("Failures", failureCount, failureCount ? "Inspect required" : "No projected failures", AlertTriangle, failureCount ? "text-status-danger" : "text-status-success")}
          </div>
        </section>

        <ControlPanel title={activeMission?.title ?? "No active mission"} eyebrow="Mission" action={activeMission && <StatusBadge state={String(activeMission.status)} /> }>
          {activeMission ? <div><div className="flex flex-wrap items-center justify-between gap-3"><p className="max-w-2xl text-sm leading-6 text-ink-600">This mission is projected from the active engineering Runtime or the authoritative workspace lifecycle. Its state is not owned by this screen.</p><button onClick={onOpenMission} className="inline-flex items-center gap-2 rounded-button border border-active bg-brand-100 px-3 py-2 text-xs font-semibold text-starlight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">Open mission review <ChevronRight size={14} /></button></div>
            <div className="mt-4 flex flex-wrap gap-2">
              {projection.capabilities.pause && <button disabled={!!pending} onClick={() => void control("pause")} className="control-button"><CirclePause size={14} /> Pause</button>}
              {projection.capabilities.resume && <button disabled={!!pending} onClick={() => void control("resume")} className="control-button"><Play size={14} /> Resume</button>}
              {projection.capabilities.cancel && <button disabled={!!pending} onClick={() => void control("cancel")} className="control-button text-status-danger"><Square size={14} /> Cancel</button>}
              {projection.capabilities.retry && <button disabled={!!pending} onClick={() => void control("retry")} className="control-button"><RotateCcw size={14} /> Retry</button>}
            </div>{actionNotice && <p role="status" className="mt-3 text-xs text-ink-500">{actionNotice}</p>}</div>
            : <StateMessage title="No active mission" detail="The authoritative Runtime and queue currently expose no mission in progress." />}
        </ControlPanel>

        <div className="grid gap-3 lg:grid-cols-2">
          <ControlPanel title="Tasks" eyebrow="Workflow execution">
            {tasks.length ? <ul className="space-y-2">{tasks.slice(0, 7).map(task => <li key={task.id} className="flex items-start justify-between gap-3 rounded-card border border-subtle bg-surface-subtle p-3"><div className="min-w-0"><p className="truncate text-sm font-medium text-starlight">{task.title}</p><p className="mt-1 truncate text-xs text-ink-400">{"reason" in task ? task.reason ?? task.id : task.id}</p></div><StatusBadge state={String(task.state)} /></li>)}</ul> : <StateMessage title="No workflow tasks" detail="No tasks are present in the current authoritative projection." />}
          </ControlPanel>
          <ControlPanel title="Agents" eyebrow="Coordinator projection">
            <ul className="space-y-2">{projection.agents.items.map(agent => <li key={agent.id} className="rounded-card border border-subtle bg-surface-subtle p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-medium text-starlight">{agent.label}</p><StatusBadge state={agent.state} /></div><p className="mt-1 text-xs leading-5 text-ink-500">{agent.assignedWork ? `${agent.assignedWork} · ` : ""}{agent.detail}</p></li>)}</ul>
          </ControlPanel>
        </div>

        <ControlPanel title="Recent activity" eyebrow="Lifecycle and workspace events">
          {projection.activity.length ? <ol className="divide-y divide-subtle">{projection.activity.slice(0, 8).map(item => <li key={item.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.failed ? "bg-status-danger" : "bg-intelligence"}`} /><div className="min-w-0 flex-1"><p className="text-sm text-ink-700">{item.detail}</p><p className="mt-1 text-xs capitalize text-ink-400">{item.type.replaceAll("_", " ")}</p></div><time className="shrink-0 text-xs text-ink-400">{relativeTime(item.at)}</time></li>)}</ol> : <StateMessage title="No recent activity" detail="No meaningful lifecycle or workspace events have been projected in this process." />}
        </ControlPanel>
      </div>

      <aside className="min-w-0 space-y-3" aria-label="Operational attention and system summaries">
        <ControlPanel title="System health" eyebrow="Live signals" action={<HeartPulse size={17} className="text-intelligence" />}>
          <ul className="space-y-3">{projection.health.signals.map(signal => <li key={signal.id} className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-ink-700">{signal.label}</p><p className="mt-0.5 text-xs leading-5 text-ink-400">{signal.detail}</p></div><StatusBadge state={signal.state} /></li>)}</ul>
        </ControlPanel>
        <ControlPanel title="Intelligence" eyebrow="Workspace evidence" action={<Activity size={17} className="text-intelligence" />}>
          <div className="flex items-center justify-between"><StatusBadge state={projection.intelligence.status} /><span className="text-xs text-ink-400">{projection.intelligence.fileCount ?? "—"} files</span></div><p className="mt-3 text-sm leading-6 text-ink-600">{projection.intelligence.status === "current" ? "Workspace evidence is current and available for governed consumers." : projection.intelligence.failure ?? `Workspace evidence is ${projection.intelligence.status}; the screen will not treat it as current.`}</p><p className="mt-2 text-xs text-ink-400">Observed {relativeTime(projection.intelligence.generatedAt)}</p>
        </ControlPanel>
        {(pendingProposal || projection.approvals.length > 0) && <ControlPanel title="Pending approvals" eyebrow="Governed action" action={<Clock3 size={17} className="text-status-warning" />}>
          {pendingProposal ? <div><p className="text-sm font-medium text-starlight">{pendingProposal.proposal.title}</p><p className="mt-1 text-xs leading-5 text-ink-500">{pendingProposal.reason}</p><div className="mt-3 flex gap-2"><button disabled={engineeringState.busy} onClick={() => void engineering.approve(pendingProposal.proposal.id)} className="rounded-button bg-brand-gradient px-3 py-2 text-xs font-semibold text-starlight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">Approve exact proposal</button><button onClick={onOpenMission} className="rounded-button border border-subtle px-3 py-2 text-xs font-semibold text-ink-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">Inspect</button></div></div> : <StateMessage tone="warning" title="Approval requires mission review" detail="The workspace projection indicates an approval, but its exact governed proposal is not loaded in this client. Open the mission review rather than approving from a copied state." action={<button onClick={onOpenMission} className="rounded-button border border-status-warning/30 px-3 py-2 text-xs font-semibold text-status-warning">Inspect</button>} />}
        </ControlPanel>}
        {(projection.notifications.length > 0 || engineeringState.error) && <ControlPanel title="Attention" eyebrow="Notifications">
          <ul className="space-y-2">{engineeringState.error && <li><StateMessage tone="danger" title="Runtime status unavailable" detail={engineeringState.error} /></li>}{projection.notifications.slice(0, 5).map(item => <li key={item.id}><StateMessage tone={item.kind === "failure" || item.kind === "unavailable" ? "danger" : "warning"} title={item.title} detail={item.detail} /></li>)}</ul>
        </ControlPanel>}
        <ControlPanel title="Codier" eyebrow="Operational context">
          <div className="flex items-center gap-3"><div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-card border border-active bg-codier-gradient/10"><Image src={failureCount ? codierPoses.troubleshooting : activeMission ? codierPoses.monitoringRuntime : codierPoses.resting} alt="Codier operational assistant" fill sizes="80px" className="object-contain" /></div><div><p className="text-sm font-semibold text-starlight">{failureCount ? "Attention is required." : approvalCount ? "A governed decision is waiting." : activeMission ? "Monitoring authoritative state." : "No active mission."}</p><p className="mt-1 text-xs leading-5 text-ink-500">Codier summarizes the projection; success is shown only when Validator and Reporter evidence supports it.</p></div></div>
        </ControlPanel>
      </aside>
    </div>
  </div>;
}
