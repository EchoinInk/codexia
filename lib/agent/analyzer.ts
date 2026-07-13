import {
  listTree,
  FsNode
} from "@/lib/fs-safe";


export interface RepositoryAnalysis {

  files: FsNode[];

  summary: string;

}



export async function analyzeRepository(
  workspace: string
): Promise<RepositoryAnalysis> {


  const files =
    await listTree(
      workspace
    );


  const summary =
    createSummary(
      files
    );


  return {

    files,

    summary

  };

}



function createSummary(
  files: FsNode[]
): string {


  const paths =
    files.map(
      file =>
        file.path
    );


  const hasPackageJson =
    paths.some(
      file =>
        file.endsWith("package.json")
    );


  const hasNextConfig =
    paths.some(
      file =>
        file.includes("next.config")
    );


  const hasTsConfig =
    paths.some(
      file =>
        file.endsWith("tsconfig.json")
    );


  const technologies: string[] = [];


  if(hasPackageJson){

    technologies.push(
      "Node.js project"
    );

  }


  if(hasNextConfig){

    technologies.push(
      "Next.js"
    );

  }


  if(hasTsConfig){

    technologies.push(
      "TypeScript"
    );

  }



  return technologies.length > 0

    ? `Detected: ${technologies.join(", ")}`

    : "Unable to determine project type";

}