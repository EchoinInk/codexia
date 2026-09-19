const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { load, root } = require("./load-typescript.cjs");

const route = load(path.join(root, "app/api/intelligence/workspace/route.ts"));
const manager = load(path.join(root, "lib/intelligence/workspace-index-manager.ts"));
const background = load(path.join(root, "lib/intelligence/workspace-background-indexer.ts"));
const cache = load(path.join(root, "lib/intelligence/workspace-cache.ts"));
const memory = load(path.join(root, "lib/intelligence/workspace-memory.ts"));

function request(workspace) {
  const query =
    workspace === undefined
      ? ""
      : `?workspace=${encodeURIComponent(workspace)}`;
  return new Request(`http://localhost:3000/api/intelligence/workspace${query}`);
}

async function fixture(name, callback) {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), `codexia-api-${name}-`)));
  const previous = process.env.WORKSPACE_DIR;
  process.env.WORKSPACE_DIR = directory;
  try {
    await callback(directory);
  } finally {
    manager.stopAllWorkspaceIndexWatchers();
    manager.resetWorkspaceIndex();
    background.clearAllWorkspaceBackgroundIndexes();
    if (previous === undefined) delete process.env.WORKSPACE_DIR;
    else process.env.WORKSPACE_DIR = previous;
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test("aggregate API returns current snapshot-bound intelligence", async () => {
  await fixture("current", async workspace => {
    await manager.rebuildWorkspaceIndex(workspace);
    const response = await route.GET(request());
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.status, "current");
    assert.equal(body.workspace, workspace);
    assert.equal(body.architecture.snapshotId, body.provenance.snapshotId);
    assert.equal(body.diagnostics.snapshotId, body.provenance.snapshotId);
    assert.equal(body.dependencies.snapshotId, body.provenance.snapshotId);
    assert.equal(body.activity.snapshotId, body.provenance.snapshotId);
    assert.equal(body.summary.fileCount, 0);
  });
});

test("aggregate API preserves stale-but-readable evidence without waiting", async () => {
  await fixture("stale", async workspace => {
    await manager.rebuildWorkspaceIndex(workspace);
    manager.markWorkspaceDirty(workspace);
    const response = await route.GET(request());
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.status, "stale");
    assert.equal(body.usable, true);
    assert.equal(body.pending, true);
    assert.equal(body.provenance.snapshotId, body.architecture.snapshotId);
  });
});

test("aggregate API preserves unavailable, incomplete, and failed statuses", async () => {
  await fixture("states", async workspace => {
    const unavailable = await route.GET(request());
    assert.equal(unavailable.status, 503);
    assert.equal((await unavailable.json()).status, "unavailable");

    cache.setWorkspaceCache(workspace, {
      files: [],
      directories: [],
    }, { files: {}, directories: [] });
    const incomplete = await route.GET(request());
    assert.equal(incomplete.status, 200);
    assert.equal((await incomplete.json()).status, "incomplete");

    process.env.WORKSPACE_DIR = workspace;
    background.scheduleWorkspaceBackgroundIndex(workspace, async () => {
      throw new Error("refresh failed");
    }, 0);
    await new Promise(resolve => setTimeout(resolve, 25));
    const failed = await route.GET(request());
    assert.equal(failed.status, 503);
    const failedBody = await failed.json();
    assert.equal(failedBody.status, "failed");
    assert.equal(failedBody.failure.message, "refresh failed");
  });
});

test("aggregate API enforces configured workspace isolation and rejects invalid input", async () => {
  await fixture("isolation", async workspace => {
    const other = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "codexia-api-other-")));
    try {
      await manager.rebuildWorkspaceIndex(workspace);
      const invalid = await route.GET(request(path.join(other, "missing")));
      assert.equal(invalid.status, 400);
      const empty = await route.GET(request(""));
      assert.equal(empty.status, 400);
      const valid = await route.GET(request(workspace));
      assert.equal(valid.status, 200);
      assert.equal((await valid.json()).workspace, workspace);
    } finally {
      fs.rmSync(other, { recursive: true, force: true });
    }
  });
});

test("aggregate API is read-only and bounds repeated relationship/analysis output", async () => {
  await fixture("readonly", async workspace => {
    fs.writeFileSync(path.join(workspace, "source.ts"), "export const value = 1;");
    await manager.rebuildWorkspaceIndex(workspace);
    const before = fs.readFileSync(path.join(workspace, "source.ts"), "utf8");
    const response = await route.GET(request());
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(fs.readFileSync(path.join(workspace, "source.ts"), "utf8"), before);
    assert.equal(body.dependencies.truncated, false);
    assert.ok(body.diagnostics.diagnosticCount >= body.diagnostics.diagnostics.length);
    assert.ok(body.architecture.findingCount >= body.architecture.findings.length);
  });

  test("aggregate API projects bounded evolution and learning with shared provenance", async () => {
    await fixture("evolution-learning", async workspace => {
      await manager.rebuildWorkspaceIndex(workspace);
      await memory.appendWorkspaceEvolution(workspace, {
        kind: "architecture",
        summary: "Observed bounded project evolution",
        details: "Evidence-backed observation",
        files: ["source.ts"],
        directories: [],
        snapshotId: "memory-snapshot",
        fingerprint: "memory-fingerprint",
        state: "historical",
        source: "workspace",
        observedAt: Date.now(),
        evidenceCount: 1,
      });
      const body = await (await route.GET(request())).json();
      assert.equal(body.evolution.snapshotId, body.provenance.snapshotId);
      assert.equal(body.learning.snapshotId, body.provenance.snapshotId);
      assert.equal(body.evolution.entries[0].summary, "Observed bounded project evolution");
      assert.equal(body.learning.entries[0].supportingEvidenceIds.length, 1);
      assert.equal(body.evolution.truncated, false);
      assert.equal(body.learning.truncated, false);
    });
  });
});
