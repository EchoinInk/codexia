"use client";
import { diffLines } from "diff";
import clsx from "clsx";

export function DiffView({ oldText, newText }: { oldText: string; newText: string }) {
  const parts = diffLines(oldText, newText);
  return (
    <pre className="text-[12.5px] leading-relaxed font-mono bg-deep-orbit text-starlight rounded-xl p-3 overflow-x-auto">
      {parts.map((p, i) =>
        p.value.split("\n").filter((l, idx, arr) => idx < arr.length - 1 || l).map((line, j) => (
          <div
            key={`${i}-${j}`}
            className={clsx(
              p.added && "bg-status-success/20 text-status-success",
              p.removed && "bg-status-danger/100/20 text-status-danger",
              !p.added && !p.removed && "text-starlight/70"
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
