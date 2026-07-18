import {
  safeReadFile,
  safeResolve,
} from "@/lib/fs-safe";

import fs from "node:fs/promises";

import { parseCode } from "./code-parser";

import type {
  IndexedFile,
} from "./types";

function detectLanguage(
  extension: string
): string {

  const languages: Record<string, string> = {

    ts: "typescript",

    tsx: "typescript-react",

    js: "javascript",

    jsx: "javascript-react",

    json: "json",

    css: "css",

    html: "html",

    md: "markdown",

  };

  return (
    languages[extension] ??
    "unknown"
  );

}

export async function analyseFile(
  path: string,
  workspace?: string
): Promise<IndexedFile> {

  const content =
    await safeReadFile(
      path,
      workspace
    );

  const stats =
    await fs.stat(
      safeResolve(
        path,
        workspace
      )
    );

  const extension =
    path.includes(".")
      ? path.split(".").pop()?.toLowerCase() ?? ""
      : "";

  const language =
    detectLanguage(
      extension
    );

  return {

    path,

    size:
      stats.size,

    modifiedAt:
      stats.mtimeMs,

    extension,

    language,

    preview:
      content.slice(
        0,
        500
      ),

    code:
      parseCode(
        content,
        language,
        path
      ),

  };

}