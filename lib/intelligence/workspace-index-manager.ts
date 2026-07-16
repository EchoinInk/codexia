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


    const hasChanges =
      diff.changed.length > 0 ||
      diff.added.length > 0 ||
      diff.removed.length > 0;


    if (!hasChanges) {

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


    return updated;

  }



  if (
    buildPromise
  ) {

    return buildPromise;

  }



  buildPromise =
    (async () => {

      try {

        const index =
          await createWorkspaceIndex();


        setWorkspaceCache(
          workspace,
          index,
          createWorkspaceFingerprint(
            index
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