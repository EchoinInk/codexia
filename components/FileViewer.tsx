"use client";
import { useEffect, useSyncExternalStore } from "react";
import { FileBuffer } from "@/lib/editor/file-buffer";
import { Shiki } from "./Shiki";
import { FileIcon, Save, X } from "lucide-react";

function langFromPath(p: string): string {
  const ext = p.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "ts", tsx: "tsx", js: "js", jsx: "jsx", json: "json", md: "md",
    css: "css", scss: "scss", html: "html", py: "py", go: "go", rs: "rust",
    java: "java", rb: "ruby", sh: "bash", yml: "yaml", yaml: "yaml",
    toml: "toml", sql: "sql", c: "c", cpp: "cpp", h: "c",
  };
  return map[ext] ?? "text";
}

export function FileViewer({
  path, onClose, onSaved, buffer,
}: { path: string; onClose: () => void; onSaved?: () => void; buffer: FileBuffer }) {
  const state = useSyncExternalStore(buffer.subscribe, buffer.getSnapshot, buffer.getSnapshot);
  const selected = state.path === path;
  const loading = !selected || state.loading;
  const content = selected ? state.content : "";
  const editing = selected && state.editing;
  const err = selected ? state.error : undefined;
  const ready = selected && !loading && state.version !== undefined;
  useEffect(() => {
    void buffer.select(path);
    return buffer.stopLoading;
  }, [path, buffer]);
  const save = async () => { if (await buffer.save(path)) onSaved?.(); };

  return (
    <div className="bg-white rounded-2xl shadow-card border border-ink-400/10 overflow-hidden h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-ink-400/10">
        <div className="flex items-center gap-2 text-ink-900 font-medium text-sm">
          <FileIcon size={15} className="text-brand" />
          <span className="font-mono">{path}</span>
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button disabled={!buffer.canSave(path)} onClick={save} className="text-xs flex items-center gap-1 bg-brand text-white px-3 py-1.5 rounded-lg hover:bg-brand-600">
                <Save size={13} /> Save
              </button>
              <button disabled={state.saving} onClick={() => buffer.discard(path)} className="text-xs text-ink-700 px-3 py-1.5 rounded-lg hover:bg-ink-400/10">
                Cancel
              </button>
            </>
          ) : (
            <button disabled={!ready || state.saving} onClick={() => buffer.edit(path)} className="text-xs text-brand bg-brand-50 px-3 py-1.5 rounded-lg hover:bg-brand-100">
              Edit
            </button>
          )}
          <button onClick={onClose} className="text-ink-500 hover:text-ink-900 p-1 rounded">
            <X size={16} />
          </button>
        </div>
      </div>
      {ready && state.content !== state.original && <p className="px-4 py-1 text-xs text-ink-500">Unsaved edits are kept when switching files or views in this session.</p>}
      <div className="flex-1 overflow-auto">
        {loading && <div className="p-6 text-sm text-ink-500">Loading…</div>}
        {err && <div className="p-6 text-sm text-red-600">{err}</div>}
        {ready && (
          editing ? (
            <textarea
              value={content}
              disabled={state.saving}
              onChange={(e) => buffer.change(path, e.target.value)}
              className="w-full h-full min-h-[400px] p-4 font-mono text-[13px] leading-relaxed bg-[#0b1020] text-white outline-none resize-none"
              spellCheck={false}
            />
          ) : (
            <Shiki code={content} lang={langFromPath(path)} />
          )
        )}
      </div>
    </div>
  );
}
