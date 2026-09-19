const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { load, root } = require("./load-typescript.cjs");

const snapshot = load(path.join(root, "lib/intelligence/workspace-intelligence-snapshot.ts"));
const manager = load(path.join(root, "lib/intelligence/workspace-index-manager.ts"));
const cache = load(path.join(root, "lib/intelligence/workspace-cache.ts"));
const background = load(path.join(root, "lib/intelligence/workspace-background-indexer.ts"));

function workspace(name) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), `codexia-snapshot-${name}-`));
  fs.writeFileSync(path.join(directory, "index.ts"), "export const value = 1;");
  return directory;
}

function fingerprint() {
  return { files: { "index.ts": "1:1:hash" }, directories: [] };
}

test("snapshot reports current state with deterministic provenance and evidence", async () => {
  const directory = workspace("current");
  try {
    const index = await manager.rebuildWorkspaceIndex(directory);
    const result = await snapshot.getWorkspaceIntelligenceSnapshot(directory);
    assert.equal(result.status, "current");
    assert.equal(result.usable, true);
    assert.equal(result.workspace, fs.realpathSync(directory));
    assert.equal(result.provenance.snapshotId, snapshotId(index));
    assert.equal(result.provenance.source, "cache");
    assert.deepEqual(result.evidence.index.files, index.files);
    assert.deepEqual(result.evidence.files, index.files);
  } finally {
    manager.stopWorkspaceIndexWatcher(directory);
    manager.resetWorkspaceIndex();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("snapshot remains readable but becomes stale when newer dirty work exists", async () => {
  const directory = workspace("stale");
  try {
    const index = await manager.rebuildWorkspaceIndex(directory);
    manager.markWorkspaceDirty(directory);
    const result = await snapshot.getWorkspaceIntelligenceSnapshot(directory);
    assert.equal(result.status, "stale");
    assert.equal(result.usable, true);
    assert.equal(result.dirty, true);
    assert.equal(result.pending, true);
    assert.strictEqual(result.evidence.index.files, index.files);
    assert.ok(result.provenance.refreshVersion > 0);
  } finally {
    manager.stopWorkspaceIndexWatcher(directory);
    manager.resetWorkspaceIndex();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("snapshot distinguishes unavailable, incomplete, and failed states", async () => {
  const unavailable = workspace("unavailable");
  const incomplete = workspace("incomplete");
  const failed = workspace("failed");
  try {
    const unavailableResult = await snapshot.getWorkspaceIntelligenceSnapshot(unavailable);
    assert.equal(unavailableResult.status, "unavailable");
    assert.equal(unavailableResult.usable, false);

    cache.setWorkspaceCache(incomplete, {
      files: [],
      directories: [],
    }, fingerprint());
    const incompleteResult = await snapshot.getWorkspaceIntelligenceSnapshot(incomplete);
    assert.equal(incompleteResult.status, "incomplete");
    assert.equal(incompleteResult.usable, true);

    background.scheduleWorkspaceBackgroundIndex(failed, async () => {
      throw new Error("refresh offline");
    }, 0);
    await new Promise(resolve => setTimeout(resolve, 25));
    const failedResult = await snapshot.getWorkspaceIntelligenceSnapshot(failed);
    assert.equal(failedResult.status, "failed");
    assert.equal(failedResult.usable, false);
    assert.equal(failedResult.failure.message, "refresh offline");
  } finally {
    manager.resetWorkspaceIndex();
    background.clearAllWorkspaceBackgroundIndexes();
    fs.rmSync(unavailable, { recursive: true, force: true });
    fs.rmSync(incomplete, { recursive: true, force: true });
    fs.rmSync(failed, { recursive: true, force: true });
  }
});

test("snapshot freshness and dirty state remain workspace-scoped", async () => {
  const first = workspace("first");
  const second = workspace("second");
  try {
    await manager.rebuildWorkspaceIndex(first);
    await manager.rebuildWorkspaceIndex(second);
    manager.markWorkspaceDirty(first);

    const firstResult = await snapshot.getWorkspaceIntelligenceSnapshot(first);
    const secondResult = await snapshot.getWorkspaceIntelligenceSnapshot(second);
    assert.equal(firstResult.status, "stale");
    assert.equal(secondResult.status, "current");
    assert.notEqual(firstResult.workspace, secondResult.workspace);
    assert.notEqual(firstResult.provenance.snapshotId, undefined);
    assert.notEqual(secondResult.provenance.snapshotId, undefined);
  } finally {
    manager.stopWorkspaceIndexWatcher(first);
    manager.stopWorkspaceIndexWatcher(second);
    manager.resetWorkspaceIndex();
    fs.rmSync(first, { recursive: true, force: true });
    fs.rmSync(second, { recursive: true, force: true });
  }
});

function snapshotId(index) {
  return load(path.join(root, "lib/intelligence/change-proposal.ts")).snapshotId(index);
}
