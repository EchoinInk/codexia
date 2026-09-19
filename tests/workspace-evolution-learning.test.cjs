const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { load, root } = require("./load-typescript.cjs");

const memory = load(path.join(root, "lib/intelligence/workspace-memory.ts"));

function fixture(name) {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), `codexia-evolution-${name}-`)));
}

function input(summary, overrides = {}) {
  return {
    kind: "architecture",
    summary,
    details: "Observed evidence",
    files: ["src/index.ts"],
    directories: ["src"],
    snapshotId: `snapshot-${summary}`,
    fingerprint: `fingerprint-${summary}`,
    state: "current",
    source: "workspace",
    observedAt: 1000,
    evidenceCount: 1,
    ...overrides,
  };
}

async function cleanup(workspaces) {
  for (const workspace of workspaces) fs.rmSync(workspace, { recursive: true, force: true });
}

test("evolution records are deterministic, meaningful, coalesced, persisted, and workspace-scoped", async () => {
  const first = fixture("first");
  const second = fixture("second");
  try {
    const firstEntry = await memory.appendWorkspaceEvolution(first, input("Stable module boundary"));
    const repeated = await memory.appendWorkspaceEvolution(first, input("Stable module boundary", { observedAt: 2000 }));
    assert.equal(repeated.id, firstEntry.id);
    assert.equal(repeated.evidenceCount, 2);
    assert.deepEqual(repeated.files, ["src/index.ts"]);
    assert.deepEqual(repeated.directories, ["src"]);

    await memory.appendWorkspaceEvolution(second, input("Stable module boundary"));
    const firstSnapshot = await memory.loadWorkspaceMemorySnapshot(first);
    const secondSnapshot = await memory.loadWorkspaceMemorySnapshot(second);
    assert.equal(firstSnapshot.evolution.length, 1);
    assert.equal(secondSnapshot.evolution.length, 1);
    assert.notEqual(firstSnapshot.evolution[0].id, undefined);
    assert.equal(firstSnapshot.evolution[0].strength.label, "medium");

    const restarted = await memory.loadWorkspaceMemorySnapshot(first);
    assert.deepEqual(restarted.evolution, firstSnapshot.evolution);
  } finally {
    await cleanup([first, second]);
  }
});

test("retention is bounded for evolution and derived learning", async () => {
  const workspace = fixture("bounds");
  try {
    for (let index = 0; index < 220; index += 1) {
      await memory.appendWorkspaceEvolution(
        workspace,
        input(`Observed change ${index}`, {
          snapshotId: `snapshot-${index}`,
          fingerprint: `fingerprint-${index}`,
          observedAt: index + 1,
        })
      );
    }
    const snapshot = await memory.loadWorkspaceMemorySnapshot(workspace);
    assert.equal(snapshot.evolution.length, 200);
    assert.equal(snapshot.learning.length, 100);
  } finally {
    await cleanup([workspace]);
  }
});

test("strength semantics are deterministic and preserve contradiction, stale, and incomplete truth", async () => {
  assert.equal(memory.createEvidenceStrength(0, 0, 0, false, true, false).label, "low");
  assert.equal(memory.createEvidenceStrength(2, 2, 0, false, true, false).label, "high");
  assert.equal(memory.createEvidenceStrength(1, 1, 1, false, true, false).label, "contradicted");
  assert.equal(memory.createEvidenceStrength(4, 2, 0, false, false, true).stale, true);

  const workspace = fixture("states");
  try {
    await memory.appendWorkspaceEvolution(workspace, input("Historical observation", {
      state: "historical",
      snapshotId: "historical-snapshot",
    }));
    await memory.appendWorkspaceEvolution(workspace, input("Stale observation", {
      state: "stale",
      snapshotId: "stale-snapshot",
    }));
    await memory.appendWorkspaceEvolution(workspace, input("Incomplete observation", {
      state: "incomplete",
      snapshotId: "incomplete-snapshot",
    }));
    await memory.appendWorkspaceEvolution(workspace, input("Contradicted observation", {
      state: "contradicted",
      snapshotId: "contradicted-snapshot",
    }));
    const snapshot = await memory.loadWorkspaceMemorySnapshot(workspace);
    const states = new Set(snapshot.learning.map(entry => entry.state));
    assert.ok(states.has("historical"));
    assert.ok(states.has("stale"));
    assert.ok(states.has("incomplete"));
    assert.ok(states.has("contradicted"));
  } finally {
    await cleanup([workspace]);
  }
});

test("corrupted persisted learning state fails closed without inventing evidence", async () => {
  const workspace = fixture("corrupt");
  try {
    const file = path.join(workspace, ".codexia", "intelligence", "workspace-memory.json");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({
      version: 3,
      files: {},
      knowledge: [],
      evolution: [{ id: "bad", summary: "missing required provenance" }],
      learning: [{ id: "bad", summary: "missing support" }],
      updatedAt: 1,
    }));
    const snapshot = await memory.loadWorkspaceMemorySnapshot(workspace);
    assert.deepEqual(snapshot.evolution, []);
    assert.deepEqual(snapshot.learning, []);
  } finally {
    await cleanup([workspace]);
  }
});
