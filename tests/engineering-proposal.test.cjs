const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { load, root } = require("./load-typescript.cjs");
const { createEngineeringRuntime } = load(path.join(root, "lib/agent/engineering/runtime.ts"));
const { createEngineeringReport } = load(path.join(root, "lib/agent/engineering/report.ts"));
const { goalDigest, authorizeProposal } = load(path.join(root, "lib/agent/engineering/governance.ts"));
const { FileRuntimeCheckpointStore } = load(path.join(root, "lib/agent/runtime/checkpoint-store.ts"));
const { createWorkspaceIndex } = load(path.join(root, "lib/intelligence/workspace-index.ts"));
const { proposalId } = load(path.join(root, "lib/intelligence/change-proposal.ts"));
const before = "export const value = 1;";
const afterA = "export const value = 2;";
const afterB = "export const value = 3;";
const passed = async checks => checks.map(check => ({ id: check.id, success: true, provider: "fixture",
  measuredAt: Date.now(), output: "passed" }));
function goal() {
  return { title: "Correct the value", mode: "repair",
    scope: { files: ["a.ts"], maxFilesPerBatch: 1, maxRisk: "high" },
    checks: [{ id: "tests", kind: "tests" }], acceptance: [{ id: "value", description: "Correct value", checkId: "tests" }],
    compatibilityChecks: ["tests"], constraints: ["No unrelated edits"], documentationFiles: [],
    budgets: { maxIterations: 10, maxRepairAttempts: 2, timeoutMs: 30000, noProgressLimit: 2 },
    tasks: [{ id: "fix", title: "Correct value", files: ["a.ts"], dependsOn: [], operation: { kind: "repair" },
      evidenceIds: [], risk: "high", obligations: ["Preserve exports"] }] };
}
function approval(g, ids = []) {
  return { goalDigest: goalDigest(g), approvedBy: "fixture reviewer", approvedAt: Date.now(),
    expiresAt: Date.now() + 60000, mode: "proposal", proposalIds: ids };
}
async function fixture(run) {
  const workspace = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "codexia-proposal-")));
  try {
    await fs.writeFile(path.join(workspace, "a.ts"), before);
    let calls = 0;
    const reasoner = { id: "sequence-fixture", propose: async () => ({ changes: [
      { path: "a.ts", before, after: ++calls === 1 ? afterA : afterB },
    ] }) };
    const options = { reasoner, checks: passed, recordMemory: false };
    await run({ workspace, options, calls: () => calls, g: goal(), store: new FileRuntimeCheckpointStore(workspace) });
  } finally { await fs.rm(workspace, { recursive: true, force: true }); }
}
function pending(result) { return result.context.engineering.tasks[0].pendingProposal.proposal; }
async function journalProposal(result) {
  return JSON.parse(await fs.readFile(result.context.engineering.tasks[0].journal, "utf8")).proposal;
}

test("B05: sequence reasoner is called once; disk restart resumes and executes exact approved A", () => fixture(async ({ workspace, options, calls, g, store }) => {
  const engine = createEngineeringRuntime(workspace, options);
  const paused = await engine.start(g, approval(g), "sequence");
  const a = pending(paused);
  assert.equal(paused.state.status, "paused");
  assert.equal(paused.context.engineering.tasks[0].status, "awaiting_approval");
  assert.equal(a.diff.changes[0].after, afterA);
  assert.equal(calls(), 1);
  const disk = JSON.parse(await fs.readFile(path.join(workspace, ".codexia/runtime/checkpoints/sequence.json"), "utf8"));
  assert.deepEqual(disk.context.engineering.tasks[0].pendingProposal.proposal, a);
  assert.deepEqual((await store.loadLatest("sequence")).context.engineering.tasks[0].pendingProposal.proposal, a);
  // A fresh runtime and fresh file-store instance use only serialized task state.
  const resumed = await createEngineeringRuntime(workspace, options).resume("sequence", approval(g, [a.id]));
  assert.equal(resumed.state.id, paused.state.id);
  assert.equal(resumed.state.status, "completed");
  assert.equal(calls(), 1, "resume must not invoke the sequence reasoner's B branch");
  assert.equal(await fs.readFile(path.join(workspace, "a.ts"), "utf8"), afterA);
  assert.deepEqual(await journalProposal(resumed), a, "real reviewed workflow journal contains exact A");
  assert.deepEqual(resumed.context.engineering.tasks[0].proposals, [a.id]);
  assert.equal(resumed.context.engineering.tasks[0].attempts, 1);
  assert.equal(resumed.context.engineering.tasks[0].pendingProposal, undefined);
  assert.equal(createEngineeringReport(resumed).pendingProposal, undefined);
}));

test("B05: wrong proposal approval cannot replace A or execute B, even with identical task/path", () => fixture(async ({ workspace, options, calls, g }) => {
  const engine = createEngineeringRuntime(workspace, options);
  const a = pending(await engine.start(g, approval(g), "wrong-approval"));
  const { id: _id, ...body } = a;
  const bBody = { ...body, diff: { changes: [{ path: "a.ts", before, after: afterB }] } };
  const b = { id: proposalId(bBody), ...bBody };
  assert.notEqual(a.id, b.id);
  assert.ok(authorizeProposal(g, approval(g, [a.id]), g.tasks[0], b, await createWorkspaceIndex(workspace))
    .some(error => error.includes(`Review proposal ${b.id}`)));
  const wrong = await engine.resume("wrong-approval", approval(g, [b.id]));
  assert.equal(wrong.state.status, "paused");
  assert.deepEqual(pending(wrong), a);
  assert.equal(calls(), 1);
  assert.equal(await fs.readFile(path.join(workspace, "a.ts"), "utf8"), before);
  const right = await engine.resume("wrong-approval", approval(g, [a.id]));
  assert.equal(right.state.status, "completed");
  assert.deepEqual(await journalProposal(right), a);
  assert.equal(calls(), 1);
}));

test("B05: stale source invalidates persisted proposal, hides review authority and never regenerates", () => fixture(async ({ workspace, options, calls, g, store }) => {
  const engine = createEngineeringRuntime(workspace, options);
  const a = pending(await engine.start(g, approval(g), "stale-proposal"));
  await fs.writeFile(path.join(workspace, "a.ts"), afterB);
  await assert.rejects(() => engine.resume("stale-proposal", approval(g, [a.id])), /Recovery\/replanning/);
  const checkpoint = await store.loadLatest("stale-proposal");
  assert.match(checkpoint.context.engineering.tasks[0].pendingProposal.invalidatedReason, /workspace changed/);
  assert.equal(createEngineeringReport({ ...checkpoint, checkpoint }).pendingProposal, undefined);
  assert.equal(calls(), 1);
  assert.equal(await fs.readFile(path.join(workspace, "a.ts"), "utf8"), afterB);
  // Restoring the bytes does not implicitly request a replacement proposal.
  await fs.writeFile(path.join(workspace, "a.ts"), before);
  const stillInvalid = await createEngineeringRuntime(workspace, options).resume("stale-proposal", approval(g, [a.id]));
  assert.equal(stillInvalid.state.status, "paused");
  assert.deepEqual(pending(stillInvalid), a);
  assert.equal(calls(), 1);
  assert.equal(await fs.readFile(path.join(workspace, "a.ts"), "utf8"), before);
}));

test("B05: persisted content/digest tampering fails revalidation without reasoning or writes", () => fixture(async ({ workspace, options, calls, g, store }) => {
  const engine = createEngineeringRuntime(workspace, options);
  const a = pending(await engine.start(g, approval(g), "tampered"));
  const checkpoint = await store.loadLatest("tampered");
  checkpoint.context.engineering.tasks[0].pendingProposal.proposal.diff.changes[0].after = afterB;
  await store.save(checkpoint);
  const result = await createEngineeringRuntime(workspace, options).resume("tampered", approval(g, [a.id]));
  assert.equal(result.state.status, "paused");
  assert.match(result.context.engineering.escalation, /identifier/);
  assert.equal(createEngineeringReport(result).pendingProposal, undefined);
  assert.equal(calls(), 1);
  assert.equal(await fs.readFile(path.join(workspace, "a.ts"), "utf8"), before);
}));

test("B05: missing legacy pending state fails closed rather than regenerating", () => fixture(async ({ workspace, options, calls, g, store }) => {
  const engine = createEngineeringRuntime(workspace, options);
  const a = pending(await engine.start(g, approval(g), "legacy"));
  const checkpoint = await store.loadLatest("legacy");
  delete checkpoint.context.engineering.tasks[0].pendingProposal;
  await store.save(checkpoint);
  await assert.rejects(() => engine.resume("legacy", approval(g, [a.id])), /Pending proposal missing/);
  await assert.rejects(() => engine.resume("legacy", approval(g, [a.id])), /Pending proposal missing/);
  assert.equal(calls(), 1);
}));

test("B05: exact proposal still follows verification, rollback and unchanged repair budget", () => fixture(async ({ workspace, options, calls, g }) => {
  g.budgets.maxRepairAttempts = 1;
  let checkCalls = 0;
  options.checks = async checks => (await passed(checks)).map(check => ({ ...check, success: ++checkCalls === 1 }));
  const engine = createEngineeringRuntime(workspace, options);
  const a = pending(await engine.start(g, approval(g), "rollback-exact"));
  const result = await engine.resume("rollback-exact", approval(g, [a.id]));
  assert.equal(result.state.status, "paused");
  assert.match(result.context.engineering.escalation, /budget/);
  assert.deepEqual(await journalProposal(result), a);
  assert.equal(result.context.engineering.tasks[0].attempts, 1);
  assert.equal(result.context.engineering.tasks[0].pendingProposal, undefined);
  assert.equal(createEngineeringReport(result).pendingProposal, undefined);
  assert.equal(await fs.readFile(path.join(workspace, "a.ts"), "utf8"), before);
  await engine.resume("rollback-exact", approval(g, [a.id]));
  assert.equal(calls(), 1);
}));

test("A01: real engineering POST adapter exposes checkpoint A and executes that same proposal on resume", () => fixture(async ({ workspace, options, calls, g, store }) => {
  const model = load(path.join(root, "lib/models/engineering-reasoner.ts"));
  const verification = load(path.join(root, "lib/agent/engineering/verification.ts"));
  const oldPropose = model.ollamaEngineeringReasoner.propose;
  const oldChecks = verification.runEngineeringChecks;
  const oldWorkspace = process.env.WORKSPACE_DIR;
  model.ollamaEngineeringReasoner.propose = options.reasoner.propose;
  verification.runEngineeringChecks = passed;
  process.env.WORKSPACE_DIR = workspace;
  try {
    const { POST } = load(path.join(root, "app/api/engineering/route.ts"));
    async function request(body) {
      const response = await POST(new Request("http://localhost:3000/api/engineering", { method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost:3000" }, body: JSON.stringify(body) }));
      const result = await response.json();
      assert.equal(response.status, 200, JSON.stringify(result));
      return result;
    }
    const preview = await request({ operation: "preview", goal: g });
    assert.equal(preview.goalDigest, goalDigest(g));
    assert.equal(calls(), 0);
    const start = await request({ operation: "start", taskId: "http-exact", goal: g, approval: approval(g) });
    assert.equal(start.outcome, "paused");
    const status = await request({ operation: "status", taskId: "http-exact" });
    const review = status.pendingProposal;
    const checkpoint = await store.loadLatest("http-exact");
    const a = checkpoint.context.engineering.tasks[0].pendingProposal.proposal;
    assert.deepEqual(review, start.pendingProposal);
    assert.deepEqual(review.proposal, a);
    assert.equal(review.digest, a.id);
    const { id, ...body } = review.proposal;
    assert.equal(id, proposalId(body));
    assert.equal(review.runtimeId, "http-exact");
    assert.equal(review.taskId, "fix");
    assert.equal(review.workspace, workspace);
    assert.deepEqual(review.affectedPaths, ["a.ts"]);
    assert.deepEqual(review.risk, { task: "high", required: "high", allowed: "high" });
    assert.deepEqual(review.checks, g.checks);
    assert.deepEqual(review.acceptance, g.acceptance);
    assert.deepEqual(review.constraints, g.constraints);
    assert.deepEqual(review.obligations, g.tasks[0].obligations);
    assert.equal(review.status, "awaiting_approval");
    assert.ok(review.proposal.warnings.length);
    assert.equal(calls(), 1);
    const resumed = await request({ operation: "resume", taskId: review.runtimeId,
      approval: { ...approval(g), ...review.approval } });
    assert.equal(resumed.outcome, "verified");
    assert.equal(resumed.pendingProposal, undefined);
    assert.equal((await request({ operation: "status", taskId: "http-exact" })).pendingProposal, undefined);
    assert.deepEqual(JSON.parse(await fs.readFile(resumed.tasks[0].journal, "utf8")).proposal, a);
    assert.equal(await fs.readFile(path.join(workspace, "a.ts"), "utf8"), afterA);
    assert.equal(calls(), 1, "preview/status/resume must not generate B");
  } finally {
    model.ollamaEngineeringReasoner.propose = oldPropose;
    verification.runEngineeringChecks = oldChecks;
    if (oldWorkspace === undefined) delete process.env.WORKSPACE_DIR;
    else process.env.WORKSPACE_DIR = oldWorkspace;
  }
}));

test("A01: report projection is detached and absent outside valid awaiting-approval state", () => fixture(async ({ workspace, options, g }) => {
  const result = await createEngineeringRuntime(workspace, options).start(g, approval(g), "projection");
  const a = structuredClone(pending(result));
  const report = createEngineeringReport(result);
  report.pendingProposal.proposal.diff.changes[0].after = afterB;
  assert.deepEqual(pending(result), a);
  for (const status of ["running", "completed", "failed", "cancelled", "created"]) {
    assert.equal(createEngineeringReport({ ...result, state: { ...result.state, status } }).pendingProposal, undefined);
  }
  result.context.engineering.tasks[0].status = "deferred";
  assert.equal(createEngineeringReport(result).pendingProposal, undefined);
}));

test("B05: reviewed workflow rejects substituted B even if renewed bounded approval could otherwise cover it", () => fixture(async ({ workspace, options, calls, g }) => {
  const result = await createEngineeringRuntime(workspace, options).start(g, approval(g), "substitution");
  const a = pending(result);
  const { id: _id, ...body } = a;
  const bBody = { ...body, diff: { changes: [{ path: "a.ts", before, after: afterB }] } };
  const b = { id: proposalId(bBody), ...bBody };
  const { runEngineeringWorkflow } = load(path.join(root, "lib/agent/engineering/workflow.ts"));
  result.context.engineering.approval = { ...approval(g), mode: "bounded" };
  const output = await runEngineeringWorkflow({ goal: g.title, files: ["a.ts"], steps: [],
    engineering: { taskId: "fix", proposal: b, evidenceIds: [], assumptions: [], constraints: [] } },
    result.context, {}, { index: () => createWorkspaceIndex(workspace), checks: passed });
  assert.equal(output.execution.success, false);
  assert.match(output.execution.output, /exact valid checkpointed proposal/);
  assert.equal(await fs.readFile(path.join(workspace, "a.ts"), "utf8"), before);
  assert.equal(calls(), 1);
}));

test("B05: expired renewal and no-approval resumes cannot consume the pending proposal", () => fixture(async ({ workspace, options, calls, g }) => {
  const engine = createEngineeringRuntime(workspace, options);
  const a = pending(await engine.start(g, approval(g), "expiry"));
  const noApproval = await engine.resume("expiry");
  assert.equal(noApproval.state.status, "paused");
  assert.deepEqual(pending(noApproval), a);
  await assert.rejects(() => engine.resume("expiry", { ...approval(g, [a.id]), expiresAt: Date.now() - 1 }), /approval/);
  assert.equal(calls(), 1);
  assert.equal(await fs.readFile(path.join(workspace, "a.ts"), "utf8"), before);
  const renewed = await engine.resume("expiry", approval(g, [a.id]));
  assert.equal(renewed.state.status, "completed");
  assert.deepEqual(await journalProposal(renewed), a);
  assert.equal(calls(), 1);
}));

test("B05: pending proposals still undergo scope and risk checks after checkpoint reload", () => fixture(async ({ workspace, options, calls, g, store }) => {
  const engine = createEngineeringRuntime(workspace, options);
  const a = pending(await engine.start(g, approval(g), "revalidate-scope"));
  const checkpoint = await store.loadLatest("revalidate-scope");
  checkpoint.context.engineering.tasks[0].task.files = [];
  await store.save(checkpoint);
  const result = await engine.resume("revalidate-scope", approval(g, [a.id]));
  assert.equal(result.state.status, "paused");
  assert.match(result.context.engineering.escalation, /Scope expansion/);
  assert.equal(calls(), 1);
  assert.equal(await fs.readFile(path.join(workspace, "a.ts"), "utf8"), before);

  // Host narrowing of permitted risk cannot make a persisted model proposal safe.
  const narrowed = structuredClone(checkpoint);
  narrowed.context.engineering.goal.scope.maxRisk = "low";
  await store.save(narrowed);
  const lowerRisk = await engine.resume("revalidate-scope", approval(narrowed.context.engineering.goal, [a.id]));
  assert.equal(lowerRisk.state.status, "paused");
  assert.match(lowerRisk.context.engineering.escalation, /risk exceeds/);
  assert.equal(calls(), 1);
}));
