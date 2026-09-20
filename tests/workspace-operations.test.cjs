const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { load, root } = require("./load-typescript.cjs");

const { createWorkspaceOperationsService } = load(path.join(root, "lib/workspace-operations/service.ts"));
const { FileNotificationPreferencesStore } = load(path.join(root, "lib/workspace-operations/store.ts"));
const routeSource = require("node:fs").readFileSync(path.join(root, "app/api/workspaces/route.ts"), "utf8");

async function workspace(prefix) {
  return fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), prefix)));
}

function source(workspace, state, dispatch = async () => ({ acknowledged: false, detail: "not acknowledged" })) {
  return { workspace, snapshot: async () => structuredClone(state), dispatch };
}

test("projection does not manufacture progress, checkpoints, verification, or approval evidence", async () => {
  const first = await workspace("codexia-ops-provenance-");
  try {
    const service = createWorkspaceOperationsService({ registry: { listAuthorized: () => [source(first, {
      workspace: first, status: "completed", tasks: [{ id: "done", title: "completed", status: "completed", budget: { limit: 1, consumed: 1 } }],
    })] } });
    const [projection] = await service.projection();
    assert.equal(projection.status, "completed");
    assert.equal(projection.progress, undefined);
    assert.equal(projection.pendingApprovals, undefined);
    assert.equal(projection.checkpoints, undefined);
    assert.equal(projection.outcome, undefined);
    assert.equal(projection.tasks[0].verification, undefined);
    assert.equal(projection.tasks[0].checkpoint, undefined);
    assert.deepEqual(projection.tasks[0].budget, { limit: 1, consumed: 1 });
    assert.doesNotMatch(routeSource, /progress:\s*task\.status/);
    assert.doesNotMatch(routeSource, /checkpoint:\s*task\.updatedAt/);
    assert.doesNotMatch(routeSource, /verification:\s*task\.output/);
  } finally { await fs.rm(first, { recursive: true, force: true }); }
});

test("workspace aggregation preserves identity and does not leak one workspace into another", async () => {
  const first = await workspace("codexia-ops-isolation-a-");
  const second = await workspace("codexia-ops-isolation-b-");
  try {
    const service = createWorkspaceOperationsService({ registry: { listAuthorized: () => [
      source(first, { workspace: first, status: "queued", tasks: [{ id: "a", title: "a", status: "queued", budget: { limit: 2, consumed: 1 } }] }),
      source(second, { workspace: second, status: "paused", tasks: [{ id: "b", title: "b", status: "paused", budget: { limit: 3, consumed: 2 } }] }),
    ] } });
    const projections = await service.projection();
    assert.deepEqual(projections.map(item => item.workspace).sort(), [first, second].sort());
    assert.equal(projections.find(item => item.workspace === first).tasks[0].id, "a");
    assert.equal(projections.find(item => item.workspace === second).tasks[0].id, "b");
    await assert.rejects(service.get(path.dirname(first)), /authorized|workspace/i);
  } finally {
    await fs.rm(first, { recursive: true, force: true });
    await fs.rm(second, { recursive: true, force: true });
  }
});

test("rejected and stale controls remain requests, not acknowledged transitions", async () => {
  const first = await workspace("codexia-ops-control-");
  let calls = 0;
  try {
    const state = { workspace: first, status: "active", tasks: [], resource: { running: 1, queued: 0 } };
    const service = createWorkspaceOperationsService({ registry: { listAuthorized: () => [source(first, state, async () => { calls += 1; return { acknowledged: false, detail: "Runtime task is stale" }; })] } });
    const result = await service.dispatch(first, "pause", "runtime-1");
    assert.equal(calls, 1);
    assert.equal(result.acknowledged, false);
    assert.equal(result.requested.action, "pause");
    assert.equal(result.projection.status, "active");
    assert.match(result.detail, /stale/);
    assert.match(result.projection.audit.at(-1).type, /action_requested/);
  } finally { await fs.rm(first, { recursive: true, force: true }); }
});

test("approval IDs cannot manufacture or broaden Phase 7 approval authority", async () => {
  const first = await workspace("codexia-ops-approval-");
  try {
    const service = createWorkspaceOperationsService({ registry: { listAuthorized: () => [source(first, { workspace: first, status: "awaiting_approval", tasks: [{ id: "proposal", title: "review", status: "awaiting_approval" }], pendingApprovals: 1 }, async (_action, _runtime, approvalId) => ({ acknowledged: false, detail: `Approval ${approvalId} requires the engineering approval route` }))] } });
    const result = await service.dispatch(first, "approve", "runtime-1", "proposal-1");
    assert.equal(result.acknowledged, false);
    assert.equal(result.requested.approvalId, "proposal-1");
    assert.equal(result.projection.status, "awaiting_approval");
    assert.match(result.detail, /engineering approval route/);
  } finally { await fs.rm(first, { recursive: true, force: true }); }
});

test("concurrent controls are serialized and notification preferences cannot change authority", async () => {
  const first = await workspace("codexia-ops-concurrency-");
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let calls = 0;
  const notifications = [];
  try {
    const service = createWorkspaceOperationsService({
      registry: { listAuthorized: () => [source(first, { workspace: first, status: "active", tasks: [{ id: "q", title: "queued", status: "queued", budget: { limit: 1, consumed: 0 } }] }, async () => { calls += 1; await gate; return { acknowledged: false, detail: "still active" }; })] },
      notify: notification => notifications.push(notification),
      preferences: new FileNotificationPreferencesStore(first),
    });
    await service.setNotificationPreferences({ enabled: false, events: ["completed", "failed", "developer_action"] });
    const firstRequest = service.dispatch(first, "pause");
    await assert.rejects(service.dispatch(first, "cancel"), /already in progress/);
    release();
    const result = await firstRequest;
    assert.equal(calls, 1);
    assert.equal(result.acknowledged, false);
    assert.equal(result.projection.tasks[0].budget.consumed, 0);
    assert.deepEqual(notifications, []);
  } finally { await fs.rm(first, { recursive: true, force: true }); }
});

test("recovery and interruption evidence is projected only when supplied by the lifecycle source", async () => {
  const first = await workspace("codexia-ops-recovery-");
  try {
    const state = { workspace: first, status: "paused", tasks: [], checkpoints: [{ id: "checkpoint-1", at: 100, phase: "executing" }], audit: [{ at: 100, type: "interrupted", detail: "Runtime timeout requires resume review" }] };
    const service = createWorkspaceOperationsService({ registry: { listAuthorized: () => [source(first, state)] } });
    const [projection] = await service.projection();
    assert.deepEqual(projection.checkpoints, state.checkpoints);
    assert.deepEqual(projection.audit, state.audit);
    assert.equal(projection.status, "paused");
  } finally { await fs.rm(first, { recursive: true, force: true }); }
});
