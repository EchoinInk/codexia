"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import clsx from "clsx";
import { Bell, ChevronDown, Command, Menu, Search, Sparkles, UserRound, X } from "lucide-react";
import { CodexiaLogo, CodexiaSymbol } from "@/components/design-system/BrandAsset";
import { CommandPalette } from "./CommandPalette";
import { shellRoute, shellRoutes, shellViewFromSearch, type ShellView } from "@/lib/application-shell/navigation";

function workspaceLabel(root?: string) {
  if (!root) return "Configured workspace";
  return root.split(/[\\/]/).filter(Boolean).at(-1) ?? root;
}

export function ApplicationShell({ view, onNavigate, workspace, runtimeStatus = "Local runtime ready", notice, children }: {
  view: ShellView;
  onNavigate: (view: ShellView) => void;
  workspace?: string;
  runtimeStatus?: string;
  notice?: ReactNode;
  children: ReactNode;
}) {
  const [commandsOpen, setCommandsOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const route = shellRoute(view);
  const navigate = useCallback((next: ShellView) => {
    onNavigate(next);
    setMobileNavOpen(false);
    const url = new URL(window.location.href);
    if (next === "chat") url.searchParams.delete("view"); else url.searchParams.set("view", next);
    window.history.pushState({ view: next }, "", `${url.pathname}${url.search}${url.hash}`);
  }, [onNavigate]);

  useEffect(() => {
    const pop = () => onNavigate(shellViewFromSearch(window.location.search));
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setCommandsOpen(true); }
    };
    window.addEventListener("popstate", pop);
    window.addEventListener("keydown", shortcut);
    return () => { window.removeEventListener("popstate", pop); window.removeEventListener("keydown", shortcut); };
  }, [onNavigate]);

  return (
    <div className="relative grid h-[100dvh] min-h-0 grid-cols-1 grid-rows-[3.75rem_minmax(0,1fr)] overflow-hidden bg-app-gradient text-starlight lg:grid-cols-[15rem_minmax(0,1fr)]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden"><div className="absolute -left-40 -top-48 h-[34rem] w-[34rem] rounded-full bg-brand/10 blur-[110px]" /><div className="absolute -right-40 top-20 h-[30rem] w-[30rem] rounded-full bg-intelligence/10 blur-[110px]" /><div className="absolute inset-0 bg-grid opacity-30 [mask-image:linear-gradient(to_bottom,black,transparent_78%)]" /></div>

      <header className="relative z-30 col-span-full flex items-center gap-3 border-b border-subtle bg-deep-orbit/85 px-3 backdrop-blur-xl sm:px-4">
        <button onClick={() => setMobileNavOpen(value => !value)} className="rounded-control p-2 text-ink-600 hover:bg-ink-400/10 lg:hidden" aria-label="Toggle global navigation" aria-expanded={mobileNavOpen}>{mobileNavOpen ? <X size={20} /> : <Menu size={20} />}</button>
        <CodexiaLogo className="hidden h-auto w-28 sm:block" priority />
        <CodexiaSymbol className="h-8 w-8 sm:hidden" priority />
        <button onClick={() => setCommandsOpen(true)} className="mx-auto flex h-10 min-w-0 max-w-xl flex-1 items-center gap-2 rounded-button border border-subtle bg-surface-glass px-3 text-left text-sm text-ink-400 shadow-card transition hover:border-active hover:text-ink-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
          <Search size={17} className="shrink-0 text-intelligence" /><span className="truncate">Search or run a command…</span><kbd className="ml-auto hidden rounded border border-subtle bg-orbit px-1.5 py-0.5 font-sans text-[10px] text-ink-500 sm:inline-flex"><Command size={10} className="mr-0.5" />K</kbd>
        </button>
        <button className="relative rounded-control p-2 text-ink-600 hover:bg-ink-400/10" aria-label="Notifications"><Bell size={19} /><span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border-2 border-deep-orbit bg-codier-magenta" /></button>
        <div className="hidden items-center gap-2 rounded-button border border-subtle bg-surface-subtle px-2.5 py-1.5 sm:flex" title={workspace}>
          <CodexiaSymbol className="h-6 w-6" /><span className="max-w-36 truncate text-xs font-semibold">{workspaceLabel(workspace)}</span><ChevronDown size={14} className="text-ink-400" />
        </div>
        <button className="flex h-9 w-9 items-center justify-center rounded-full border border-subtle bg-brand-100 text-brand-300" aria-label="Account and status"><UserRound size={17} /></button>
      </header>

      <aside className={clsx("absolute bottom-0 left-0 top-[3.75rem] z-20 flex w-60 flex-col border-r border-subtle bg-deep-orbit/95 backdrop-blur-xl transition-transform lg:relative lg:top-0 lg:z-10 lg:row-start-2 lg:translate-x-0", mobileNavOpen ? "translate-x-0" : "-translate-x-full")}>
        <div className="border-b border-subtle p-3"><div className="rounded-button border border-active bg-brand-100 p-3 shadow-brand"><p className="text-caption font-semibold uppercase tracking-[0.16em] text-brand-300">Project</p><p className="mt-1 truncate text-sm font-semibold text-starlight">{workspaceLabel(workspace)}</p><p className="mt-1 truncate text-xs text-ink-500">{workspace ?? "Local workspace"}</p></div></div>
        <nav aria-label="Global navigation" className="min-h-0 flex-1 overflow-y-auto p-3">
          {["Workspace", "System"].map(group => <div key={group} className="mb-5"><p className="mb-2 px-2 text-caption font-semibold uppercase tracking-[0.16em] text-ink-400">{group}</p>{shellRoutes.filter(item => item.group === group).map(item => { const Icon = item.icon; const active = item.id === view; return <button key={item.id} onClick={() => navigate(item.id)} aria-current={active ? "page" : undefined} className={clsx("mb-1 flex w-full items-center gap-3 rounded-button px-3 py-2.5 text-left text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand", active ? "border border-active bg-brand-100 text-starlight shadow-brand" : "border border-transparent text-ink-600 hover:bg-ink-400/10 hover:text-starlight")}><Icon size={18} className={active ? "text-brand-300" : "text-ink-400"} /><span className="truncate">{item.shortLabel}</span>{active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-intelligence shadow-intelligence" />}</button>; })}</div>)}
        </nav>
        <div className="border-t border-subtle p-3"><div className="flex items-center gap-2 rounded-button bg-surface-subtle px-3 py-2"><span className="h-2 w-2 rounded-full bg-status-success shadow-[0_0_0_4px_rgba(66,214,164,0.10)]" /><span className="min-w-0"><span className="block truncate text-xs font-medium text-ink-700">{runtimeStatus}</span><span className="block text-[10px] text-ink-400">Local · private</span></span></div></div>
      </aside>
      {mobileNavOpen && <button aria-label="Close global navigation" className="fixed inset-0 top-[3.75rem] z-10 bg-nebula/60 lg:hidden" onClick={() => setMobileNavOpen(false)} />}

      <main className="relative z-0 row-start-2 flex min-w-0 flex-col overflow-hidden lg:col-start-2">
        <div className="flex min-h-[4.5rem] shrink-0 items-center justify-between gap-4 border-b border-subtle bg-deep-orbit/55 px-4 sm:px-6">
          <div className="min-w-0"><div className="flex items-center gap-2"><Sparkles size={12} className="text-intelligence" /><p className="text-caption font-semibold uppercase tracking-[0.16em] text-ink-400">Codexia workspace</p></div><div className="mt-1 flex min-w-0 items-baseline gap-3"><h1 className="truncate text-title font-semibold text-starlight">{route.label}</h1><p className="hidden truncate text-sm text-ink-500 xl:block">{route.description}</p></div></div>
          <div className="hidden rounded-full border border-subtle bg-surface-subtle px-3 py-1.5 text-xs text-ink-600 sm:block">{runtimeStatus}</div>
        </div>
        {notice}
        <div className="min-h-0 flex-1 p-2 sm:p-3 lg:p-4">{children}</div>
      </main>
      <CommandPalette open={commandsOpen} onClose={() => setCommandsOpen(false)} onNavigate={navigate} />
    </div>
  );
}
