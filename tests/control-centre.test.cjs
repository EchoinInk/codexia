const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { load, root } = require("./load-typescript.cjs");

const { buildControlCentreProjection, controlCentreTaskState } = load(path.join(root, "lib/control-centre/projection.ts"));
const routeSource = fs.readFileSync(path.join(root, "app/api/workspaces/route.ts"), "utf8");
const componentSource = fs.readFileSync(path.join(root, "components/control-centre/ControlCentre.tsx"), "utf8");
const pageSource = fs.readFileSync(path.join(root, "app/page.tsx"), "utf8");

function source(overrides = {}) {
  return {
    observedAt: 2_000,
    lifecycle: {
      workspace: "/workspace", label: "Codexia", runtimeId: "runtime-1", status: "active",
      tasks: [
        { id: "run", title: "Execute bounded workflow", status: "running", updatedAt: 1_900 },
        { id: "review", title: "Review exact patch", status: "awaiting_approval", pendingApproval: true },
        { id: "failed", title: "Run provider check", status: "failed", error: "Provider unavailable", recoveryAvailable: true },
      ],
      resource: { running: 1, queued: 0 },
      capabilities: { pause: true, resume: false, cancel: true, retry: false, approve: true },
    },
    intelligence: { status: "current", usable: true, generatedAt: 1_800, snapshotId: "snapshot-1", fileCount: 20, findingCount: 2 },
    activity: [{ id: "event-1", type: "impact_analysed", detail: "Impact analysed", at: 1_850 }],
    eventRuntime: { pending: 0, failed: 0, lastProcessedAt: 1_850 },
    ...overrides,
  };
}

test("WP9.3: mission and task state are derived from authoritative lifecycle state", () => {
  const projection = buildControlCentreProjection(source());
  assert.equal(projection.workspace.root, "/workspace");
  assert.equal(projection.mission.id, "runtime-1");
  assert.equal(projection.mission.status, "running");
  assert.deepEqual(projection.tasks.map(task => task.state), ["running", "blocked", "failed"]);
  assert.equal(projection.taskSummary.running, 1);
  assert.equal(projection.taskSummary.blocked, 1);
  assert.equal(controlCentreTaskState("not-a-lifecycle-state"), "unknown");
});

test("WP9.3: agent summary does not invent specialist availability", () => {
  const agents = buildControlCentreProjection(source()).agents;
  assert.equal(agents.active, 1);
  assert.equal(agents.unavailable, 1);
  assert.match(agents.items.find(agent => agent.id === "specialist-projection").detail, /does not expose/i);
  assert.equal(agents.items.find(agent => agent.id === "runtime-coordinator").assignedWork, "Execute bounded workflow");
});

test("WP9.3: health preserves stale, unavailable, failed, and unknown signals", () => {
  assert.equal(buildControlCentreProjection(source({ intelligence: { status: "stale", usable: true } })).health.overall, "stale");
  assert.equal(buildControlCentreProjection(source({ intelligence: { status: "unavailable", usable: false } })).health.overall, "unavailable");
  assert.equal(buildControlCentreProjection(source({ eventRuntime: { pending: 0, failed: 1, lastError: "watcher failed" } })).health.overall, "failed");
  const unknown = buildControlCentreProjection(source()).health.signals.find(signal => signal.id === "providers");
  assert.equal(unknown.state, "unknown");
});

test("WP9.3: approvals, failures, and recovery are attention projections only", () => {
  const projection = buildControlCentreProjection(source());
  assert.equal(projection.approvals[0].taskId, "review");
  assert.equal(projection.failures[0].taskId, "failed");
  assert.equal(projection.failures[0].recoverable, true);
  assert.ok(projection.notifications.some(item => item.kind === "approval"));
  assert.ok(projection.notifications.some(item => item.kind === "failure"));
});

test("WP9.3: governed actions stay on existing Runtime and engineering contracts", () => {
  assert.match(componentSource, /fetch\("\/api\/workspaces"/);
  assert.match(componentSource, /engineering\.approve\(pendingProposal\.proposal\.id\)/);
  assert.doesNotMatch(componentSource, /setProjection\([^)]*status/);
  assert.match(routeSource, /buildControlCentreProjection/);
  assert.match(routeSource, /continuous\.pause\(\)/);
  assert.match(pageSource, /<WorkspaceOperations active=/);
});

test("WP9.3: responsive composition keeps operational surfaces present", () => {
  assert.match(componentSource, /overflow-x-hidden/);
  assert.match(componentSource, /xl:grid-cols-\[minmax\(0,1fr\)_20rem\]/);
  assert.match(componentSource, /aria-label="Operational attention and system summaries"/);
  for (const label of ["System health", "Intelligence", "Pending approvals", "Recent activity", "Agents", "Tasks"]) assert.match(componentSource, new RegExp(label));
});
