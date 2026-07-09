"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Shiki } from "./Shiki";

export function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="relative my-2 group">
      <div className="absolute right-2 top-2 z-10 flex items-center gap-2">
        {lang && (
          <span className="text-[11px] uppercase tracking-wider text-white/50 bg-white/5 px-2 py-0.5 rounded">
            {lang}
          </span>
        )}
        <button
          onClick={onCopy}
          className="text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded p-1.5"
          aria-label="Copy code"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
      <Shiki code={code} lang={lang ?? "text"} />
    </div>
  );
}
