const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { load, root } = require("./load-typescript.cjs");
const { createEngineeringRuntime } = load(path.join(root, "lib/agent/engineering/runtime.ts"));
const { goalDigest, validateEngineeringGoal } = load(path.join(root, "lib/agent/engineering/governance.ts"));
const { createEngineeringReport } = load(path.join(root, "lib/agent/engineering/report.ts"));
const { InMemoryRuntimeCheckpointStore } = load(path.join(root, "lib/agent/runtime/checkpoint-store.ts"));
const { createWorkspaceIndex } = load(path.join(root, "lib/intelligence/workspace-index.ts"));
const { snapshotId } = load(path.join(root, "lib/intelligence/change-proposal.ts"));
const { evaluateEngineeringChecks } = load(path.join(root, "lib/agent/engineering/verification.ts"));

function goal(overrides = {}) {
  return { title: "Migrate the value name", mode: "migration",
    scope: { files: ["a.ts", "b.ts", "README.md"], maxFilesPerBatch: 3, maxRisk: "high" },
    checks: [{ id: "tests", kind: "tests" }], acceptance: [{ id: "correct", description: "Required tests pass", checkId: "tests" }],
    compatibilityChecks: ["tests"], constraints: ["Preserve public behavior"], documentationFiles: [],
    budgets: { maxIterations: 10, maxRepairAttempts: 2, timeoutMs: 30000, noProgressLimit: 2 },
    tasks: [{ id: "rename", title: "Rename value to amount", dependsOn: [], files: ["a.ts", "b.ts"],
      operation: { kind: "rename", file: "a.ts", position: { line: 1, column: 14 }, newName: "amount" },
      evidenceIds: [], risk: "medium", obligations: ["Run tests"] }], ...overrides };
}
function approval(g, mode = "bounded") {
  return { goalDigest: goalDigest(g), approvedBy: "fixture user", approvedAt: Date.now(), expiresAt: Date.now() + 60000,
    mode, proposalIds: [] };
}
const passed = async checks => checks.map(check => ({ id: check.id, success: true, provider: "fixture", measuredAt: Date.now(), output: "passed" }));
async function fixture(fn) {
  const workspace = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "codexia-engineering-")));
  try {
    await fs.writeFile(path.join(workspace, "a.ts"), "export const value = 1;");
    await fs.writeFile(path.join(workspace, "b.ts"), 'import { value } from "./a"; value;');
    await fs.writeFile(path.join(workspace, "README.md"), "Use value.");
    const store = new InMemoryRuntimeCheckpointStore();
    const options = { checkpointStore: store, checks: passed, recordMemory: false };
    await fn(workspace, options, store);
  } finally { await fs.rm(workspace, { recursive: true, force: true }); }
}

test("engineering scope validates acceptance, dependency DAGs, and approval identity", () => {
  const g = goal();
  validateEngineeringGoal(g);
  assert.throws(() => validateEngineeringGoal({ ...g, acceptance: [] }));
  assert.throws(() => validateEngineeringGoal({ ...g, tasks: [{ ...g.tasks[0], dependsOn: ["rename"] }] }));
  assert.throws(() => validateEngineeringGoal({ ...g, scope: { ...g.scope, files: ["../escape.ts"] } }));
  assert.throws(() => validateEngineeringGoal({ ...g, compatibilityChecks: ["unknown"] }));
});
test("staged migration reuses Runtime, updates docs, and verifies every acceptance check", () => fixture(async (workspace, options, store) => {
  const g = goal({ documentationFiles: ["README.md"] });
  g.tasks.push({ id: "docs", title: "Update migration documentation", dependsOn: ["rename"], files: ["README.md"],
    operation: { kind: "patch", diff: { changes: [{ path: "README.md", before: "Use value.", after: "Use amount." }] } },
    evidenceIds: [], risk: "high", obligations: ["Documentation reflects the migration"] });
  const engine = createEngineeringRuntime(workspace, options);
  const events = [];
  engine.subscribe(event => events.push(event.type));
  const result = await engine.start(g, approval(g), "migration");
  assert.equal(result.state.status, "completed");
  assert.equal(result.metrics.iterations, 3);
  assert.equal(await fs.readFile(path.join(workspace, "README.md"), "utf8"), "Use amount.");
  assert.match(await fs.readFile(path.join(workspace, "b.ts"), "utf8"), /amount/);
  assert.ok(events.includes("checkpoint_saved"));
  const checkpoint = await store.loadLatest("migration");
  assert.equal(checkpoint.context.engineering.tasks.filter(task => task.status === "verified").length, 2);
  assert.equal(createEngineeringReport(result).outcome, "verified");
  assert.ok(result.context.engineering.audit.some(event => event.type === "approval"));
}));
test("repair uses compiler fixes and structured verifier evidence", () => fixture(async (workspace, options) => {
  await fs.writeFile(path.join(workspace, "a.ts"), "interface Item { value: number }\nexport class Box implements Item {}");
  await fs.writeFile(path.join(workspace, "b.ts"), "export {};");
  const g = goal({ mode: "repair", title: "Repair missing implementation", tasks: undefined });
  options.checks = async checks => {
    const text = await fs.readFile(path.join(workspace, "a.ts"), "utf8");
    return checks.map(check => ({ id: check.id, success: text.includes("value: number;"), provider: "fixture tests", measuredAt: Date.now(), output: text.includes("value: number;") ? "pass" : "missing member" }));
  };
  const result = await createEngineeringRuntime(workspace, options).start(g, approval(g), "repair");
  assert.equal(result.state.status, "completed");
  assert.equal(result.context.engineering.baseline[0].success, false);
  assert.ok(result.context.engineering.audit.some(event => event.provider === "typescript"));
}));
test("missing exact proposal approval pauses without mutation and can resume after review", () => fixture(async (workspace, options) => {
  const g = goal(); const a = approval(g, "proposal");
  const engine = createEngineeringRuntime(workspace, options);
  const paused = await engine.start(g, a, "reviewed");
  assert.equal(paused.state.status, "paused");
  assert.equal(await fs.readFile(path.join(workspace, "a.ts"), "utf8"), "export const value = 1;");
  const proposal = paused.lastIteration.plan.engineering.proposal;
  const renewed = { ...approval(g, "proposal"), proposalIds: [proposal.id] };
  const resumed = await engine.resume("reviewed", renewed);
  assert.equal(resumed.state.status, "completed");
}));
test("external edits invalidate resume rather than expanding scope", () => fixture(async (workspace, options) => {
  const g = goal();
  const engine = createEngineeringRuntime(workspace, options);
  await engine.start(g, approval(g, "proposal"), "stale");
  await fs.appendFile(path.join(workspace, "a.ts"), "\n// external change");
  await assert.rejects(() => engine.resume("stale", approval(g)), /Recovery/);
}));
test("scope breaches and excessive risk never reach execution", () => fixture(async (workspace, options) => {
  const g = goal({ scope: { files: ["a.ts"], maxFilesPerBatch: 1, maxRisk: "low" }, tasks: [
    { ...goal().tasks[0], files: ["a.ts"], risk: "low" },
  ] });
  const result = await createEngineeringRuntime(workspace, options).start(g, approval(g), "scope");
  assert.equal(result.state.status, "paused");
  assert.match(result.context.engineering.escalation, /risk|Scope|batch/);
  assert.equal(await fs.readFile(path.join(workspace, "a.ts"), "utf8"), "export const value = 1;");
}));
test("failed batch rolls back and stops at repair budget without claiming migration success", () => fixture(async (workspace, options) => {
  const g = goal({ budgets: { ...goal().budgets, maxRepairAttempts: 1 } });
  options.checks = async checks => checks.map(check => ({ id: check.id, success: false, provider: "fixture", measuredAt: Date.now(), output: "test failure" }));
  const result = await createEngineeringRuntime(workspace, options).start(g, approval(g), "failure");
  assert.notEqual(result.state.status, "completed");
  assert.match(result.context.engineering.escalation, /budget/);
  assert.equal(await fs.readFile(path.join(workspace, "a.ts"), "utf8"), "export const value = 1;");
  assert.ok(createEngineeringReport(result).acceptance.every(item => item.status === "unverified"));
}));
test("reviewer disagreement cannot override verification or claim completion", () => fixture(async (workspace, options) => {
  options.specialists = { reviewer: { role: "reviewer", review: async () => ({ role: "reviewer", approved: false,
    summary: "Compatibility concern", findings: ["Need review"], requiredActions: ["Review public consumers"] }) } };
  const g = goal();
  const result = await createEngineeringRuntime(workspace, options).start(g, approval(g), "disagreement");
  assert.equal(result.state.status, "paused");
  assert.match(result.context.engineering.escalation, /public consumers/);
  assert.notEqual(createEngineeringReport(result).outcome, "verified");
}));
test("missing providers and stale evidence cannot satisfy benchmark/security acceptance", () => fixture(async (workspace, options) => {
  const g = goal({ checks: [{ id: "perf", kind: "benchmark", metric: { name: "ms", direction: "lower", maxRegressionPercent: 0 } }],
    acceptance: [{ id: "speed", description: "No slowdown", checkId: "perf" }], compatibilityChecks: ["perf"] });
  options.checks = undefined;
  const result = await createEngineeringRuntime(workspace, options).start(g, approval(g), "unsupported");
  assert.equal(result.state.status, "paused");
  assert.match(result.context.engineering.escalation, /baseline|provider/);
  const errors = evaluateEngineeringChecks(g.checks, [{ id: "perf", success: true, provider: "benchmark", measuredAt: Date.now(), measurements: { ms: 20 } }],
    [{ id: "perf", success: true, provider: "benchmark", measuredAt: Date.now(), measurements: { ms: 10 } }]);
  assert.match(errors[0], /regressed/);
}));
test("registered finding providers require matching provenance and snapshot", () => fixture(async (workspace, options) => {
  options.findingProviders = [{ id: "security-fixture", collect: async index => [{ id: "f1", provider: "security-fixture", category: "security",
    severity: "critical", confidence: 1, files: ["a.ts"], summary: "Fixture security issue", snapshot: snapshotId(index), observedAt: Date.now(), evidence: ["fixture:1"], effort: 1 }] },
    { id: "broken", collect: async () => { throw Error("offline"); } }];
  const preview = await createEngineeringRuntime(workspace, options).preview(goal({ mode: "remediation", tasks: undefined }));
  assert.equal(preview.evidence.findings[0].provider, "security-fixture");
  assert.ok(preview.evidence.providerErrors.some(error => error.includes("offline")));
  assert.ok(preview.tasks[0].evidenceIds.includes("f1"));
}));
test("pause/cancel are existing Runtime controls and paused checkpoints remain serializable", () => fixture(async (workspace, options) => {
  const g = goal();
  const engine = createEngineeringRuntime(workspace, options);
  engine.subscribe(event => { if (event.type === "phase_changed" && event.phase === "planning") engine.pause("pause", "user pause"); });
  const result = await engine.start(g, approval(g), "pause");
  assert.equal(result.state.status, "paused");
  assert.equal(await fs.readFile(path.join(workspace, "a.ts"), "utf8"), "export const value = 1;");
  const serialized = JSON.stringify(result.checkpoint);
  assert.ok(serialized.includes("Preserve public behavior"));
  const other = createEngineeringRuntime(workspace, options);
  other.subscribe(event => { if (event.type === "phase_changed" && event.phase === "planning") other.cancel("cancel", "user cancellation"); });
  const cancelled = await other.start(g, approval(g), "cancel");
  assert.equal(cancelled.state.status, "cancelled");
}));
test("documentation obligations prevent premature completion", () => fixture(async (workspace, options) => {
  const g = goal({ documentationFiles: ["README.md"] });
  const result = await createEngineeringRuntime(workspace, options).start(g, approval(g), "missing-docs");
  assert.equal(result.state.status, "paused");
  assert.match(result.context.engineering.escalation, /Documentation/);
}));

test("provider-independent reasoning returns validated diffs and enforces text schema", async () => {
  const { createChatEngineeringReasoner } = load(path.join(root, "lib/models/engineering-reasoner.ts"));
  const index = { files: [{ path: "a.ts", sourceText: "export const a = 1;" }], directories: [] };
  const input = { task: { ...goal().tasks[0], files: ["a.ts"] }, index,
    evidence: { findings: [], memory: [], snapshot: "fixture" }, failures: [] };
  const reasoner = createChatEngineeringReasoner("registered-openai-adapter", async messages => {
    assert.match(messages[0].content, /untrusted evidence/);
    return JSON.stringify({ changes: [{ path: "a.ts", before: "export const a = 1;", after: "export const a = 2;" }] });
  });
  assert.equal((await reasoner.propose(input)).changes.length, 1);
  await assert.rejects(() => createChatEngineeringReasoner("invalid", async () => '{"changes":[null]}').propose(input));
});
test("verification evidence must be fresh and benchmark regressions roll back", () => fixture(async (workspace, options) => {
  const g = goal({ checks: [{ id: "benchmark", kind: "benchmark", metric: { name: "latency", direction: "lower", maxRegressionPercent: 0 } }],
    acceptance: [{ id: "performance", description: "Do not regress latency", checkId: "benchmark" }], compatibilityChecks: ["benchmark"],
    budgets: { ...goal().budgets, maxRepairAttempts: 1 } });
  options.checks = async checks => {
    const text = await fs.readFile(path.join(workspace, "a.ts"), "utf8");
    return checks.map(check => ({ id: check.id, success: true, provider: "benchmark fixture", measuredAt: Date.now(), output: "measured",
      measurements: { latency: text.includes("amount") ? 20 : 10 } }));
  };
  const result = await createEngineeringRuntime(workspace, options).start(g, approval(g), "benchmark-regression");
  assert.notEqual(result.state.status, "completed");
  assert.equal(await fs.readFile(path.join(workspace, "a.ts"), "utf8"), "export const value = 1;");
  const old = { ...options, checks: async checks => checks.map(check => ({ id: check.id, success: true, provider: "stale cache", measuredAt: 1, output: "passed" })) };
  const staleGoal = goal();
  const stale = await createEngineeringRuntime(workspace, old).start(staleGoal, approval(staleGoal), "stale-checks");
  assert.notEqual(stale.state.status, "completed");
}));
test("interrupted checkpoint revalidation requires renewed approval and exact workspace", () => fixture(async (workspace, options, store) => {
  const g = goal();
  const engine = createEngineeringRuntime(workspace, options);
  const paused = await engine.start(g, approval(g, "proposal"), "interrupted");
  const checkpoint = await store.loadLatest("interrupted");
  checkpoint.state.status = "running";
  checkpoint.context.engineering.inFlight = { taskId: "rename", proposalId: paused.lastIteration.plan.engineering.proposal.id };
  await store.save(checkpoint);
  const resumed = await createEngineeringRuntime(workspace, options).resume("interrupted", approval(g));
  assert.equal(resumed.state.status, "completed");
  assert.ok(resumed.context.engineering.audit.some(event => event.type === "revalidated"));
}));
test("runtime checkpoint persistence refuses symlink escape", () => fixture(async (workspace) => {
  const { FileRuntimeCheckpointStore } = load(path.join(root, "lib/agent/runtime/checkpoint-store.ts"));
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), "codexia-external-"));
  try {
    await fs.symlink(outside, path.join(workspace, ".codexia"));
    const store = new FileRuntimeCheckpointStore(workspace);
    await assert.rejects(() => store.save({ taskId: "escape" }), /Unsafe/);
    assert.deepEqual(await fs.readdir(outside), []);
    assert.throws(() => new FileRuntimeCheckpointStore(workspace, "../outside"), /escapes/);
  } finally { await fs.rm(outside, { recursive: true, force: true }); }
}));
test("runtime budget and checkpoint serialization preserve failed acceptance", () => fixture(async (workspace, options) => {
  const g = goal({ budgets: { ...goal().budgets, maxIterations: 1 } });
  const result = await createEngineeringRuntime(workspace, options).start(g, approval(g), "limit");
  assert.equal(result.state.status, "failed");
  assert.equal(result.state.stopReason, "iteration_limit");
  assert.notEqual(createEngineeringReport(result).outcome, "verified");
}));

test("final verification cannot silently accept source changed by a checker", () => fixture(async (workspace, options) => {
  let calls = 0;
  options.checks = async checks => {
    calls++;
    if (calls === 3) await fs.appendFile(path.join(workspace, "README.md"), " unexpected write");
    return passed(checks);
  };
  const g = goal();
  const result = await createEngineeringRuntime(workspace, options).start(g, approval(g), "mutating-final-check");
  assert.equal(result.state.status, "paused");
  assert.match(result.context.engineering.escalation, /changed during final verification/);
}));
test("out-of-patch checker writes are escalated and not silently adopted as a new baseline", () => fixture(async (workspace, options) => {
  let calls = 0;
  options.checks = async checks => {
    calls++;
    if (calls === 2) await fs.appendFile(path.join(workspace, "README.md"), " external write");
    return passed(checks);
  };
  const g = goal();
  const engine = createEngineeringRuntime(workspace, options);
  const result = await engine.start(g, approval(g), "mutating-check");
  assert.equal(result.state.status, "paused");
  assert.match(result.context.engineering.escalation, /Unexpected workspace changes/);
  await assert.rejects(() => engine.resume("mutating-check", approval(g)), /Recovery/);
}));
test("resolved findings retain initial provenance and require final verified evidence", () => fixture(async (workspace, options) => {
  await fs.writeFile(path.join(workspace, "a.ts"), "interface Item { value: number }\nexport class Box implements Item {}");
  await fs.writeFile(path.join(workspace, "b.ts"), "export {};");
  options.checks = async checks => {
    const text = await fs.readFile(path.join(workspace, "a.ts"), "utf8");
    return checks.map(check => ({ id: check.id, success: text.includes("value: number;"), provider: "fixture", measuredAt: Date.now(), output: "fixture result" }));
  };
  const g = goal({ mode: "repair", tasks: undefined });
  const result = await createEngineeringRuntime(workspace, options).start(g, approval(g), "finding-outcomes");
  const report = createEngineeringReport(result);
  assert.ok(report.findings.some(f => f.disposition === "resolved" && f.provider === "typescript"));
  assert.ok(report.findings.every(f => f.snapshot && f.evidence.length));
}));
test("no-progress detection ignores varying log noise", () => fixture(async (workspace, options) => {
  let call = 0;
  options.checks = async checks => checks.map(check => ({ id: check.id, success: false, provider: "fixture", measuredAt: Date.now(), output: `failure run ${++call}` }));
  const g = goal({ mode: "repair", tasks: [{ id: "retry-check", title: "Investigate failing tests", files: [], dependsOn: [],
    operation: { kind: "verify" }, evidenceIds: [], risk: "low", obligations: [] }],
    budgets: { ...goal().budgets, maxRepairAttempts: 5, noProgressLimit: 1 } });
  const result = await createEngineeringRuntime(workspace, options).start(g, approval(g), "no-progress");
  assert.equal(result.state.status, "paused");
  assert.match(result.context.engineering.escalation, /No measurable progress/);
  assert.equal(result.context.engineering.tasks[0].attempts, 2);
}));
test("expired approvals and modified goal constraints cannot authorize work", () => fixture(async (workspace, options) => {
  const g = goal(); const engine = createEngineeringRuntime(workspace, options);
  await assert.rejects(() => engine.start(g, { ...approval(g), expiresAt: Date.now() - 1 }, "expired"));
  await assert.rejects(() => engine.start({ ...g, constraints: [] }, approval(g), "changed-approval"));
}));

test("renewed approval cannot reset repair-attempt budgets", () => fixture(async (workspace, options) => {
  let attempts = 0;
  options.checks = async checks => { attempts++; return checks.map(check => ({ id: check.id, success: false,
    provider: "fixture", measuredAt: Date.now(), output: "failure" })); };
  const g = goal({ budgets: { ...goal().budgets, maxRepairAttempts: 1 } });
  const engine = createEngineeringRuntime(workspace, options);
  const paused = await engine.start(g, approval(g), "budget-renewal");
  assert.equal(paused.state.status, "paused");
  const beforeResume = attempts;
  const result = await engine.resume("budget-renewal", approval(g));
  assert.equal(result.state.status, "paused");
  assert.equal(attempts, beforeResume);
}));
test("direct start rejects nonexistent scope and incomplete baseline evidence", () => fixture(async (workspace, options) => {
  const g = goal({ scope: { ...goal().scope, files: [...goal().scope.files, "absent.ts"] } });
  await assert.rejects(() => createEngineeringRuntime(workspace, options).start(g, approval(g), "unknown-scope"), /Unknown scope/);
  const valid = goal();
  const result = await createEngineeringRuntime(workspace, { ...options, checks: async () => [] }).start(valid, approval(valid), "empty-baseline");
  assert.equal(result.state.status, "paused");
  assert.match(result.context.engineering.escalation, /missing or duplicated/);
}));
