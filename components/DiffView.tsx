"use client";
import { diffLines } from "diff";
import clsx from "clsx";

export function DiffView({ oldText, newText }: { oldText: string; newText: string }) {
  const parts = diffLines(oldText, newText);
  return (
    <pre className="text-[12.5px] leading-relaxed font-mono bg-[#0b1020] text-white rounded-xl p-3 overflow-x-auto">
      {parts.map((p, i) =>
        p.value.split("\n").filter((l, idx, arr) => idx < arr.length - 1 || l).map((line, j) => (
          <div
            key={`${i}-${j}`}
            className={clsx(
              p.added && "bg-green-500/20 text-green-200",
              p.removed && "bg-red-500/20 text-red-200",
              !p.added && !p.removed && "text-white/70"
            )}
          >
            <span className="select-none opacity-50 pr-2">
              {p.added ? "+" : p.removed ? "-" : " "}
            </span>
            {line || "\u00a0"}
          </div>
        ))
      )}
    </pre>
  );
}
