import type { CodeAnalysis } from "./types";


export function parseCode(
  content: string,
  language: string
): CodeAnalysis {

  if (
    language !== "typescript" &&
    language !== "typescript-react" &&
    language !== "javascript" &&
    language !== "javascript-react"
  ) {
    return {
      imports: [],
      exports: [],
      functions: [],
      classes: [],
      components: [],
    };
  }


  const imports = extractImports(content);

  const exports = extractExports(content);

  const functions = extractFunctions(content);

  const classes = extractClasses(content);

  const components = extractComponents(
    content,
    language
  );


  return {
    imports,

    exports,

    functions,

    classes,

    components,
  };
}


function extractImports(
  content: string
): string[] {

  const matches = [
    ...content.matchAll(
      /import\s+.*?\s+from\s+["'](.+?)["']/g
    ),
  ];


  return matches.map(
    match => match[1]
  );
}


function extractExports(
  content: string
): string[] {

  const matches = [
    ...content.matchAll(
      /export\s+(?:default\s+)?(?:function|class|const|let|var)\s+(\w+)/g
    ),
  ];


  return matches.map(
    match => match[1]
  );
}


function extractFunctions(
  content: string
): string[] {

  const matches = [
    ...content.matchAll(
      /function\s+(\w+)\s*\(/g
    ),
  ];


  return matches.map(
    match => match[1]
  );
}


function extractClasses(
  content: string
): string[] {

  const matches = [
    ...content.matchAll(
      /class\s+(\w+)/g
    ),
  ];


  return matches.map(
    match => match[1]
  );
}


function extractComponents(
  content: string,
  language: string
): string[] {

  if (language !== "typescript-react" &&
      language !== "javascript-react") {
    return [];
  }


  const matches = [
    ...content.matchAll(
      /(?:function|const)\s+([A-Z]\w*)/g
    ),
  ];


  return matches.map(
    match => match[1]
  );
}