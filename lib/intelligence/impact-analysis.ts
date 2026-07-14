import type {
  IntelligenceContext,
} from "./intelligence-context";


export interface ImpactAnalysis {

  targetFiles: string[];

  affectedFiles: string[];

  reasons: Record<string, string[]>;

}


export function analyseImpact(
  context: IntelligenceContext,
  files: string[]
): ImpactAnalysis {

  const affected =
    new Set<string>();

  const reasons:
    Record<string, string[]> = {};


  for (const file of files) {

    affected.add(
      file
    );


    reasons[file] = [
      "Direct modification target",
    ];


    const dependents =
      findDependents(
        context,
        file
      );


    for (const dependent of dependents) {

      affected.add(
        dependent
      );


      if (!reasons[dependent]) {

        reasons[dependent] = [];

      }


      reasons[dependent].push(
        `Depends on ${file}`
      );

    }

  }


  return {

    targetFiles: files,

    affectedFiles:
      [...affected],

    reasons,

  };

}



function findDependents(
  context: IntelligenceContext,
  file: string
): string[] {

  return Object.entries(
    context.dependencies
  )
    .filter(
      ([, dependencies]) =>
        dependencies.some(
          dependency =>
            file.includes(
              dependency
            )
        )
    )
    .map(
      ([path]) =>
        path
    );

}