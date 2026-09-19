"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Brain,
  CheckCircle2,
  CircleSlash,
  Clock3,
  GitBranch,
  RefreshCw,
  ServerCrash,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import clsx from "clsx";

type IntelligenceStatus =
  | "current"
  | "stale"
  | "incomplete"
  | "unavailable"
  | "failed";

type WorkspaceIntelligence = {
  workspace: string;
  status: IntelligenceStatus;
  usable: boolean;
  dirty: boolean;
  pending: boolean;
  refresh?: {
    dirtyVersion?: number;
    background?: {
      state?: "queued" | "running" | "completed" | "failed";
      startedAt?: number;
      completedAt?: number;
      error?: string;
    };
  };
  provenance?: {
    snapshotId: string;
    generatedAt: number;
    source: "cache" | "persisted";
    refreshVersion: number;
  };
  failure?: { message: string; occurredAt?: number };
  summary?: {
    fileCount: number;
    directoryCount: number;
    relationshipCount: number;
  };
  dependencies?: {
    relationships: Array<unknown>;
    relationshipCount?: number;
    truncated: boolean;
  };
  architecture?: {
    findings: Array<unknown>;
    findingCount: number;
    truncated: boolean;
    graph: { nodeCount: number; orderCount: number };
  };
  diagnostics?: {
    diagnostics: Array<unknown>;
    diagnosticCount: number;
    truncated: boolean;
    providerErrors?: string[];
  };
  evolution?: {
    snapshotId: string;
    entries: EvolutionEntry[];
    entryCount: number;
    truncated: boolean;
  };
  learning?: {
    snapshotId: string;
    entries: LearningEntry[];
    entryCount: number;
    truncated: boolean;
  };
  activity?: { memory?: unknown };
};

type EvidenceStrength = {
  supportingObservations: number;
  distinctSnapshots: number;
  contradictionCount: number;
  invalidated: boolean;
  current: boolean;
  stale: boolean;
  label: "low" | "medium" | "high" | "contradicted";
};

type EvidenceState =
  | "current"
  | "historical"
  | "stale"
  | "incomplete"
  | "contradicted"
  | "invalidated";

type EvolutionEntry = {
  id: string;
  kind: string;
  summary: string;
  details?: string;
  files: string[];
  directories: string[];
  snapshotId: string;
  fingerprint: string;
  state: EvidenceState;
  source: string;
  observedAt: number;
  evidenceCount: number;
  strength: EvidenceStrength;
};

type LearningEntry = {
  id: string;
  kind: string;
  summary: string;
  details?: string;
  files: string[];
  state: EvidenceState;
  supportingEvidenceIds: string[];
  observedAt: number;
  strength: EvidenceStrength;
};

const statusCopy: Record<
  IntelligenceStatus,
  { label: string; description: string; className: string }
> = {
  current: {
    label: "Current",
    description: "Intelligence matches the latest reconciled workspace state.",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
  stale: {
    label: "Stale",
    description: "A usable snapshot is available while newer workspace work is pending.",
    className: "bg-amber-50 text-amber-700 ring-amber-200",
  },
  incomplete: {
    label: "Incomplete",
    description: "A snapshot exists, but its evidence is not complete enough for a full view.",
    className: "bg-sky-50 text-sky-700 ring-sky-200",
  },
  unavailable: {
    label: "Unavailable",
    description: "No usable workspace intelligence snapshot is available yet.",
    className: "bg-slate-100 text-slate-600 ring-slate-200",
  },
  failed: {
    label: "Failed",
    description: "The latest refresh failed; failed output is not presented as current.",
    className: "bg-rose-50 text-rose-700 ring-rose-200",
  },
};

const statusIcons: Record<IntelligenceStatus, typeof CheckCircle2> = {
  current: CheckCircle2,
  stale: Clock3,
  incomplete: AlertTriangle,
  unavailable: CircleSlash,
  failed: XCircle,
};

function formatTime(timestamp?: number) {
  if (!timestamp) return "Not available";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function refreshLabel(refresh: WorkspaceIntelligence["refresh"]) {
  const state = refresh?.background?.state;
  if (state === "running") return "Indexing now";
  if (state === "queued") return "Refresh queued";
  if (state === "failed") return "Refresh failed";
  if (state === "completed") return "Refresh complete";
  return "Idle";
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/90 bg-white/75 p-4 shadow-[0_10px_28px_-22px_rgba(49,46,129,0.35)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-ink-900">
        {value}
      </p>
      {detail && <p className="mt-1 text-xs text-ink-500">{detail}</p>}
    </div>
  );
}

function stateLabel(state: EvidenceState) {
  return state.replace("_", " ");
}

function stateClassName(state: EvidenceState) {
  if (state === "current") return "bg-emerald-50 text-emerald-700";
  if (state === "stale") return "bg-amber-50 text-amber-700";
  if (state === "contradicted" || state === "invalidated") return "bg-rose-50 text-rose-700";
  if (state === "incomplete") return "bg-sky-50 text-sky-700";
  return "bg-slate-100 text-slate-600";
}

function StrengthBadge({ strength }: { strength: EvidenceStrength }) {
  return (
    <span className="rounded-full bg-violet-50 px-2 py-1 text-[11px] font-medium text-violet-700">
      {strength.label} support · {strength.supportingObservations} observation
      {strength.supportingObservations === 1 ? "" : "s"}
    </span>
  );
}

export function WorkspaceIntelligence({ active }: { active: boolean }) {
  const [snapshot, setSnapshot] = useState<WorkspaceIntelligence>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [lastChecked, setLastChecked] = useState<number>();

  const loadSnapshot = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/intelligence/workspace", {
        signal,
        cache: "no-store",
      });
      const body = (await response.json()) as WorkspaceIntelligence & {
        error?: string;
      };
      if (!response.ok && !body.status) {
        throw new Error(body.error ?? "Unable to load workspace intelligence");
      }
      setSnapshot(body);
      setError(undefined);
      setLastChecked(Date.now());
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    void loadSnapshot(controller.signal);
    return () => {
      controller.abort();
    };
  }, [active, loadSnapshot]);

  const status = snapshot?.status;
  const copy = status ? statusCopy[status] : undefined;
  const StatusIcon = status ? statusIcons[status] : Activity;
  const backgroundState = snapshot?.refresh?.background?.state;
  const canShowEvidence = Boolean(snapshot?.usable && snapshot?.provenance);

  return (
    <div className="h-full overflow-y-auto p-3 sm:p-5">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 border-b border-ink-400/10 pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-400">
              Live workspace intelligence
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink-900 sm:text-2xl">
              Workspace health and evidence
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-500">
              Read-only insight from the latest bounded workspace snapshot.
              Refreshing does not trigger engineering actions.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void loadSnapshot();
            }}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/90 bg-white/80 px-3 py-2 text-sm font-medium text-ink-700 shadow-sm transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-violet-300"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            <ServerCrash size={18} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Unable to read workspace intelligence</p>
              <p className="mt-1">{error}</p>
            </div>
          </div>
        )}

        {snapshot && copy && (
          <>
            <section className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div className={clsx("rounded-2xl p-5 ring-1", copy.className)}>
                <div className="flex items-start gap-3">
                  <StatusIcon size={21} className="mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{copy.label}</h3>
                      {snapshot.pending && (
                        <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-medium">
                          Refresh pending
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm opacity-90">{copy.description}</p>
                    {snapshot.failure && (
                      <p className="mt-3 text-sm font-medium">
                        {snapshot.failure.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-white/90 bg-white/75 p-4 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-semibold text-ink-800">
                  <ShieldCheck size={17} className="text-violet-500" />
                  Refresh state
                </div>
                <p className="mt-3 text-sm text-ink-600">{refreshLabel(snapshot.refresh)}</p>
                <p className="mt-1 text-xs text-ink-400">
                  {snapshot.dirty ? "Workspace has newer changes" : "No known newer changes"}
                </p>
                {lastChecked && (
                  <p className="mt-3 text-[11px] text-ink-400">
                    Checked {formatTime(lastChecked)}
                  </p>
                )}
              </div>
            </section>

            <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Files" value={snapshot.summary?.fileCount ?? "—"} />
              <Metric label="Directories" value={snapshot.summary?.directoryCount ?? "—"} />
              <Metric
                label="Relationships"
                value={snapshot.summary?.relationshipCount ?? "—"}
                detail={snapshot.dependencies?.truncated ? "Showing bounded results" : undefined}
              />
              <Metric
                label="Diagnostics"
                value={snapshot.diagnostics?.diagnosticCount ?? "—"}
                detail={snapshot.diagnostics?.truncated ? "Showing bounded results" : undefined}
              />
            </section>

            <section className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/90 bg-white/75 p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold text-ink-800">Snapshot provenance</h3>
                  <span className="rounded-full bg-violet-50 px-2 py-1 text-[11px] font-medium text-violet-700">
                    {snapshot.provenance?.source ?? "none"}
                  </span>
                </div>
                {snapshot.provenance ? (
                  <dl className="mt-4 space-y-3 text-sm">
                    <div>
                      <dt className="text-xs text-ink-400">Snapshot ID</dt>
                      <dd className="mt-1 break-all font-mono text-xs text-ink-700">
                        {snapshot.provenance.snapshotId}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <div>
                        <dt className="text-xs text-ink-400">Generated</dt>
                        <dd className="mt-1 text-ink-700">{formatTime(snapshot.provenance.generatedAt)}</dd>
                      </div>
                      <div className="text-right">
                        <dt className="text-xs text-ink-400">Refresh version</dt>
                        <dd className="mt-1 text-ink-700">{snapshot.provenance.refreshVersion}</dd>
                      </div>
                    </div>
                  </dl>
                ) : (
                  <p className="mt-4 text-sm text-ink-500">No usable snapshot provenance is available.</p>
                )}
              </div>

              <div className="rounded-2xl border border-white/90 bg-white/75 p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <Activity size={17} className="text-violet-500" />
                  <h3 className="font-semibold text-ink-800">Workspace activity</h3>
                </div>
                <p className="mt-3 text-sm text-ink-500">
                  {canShowEvidence
                    ? "Activity and memory are tied to the displayed snapshot."
                    : "Activity is unavailable until a usable snapshot exists."}
                </p>
                {backgroundState && (
                  <p className="mt-3 text-xs text-ink-400">
                    Background indexer: {backgroundState}
                  </p>
                )}
              </div>
            </section>

            <section className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/90 bg-white/75 p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <GitBranch size={17} className="text-violet-500" />
                    <div>
                      <h3 className="font-semibold text-ink-800">Project evolution</h3>
                      <p className="mt-1 text-xs text-ink-500">
                        Observed workspace changes, retained as bounded evidence.
                      </p>
                    </div>
                  </div>
                  {snapshot.evolution?.truncated && (
                    <span className="text-[11px] text-ink-400">Showing bounded results</span>
                  )}
                </div>
                {snapshot.evolution?.entries.length ? (
                  <div className="mt-4 space-y-3">
                    {snapshot.evolution.entries.map(entry => (
                      <article key={entry.id} className="rounded-xl border border-ink-400/10 bg-white/70 p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400">
                            {entry.kind}
                          </span>
                          <span className={clsx("rounded-full px-2 py-1 text-[11px] font-medium capitalize", stateClassName(entry.state))}>
                            {stateLabel(entry.state)}
                          </span>
                          <StrengthBadge strength={entry.strength} />
                        </div>
                        <p className="mt-2 text-sm font-medium text-ink-800">{entry.summary}</p>
                        {entry.details && <p className="mt-1 text-xs leading-5 text-ink-500">{entry.details}</p>}
                        <p className="mt-2 text-[11px] text-ink-400">
                          Observed {formatTime(entry.observedAt)} · {entry.evidenceCount} evidence event{entry.evidenceCount === 1 ? "" : "s"}
                        </p>
                        {(entry.files.length > 0 || entry.directories.length > 0) && (
                          <p className="mt-1 break-words text-[11px] text-ink-400">
                            Scope: {[...entry.files, ...entry.directories].slice(0, 4).join(", ")}
                            {[...entry.files, ...entry.directories].length > 4 ? " …" : ""}
                          </p>
                        )}
                        <p className="mt-1 break-all font-mono text-[10px] text-ink-400">
                          Evidence snapshot: {entry.snapshotId}
                        </p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-ink-500">No meaningful evolution has been observed in this snapshot.</p>
                )}
              </div>

              <div className="rounded-2xl border border-white/90 bg-white/75 p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Brain size={17} className="text-violet-500" />
                    <div>
                      <h3 className="font-semibold text-ink-800">Learned patterns</h3>
                      <p className="mt-1 text-xs text-ink-500">
                        Derived, non-authoritative inferences linked to observed evidence.
                      </p>
                    </div>
                  </div>
                  {snapshot.learning?.truncated && (
                    <span className="text-[11px] text-ink-400">Showing bounded results</span>
                  )}
                </div>
                {snapshot.learning?.entries.length ? (
                  <div className="mt-4 space-y-3">
                    {snapshot.learning.entries.map(entry => (
                      <article key={entry.id} className="rounded-xl border border-ink-400/10 bg-white/70 p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400">
                            {entry.kind}
                          </span>
                          <span className={clsx("rounded-full px-2 py-1 text-[11px] font-medium capitalize", stateClassName(entry.state))}>
                            {stateLabel(entry.state)}
                          </span>
                          <StrengthBadge strength={entry.strength} />
                        </div>
                        <p className="mt-2 text-sm font-medium text-ink-800">{entry.summary}</p>
                        {entry.details && <p className="mt-1 text-xs leading-5 text-ink-500">{entry.details}</p>}
                        <p className="mt-2 text-[11px] text-ink-400">
                          Inferred {formatTime(entry.observedAt)} · supported by {entry.supportingEvidenceIds.length} observation{entry.supportingEvidenceIds.length === 1 ? "" : "s"}
                        </p>
                        <p className="mt-1 break-all font-mono text-[10px] text-ink-400">
                          Evidence IDs: {entry.supportingEvidenceIds.join(", ")}
                        </p>
                        {entry.files.length > 0 && (
                          <p className="mt-1 break-words text-[11px] text-ink-400">
                            Related files: {entry.files.slice(0, 4).join(", ")}{entry.files.length > 4 ? " …" : ""}
                          </p>
                        )}
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-ink-500">No learned pattern is available from the retained evidence.</p>
                )}
              </div>
            </section>

            <p className="mt-4 text-xs leading-5 text-ink-400">
              Evolution is observation. Learning is inference. Neither changes workspace freshness,
              approves engineering work, executes actions, or upgrades historical/stale evidence to current.
            </p>

            <p className="mt-4 break-all text-xs text-ink-400">
              Workspace: {snapshot.workspace}
            </p>
          </>
        )}

        {!snapshot && loading && (
          <div className="mt-5 rounded-2xl border border-white/90 bg-white/75 p-8 text-center text-sm text-ink-500">
            Reading the workspace snapshot…
          </div>
        )}
      </div>
    </div>
  );
}
