"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { CodeBlock } from "./CodeBlock";

type MarkdownProps = {
  children: string;
};

export function Markdown({
  children,
}: MarkdownProps) {
  return (
    <div className="prose-chat text-[14.5px] leading-relaxed text-ink-900">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({
            className,
            children,
            ...props
          }) {
            const match =
              /language-(\w+)/.exec(
                className || ""
              );

            const code =
              String(children)
                .replace(/\n$/, "");

            if (match) {
              return (
                <CodeBlock
                  code={code}
                  lang={match[1]}
                />
              );
            }

            return (
              <code
                className={className}
                {...props}
              >
                {children}
              </code>
            );
          },

          a({
            children,
            ...props
          }) {
            return (
              <a
                {...props}
                className="text-brand underline"
                target="_blank"
                rel="noreferrer"
              >
                {children}
              </a>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}