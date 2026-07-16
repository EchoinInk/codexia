import { createWorkspaceIndex } from "./workspace-index";

import type { WorkspaceIndex } from "./types";

import {
  getWorkspaceCache,
  getWorkspaceCacheEntry,
  setWorkspaceCache,
  invalidateWorkspaceCache,
  clearWorkspaceCache,
  hasWorkspaceCache,
} from "./workspace-cache";

import { createWorkspaceFingerprint } from "./index-fingerprint";

let buildPromise: Promise<WorkspaceIndex> | null = null;

export async function getWorkspaceIndex(
  workspace: string
): Promise<WorkspaceIndex> {
  const cached = getWorkspaceCache(workspace);

  const cacheEntry = getWorkspaceCacheEntry(workspace);

  if (cached && cacheEntry) {
    const refreshed = await createWorkspaceIndex(
      cached,
      cacheEntry.fingerprint
    );

    const fingerprint = createWorkspaceFingerprint(refreshed);

    setWorkspaceCache(workspace, refreshed, fingerprint);

    return refreshed;
  }

  if (buildPromise) {
    return buildPromise;
  }

  buildPromise = (async () => {
    try {
      const index = await createWorkspaceIndex();

      setWorkspaceCache(workspace, index, createWorkspaceFingerprint(index));

      return index;
    } finally {
      buildPromise = null;
    }
  })();

  return buildPromise;
}

export function markWorkspaceDirty(workspace?: string): void {
  invalidateWorkspaceCache(workspace);
}

export function resetWorkspaceIndex(): void {
  clearWorkspaceCache();
}

export function hasWorkspaceIndex(workspace: string): boolean {
  return hasWorkspaceCache(workspace);
}

export async function rebuildWorkspaceIndex(
  workspace: string
): Promise<WorkspaceIndex> {
  invalidateWorkspaceCache(workspace);

  return getWorkspaceIndex(workspace);
}
