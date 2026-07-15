"use client";
import {
  MessageSquare,
  Folder,
  Settings,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import clsx from "clsx";

export type View = "chat" | "files" | "settings";

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
      ],
    },
    {
      label: "System",
      items: [{ id: "settings", icon: Settings, label: "Settings" }],
    },
  ];

  return (
    <aside className="w-64 shrink-0 bg-white border-r border-ink-400/15 flex flex-col">
      <div className="px-6 py-6 flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand to-brand-700 flex items-center justify-center text-white shadow-soft">
          <Sparkles size={18} />
        </div>
        <div>
          <div className="text-ink-900 font-bold text-lg leading-none">
            Codexia
          </div>
          <div className="text-[11px] text-ink-500 mt-0.5">Local AI coding</div>
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
                      ? "bg-brand-50 text-brand"
                      : "text-ink-700 hover:bg-ink-400/5"
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
