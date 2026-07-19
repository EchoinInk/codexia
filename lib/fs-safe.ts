import path from "node:path";
import fs from "node:fs/promises";

export function getWorkspaceRoot(
  workspace?: string
): string {
  const root =
    workspace ||
    process.env.WORKSPACE_DIR;

  if (!root) {
    throw new Error("WORKSPACE_DIR is not set. Add it to .env.local.");
  }

  return path.resolve(root);
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
  return IGNORE.has(
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

  const abs =
    safeResolve(
      relDir,
      workspace
    );

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

export async function safeReadFile(
  relPath: string,
  workspace?: string
): Promise<string> {
  const abs =
    safeResolve(
      relPath,
      workspace
    );

  return fs.readFile(
    abs,
    "utf8"
  );
}

export async function safeWriteFile(
  relPath: string,
  content: string,
  workspace?: string
): Promise<void> {
  const abs =
    safeResolve(
      relPath,
      workspace
    );

  await fs.mkdir(
    path.dirname(abs),
    {
      recursive: true,
    }
  );

  await fs.writeFile(
    abs,
    content,
    "utf8"
  );
}
