import fs from "node:fs/promises";
import path from "node:path";
import { constants } from "node:fs";
import { safeResolve } from "@/lib/fs-safe";

/** Resolve a workspace file while rejecting symlinks in every path component. */
export async function guardedPath(workspace: string, file: string): Promise<string> {
  const target = safeResolve(file, workspace);
  const root = path.resolve(workspace);
  if ((await fs.realpath(root)) !== root) throw new Error("Workspace root must be canonical");
  const relative = path.relative(root, target);
  let current = root;
  for (const component of relative.split(path.sep)) {
    current = path.join(current, component);
    const stat = await fs.lstat(current);
    if (stat.isSymbolicLink()) throw new Error(`Symlink target rejected: ${file}`);
  }
  if (!(await fs.stat(target)).isFile()) throw new Error(`Not a file: ${file}`);
  return target;
}

export async function guardedRead(workspace: string, file: string): Promise<string> {
  const target = await guardedPath(workspace, file);
  const handle = await fs.open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
  try { return await handle.readFile("utf8"); } finally { await handle.close(); }
}

export async function guardedReplace(workspace: string, file: string, before: string, after: string): Promise<void> {
  const target = await guardedPath(workspace, file);
  const handle = await fs.open(target, constants.O_RDWR | constants.O_NOFOLLOW);
  try {
    if (await handle.readFile("utf8") !== before) throw new Error(`Concurrent source change: ${file}`);
    const bytes = Buffer.from(after);
    let written = 0;
    while (written < bytes.length) {
      const result = await handle.write(bytes, written, bytes.length - written, written);
      if (!result.bytesWritten) throw new Error(`Unable to write ${file}`);
      written += result.bytesWritten;
    }
    await handle.truncate(bytes.length);
    await handle.sync();
  } finally { await handle.close(); }
}
