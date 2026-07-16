import { analyseFile } from "./file-analyzer";

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
        await analyseFile(
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
      await analyseFile(
        file
      );

    files.push(
      analysed
    );

  }


  return {
    ...previous,

    files,

  };
}