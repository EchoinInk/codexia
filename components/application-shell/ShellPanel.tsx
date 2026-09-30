import clsx from "clsx";
import type { ElementType, HTMLAttributes, ReactNode } from "react";

export function ShellPanel({ as: Component = "section", className, children, ...props }: HTMLAttributes<HTMLElement> & { as?: ElementType; children: ReactNode }) {
  return (
    <Component className={clsx("overflow-hidden rounded-shell border border-subtle bg-surface-glass shadow-panel backdrop-blur-2xl", className)} {...props}>
      {children}
    </Component>
  );
}

export function ShellPanelHeader({ eyebrow, title, actions, className }: { eyebrow?: string; title: string; actions?: ReactNode; className?: string }) {
  return (
    <header className={clsx("flex min-h-14 items-center justify-between gap-4 border-b border-subtle px-panel", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="text-caption font-semibold uppercase tracking-[0.16em] text-ink-400">{eyebrow}</p>}
        <h2 className="truncate text-titleSmall font-semibold text-starlight">{title}</h2>
      </div>
      {actions}
    </header>
  );
}
