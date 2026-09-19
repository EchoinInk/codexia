const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { load, root } = require("./load-typescript.cjs");

const fingerprints = load(path.join(root, "lib/intelligence/index-fingerprint.ts"));
const indexer = load(path.join(root, "lib/intelligence/incremental-index.ts"));
const workspaceIndex = load(path.join(root, "lib/intelligence/workspace-index.ts"));
const background = load(path.join(root, "lib/intelligence/workspace-background-indexer.ts"));
const eventSystem = load(path.join(root, "lib/agent/event-system/system.ts"));

function fingerprint(files, directories) {
  return { files, directories };
}

test("fingerprint diffs classify file-affected directories deterministically", () => {
  const diff = fingerprints.compareFingerprints(
    fingerprint({
      "src/z.ts": "old-z",
      "src/nested/keep.ts": "keep",
      "remove.ts": "removed",
    }, ["src", "src/nested"]),
    fingerprint({
      "src/z.ts": "new-z",
      "src/nested/keep.ts": "keep",
      "src/nested/add.ts": "added",
    }, ["src", "src/nested"])
  );

  assert.deepEqual(diff.changed, ["src/z.ts"]);
  assert.deepEqual(diff.added, ["src/nested/add.ts"]);
  assert.deepEqual(diff.removed, ["remove.ts"]);
  assert.deepEqual(diff.changedDirectories, ["src", "src/nested"]);
  assert.deepEqual(diff.addedDirectories, []);
  assert.deepEqual(diff.removedDirectories, []);
  assert.deepEqual(diff.unchangedDirectories, ["src", "src/nested"]);
});

test("incremental reconciliation preserves added, changed, and removed identities", async () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "codexia-refresh-"));
  try {
    fs.mkdirSync(path.join(workspace, "src"));
    fs.writeFileSync(path.join(workspace, "src", "changed.ts"), "before");
    fs.writeFileSync(path.join(workspace, "src", "removed.ts"), "removed");
    const previous = await workspaceIndex.createWorkspaceIndex(workspace);

    fs.writeFileSync(path.join(workspace, "src", "changed.ts"), "after");
    fs.unlinkSync(path.join(workspace, "src", "removed.ts"));
    fs.writeFileSync(path.join(workspace, "src", "added.ts"), "new");

    const updated = await indexer.applyIncrementalIndexUpdate(previous, {
      changed: ["src/changed.ts"],
      added: ["src/added.ts"],
      removed: ["src/removed.ts"],
      unchanged: [],
      changedDirectories: ["src"],
      addedDirectories: [],
      removedDirectories: [],
      unchangedDirectories: ["src"],
    }, workspace);

    assert.deepEqual(updated.files.map(file => file.path).sort(), [
      "src/added.ts",
      "src/changed.ts",
    ]);
    assert.equal(updated.files.find(file => file.path === "src/changed.ts").sourceText, "after");
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("ambiguous event requests reconciliation without inventing a file identity", async () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "codexia-ambiguous-"));
  let dirty = 0;
  let reads = 0;
  const system = new eventSystem.WorkspaceEventSystem();
  system.configure({
    markWorkspaceDirty: () => { dirty += 1; },
    getWorkspaceIndex: async () => {
      reads += 1;
      return { directories: [], files: [] };
    },
  });

  try {
    system.notifyFileChanged({
      workspace,
      changes: [{ type: "change", ambiguous: true, occurredAt: 1 }],
    });
    await new Promise(resolve => setTimeout(resolve, 25));
    assert.equal(dirty, 1);
    assert.equal(reads, 1);
    const event = system.getHistory(workspace).find(item => item.type === "file_changed");
    assert.equal(event.changes[0].path, undefined);
    assert.equal(event.changes[0].ambiguous, true);
  } finally {
    system.clear(workspace);
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("background refresh coalesces newer work per workspace without cross-workspace interference", async () => {
  const first = fs.mkdtempSync(path.join(os.tmpdir(), "codexia-queue-a-"));
  const second = fs.mkdtempSync(path.join(os.tmpdir(), "codexia-queue-b-"));
  let release;
  const running = new Promise(resolve => { release = resolve; });
  let firstRuns = 0;
  let secondRuns = 0;

  try {
    background.scheduleWorkspaceBackgroundIndex(first, async () => {
      firstRuns += 1;
      await running;
    }, 0);
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(background.getWorkspaceBackgroundIndexStatus(first).state, "running");

    const coalesced = background.scheduleWorkspaceBackgroundIndex(first, async () => {
      firstRuns += 1;
    }, 0);
    assert.equal(coalesced.state, "running");

    background.scheduleWorkspaceBackgroundIndex(second, async () => {
      secondRuns += 1;
    }, 0);
    release();
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.equal(firstRuns, 1);
    assert.equal(secondRuns, 1);

    background.scheduleWorkspaceBackgroundIndex(first, async () => {
      firstRuns += 1;
    }, 0);
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.equal(firstRuns, 2);
    assert.equal(secondRuns, 1);
  } finally {
    background.clearAllWorkspaceBackgroundIndexes();
    fs.rmSync(first, { recursive: true, force: true });
    fs.rmSync(second, { recursive: true, force: true });
  }
});
