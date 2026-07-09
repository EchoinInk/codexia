"use client";
import { useEffect, useRef, useState } from "react";
import { Markdown } from "./Markdown";
import { DiffView } from "./DiffView";
import { ArrowUp, Bot, User, Wrench, Check, X } from "lucide-react";

type Msg =
  | { role: "user" | "assistant"; content: string }
  | { role: "tool"; tool: string; data: any };

type PendingDiff = {
  path: string;
  oldText: string;
  newText: string;
};

export function Chat({ onWorkspaceChanged }: { onWorkspaceChanged?: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingDiff, setPendingDiff] = useState<PendingDiff | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);

    // build history for backend (only user/assistant text)
    const history = next
      .filter((m): m is Extract<Msg, { role: "user" | "assistant" }> =>
        m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      if (!res.ok || !res.body) throw new Error(`Chat error: ${res.status}`);

      // Append a streaming assistant placeholder
      setMessages((m) => [...m, { role: "assistant", content: "" }]);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          const t = line.trim();
          if (!t) continue;
          let evt: { type: string; data: any };
          try { evt = JSON.parse(t); } catch { continue; }
          if (evt.type === "token") {
            setMessages((m) => {
              const copy = m.slice();
              const last = copy[copy.length - 1];
              if (last && last.role === "assistant") {
                copy[copy.length - 1] = { ...last, content: last.content + evt.data };
              }
              return copy;
            });
          } else if (evt.type === "tool_call") {
            // Intercept write_file → show diff and ask user
            const call = evt.data;
            if (call.tool === "write_file" && call.args?.path && typeof call.args?.content === "string") {
              try {
                const r = await fetch(`/api/fs/read?path=${encodeURIComponent(call.args.path)}`);
                const j = await r.json();
                const oldText = j.error ? "" : j.content;
                setPendingDiff({ path: call.args.path, oldText, newText: call.args.content });
              } catch {
                setPendingDiff({ path: call.args.path, oldText: "", newText: call.args.content });
              }
            }
            setMessages((m) => [...m, { role: "tool", tool: call.tool, data: call.args }]);
            // Start a fresh assistant placeholder for follow-up
            setMessages((m) => [...m, { role: "assistant", content: "" }]);
          } else if (evt.type === "tool_result") {
            // Workspace probably changed
            onWorkspaceChanged?.();
          } else if (evt.type === "error") {
            setMessages((m) => [
              ...m,
              { role: "assistant", content: `\n\n**Error:** ${evt.data.message}` },
            ]);
          }
        }
      }
    } catch (e: any) {
      setMessages((m) => [...m, { role: "assistant", content: `**Error:** ${e.message}` }]);
    } finally {
      setBusy(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="bg-white rounded-2xl shadow-card border border-ink-400/10 flex flex-col h-full overflow-hidden">
      <div className="px-6 py-4 border-b border-ink-400/10 flex items-center justify-between">
        <div>
          <div className="text-ink-900 font-bold">Conversation</div>
          <div className="text-xs text-ink-500">Streaming from your local Ollama model</div>
        </div>
        <div className="text-[11px] text-ink-500 font-mono bg-ink-400/10 px-2 py-1 rounded">
          system: Codexia
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
        {messages.length === 0 && (
          <div className="text-center text-ink-500 mt-20">
            <Bot className="mx-auto mb-3 text-brand" size={28} />
            <div className="font-semibold text-ink-900">Hi, I'm Codexia.</div>
            <div className="text-sm mt-1">Ask me to read, edit, or generate code in your workspace.</div>
          </div>
        )}

        {messages.map((m, i) => {
          if (m.role === "tool") {
            return (
              <div key={i} className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <Wrench size={15} />
                </div>
                <div className="bg-amber-50 border border-amber-200/60 rounded-xl px-4 py-2 text-[13px] text-amber-900 font-mono">
                  <span className="font-semibold">{m.tool}</span>
                  {m.data?.path && <> · <span>{m.data.path}</span></>}
                </div>
              </div>
            );
          }
          return (
            <div key={i} className="flex gap-3">
              <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center ${
                m.role === "user" ? "bg-ink-400/15 text-ink-700" : "bg-brand-50 text-brand"
              }`}>
                {m.role === "user" ? <User size={15} /> : <Bot size={15} />}
              </div>
              <div className="flex-1 min-w-0">
                {m.role === "user" ? (
                  <div className="text-ink-900 text-[14.5px] whitespace-pre-wrap leading-relaxed">{m.content}</div>
                ) : m.content ? (
                  <Markdown>{m.content}</Markdown>
                ) : busy ? (
                  <div className="typing text-ink-500 text-lg">
                    <span>•</span><span>•</span><span>•</span>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {pendingDiff && (
        <PendingDiffBar
          diff={pendingDiff}
          onApply={async () => {
            await fetch("/api/fs/write", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ path: pendingDiff.path, content: pendingDiff.newText }),
            });
            setPendingDiff(null);
            onWorkspaceChanged?.();
          }}
          onDiscard={() => setPendingDiff(null)}
        />
      )}

      <div className="border-t border-ink-400/10 p-4">
        <div className="flex items-end gap-2 bg-[#f4f7fe] rounded-2xl p-2 border border-ink-400/10 focus-within:border-brand/40">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder="Ask Codexia to read, write, or refactor code…"
            rows={1}
            className="flex-1 bg-transparent outline-none resize-none px-3 py-2 text-[14.5px] text-ink-900 placeholder:text-ink-400 max-h-40"
          />
          <button
            onClick={send}
            disabled={busy || !input.trim()}
            className="w-9 h-9 rounded-xl bg-brand hover:bg-brand-600 text-white flex items-center justify-center disabled:opacity-40"
          >
            <ArrowUp size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}

function PendingDiffBar({
  diff, onApply, onDiscard,
}: { diff: PendingDiff; onApply: () => void; onDiscard: () => void }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border-t border-ink-400/10 bg-brand-50/40 px-6 py-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold text-ink-900">
          Proposed edit · <span className="font-mono text-brand">{diff.path}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setOpen((o) => !o)} className="text-xs text-ink-700 hover:underline">
            {open ? "Hide diff" : "Show diff"}
          </button>
          <button onClick={onDiscard} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg text-ink-700 hover:bg-ink-400/10">
            <X size={13} /> Discard
          </button>
          <button onClick={onApply} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-brand text-white hover:bg-brand-600">
            <Check size={13} /> Apply
          </button>
        </div>
      </div>
      {open && (
        <div className="max-h-72 overflow-auto">
          <DiffView oldText={diff.oldText} newText={diff.newText} />
        </div>
      )}
    </div>
  );
}
