"use client";

import { useEffect, useState } from "react";
import { codeToHtml } from "shiki";

type ShikiProps = {
  code: string;
  lang?: string;
};

export function Shiki({ code, lang = "tsx" }: ShikiProps) {
  const [html, setHtml] = useState("");

  useEffect(() => {
    let cancelled = false;

    codeToHtml(code, {
      lang,
      theme: "github-dark",
    })
      .then((result) => {
        if (!cancelled) {
          setHtml(result);
        }
      })
      .catch(() => {
        codeToHtml(code, {
          lang: "text",
          theme: "github-dark",
        }).then((result) => {
          if (!cancelled) {
            setHtml(result);
          }
        });
      });

    return () => {
      cancelled = true;
    };
  }, [code, lang]);

  if (!html) {
    return (
      <pre className="shiki">
        <code>{code}</code>
      </pre>
    );
  }

  return (
    <div
      dangerouslySetInnerHTML={{
        __html: html,
      }}
    />
  );
}
