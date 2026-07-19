import {
  createWorkspaceIndex,
} from "./workspace-index";

import {
  applyIncrementalIndexUpdate,
} from "./incremental-index";

import type {
  WorkspaceIndex,
} from "./types";

import {
  getWorkspaceCache,
  getWorkspaceCacheEntry,
  setWorkspaceCache,
  invalidateWorkspaceCache,
  clearWorkspaceCache,
  hasWorkspaceCache,
} from "./workspace-cache";

import {
  createWorkspaceFingerprint,
  createWorkspaceFingerprintFromFilesystem,
  compareFingerprints,
  type FingerprintDiff,
  type WorkspaceFingerprint,
} from "./index-fingerprint";

import {
  loadWorkspaceState,
  saveWorkspaceState,
  createWorkspaceState,
} from "./workspace-storage";

import {
  startWorkspaceWatcher,
  stopWorkspaceWatcher,
  stopAllWorkspaceWatchers,
  hasWorkspaceWatcher,
  getWorkspaceWatcherStatus,
} from "./workspace-watcher";

import type {
  WorkspaceWatcherStatus,
} from "./workspace-watcher";

import {
  scheduleWorkspaceBackgroundIndex,
  clearWorkspaceBackgroundIndex,
  clearAllWorkspaceBackgroundIndexes,
  getWorkspaceBackgroundIndexStatus,
} from "./workspace-background-indexer";

import type {
  WorkspaceBackgroundIndexStatus,
} from "./workspace-background-indexer";

import {
  attachWorkspaceMemory,
  recordWorkspaceFileChange,
  recordWorkspaceIndexDiff,
} from "./workspace-memory";

const buildPromises =
  new Map<string, Promise<WorkspaceIndex>>();

const watcherPromises =
  new Map<string, Promise<void>>();

const dirtyWorkspaceVersions =
  new Map<string, number>();

function hasFingerprintChanges(
  diff: FingerprintDiff
): boolean {
  return (
    diff.changed.length > 0 ||
    diff.added.length > 0 ||
    diff.removed.length > 0 ||
    diff.changedDirectories.length > 0 ||
    diff.addedDirectories.length > 0 ||
    diff.removedDirectories.length > 0
  );
}

async function refreshWorkspaceIndex(
  workspace: string,
  index: WorkspaceIndex,
  previousFingerprint: WorkspaceFingerprint
): Promise<WorkspaceIndex> {
  const fingerprint =
    await createWorkspaceFingerprintFromFilesystem(
      workspace
    );

  const diff =
    compareFingerprints(
      previousFingerprint,
      fingerprint
    );

  if (
    !hasFingerprintChanges(
      diff
    )
  ) {
    setWorkspaceCache(
      workspace,
      index,
      fingerprint
    );

    return index;
  }

  const updated =
    await applyIncrementalIndexUpdate(
      index,
      diff,
      workspace
    );

  await recordWorkspaceIndexDiff(
    workspace,
    diff
  );

  setWorkspaceCache(
    workspace,
    updated,
    fingerprint
  );

  await saveWorkspaceState(
    workspace,
    createWorkspaceState(
      updated,
      fingerprint
    )
  );

  return updated;
}

async function buildFreshWorkspaceIndex(
  workspace: string
): Promise<WorkspaceIndex> {
  const index =
    await createWorkspaceIndex(
      workspace
    );

  const fingerprint =
    createWorkspaceFingerprint(
      index
    );

  setWorkspaceCache(
    workspace,
    index,
    fingerprint
  );

  await saveWorkspaceState(
    workspace,
    createWorkspaceState(
      index,
      fingerprint
    )
  );

  return attachWorkspaceMemory(
    workspace,
    index
  );
}

async function refreshCurrentWorkspaceIndex(
  workspace: string
): Promise<WorkspaceIndex> {
  const cacheEntry =
    getWorkspaceCacheEntry(
      workspace
    );

  if (cacheEntry) {
    return attachWorkspaceMemory(
      workspace,
      await refreshWorkspaceIndex(
        workspace,
        cacheEntry.index,
        cacheEntry.fingerprint
      )
    );
  }

  const stored =
    await loadWorkspaceState(
      workspace
    );

  if (stored) {
    setWorkspaceCache(
      workspace,
      stored.index,
      stored.fingerprint
    );

    return attachWorkspaceMemory(
      workspace,
      await refreshWorkspaceIndex(
        workspace,
        stored.index,
        stored.fingerprint
      )
    );
  }

  return buildFreshWorkspaceIndex(
    workspace
  );
}

function markWorkspaceVersionDirty(
  workspace: string
): number {
  const version =
    (
      dirtyWorkspaceVersions.get(
        workspace
      ) ?? 0
    ) + 1;

  dirtyWorkspaceVersions.set(
    workspace,
    version
  );

  return version;
}

function scheduleWorkspaceRefresh(
  workspace: string
): WorkspaceBackgroundIndexStatus {
  const version =
    dirtyWorkspaceVersions.get(
      workspace
    ) ??
    markWorkspaceVersionDirty(
      workspace
    );

  return scheduleWorkspaceBackgroundIndex(
    workspace,
    async () => {
      await refreshCurrentWorkspaceIndex(
        workspace
      );

      if (
        dirtyWorkspaceVersions.get(
          workspace
        ) === version
      ) {
        dirtyWorkspaceVersions.delete(
          workspace
        );

        return;
      }

      setTimeout(
        () => {
          scheduleWorkspaceRefresh(
            workspace
          );
        },
        0
      );
    }
  );
}

async function ensureWorkspaceWatcher(
  workspace: string
): Promise<void> {
  if (
    hasWorkspaceWatcher(
      workspace
    )
  ) {
    return;
  }

  const existing =
    watcherPromises.get(
      workspace
    );

  if (existing) {
    return existing;
  }

  const watcherPromise =
    startWorkspaceWatcher(
      workspace,
      event => {
        recordWorkspaceFileChange(
          event.workspace,
          event.path
        ).catch(
          error => {
            console.warn(
              `Unable to record workspace memory for "${event.path}": ${
                error instanceof Error
                  ? error.message
                  : String(error)
              }`
            );
          }
        );

        markWorkspaceDirty(
          event.workspace
        );
      }
    )
      .then(
        () => undefined
      )
      .catch(
        error => {
          watcherPromises.delete(
            workspace
          );

          console.warn(
            `Unable to start workspace watcher for "${workspace}": ${
              error instanceof Error
                ? error.message
                : String(error)
            }`
          );
        }
      );

  watcherPromises.set(
    workspace,
    watcherPromise
  );

  return watcherPromise;
}

export async function getWorkspaceIndex(
  workspace: string
): Promise<WorkspaceIndex> {
  await ensureWorkspaceWatcher(
    workspace
  );

  const cached =
    getWorkspaceCache(
      workspace
    );

  const cacheEntry =
    getWorkspaceCacheEntry(
      workspace
    );

  if (
    cached &&
    cacheEntry
  ) {
    if (
      dirtyWorkspaceVersions.has(
        workspace
      )
    ) {
      scheduleWorkspaceRefresh(
        workspace
      );
    }

    return attachWorkspaceMemory(
      workspace,
      cached
    );
  }

  const stored =
    await loadWorkspaceState(
      workspace
    );

  if (stored) {
    setWorkspaceCache(
      workspace,
      stored.index,
      stored.fingerprint
    );

    markWorkspaceVersionDirty(
      workspace
    );

    scheduleWorkspaceRefresh(
      workspace
    );

    return attachWorkspaceMemory(
      workspace,
      stored.index
    );
  }

  const existingBuild =
    buildPromises.get(
      workspace
    );

  if (existingBuild) {
    return existingBuild;
  }

  const buildPromise =
    (async () => {
      try {
        return buildFreshWorkspaceIndex(
          workspace
        );
      } finally {
        buildPromises.delete(
          workspace
        );
      }
    })();

  buildPromises.set(
    workspace,
    buildPromise
  );

  return buildPromise;
}

export function markWorkspaceDirty(
  workspace?: string
): void {
  if (!workspace) {
    invalidateWorkspaceCache();

    clearAllWorkspaceBackgroundIndexes();

    dirtyWorkspaceVersions.clear();

    return;
  }

  markWorkspaceVersionDirty(
    workspace
  );

  scheduleWorkspaceRefresh(
    workspace
  );
}

export function resetWorkspaceIndex(): void {
  clearWorkspaceCache();

  clearAllWorkspaceBackgroundIndexes();

  dirtyWorkspaceVersions.clear();
}

export function hasWorkspaceIndex(
  workspace: string
): boolean {
  return hasWorkspaceCache(
    workspace
  );
}

export async function rebuildWorkspaceIndex(
  workspace: string
): Promise<WorkspaceIndex> {
  invalidateWorkspaceCache(
    workspace
  );

  clearWorkspaceBackgroundIndex(
    workspace
  );

  dirtyWorkspaceVersions.delete(
    workspace
  );

  return buildFreshWorkspaceIndex(
    workspace
  );
}

export async function startWorkspaceIndexWatcher(
  workspace: string
): Promise<void> {
  await ensureWorkspaceWatcher(
    workspace
  );
}

export function stopWorkspaceIndexWatcher(
  workspace: string
): void {
  watcherPromises.delete(
    workspace
  );

  stopWorkspaceWatcher(
    workspace
  );
}

export function stopAllWorkspaceIndexWatchers(): void {
  watcherPromises.clear();

  stopAllWorkspaceWatchers();
}

export function hasWorkspaceIndexWatcher(
  workspace: string
): boolean {
  return hasWorkspaceWatcher(
    workspace
  );
}

export function getWorkspaceIndexWatcherStatus(
  workspace: string
): WorkspaceWatcherStatus | null {
  return getWorkspaceWatcherStatus(
    workspace
  );
}

export function getWorkspaceIndexBackgroundStatus(
  workspace: string
): WorkspaceBackgroundIndexStatus | null {
  return getWorkspaceBackgroundIndexStatus(
    workspace
  );
}
