const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { load, root } = require("./load-typescript.cjs");

const watcher = load(path.join(root, "lib/intelligence/workspace-watcher.ts"));
const events = load(path.join(root, "lib/agent/event-system/system.ts"));

test("watch change coalescing retains distinct paths in deterministic order", () => {
  const changes = watcher.coalesceWorkspaceWatchChanges([
    { path: "src/z.ts", type: "change", ambiguous: false, occurredAt: 3 },
    { path: "src/a.ts", type: "change", ambiguous: false, occurredAt: 1 },
    { path: "src/z.ts", type: "rename", ambiguous: false, occurredAt: 4 },
    { path: undefined, type: "rename", ambiguous: true, occurredAt: 2 },
    { path: undefined, type: "rename", ambiguous: true, occurredAt: 5 },
  ]);

  assert.deepEqual(changes, [
    { path: undefined, type: "rename", ambiguous: true, occurredAt: 5 },
    { path: "src/a.ts", type: "change", ambiguous: false, occurredAt: 1 },
    { path: "src/z.ts", type: "rename", ambiguous: false, occurredAt: 4 },
  ]);
});

test("watcher emits one batch across directories and preserves rename/removal evidence", async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "codexia-watcher-"));
  const received = [];

  await fs.mkdir(path.join(workspace, "src"), { recursive: true });
  await fs.mkdir(path.join(workspace, "tests"), { recursive: true });
  await fs.writeFile(path.join(workspace, "src", "existing.ts"), "before");

  try {
    await watcher.startWorkspaceWatcher(workspace, event => received.push(event));
    await fs.writeFile(path.join(workspace, "src", "added.ts"), "added");
    await fs.writeFile(path.join(workspace, "tests", "new.test.ts"), "new");
    await fs.rename(
      path.join(workspace, "src", "existing.ts"),
      path.join(workspace, "src", "renamed.ts")
    );
    await new Promise(resolve => setTimeout(resolve, 450));

    assert.equal(received.length, 1);
    assert.equal(received[0].workspace, workspace);
    assert.ok(received[0].changes.some(change => change.path === "src/added.ts"));
    assert.ok(received[0].changes.some(change => change.path === "tests/new.test.ts"));
    assert.ok(received[0].changes.some(change =>
      change.path === "src/existing.ts" && change.type === "rename"
    ));
    assert.ok(received[0].changes.some(change =>
      change.path === "src/renamed.ts" && change.type === "rename"
    ));
    assert.deepEqual(
      received[0].changes,
      [...received[0].changes].sort((left, right) =>
        (left.path ?? "").localeCompare(right.path ?? "")
      )
    );
  } finally {
    watcher.stopWorkspaceWatcher(workspace);
    await fs.rm(workspace, { recursive: true, force: true });
  }
});

test("event system propagates one coalesced batch without discarding identities", async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "codexia-events-"));
  const system = new events.WorkspaceEventSystem();
  const observed = [];
  let dirty = 0;

  system.configure({
    markWorkspaceDirty: () => { dirty += 1; },
    getWorkspaceIndex: async () => ({
      directories: [],
      files: [],
    }),
  });
  system.subscribe(event => observed.push(event));

  const input = {
    workspace,
    changes: [
      { path: "b.ts", type: "change", ambiguous: false, occurredAt: 2 },
      { path: "a.ts", type: "rename", ambiguous: false, occurredAt: 1 },
    ],
  };
  const accepted = system.notifyFileChanged(input);
  await new Promise(resolve => setTimeout(resolve, 25));

  assert.deepEqual(accepted.changes.map(change => change.path), ["a.ts", "b.ts"]);
  assert.equal(dirty, 1);
  assert.deepEqual(
    observed.find(event => event.type === "file_changed").changes.map(change => change.path),
    ["a.ts", "b.ts"]
  );
  assert.deepEqual(
    observed.find(event => event.type === "impact_analysed").changes.map(change => change.path),
    ["a.ts", "b.ts"]
  );
  system.clear(workspace);
  await fs.rm(workspace, { recursive: true, force: true });
});
