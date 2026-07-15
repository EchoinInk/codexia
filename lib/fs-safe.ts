import path from "node:path";
import fs from "node:fs/promises";

export function getWorkspaceRoot(): string {
  const root = process.env.WORKSPACE_DIR;

  if (!root) {
    throw new Error("WORKSPACE_DIR is not set. Add it to .env.local.");
  }

  return path.resolve(root);
}

/**
 * Resolve a path inside WORKSPACE_DIR
 */
export function safeResolve(relOrAbs: string): string {
  const root = getWorkspaceRoot();

  const candidate = path.resolve(root, relOrAbs.replace(/^\/+/, ""));

  const normalized = path.normalize(candidate);

  if (normalized !== root && !normalized.startsWith(root + path.sep)) {
    throw new Error("Path escapes workspace root");
  }

  return normalized;
}

export type FsNode = {
  name: string;

  path: string;

  type: "file" | "dir";

  children?: FsNode[];
};

const IGNORE = new Set([
  "node_modules",
  ".git",
  ".next",
  ".turbo",
  ".cache",
  "dist",
  "build",
  ".DS_Store",
  ".vercel",
]);

export async function listTree(relDir: string = ""): Promise<FsNode[]> {
  const root = getWorkspaceRoot();

  const abs = safeResolve(relDir);

  try {
    const entries = await fs.readdir(abs, {
      withFileTypes: true,
    });

    const nodes: FsNode[] = [];

    for (const entry of entries) {
      if (IGNORE.has(entry.name)) {
        continue;
      }

      const fullPath = path.join(abs, entry.name);

      const relative = path.relative(root, fullPath);

      if (entry.isDirectory()) {
        nodes.push({
          name: entry.name,

          path: relative,

          type: "dir",

          children: await listTree(relative),
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
/**
 * Read a workspace file safely
 */
export async function safeReadFile(relPath: string): Promise<string> {
  const abs = safeResolve(relPath);

  return fs.readFile(abs, "utf8");
}

/**
 * Write a workspace file safely
 */
export async function safeWriteFile(
  relPath: string,
  content: string
): Promise<void> {
  const abs = safeResolve(relPath);

  await fs.mkdir(path.dirname(abs), {
    recursive: true,
  });

  await fs.writeFile(abs, content, "utf8");
}