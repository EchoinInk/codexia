import type { IndexedFile } from "./types";


export interface FileRelationship {
  from: string;

  to: string;

  type: "import";
}


export interface RelationshipGraph {
  relationships: FileRelationship[];
}


export function createRelationshipGraph(
  files: IndexedFile[]
): RelationshipGraph {

  const relationships: FileRelationship[] = [];


  for (const file of files) {

    const imports =
      file.code?.imports ?? [];


    for (const imported of imports) {

      relationships.push({

        from: file.path,

        to: imported,

        type: "import",

      });

    }

  }


  return {
    relationships,
  };

}