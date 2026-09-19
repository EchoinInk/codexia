import { guardedWorkspacePath, safeReadFile, safeWriteFile, fileVersion } from "@/lib/fs-safe";

/** Existing reviewed-change interface; containment is shared with manual access. */
export function guardedPath(workspace: string, file: string): Promise<string> {
  return guardedWorkspacePath(workspace, file);
}

export function guardedRead(workspace: string, file: string): Promise<string> {
  return safeReadFile(file, workspace);
}

export function guardedReplace(workspace: string, file: string, before: string, after: string): Promise<void> {
  return safeWriteFile(file, after, workspace, fileVersion(before));
}
