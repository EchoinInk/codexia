"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "./CodeBlock";

export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-chat text-[14.5px] leading-relaxed text-ink-900">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || "");
            const code = String(children).replace(/\n$/, "");
            if (inline) return <code className={className} {...props}>{children}</code>;
            return <CodeBlock code={code} lang={match?.[1]} />;
          },
          a({ children, ...props }) {
            return <a {...props} className="text-brand underline" target="_blank" rel="noreferrer">{children}</a>;
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
