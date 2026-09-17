const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs/promises");
const os = require("node:os");
const { test } = require("node:test");
const { load, root } = require("./load-typescript.cjs");
const { planRename, availableRefactorings, planRefactoring } = load(path.join(root, "lib/intelligence/refactoring.ts"));
const { createWorkspaceIndex } = load(path.join(root, "lib/intelligence/workspace-index.ts"));
const { applyReviewedChange, recoverChange } = load(path.join(root, "lib/agent/change-workflow.ts"));
function index(sources) { return { directories: [], files: Object.entries(sources).map(([path, sourceText]) => ({
  path, sourceText, preview: sourceText, extension: "ts", language: "typescript", size: sourceText.length,
})) }; }
const ok = async () => [{ success: true, command: "fixture verifier", output: "passed" }];
const fail = async () => [{ success: false, command: "fixture verifier", output: "failed" }];

test("rename updates imported references while preserving shadowed variables and shorthand keys", () => {
  const workspace = index({ "a.ts": "export const value = 1;\nexport const item = { value };",
    "b.ts": 'import { value } from "./a";\nvalue;\nfunction local() { const value = 2; return value; }' });
  const result = planRename(workspace, "a.ts", { line: 1, column: 14 }, "amount");
  assert.deepEqual(result.conflicts, []);
  assert.equal(result.proposal.diff.changes.length, 2);
  const a = result.proposal.diff.changes.find(change => change.path === "a.ts").after;
  const b = result.proposal.diff.changes.find(change => change.path === "b.ts").after;
  assert.match(a, /value: amount/);
  assert.match(b, /const value = 2; return value/);
  assert.match(b, /amount/);
});
test("rename rejects keywords, collisions, and missing targets", () => {
  const workspace = index({ "a.ts": "const value = 1; const amount = 2; value;" });
  assert.ok(planRename(workspace, "a.ts", { line: 1, column: 7 }, "amount").conflicts.length);
  assert.ok(planRename(workspace, "a.ts", { line: 1, column: 7 }, "class").conflicts.length);
  assert.ok(planRename(workspace, "missing.ts", { line: 1, column: 1 }, "fresh").conflicts.length);
});
test("compiler refactoring offers and plans applicable actions", () => {
  const workspace = index({ "a.ts": "export function sum(a: number, b: number) { return a + b; }" });
  const range = { start: { line: 1, column: 1 }, end: { line: 1, column: 58 } };
  const actions = availableRefactorings(workspace, "a.ts", range);
  assert.ok(actions.length);
  const proposals = actions.map(action => planRefactoring(workspace, "a.ts", range, action.refactor, action.action));
  assert.ok(proposals.some(result => result.proposal));
  assert.ok(planRefactoring(workspace, "a.ts", range, "invalid", "invalid").conflicts.length);
});
async function fixture(fn) {
  const workspace = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "codexia-change-")));
  try {
    await fs.writeFile(path.join(workspace, "a.ts"), "export const value = 1;");
    const current = await createWorkspaceIndex(workspace);
    const proposal = planRename(current, "a.ts", { line: 1, column: 14 }, "amount").proposal;
    assert.ok(proposal);
    await fn(workspace, proposal);
  } finally { await fs.rm(workspace, { recursive: true, force: true }); }
}
test("reviewed application verifies and persists a journal", () => fixture(async (workspace, proposal) => {
  const result = await applyReviewedChange(workspace, proposal, proposal.id, ok);
  assert.equal(result.status, "verified");
  assert.match(await fs.readFile(path.join(workspace, "a.ts"), "utf8"), /amount/);
  assert.equal(JSON.parse(await fs.readFile(result.journal, "utf8")).state, "verified");
}));
test("verification failures and verifier exceptions rollback source", () => fixture(async (workspace, proposal) => {
  for (const verify of [fail, async () => { throw Error("Verifier crashed"); }]) {
    const result = await applyReviewedChange(workspace, proposal, proposal.id, verify);
    assert.equal(result.status, "rolled_back");
    assert.equal(await fs.readFile(path.join(workspace, "a.ts"), "utf8"), proposal.diff.changes[0].before);
  }
}));
test("stale and unreviewed proposals never write", () => fixture(async (workspace, proposal) => {
  assert.equal((await applyReviewedChange(workspace, proposal, "wrong", ok)).status, "rejected");
  await fs.appendFile(path.join(workspace, "a.ts"), "\n// external edit");
  assert.equal((await applyReviewedChange(workspace, proposal, proposal.id, ok)).status, "rejected");
  assert.match(await fs.readFile(path.join(workspace, "a.ts"), "utf8"), /external edit/);
}));
test("rollback does not overwrite concurrent external edits", () => fixture(async (workspace, proposal) => {
  const result = await applyReviewedChange(workspace, proposal, proposal.id, async () => {
    await fs.writeFile(path.join(workspace, "a.ts"), "// user changed this file");
    return fail();
  });
  assert.equal(result.status, "rollback_conflict");
  assert.equal(await fs.readFile(path.join(workspace, "a.ts"), "utf8"), "// user changed this file");
}));
test("recovery restores an interrupted applied journal", () => fixture(async (workspace, proposal) => {
  const folder = path.join(workspace, ".codexia/changes");
  await fs.mkdir(folder, { recursive: true });
  await fs.writeFile(path.join(workspace, "a.ts"), proposal.diff.changes[0].after);
  await fs.writeFile(path.join(folder, "abcdef.json"), JSON.stringify({ version: 1, proposal, applied: [], state: "prepared" }));
  const result = await recoverChange(workspace, "abcdef.json");
  assert.equal(result.status, "rolled_back");
  assert.equal(await fs.readFile(path.join(workspace, "a.ts"), "utf8"), proposal.diff.changes[0].before);
}));

test("successful verification cannot accept concurrent changed output", () => fixture(async (workspace, proposal) => {
  const result = await applyReviewedChange(workspace, proposal, proposal.id, async () => {
    await fs.writeFile(path.join(workspace, "a.ts"), "// changed during verification");
    return ok();
  });
  assert.equal(result.status, "rollback_conflict");
}));
test("application rejects concurrent workflow and preserves symlink targets", () => fixture(async (workspace, proposal) => {
  const { guardedReplace } = load(path.join(root, "lib/agent/guarded-files.ts"));
  await fs.symlink(path.join(workspace, "a.ts"), path.join(workspace, "link.ts"));
  await assert.rejects(() => guardedReplace(workspace, "link.ts", proposal.diff.changes[0].before, "changed"));
  await fs.unlink(path.join(workspace, "link.ts"));
  const result = await applyReviewedChange(workspace, proposal, proposal.id, async () => {
    const concurrent = await applyReviewedChange(workspace, proposal, proposal.id, ok);
    assert.equal(concurrent.status, "rejected");
    assert.match(concurrent.errors[0], /in progress/);
    return ok();
  });
  assert.equal(result.status, "verified");
}));
test("multi-file rename rolls back every file after verification fails", () => fixture(async (workspace) => {
  await fs.writeFile(path.join(workspace, "b.ts"), 'import { value } from "./a"; value;');
  const current = await createWorkspaceIndex(workspace);
  const proposal = planRename(current, "a.ts", { line: 1, column: 14 }, "amount").proposal;
  assert.equal(proposal.diff.changes.length, 2);
  const result = await applyReviewedChange(workspace, proposal, proposal.id, fail);
  assert.equal(result.status, "rolled_back");
  for (const change of proposal.diff.changes) {
    assert.equal(await fs.readFile(path.join(workspace, change.path), "utf8"), change.before);
  }
}));
