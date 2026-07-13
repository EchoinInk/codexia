import { safeReadFile } from "@/lib/fs-safe";

export interface FileChange {
  path: string;

  before: string;

  after: string;
}

export interface DiffResult {
  changes: FileChange[];
}

export async function generateFileDiff(
  path: string,
  newContent: string
): Promise<FileChange> {
  let before = "";

  try {
    before = await safeReadFile(path);
  } catch {
    // File does not exist yet

    before = "";
  }

  return {
    path,

    before,

    after: newContent,
  };
}

export async function generateDiff(
  changes: {
    path: string;
    content: string;
  }[]
): Promise<DiffResult> {
  const result: FileChange[] = [];

  for (const change of changes) {
    const diff = await generateFileDiff(change.path, change.content);

    result.push(diff);
  }

  return {
    changes: result,
  };
}
