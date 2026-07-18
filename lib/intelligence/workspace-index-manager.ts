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
  compareFingerprints,
} from "./index-fingerprint";

import {
  loadWorkspaceState,
  saveWorkspaceState,
  createWorkspaceState,
} from "./workspace-storage";


let buildPromise:
  Promise<WorkspaceIndex> | null = null;



export async function getWorkspaceIndex(
  workspace: string
): Promise<WorkspaceIndex> {


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

    const fresh =
      await createWorkspaceIndex();


    const fingerprint =
      createWorkspaceFingerprint(
        fresh
      );


    const diff =
      compareFingerprints(
        cacheEntry.fingerprint,
        fingerprint
      );


    const changed =
      diff.changed.length > 0 ||
      diff.added.length > 0 ||
      diff.removed.length > 0 ||
      diff.changedDirectories.length > 0 ||
      diff.addedDirectories.length > 0 ||
      diff.removedDirectories.length > 0;


    if (!changed) {

      return cached;

    }


    const updated =
      await applyIncrementalIndexUpdate(
        cached,
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

    return stored.index;

  }



  if (buildPromise) {

    return buildPromise;

  }



  buildPromise =
    (async () => {

      try {

        const index =
          await createWorkspaceIndex();


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

        buildPromise = null;

      }

    })();



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