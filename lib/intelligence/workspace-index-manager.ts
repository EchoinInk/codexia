import { createWorkspaceIndex } from "./workspace-index";

import type { WorkspaceIndex } from "./types";

import {
  getWorkspaceCache,
  setWorkspaceCache,
  invalidateWorkspaceCache,
  clearWorkspaceCache,
  hasWorkspaceCache,
} from "./workspace-cache";

let buildPromise: Promise<WorkspaceIndex> | null = null;

export async function getWorkspaceIndex(): Promise<WorkspaceIndex> {
  const cached = getWorkspaceCache();

  if (cached) {
    return cached;
  }

  if (buildPromise) {
    return buildPromise;
  }

  buildPromise = (async () => {
    try {
      const index = await createWorkspaceIndex();

      setWorkspaceCache(index);

      return index;
    } finally {
      buildPromise = null;
    }
  })();

  return buildPromise;
}

export function markWorkspaceDirty(): void {
  invalidateWorkspaceCache();
}

export function resetWorkspaceIndex(): void {
  clearWorkspaceCache();
}

export function hasWorkspaceIndex(): boolean {
  return hasWorkspaceCache();
}

export async function rebuildWorkspaceIndex(): Promise<WorkspaceIndex> {
  invalidateWorkspaceCache();

  return getWorkspaceIndex();
}