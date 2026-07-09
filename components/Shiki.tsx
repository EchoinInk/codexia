"use client";
import { useEffect, useState } from "react";
import { codeToHtml } from "shiki";

export function Shiki({ code, lang = "tsx" }: { code: string; lang?: string }) {
  const [html, setHtml] = useState<string>("");
  useEffect(() => {
    let cancelled = false;
    codeToHtml(code, { lang: (lang as any) || "tsx", theme: "github-dark" })
      .then((h) => { if (!cancelled) setHtml(h); })
      .catch(() => {
        codeToHtml(code, { lang: "text", theme: "github-dark" }).then(
          (h) => !cancelled && setHtml(h)
        );
      });
    return () => { cancelled = true; };
  }, [code, lang]);
  if (!html) {
    return (
      <pre className="shiki"><code>{code}</code></pre>
    );
  }
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
