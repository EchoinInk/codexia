import type {
  IndexedFile,
} from "./types";


export interface FileIndex {

  files: Map<string, IndexedFile>;

  hasChanged(
    file: IndexedFile
  ): boolean;

}


export function createFileIndex(
  files: IndexedFile[] = []
): FileIndex {

  const index =
    new Map<string, IndexedFile>(
      files.map(
        file => [
          file.path,
          file,
        ]
      )
    );


  return {

    files: index,


    hasChanged(
      file: IndexedFile
    ): boolean {

      const existing =
        index.get(
          file.path
        );


      if (!existing) {

        return true;

      }


      return (
        existing.hash !== file.hash
        ||
        existing.modifiedAt !== file.modifiedAt
      );

    },

  };

}