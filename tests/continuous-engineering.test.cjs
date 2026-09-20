const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { load, root } = require("./load-typescript.cjs");
const { evaluateMaintenanceEligibility, DEFAULT_AUTONOMOUS_MAINTENANCE_POLICY } =
  load(path.join(root, "lib/agent/maintenance/policy.ts"));

function snapshot(status = "current") {
  return { workspace: "/workspace", status, usable: !["unavailable", "failed"].includes(status),
    dirty: status === "stale", pending: status === "stale", refresh: { workspace: "/workspace", dirty: false, version: 1 },
    provenance: ["unavailable", "failed"].includes(status) ? undefined : { workspace: "/workspace", snapshotId: "snap",
      generatedAt: 1000, source: "cache", fingerprint: { files: {}, directories: [] }, refreshVersion: 1 },
    evidence: ["unavailable", "failed"].includes(status) ? undefined : { index: { files: [], directories: [] }, files: [], directories: [], relationships: {}, memory: undefined, intelligence: undefined } };
}
function insight(overrides = {}) {
  return { id: "diagnostic-insight", category: "diagnostic", summary: "Fix type error", rationale: "compiler",
    affectedFiles: ["src/a.ts"], affectedDirectories: [], affectedSymbols: [],
    evidence: [{ source: "diagnostic", id: "diagnostic-id", label: "compiler", snapshotId: "snap" }],
    provenance: { workspace: "/workspace", snapshotId: "snap", generatedAt: 1000, sources: ["diagnostic"] },
    state: "current", severity: "error", priority: "high",
    priorityFactors: { validity: 4, sourceSeverity: 3, impact: 0, recurrence: 0, strength: 2 },
    persistence: { observationCount: 1, distinctSnapshots: 1, repeated: false }, limitations: [], contradictions: [], ...overrides };
}
function evaluate(overrides = {}) {
  return evaluateMaintenanceEligibility({ workspace: "/workspace", enabled: true, paused: false,
    snapshot: snapshot(), insight: insight(), queue: [], policy: DEFAULT_AUTONOMOUS_MAINTENANCE_POLICY, now: 1100, ...overrides });
}

test("maintenance policy admits only current direct bounded diagnostic evidence", () => {
  const decision = evaluate();
  assert.equal(decision.eligible, true);
  assert.equal(decision.code, "eligible");
  assert.match(decision.taskIdentity, /^maintenance-[a-f0-9]{32}$/);
  assert.deepEqual(evaluate(), decision);
});

test("stale, incomplete, unavailable and failed evidence cannot authorize maintenance", () => {
  for (const status of ["stale", "incomplete", "unavailable", "failed"]) {
    const decision = evaluate({ snapshot: snapshot(status) });
    assert.equal(decision.eligible, false, status);
  }
  assert.equal(evaluate({ now: 1000 + DEFAULT_AUTONOMOUS_MAINTENANCE_POLICY.maximumEvidenceAgeMs + 1 }).code, "evidence_stale");
});

test("contradiction, invalidation, history and high priority alone are insufficient", () => {
  assert.equal(evaluate({ insight: insight({ state: "contradicted", contradictions: ["conflict"] }) }).code, "evidence_contradicted");
  assert.equal(evaluate({ insight: insight({ state: "invalidated" }) }).eligible, false);
  assert.equal(evaluate({ insight: insight({ state: "historical" }) }).eligible, false);
  assert.equal(evaluate({ insight: insight({ priority: "critical", category: "architecture",
    evidence: [{ source: "architecture", id: "a", label: "a", snapshotId: "snap" }] }) }).code, "unsupported_category");
});

test("risk/scope, workspace paths, queue bounds and deterministic duplicate suppression are enforced", () => {
  assert.equal(evaluate({ insight: insight({ affectedFiles: ["a.ts", "b.ts"] }) }).code, "scope_unbounded");
  assert.equal(evaluate({ insight: insight({ affectedFiles: ["../outside.ts"] }) }).code, "scope_unbounded");
  const first = evaluate();
  const queued = { id: first.taskIdentity, type: "engineering", status: "completed", priority: "normal", payload: {},
    attempt: 1, maxAttempts: 1, attemptBudget: { limit: 1, consumed: 1 }, queuedAt: 1, updatedAt: 1 };
  assert.equal(evaluate({ queue: [queued] }).code, "duplicate");
  assert.equal(evaluate({ queue: [{ ...queued, id: "other", status: "running" }] }).code, "queue_full");
});

test("disabled and paused controllers cannot admit work", () => {
  assert.equal(evaluate({ enabled: false }).code, "disabled");
  assert.equal(evaluate({ paused: true }).code, "runtime_paused");
});
