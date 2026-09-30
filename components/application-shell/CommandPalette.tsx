"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Search, X } from "lucide-react";
import { searchShellRoutes, type ShellView } from "@/lib/application-shell/navigation";

export function CommandPalette({ open, onClose, onNavigate }: { open: boolean; onClose: () => void; onNavigate: (view: ShellView) => void }) {
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const routes = useMemo(() => searchShellRoutes(query), [query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    requestAnimationFrame(() => input.current?.focus());
    const previous = document.activeElement as HTMLElement | null;
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const focusable = [...(dialog.current?.querySelectorAll<HTMLElement>('button, input, [href], [tabindex]:not([tabindex="-1"])') ?? [])];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keyboard);
    return () => { document.removeEventListener("keydown", keyboard); previous?.focus(); };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-nebula/75 p-4 pt-[12vh] backdrop-blur-sm" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="command-title" className="w-full max-w-2xl overflow-hidden rounded-panel border border-active bg-deep-orbit shadow-floating">
        <div className="flex items-center gap-3 border-b border-subtle px-4">
          <Search aria-hidden="true" className="text-intelligence" size={19} />
          <label id="command-title" htmlFor="shell-command" className="sr-only">Search files or navigate Codexia</label>
          <input ref={input} id="shell-command" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => {
            if (event.key === "Enter" && routes[0]) { onNavigate(routes[0].id); onClose(); }
          }} placeholder="Search workspaces or run a navigation command…" className="h-14 min-w-0 flex-1 bg-transparent text-sm text-starlight outline-none placeholder:text-ink-400" />
          <button onClick={onClose} className="rounded-control p-2 text-ink-500 hover:bg-ink-400/10 hover:text-starlight" aria-label="Close command palette"><X size={18} /></button>
        </div>
        <div className="max-h-[23rem] overflow-y-auto p-2">
          <p className="px-3 py-2 text-caption font-semibold uppercase tracking-[0.16em] text-ink-400">Navigate</p>
          {routes.map(route => {
            const Icon = route.icon;
            return <button key={route.id} onClick={() => { onNavigate(route.id); onClose(); }} className="group flex w-full items-center gap-3 rounded-button px-3 py-3 text-left hover:bg-brand-100 focus-visible:bg-brand-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand">
              <span className="flex h-9 w-9 items-center justify-center rounded-control border border-subtle bg-orbit text-ink-500 group-hover:text-brand-300"><Icon size={18} /></span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-starlight">{route.label}</span><span className="block truncate text-xs text-ink-500">{route.description}</span></span>
              <ArrowRight size={16} className="text-ink-400" />
            </button>;
          })}
          {!routes.length && <p className="px-3 py-8 text-center text-sm text-ink-500">No matching workspace or command.</p>}
        </div>
        <div className="border-t border-subtle px-4 py-2 text-xs text-ink-400">Enter to open the first result · Escape to close</div>
      </div>
    </div>
  );
}
