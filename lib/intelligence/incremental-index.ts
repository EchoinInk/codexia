import {
  createIndexedFile,
} from "./workspace-index";

import {
  createRelationshipGraph,
} from "./relationship-graph";

import type {
  IndexedFile,
  WorkspaceIndex,
} from "./types";

import type {
  FingerprintDiff,
} from "./index-fingerprint";


export async function applyIncrementalIndexUpdate(
  previous: WorkspaceIndex,
  diff: FingerprintDiff
): Promise<WorkspaceIndex> {

  const files: IndexedFile[] = [];

  const directories =
    [
      ...new Set(
        previous.directories
          .filter(
            directory =>
              !diff.removedDirectories.includes(
                directory
              )
          )
          .concat(
            diff.addedDirectories
          )
      ),
    ].sort();


  for (const file of previous.files) {

    if (
      diff.removed.includes(
        file.path
      )
    ) {
      continue;
    }


    if (
      diff.changed.includes(
        file.path
      )
    ) {
      const updated =
        await createIndexedFile(
          file.path
        );

      files.push(
        updated
      );

      continue;
    }


    files.push(file);
  }


  for (const file of diff.added) {

    const analysed =
      await createIndexedFile(
        file
      );

    files.push(
      analysed
    );

  }


  return {
    ...previous,

    files,

    directories,

    relationships:
      createRelationshipGraph(
        files
      ),

  };
}