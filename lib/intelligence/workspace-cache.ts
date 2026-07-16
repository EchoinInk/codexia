import type { WorkspaceIndex } from "./types";

let cachedWorkspaceIndex: WorkspaceIndex | null = null;

let cacheCreatedAt = 0;

let cacheDirty = true;

export function getWorkspaceCache(): WorkspaceIndex | null {
  if (cacheDirty) {
    return null;
  }

  return cachedWorkspaceIndex;
}

export function setWorkspaceCache(index: WorkspaceIndex): void {
  cachedWorkspaceIndex = index;

  cacheCreatedAt = Date.now();

  cacheDirty = false;
}

export function invalidateWorkspaceCache(): void {
  cacheDirty = true;
}

export function clearWorkspaceCache(): void {
  cachedWorkspaceIndex = null;

  cacheCreatedAt = 0;

  cacheDirty = true;
}

export function isWorkspaceCacheDirty(): boolean {
  return cacheDirty;
}

export function getWorkspaceCacheAge(): number {
  if (cacheCreatedAt === 0) {
    return 0;
  }

  return Date.now() - cacheCreatedAt;
}

export function hasWorkspaceCache(): boolean {
  return cachedWorkspaceIndex !== null && !cacheDirty;
}
