import path from "node:path";
import fs from "node:fs/promises";
import { constants, realpathSync } from "node:fs";
import { createHash } from "node:crypto";

export function getWorkspaceRoot(
  workspace?: string
): string {
  const root =
    workspace ||
    process.env.WORKSPACE_DIR;

  if (!root) {
    throw new Error("WORKSPACE_DIR is not set. Add it to .env.local.");
  }

  return realpathSync(path.resolve(root));
}

export function safeResolve(
  relOrAbs: string,
  workspace?: string
): string {
  const root =
    getWorkspaceRoot(
      workspace
    );

  const candidate =
    path.isAbsolute(relOrAbs)
      ? path.normalize(relOrAbs)
      : path.resolve(
          root,
          relOrAbs
        );

  const normalized =
    path.normalize(candidate);

  if (
    normalized !== root &&
    !normalized.startsWith(root + path.sep)
  ) {
    throw new Error(
      "Path escapes workspace root"
    );
  }

  return normalized;
}

export type FsNode = {
  name: string;

  path: string;

  type: "file" | "dir";

  children?: FsNode[];
};

const IGNORE =
  new Set([
    "node_modules",
    ".git",
    ".next",
    ".turbo",
    ".cache",
    ".codexia",
    "dist",
    "build",
    ".DS_Store",
    ".vercel",
  ]);

export function shouldIgnoreWorkspaceEntry(
  name: string
): boolean {
  return name.endsWith(".tsbuildinfo") || IGNORE.has(
    name
  );
}

export async function listTree(
  relDir: string = "",
  workspace?: string
): Promise<FsNode[]> {
  const root =
    getWorkspaceRoot(
      workspace
    );

  const abs = await guardedWorkspacePath(root, relDir, { directory: true });

  try {
    const entries =
      await fs.readdir(
        abs,
        {
          withFileTypes: true,
        }
      );

    const nodes: FsNode[] = [];

    for (const entry of entries) {
      if (
        shouldIgnoreWorkspaceEntry(
          entry.name
        )
      ) {
        continue;
      }

      const fullPath =
        path.join(
          abs,
          entry.name
        );

      const relative =
        path.relative(
          root,
          fullPath
        );

      if (entry.isDirectory()) {
        nodes.push({
          name: entry.name,

          path: relative,

          type: "dir",

          children:
            await listTree(
              relative,
              workspace
            ),
        });
      } else if (entry.isFile()) {
        nodes.push({
          name: entry.name,

          path: relative,

          type: "file",
        });
      }
    }

    nodes.sort((a, b) =>
      a.type === b.type
        ? a.name.localeCompare(b.name)
        : a.type === "dir"
          ? -1
          : 1
    );

    return nodes;
  } catch (err: unknown) {
    throw new Error(
      `Unable to list workspace path "${relDir || "."}": ${
        err instanceof Error
          ? err.message
          : String(err)
      }`
    );
  }
}

/** Shared component-wise containment for both manual and reviewed operations. */
export async function guardedWorkspacePath(
  workspace: string,
  file: string,
  options: { directory?: boolean; createParents?: boolean; allowMissing?: boolean } = {}
): Promise<string> {
  const root = getWorkspaceRoot(workspace);
  if (typeof file !== "string" || file.includes("\0")) throw new Error("Invalid workspace path");
  const target = safeResolve(file, root);
  if (target === root) {
    if (options.directory) return root;
    throw new Error("A specific file is required; workspace root is forbidden");
  }
  const components = path.relative(root, target).split(path.sep);
  let current = root;
  for (let i = 0; i < components.length; i++) {
    current = path.join(current, components[i]);
    const last = i === components.length - 1;
    let stat;
    try { stat = await fs.lstat(current); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      if (last && options.allowMissing) return target;
      if (!last && options.createParents) {
        try { await fs.mkdir(current); }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
        stat = await fs.lstat(current);
      } else throw error;
    }
    if (stat.isSymbolicLink()) throw new Error(`Symlink target rejected: ${file}`);
    if ((!last || options.directory) && !stat.isDirectory()) throw new Error(`Not a directory: ${file}`);
    if (last && !options.directory && !stat.isFile()) throw new Error(`Not a file: ${file}`);
  }
  return target;
}

export class FileConflictError extends Error {
  constructor() { super("File changed since it was loaded. Reload and review your changes before saving."); }
}

export function fileVersion(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

// Serialize this process's compare/write operations, including reviewed patches.
const writes = new Map<string, Promise<unknown>>();
async function withFileLock<T>(file: string, action: () => Promise<T>): Promise<T> {
  const previous = writes.get(file) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(action);
  writes.set(file, next);
  try { return await next; }
  finally { if (writes.get(file) === next) writes.delete(file); }
}

export async function safeReadFile(relPath: string, workspace?: string): Promise<string> {
  const target = await guardedWorkspacePath(getWorkspaceRoot(workspace), relPath);
  const handle = await fs.open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    if (!(await handle.stat()).isFile()) throw new Error(`Not a file: ${relPath}`);
    return await handle.readFile("utf8");
  } finally { await handle.close(); }
}

/** null means create-only; a version means replace exactly that loaded content. */
export async function safeWriteFile(
  relPath: string, content: string, workspace?: string, expectedVersion?: string | null
): Promise<void> {
  const root = getWorkspaceRoot(workspace);
  const target = safeResolve(relPath, root);
  await withFileLock(target, async () => {
    try {
      await guardedWorkspacePath(root, relPath, { createParents: expectedVersion == null, allowMissing: expectedVersion == null });
    } catch (error) {
      if (typeof expectedVersion === "string" && (error as NodeJS.ErrnoException).code === "ENOENT") throw new FileConflictError();
      throw error;
    }
    let handle;
    try {
      // Exclusive creation never truncates an existing target or follows a link.
      handle = expectedVersion === null
        ? await fs.open(target, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600)
        : await fs.open(target, constants.O_RDWR | constants.O_NOFOLLOW);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if ((expectedVersion === null && code === "EEXIST") || (typeof expectedVersion === "string" && code === "ENOENT")) throw new FileConflictError();
      if (expectedVersion === undefined && code === "ENOENT") {
        handle = await fs.open(target, constants.O_RDWR | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      } else throw error;
    }
    try {
      if (!(await handle.stat()).isFile()) throw new Error(`Not a file: ${relPath}`);
      if (typeof expectedVersion === "string" && fileVersion(await handle.readFile("utf8")) !== expectedVersion) throw new FileConflictError();
      const bytes = Buffer.from(content);
      let written = 0;
      while (written < bytes.length) {
        const result = await handle.write(bytes, written, bytes.length - written, written);
        if (!result.bytesWritten) throw new Error(`Unable to write ${relPath}`);
        written += result.bytesWritten;
      }
      await handle.truncate(bytes.length);
      await handle.sync();
    } finally { await handle.close(); }
  });
}

export async function safeDeleteFile(relPath: string, workspace?: string): Promise<void> {
  const root = getWorkspaceRoot(workspace);
  const target = safeResolve(relPath, root);
  await withFileLock(target, async () => {
    await guardedWorkspacePath(root, relPath);
    await fs.unlink(target); // Never recursively remove a directory.
  });
}
