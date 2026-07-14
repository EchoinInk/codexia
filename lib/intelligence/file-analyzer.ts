import { safeReadFile } from "@/lib/fs-safe";

export interface FileAnalysis {
  path: string;

  size: number;

  extension: string;

  preview: string;
}

export async function analyseFile(path: string): Promise<FileAnalysis> {
  const content = await safeReadFile(path);

  return {
    path,

    size: content.length,

    extension: path.includes(".") ? path.split(".").pop() ?? "" : "",

    preview: content.slice(0, 500),
  };
}
