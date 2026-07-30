"use client";
import { useEffect, useState } from "react";
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
  path, onClose, onSaved,
}: { path: string; onClose: () => void; onSaved?: () => void }) {
  const [content, setContent] = useState<string>("");
  const [original, setOriginal] = useState<string>("");
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/fs/read?path=${encodeURIComponent(path)}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.error) setErr(j.error);
        else { setContent(j.content); setOriginal(j.content); setErr(null); }
      })
      .finally(() => setLoading(false));
  }, [path]);

  const save = async () => {
    const r = await fetch("/api/fs/write", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, content }),
    });
    const j = await r.json();
    if (j.error) setErr(j.error);
    else { setOriginal(content); setEditing(false); onSaved?.(); }
  };

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
              <button onClick={save} className="text-xs flex items-center gap-1 bg-brand text-white px-3 py-1.5 rounded-lg hover:bg-brand-600">
                <Save size={13} /> Save
              </button>
              <button onClick={() => { setContent(original); setEditing(false); }} className="text-xs text-ink-700 px-3 py-1.5 rounded-lg hover:bg-ink-400/10">
                Cancel
              </button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} className="text-xs text-brand bg-brand-50 px-3 py-1.5 rounded-lg hover:bg-brand-100">
              Edit
            </button>
          )}
          <button onClick={onClose} className="text-ink-500 hover:text-ink-900 p-1 rounded">
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {loading && <div className="p-6 text-sm text-ink-500">Loading…</div>}
        {err && <div className="p-6 text-sm text-red-600">{err}</div>}
        {!loading && !err && (
          editing ? (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
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
