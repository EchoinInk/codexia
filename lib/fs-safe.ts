import path from "node:path";
import fs from "node:fs/promises";

export function getWorkspaceRoot(): string {
  const root = process.env.WORKSPACE_DIR;
  if (!root) throw new Error("WORKSPACE_DIR is not set. Add it to .env.local.");
  return path.resolve(root);
}

/** Resolve a user-supplied path relative to WORKSPACE_DIR and ensure it doesn't escape it. */
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
  path: string; // relative to workspace
  type: "file" | "dir";
  children?: FsNode[];
};

const IGNORE = new Set([
  "node_modules", ".git", ".next", ".turbo", ".cache",
  "dist", "build", ".DS_Store", ".vercel",
]);

export async function listTree(relDir = ""): Promise<FsNode[]> {
  const root = getWorkspaceRoot();
  const abs = safeResolve(relDir);
  const entries = await fs.readdir(abs, { withFileTypes: true });
  const nodes: FsNode[] = [];
  for (const e of entries) {
    if (IGNORE.has(e.name)) continue;
    const rel = path.relative(root, path.join(abs, e.name));
    if (e.isDirectory()) {
      nodes.push({ name: e.name, path: rel, type: "dir", children: await listTree(rel) });
    } else if (e.isFile()) {
      nodes.push({ name: e.name, path: rel, type: "file" });
    }
  }
  nodes.sort((a, b) =>
    a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1
  );
  return nodes;
}
