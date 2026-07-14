import type {
  IntelligenceContext,
} from "./intelligence-context";


export interface FileSelection {
  files: string[];

  reason: string;
}


export function selectRelevantFiles(
  context: IntelligenceContext,
  query: string
): FileSelection {

  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);


  const matches = context.files.filter(
    file => {

      const normalized =
        file.toLowerCase();


      return terms.some(
        term => normalized.includes(term)
      );

    }
  );


  const related = context.relatedFiles.filter(
    file =>
      matches.some(
        match =>
          context.dependencies[match]
            ?.some(dep =>
              file.includes(dep)
            )
      )
  );


  const files = [
    ...new Set([
      ...matches,
      ...related,
    ]),
  ];


  return {
    files,

    reason:
      files.length > 0
        ? "Matched files using workspace intelligence"
        : "No matching files found",
  };
}