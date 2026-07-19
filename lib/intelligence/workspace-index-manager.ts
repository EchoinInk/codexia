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

const buildPromises =
  new Map<string, Promise<WorkspaceIndex>>();

const watcherPromises =
  new Map<string, Promise<void>>();

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
        invalidateWorkspaceCache(
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
    return refreshWorkspaceIndex(
      workspace,
      cached,
      cacheEntry.fingerprint
    );
  }

  const stored =
    await loadWorkspaceState(
      workspace
    );

  if (stored) {
    return refreshWorkspaceIndex(
      workspace,
      stored.index,
      stored.fingerprint
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

        return index;
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
  invalidateWorkspaceCache(
    workspace
  );
}

export function resetWorkspaceIndex(): void {
  clearWorkspaceCache();
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

  return getWorkspaceIndex(
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
