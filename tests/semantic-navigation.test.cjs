const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const { load, root } = require("./load-typescript.cjs");
const { parseCode } = load(path.join(root, "lib/intelligence/code-parser.ts"));
const { createSemanticNavigation } = load(path.join(root, "lib/intelligence/semantic-navigation.ts"));
const { createWorkspaceIndex } = load(path.join(root, "lib/intelligence/workspace-index.ts"));
const { applyIncrementalIndexUpdate } = load(path.join(root, "lib/intelligence/incremental-index.ts"));
const storage = load(path.join(root, "lib/intelligence/workspace-storage.ts"));

function indexed(file, sourceText) {
  return { path: file, sourceText, size: sourceText.length, extension: "ts", language: "typescript",
    preview: sourceText.slice(0, 500), code: parseCode(sourceText, "typescript", file) };
}
function position(text, term, last = false) {
  const offset = last ? text.lastIndexOf(term) : text.indexOf(term);
  const lines = text.slice(0, offset).split("\n");
  return { line: lines.length, column: lines.at(-1).length + 1 };
}

test("search includes every binding and precise nested declaration locations", () => {
  const text = "export const first = 1, second = 2;\nconst { value: renamed } = { value: 1 };\nclass Box { run() {} }";
  const navigation = createSemanticNavigation({ files: [indexed("a.ts", text)], directories: [] });
  assert.equal(navigation.searchSymbols("second", { mode: "exact" }).length, 1);
  assert.equal(navigation.searchSymbols("scnd")[0].name, "second");
  assert.equal(navigation.searchSymbols("SECOND", { mode: "exact", caseSensitive: true }).length, 0);
  assert.equal(navigation.searchSymbols("ren", { mode: "prefix" })[0].name, "renamed");
  assert.equal(navigation.searchSymbols("", { limit: 0 }).length, 0);
  assert.equal(navigation.searchSymbols("first", { file: "other.ts" }).length, 0);
  const method = navigation.documentSymbols("a.ts").find(symbol => symbol.name === "run");
  assert.equal(method.container, "Box");
  assert.deepEqual(method.range.start, position(text, "run"));
  assert.equal(navigation.searchSymbols("second", { exportedOnly: true }).length, 1);
});

test("cross-file aliases resolve definitions and references without conflating shadowed names", () => {
  const a = "export function work() { return 1; }";
  const b = 'import { work as run } from "./a";\nrun();\nfunction local() { const run = 2; return run; }';
  const navigation = createSemanticNavigation({ files: [indexed("a.ts", a), indexed("b.ts", b)], directories: [] });
  const definition = navigation.definitions("b.ts", position(b, "run();"));
  assert.equal(definition.length, 1);
  assert.equal(definition[0].file, "a.ts");
  assert.deepEqual(definition[0].range.start, position(a, "work"));
  const references = navigation.references("b.ts", position(b, "run();"));
  assert.ok(references.some(location => location.file === "b.ts" && location.range.start.line === 2));
  assert.ok(!references.some(location => location.file === "b.ts" && location.range.start.line === 3));
  assert.deepEqual(navigation.definitions("b.ts", { line: 100, column: 1 }), []);
  assert.deepEqual(navigation.definitions("../b.ts", { line: 1, column: 1 }), []);
});

test("implementation lookup and tsconfig path aliases use indexed sources", () => {
  const a = "export interface Shape { area(): number; }\nexport class Square implements Shape { area() { return 1; } }";
  const b = 'import { Square } from "@/shape";\nnew Square();';
  const config = indexed("tsconfig.json", JSON.stringify({ compilerOptions: { paths: { "@/*": ["./*"] } } }));
  const navigation = createSemanticNavigation({ files: [indexed("shape.ts", a), indexed("main.ts", b), config], directories: [] });
  assert.ok(navigation.implementations("shape.ts", position(a, "Shape")).some(location => location.range.start.line === 2));
  assert.equal(navigation.definitions("main.ts", position(b, "Square", true))[0].file, "shape.ts");
});

test("incremental updates replace changed and removed symbols, retain unchanged files, and persist sources", async () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "codexia-navigation-"));
  try {
    fs.writeFileSync(path.join(workspace, "a.ts"), "export const before = 1;");
    fs.writeFileSync(path.join(workspace, "keep.ts"), "export const keep = 1;");
    fs.writeFileSync(path.join(workspace, "remove.ts"), "export const removed = 1;");
    const previous = await createWorkspaceIndex(workspace);
    fs.writeFileSync(path.join(workspace, "a.ts"), "export const after = 2;");
    fs.writeFileSync(path.join(workspace, "new.ts"), "export const added = 1;");
    fs.unlinkSync(path.join(workspace, "remove.ts"));
    const updated = await applyIncrementalIndexUpdate(previous, {
      changed: ["a.ts"], added: ["new.ts"], removed: ["remove.ts"],
      addedDirectories: [], removedDirectories: [], changedDirectories: [],
    }, workspace);
    assert.equal(updated.files.find(file => file.path === "keep.ts"), previous.files.find(file => file.path === "keep.ts"));
    const navigation = createSemanticNavigation(updated);
    assert.equal(navigation.searchSymbols("before", { mode: "exact" }).length, 0);
    assert.equal(navigation.searchSymbols("removed", { mode: "exact" }).length, 0);
    assert.equal(navigation.searchSymbols("after", { mode: "exact" }).length, 1);
    assert.equal(navigation.searchSymbols("added", { mode: "exact" }).length, 1);
    await storage.saveWorkspaceState(workspace, storage.createWorkspaceState(updated, {}));
    assert.equal((await storage.loadWorkspaceState(workspace)).index.files.find(file => file.path === "a.ts").sourceText, "export const after = 2;");
    const persisted = path.join(workspace, ".codexia/intelligence/workspace-index.json");
    fs.writeFileSync(persisted, JSON.stringify({ index: previous, fingerprint: {} }));
    assert.equal(await storage.loadWorkspaceState(workspace), null);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});
