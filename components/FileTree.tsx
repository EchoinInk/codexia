"use client";
import { useEffect, useState } from "react";
import { ChevronRight, File as FileIcon, Folder, FolderOpen, RefreshCw } from "lucide-react";
import clsx from "clsx";

export type FsNode = {
  name: string;
  path: string;
  type: "file" | "dir";
  children?: FsNode[];
};

function Node({
  node, depth, onOpen, activePath,
}: {
  node: FsNode; depth: number; onOpen: (p: string) => void; activePath?: string;
}) {
  const [open, setOpen] = useState(depth < 1);
  if (node.type === "file") {
    const active = node.path === activePath;
    return (
      <button
        onClick={() => onOpen(node.path)}
        className={clsx(
          "w-full flex items-center gap-2 text-left px-2 py-1 rounded-md text-[13px]",
          active ? "bg-brand-50 text-brand" : "text-ink-700 hover:bg-ink-400/5"
        )}
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        <FileIcon size={14} className="opacity-70 shrink-0" />
        <span className="truncate">{node.name}</span>
      </button>
    );
  }
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-[13px] text-ink-900 hover:bg-ink-400/5"
        style={{ paddingLeft: 4 + depth * 14 }}
      >
        <ChevronRight
          size={14}
          className={clsx("transition-transform", open && "rotate-90")}
        />
        {open ? <FolderOpen size={14} className="text-brand" /> : <Folder size={14} className="text-ink-500" />}
        <span className="font-medium truncate">{node.name}</span>
      </button>
      {open && node.children?.map((c) => (
        <Node key={c.path} node={c} depth={depth + 1} onOpen={onOpen} activePath={activePath} />
      ))}
    </div>
  );
}

export function FileTree({
  onOpen, activePath, refreshKey = 0,
}: {
  onOpen: (p: string) => void; activePath?: string; refreshKey?: number;
}) {
  const [tree, setTree] = useState<FsNode[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/fs/list");
      const j = await r.json();
      if (j.error) setErr(j.error); else { setTree(j.tree); setErr(null); }
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [refreshKey]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-ink-400/10">
        <div className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Workspace</div>
        <button onClick={load} className="text-ink-500 hover:text-brand p-1 rounded">
          <RefreshCw size={13} className={clsx(loading && "animate-spin")} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {err && <div className="text-xs text-red-600 p-2">{err}</div>}
        {!err && tree.length === 0 && !loading && (
          <div className="text-xs text-ink-500 p-2">Empty workspace.</div>
        )}
        {tree.map((n) => (
          <Node key={n.path} node={n} depth={0} onOpen={onOpen} activePath={activePath} />
        ))}
      </div>
    </div>
  );
}
