import type { WorkspaceIndex } from "./types";

import type { WorkspaceFingerprint } from "./index-fingerprint";

interface WorkspaceCacheEntry {
  index: WorkspaceIndex;

  fingerprint: WorkspaceFingerprint;

  createdAt: number;
}

const workspaceCaches = new Map<string, WorkspaceCacheEntry>();

export function getWorkspaceCache(workspace: string): WorkspaceIndex | null {
  const entry = workspaceCaches.get(workspace);

  if (!entry) {
    return null;
  }

  return entry.index;
}

export function getWorkspaceCacheEntry(
  workspace: string
): WorkspaceCacheEntry | null {
  return workspaceCaches.get(workspace) ?? null;
}

export function getWorkspaceFingerprint(
  workspace: string
): WorkspaceFingerprint | null {
  const entry = workspaceCaches.get(workspace);

  if (!entry) {
    return null;
  }

  return entry.fingerprint;
}

export function setWorkspaceCache(
  workspace: string,
  index: WorkspaceIndex,
  fingerprint: WorkspaceFingerprint
): void {
  workspaceCaches.set(workspace, {
    index,

    fingerprint,

    createdAt: Date.now(),
  });
}

export function invalidateWorkspaceCache(workspace?: string): void {
  if (workspace) {
    workspaceCaches.delete(workspace);

    return;
  }

  workspaceCaches.clear();
}

export function clearWorkspaceCache(): void {
  workspaceCaches.clear();
}

export function hasWorkspaceCache(workspace: string): boolean {
  return workspaceCaches.has(workspace);
}

export function getWorkspaceCacheAge(workspace: string): number {
  const entry = workspaceCaches.get(workspace);

  if (!entry) {
    return 0;
  }

  return Date.now() - entry.createdAt;
}
