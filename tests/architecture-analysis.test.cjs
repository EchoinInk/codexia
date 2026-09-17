const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");
const { load, root } = require("./load-typescript.cjs");
const { analyseArchitecture } = load(path.join(root, "lib/intelligence/architecture-analysis.ts"));
const { createIntelligenceContext } = load(path.join(root, "lib/intelligence/intelligence-context.ts"));
const { formatArchitectureReport } = load(path.join(root, "lib/agent/architecture-report.ts"));
function index(files) { return { directories: [], files: Object.entries(files).map(([path, sourceText]) => ({
  path, sourceText, preview: sourceText, size: sourceText.length, extension: "ts", language: "typescript",
})) }; }
test("unused local/export candidates respect references and explicit public files", () => {
  const workspace = index({
    "main.ts": 'import { used } from "./library"; used();',
    "library.ts": 'export function used() { const unused = 1; return 2; }\nexport const orphan = 3;',
    "public.ts": 'export const api = 1;',
  });
  const report = analyseArchitecture(workspace, { entryPoints: ["main.ts"], publicFiles: ["public.ts"] });
  assert.ok(report.findings.some(f => f.kind === "unused_symbol" && f.message.includes("unused")));
  assert.ok(report.findings.some(f => f.kind === "unused_export" && f.message.includes("orphan")));
  assert.ok(!report.findings.some(f => f.kind === "unused_export" && f.message.includes("Export used")));
  assert.ok(!report.findings.some(f => f.file === "public.ts"));
});
test("module graph follows aliases, barrels, static dynamic imports, and reports cycles", () => {
  const workspace = index({
    "tsconfig.json": JSON.stringify({ compilerOptions: { paths: { "@/*": ["./*"] } } }),
    "main.ts": 'import { value } from "@/barrel"; import("./lazy"); value;',
    "barrel.ts": 'export { value } from "./library";',
    "library.ts": 'import "./barrel"; export const value = 1;',
    "lazy.ts": 'export const lazy = 1;',
    "orphan.ts": 'export const orphan = 1;',
  });
  const report = analyseArchitecture(workspace, { entryPoints: ["main.ts"] });
  assert.deepEqual(report.findings.filter(f => f.kind === "unreachable_module").map(f => f.file), ["orphan.ts"]);
  assert.equal(report.findings.filter(f => f.kind === "dependency_cycle").length, 1);
  assert.deepEqual(report.graph.nodes.find(n => n.file === "main.ts").resolvedImports.sort(), ["barrel.ts", "lazy.ts"]);
  assert.deepEqual(report, analyseArchitecture(workspace, { entryPoints: ["main.ts"] }));
});
test("explicit layer rules find violations; unresolved packages remain external", () => {
  const workspace = index({
    "ui/page.ts": 'import "../core/service"; import "../missing"; import "external-package";',
    "core/service.ts": 'import "../ui/page";',
  });
  const report = analyseArchitecture(workspace, { layers: [
    { name: "ui", prefixes: ["ui"], allowedDependencies: ["core"] },
    { name: "core", prefixes: ["core"], allowedDependencies: [] },
  ] });
  assert.equal(report.findings.filter(f => f.kind === "layer_violation").length, 1);
  assert.equal(report.findings.find(f => f.kind === "layer_violation").file, "core/service.ts");
  assert.equal(report.findings.filter(f => f.kind === "unresolved_import").length, 1);
  assert.ok(!report.findings.some(f => f.kind === "unreachable_module"));
  assert.match(formatArchitectureReport(report), /layer_violation/);
});
test("dynamic loading is explicit uncertainty and invalid roots/rules are rejected", () => {
  const workspace = index({ "main.ts": "const moduleName = 'plugin'; import(moduleName);", "plugin.ts": "export const value = 1;" });
  const report = analyseArchitecture(workspace, { entryPoints: ["main.ts"] });
  assert.ok(report.limitations.some(limit => limit.includes("Dynamic module")));
  assert.throws(() => analyseArchitecture(workspace, { entryPoints: ["missing.ts"] }));
  assert.throws(() => analyseArchitecture(workspace, { layers: [
    { name: "a", prefixes: ["main.ts"], allowedDependencies: ["unknown"] },
  ] }));
});
test("existing intelligence impact analysis uses resolved transitive dependencies", () => {
  const context = createIntelligenceContext(index({
    "main.ts": 'import "./middle";', "middle.ts": 'import "./leaf";', "leaf.ts": "export const value = 1;",
    "leaf-extra.ts": "export const unrelated = 1;",
  }));
  assert.deepEqual(context.analyseImpact(["leaf.ts"]).affectedFiles.sort(), ["leaf.ts", "main.ts", "middle.ts"]);
});
