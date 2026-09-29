import type { StatusSemantic } from "./tokens";

/** Shared semantic treatments. Product state names map here, not to raw colours. */
export const statusClassNames: Record<StatusSemantic, string> = {
  neutral: "bg-status-neutral/15 text-moonlight ring-status-neutral/40",
  info: "bg-status-info/10 text-status-info ring-status-info/35",
  active: "bg-status-active/15 text-brand-300 ring-status-active/40",
  success: "bg-status-success/10 text-status-success ring-status-success/35",
  warning: "bg-status-warning/10 text-status-warning ring-status-warning/35",
  danger: "bg-status-danger/10 text-status-danger ring-status-danger/35",
};

export function evidenceStatusSemantic(state: string): StatusSemantic {
  if (state === "current" || state === "verified" || state === "completed") return "success";
  if (state === "stale" || state === "awaiting_approval" || state === "warning") return "warning";
  if (state === "incomplete" || state === "running" || state === "queued") return "info";
  if (state === "contradicted" || state === "invalidated" || state === "failed" || state === "error") return "danger";
  if (state === "active" || state === "planning") return "active";
  return "neutral";
}

export function evidenceStatusClassName(state: string, includeRing = false): string {
  const classes = statusClassNames[evidenceStatusSemantic(state)];
  return includeRing ? classes : classes.replace(/\sring-[^\s]+/g, "");
}
