"use client";
import {
  MessageSquare,
  Folder,
  Settings,
  Sparkles,
  Activity,
  PanelsTopLeft,
  type LucideIcon,
} from "lucide-react";
import clsx from "clsx";
import { CodexiaLogo } from "@/components/design-system/BrandAsset";

export type View = "chat" | "files" | "intelligence" | "operations" | "settings";

export function Sidebar({
  view,
  setView,
}: {
  view: View;
  setView: (v: View) => void;
}) {
  const groups: {
    label: string;
    items: {
      id: View;
      icon: LucideIcon;
      label: string;
    }[];
  }[] = [
    {
      label: "Workspace",
      items: [
        { id: "chat", icon: MessageSquare, label: "Chat" },
        { id: "files", icon: Folder, label: "Files" },
        { id: "intelligence", icon: Activity, label: "Intelligence" },
        { id: "operations", icon: PanelsTopLeft, label: "Control Centre" },
      ],
    },
    {
      label: "System",
      items: [{ id: "settings", icon: Settings, label: "Settings" }],
    },
  ];

  return (
    <aside className="w-64 shrink-0 bg-deep-orbit border-r border-subtle flex flex-col">
      <div className="px-6 py-6">
        <CodexiaLogo className="h-auto w-32" priority />
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-500">
          <Sparkles size={12} className="text-intelligence" /> Local AI coding
        </div>
      </div>

      <nav className="px-3 mt-2 flex-1">
        {groups.map((g) => (
          <div key={g.label} className="mb-6">
            <div className="px-3 text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-2">
              {g.label}
            </div>
            {g.items.map((it) => {
              const Icon = it.icon;
              const active = view === it.id;
              return (
                <button
                  key={it.id}
                  onClick={() => setView(it.id)}
                  className={clsx(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition",
                    active
                      ? "bg-brand-100 text-brand-300 shadow-glow-sm"
                      : "text-ink-700 hover:bg-ink-400/10"
                  )}
                >
                  <Icon
                    size={18}
                    className={active ? "text-brand" : "text-ink-500"}
                  />
                  {it.label}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-ink-400/10 text-[11px] text-ink-500">
        Powered by Ollama · runs 100% locally
      </div>
    </aside>
  );
}
