const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");
const { load, root } = require("./load-typescript.cjs");
const { parseCode } = load(path.join(root, "lib/intelligence/code-parser.ts"));
const { diagnoseWorkspace, diagnosticCodeActions } = load(path.join(root, "lib/intelligence/diagnostics.ts"));
const { explainDiagnostic } = load(path.join(root, "lib/intelligence/diagnostic-advice.ts"));
const { createChangeProposal } = load(path.join(root, "lib/intelligence/change-proposal.ts"));
const { validateChangeProposal } = load(path.join(root, "lib/agent/change-validator.ts"));
function workspace(text) {
  return { directories: [], files: [{ path: "a.ts", sourceText: text, preview: text, size: text.length,
    extension: "ts", language: "typescript", code: parseCode(text, "typescript", "a.ts") }] };
}
test("diagnostics are structured, deterministic, and isolate provider failure", async () => {
  const index = workspace('export const count: number = "bad";');
  const first = await diagnoseWorkspace(index);
  const diagnostic = first.diagnostics.find(item => item.code === "2322");
  assert.ok(diagnostic);
  assert.equal(diagnostic.file, "a.ts");
  assert.equal(diagnostic.severity, "error");
  assert.equal(diagnostic.range.start.line, 1);
  assert.deepEqual(first, await diagnoseWorkspace(index));
  const failed = await diagnoseWorkspace(index, [{ id: "broken", diagnose: async () => { throw Error("offline"); } }]);
  assert.deepEqual(failed.providerErrors, [{ provider: "broken", message: "offline" }]);
});
test("safe proposals reject stale, overlapping-file, path escape, and new compiler errors", () => {
  const index = workspace("export const count: number = 1;");
  const propose = (after, file = "a.ts") => createChangeProposal(index, "Fix", "quickfix", "test", {
    changes: [{ path: file, before: index.files[0].sourceText, after }],
  });
  assert.equal(validateChangeProposal(index, propose("export const count: number = 2;")).valid, true);
  assert.equal(validateChangeProposal(index, propose('export const count: number = "wrong";')).valid, false);
  assert.equal(validateChangeProposal(index, propose("export const count = 2;", "../a.ts")).valid, false);
  const stale = propose("export const count = 2;");
  index.files[0].sourceText += "\n";
  assert.equal(validateChangeProposal(index, stale).valid, false);
  assert.equal(validateChangeProposal(index, {}).valid, false);
  assert.equal(validateChangeProposal(index, { ...stale, diff: { changes: [null] } }).valid, false);
});
test("model advice is injectable and proposed edits are validated", async () => {
  const index = workspace('export const count: number = "bad";');
  const diagnostic = (await diagnoseWorkspace(index)).diagnostics.find(item => item.code === "2322");
  const result = await explainDiagnostic(index, diagnostic, { advise: async request => {
    assert.equal(request.file, "a.ts");
    return { explanation: "A number is required.", suggestions: ["Use a numeric value."], replacement: "export const count: number = 1;" };
  } });
  assert.equal(result.actions.length, 1);
  const invalid = await explainDiagnostic(index, diagnostic, { advise: async () => ({
    explanation: "Bad suggestion", suggestions: [], replacement: "export const = ;",
  }) });
  assert.equal(invalid.actions.length, 0);
  assert.ok(invalid.rejected.length);
  await assert.rejects(() => explainDiagnostic(index, diagnostic, { advise: async () => "not JSON" }));
});
test("compiler fixes produce validated source diffs", async () => {
  const index = workspace('interface Item { value: number }\nexport class Box implements Item {}');
  const report = await diagnoseWorkspace(index);
  const issue = report.diagnostics.find(item => item.code === "2420");
  assert.ok(issue);
  const actions = diagnosticCodeActions(index, issue);
  assert.ok(actions.length);
  assert.ok(actions.every(action => validateChangeProposal(index, action).valid));
  assert.ok(actions.some(action => action.diff.changes[0].after.includes("value")));
});
