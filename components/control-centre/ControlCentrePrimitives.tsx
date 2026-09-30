import clsx from "clsx";
import type { ReactNode } from "react";
import { evidenceStatusClassName } from "@/lib/design-system/status";

export function ControlPanel({ title, eyebrow, action, className, children }: { title: string; eyebrow?: string; action?: ReactNode; className?: string; children: ReactNode }) {
  return <section className={clsx("min-w-0 rounded-panel border border-subtle bg-surface-elevated/80 shadow-card", className)}>
    <header className="flex min-h-14 items-center justify-between gap-3 border-b border-subtle px-4 py-3">
      <div className="min-w-0">{eyebrow && <p className="text-caption font-semibold uppercase tracking-[0.14em] text-ink-400">{eyebrow}</p>}<h2 className="truncate text-sm font-semibold text-starlight">{title}</h2></div>{action}
    </header>
    <div className="p-4">{children}</div>
  </section>;
}

export function StatusBadge({ state, children = state }: { state: string; children?: ReactNode }) {
  return <span className={clsx("inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ring-1 ring-inset", evidenceStatusClassName(state, true))}>{children}</span>;
}

export function StateMessage({ title, detail, tone = "neutral", action }: { title: string; detail: string; tone?: string; action?: ReactNode }) {
  return <div className={clsx("rounded-card border p-4", tone === "danger" ? "border-status-danger/30 bg-status-danger/5" : tone === "warning" ? "border-status-warning/30 bg-status-warning/5" : "border-subtle bg-surface-subtle")}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold text-starlight">{title}</p><p className="mt-1 text-xs leading-5 text-ink-500">{detail}</p></div>{action}</div>
  </div>;
}
