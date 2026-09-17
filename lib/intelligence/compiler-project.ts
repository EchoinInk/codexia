import path from "node:path";
import ts from "typescript";
import type { WorkspaceIndex } from "./types";
import type { SourcePosition, SourceRange } from "./symbols";

export function normalizeFile(file: string): string {
  return path.posix.normalize(file.replace(/\\/g, "/"));
}

export function isWorkspacePath(file: string): boolean {
  return !!file && file !== "." && !file.includes("\0") &&
    !path.posix.isAbsolute(file) && !/^[a-z]:/i.test(file) &&
    file === normalizeFile(file) && !file.startsWith("../");
}

export function sourceRange(source: ts.SourceFile, start: number, length: number): SourceRange {
  const from = source.getLineAndCharacterOfPosition(start);
  const to = source.getLineAndCharacterOfPosition(start + length);
  return {
    start: { line: from.line + 1, column: from.character + 1 },
    end: { line: to.line + 1, column: to.character + 1 },
  };
}

/** A disposable compiler view, exclusively over an existing index snapshot. */
export function createCompilerProject(workspace: WorkspaceIndex, overrides: ts.CompilerOptions = {}) {
  const root = "/__codexia_workspace__";
  const sources = new Map<string, { file: string; text: string }>();
  for (const file of workspace.files) {
    const relative = normalizeFile(file.path);
    if (isWorkspacePath(relative) && file.sourceText !== undefined) {
      sources.set(`${root}/${relative}`, { file: relative, text: file.sourceText });
    }
  }
  const readFile = (name: string): string | undefined => sources.get(normalizeFile(name))?.text;
  const fileExists = (name: string): boolean => readFile(name) !== undefined;
  const directoryExists = (name: string): boolean =>
    [...sources.keys()].some(file => file.startsWith(`${normalizeFile(name)}/`));
  const defaults: ts.CompilerOptions = {
    allowJs: true, checkJs: true, jsx: ts.JsxEmit.Preserve,
    target: ts.ScriptTarget.Latest, module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler, noLib: true, noEmit: true,
  };
  let options = defaults;
  const configurationErrors: ts.Diagnostic[] = [];
  const configName = [`${root}/tsconfig.json`, `${root}/jsconfig.json`].find(fileExists);
  if (configName) {
    const config = ts.readConfigFile(configName, readFile);
    if (config.error) configurationErrors.push(config.error);
    else {
      const parsed = ts.parseJsonConfigFileContent(config.config, {
        useCaseSensitiveFileNames: true, readDirectory: () => [...sources.keys()], fileExists, readFile,
      }, root, undefined, configName);
      options = { ...defaults, ...parsed.options };
      configurationErrors.push(...parsed.errors);
    }
  }
  options = { ...options, ...overrides, noLib: true, noEmit: true };
  const host: ts.LanguageServiceHost = {
    getCompilationSettings: () => options,
    getScriptFileNames: () => [...sources.keys()].filter(name => /\.[jt]sx?$/i.test(name)),
    getScriptVersion: () => "1",
    getScriptSnapshot: name => {
      const text = readFile(name);
      return text === undefined ? undefined : ts.ScriptSnapshot.fromString(text);
    },
    getCurrentDirectory: () => root,
    getDefaultLibFileName: () => `${root}/lib.d.ts`,
    fileExists, readFile, directoryExists, useCaseSensitiveFileNames: () => true,
  };
  const service = ts.createLanguageService(host);
  function fileName(file: string): string {
    return `${root}/${normalizeFile(file)}`;
  }
  function position(file: string, point: SourcePosition): number | undefined {
    const source = sources.get(fileName(file));
    if (!source || !Number.isInteger(point.line) || !Number.isInteger(point.column) ||
      point.line < 1 || point.column < 1) return undefined;
    const ast = service.getProgram()?.getSourceFile(fileName(file));
    if (!ast) return undefined;
    const starts = ast.getLineStarts();
    const start = starts[point.line - 1];
    if (start === undefined) return undefined;
    const end = start + source.text.slice(start, starts[point.line] ?? source.text.length).replace(/[\r\n]+$/, "").length;
    const offset = start + point.column - 1;
    return offset <= end ? offset : undefined;
  }
  return {
    root, sources, service, options, configurationErrors, fileName, position,
    resolveModule(from: string, specifier: string): string | undefined {
      const resolved = ts.resolveModuleName(specifier, fileName(from), options, host).resolvedModule;
      return resolved ? sources.get(resolved.resolvedFileName)?.file : undefined;
    },
    dispose: () => service.dispose(),
  };
}

export type CompilerProject = ReturnType<typeof createCompilerProject>;
