const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { load, root } = require("./load-typescript.cjs");

const { deriveEngineeringInsights } = load(path.join(root, "lib/intelligence/engineering-insights.ts"));

function snapshot(status = "current", overrides = {}) {
  return {
    workspace: "/workspace",
    status,
    usable: status !== "unavailable" && status !== "failed",
    dirty: status === "stale",
    pending: status === "stale",
    refresh: { workspace: "/workspace", dirty: status === "stale", version: 1, background: null },
    provenance: status === "unavailable" || status === "failed" ? undefined : {
      workspace: "/workspace", snapshotId: "snapshot-1", generatedAt: 1000, source: "cache",
      fingerprint: { files: {}, directories: [] }, refreshVersion: 1,
    },
    evidence: status === "unavailable" || status === "failed" ? undefined : {
      index: { files: [], directories: [], relationships: {} }, files: [], directories: [],
      relationships: {}, memory: undefined, intelligence: undefined,
    },
    ...overrides,
  };
}

function diagnostic(id, severity = "error") {
  return {
    id, provider: "fixture", code: id, severity, file: `${id}.ts`,
    message: `Diagnostic ${id}`, explanation: "Compiler evidence", relatedFiles: [], suggestions: [],
  };
}

test("insights derive deterministically with provenance and stable ordering", () => {
  const input = {
    snapshot: snapshot(),
    diagnostics: { diagnostics: [diagnostic("b", "warning"), diagnostic("a", "error")], providerErrors: [], limitations: [] },
    architecture: { findings: [], graph: { nodes: [], order: [] }, limitations: [] },
  };
  const first = deriveEngineeringInsights(input);
  const second = deriveEngineeringInsights(input);
  assert.deepEqual(first, second);
  assert.deepEqual(first.insights.map(item => item.id), [first.insights[0].id, first.insights[1].id]);
  assert.equal(first.insights[0].priority, "high");
  assert.equal(first.insights[0].provenance.snapshotId, "snapshot-1");
  assert.equal(first.insights[0].evidence[0].snapshotId, "snapshot-1");
});

test("current concrete evidence outranks repeated weak learning and stale evidence", () => {
  const result = deriveEngineeringInsights({
    snapshot: snapshot("stale"),
    diagnostics: { diagnostics: [diagnostic("current-error", "error")], providerErrors: [], limitations: [] },
    memory: {
      frequentlyEditedFiles: [], commonlyOpenedFiles: [], recentlyModifiedFiles: [], hotspots: [],
      developerHabits: { totalReads: 0, totalEdits: 0, totalChanges: 0 }, knowledge: {
        architecture: [], codingStyle: [], preferredPatterns: [], previousFailures: [], previousFixes: [],
      },
      evolution: [], learning: [{
        id: "learning", kind: "pattern", summary: "Repeated weak pattern", files: ["a.ts"],
        state: "historical", supportingEvidenceIds: ["one", "two", "three"], observedAt: 1000,
        strength: { supportingObservations: 3, distinctSnapshots: 3, contradictionCount: 0, invalidated: false, current: false, stale: false, label: "high" },
      }],
    },
  });
  assert.equal(result.insights.length, 2);
  assert.equal(result.insights[0].category, "diagnostic");
  assert.equal(result.insights[0].priorityFactors.sourceSeverity, 3);
  assert.equal(result.insights[1].state, "historical");
});

test("contradicted and invalidated evidence stays visible and cannot become ordinary high priority", () => {
  const memory = {
    frequentlyEditedFiles: [], commonlyOpenedFiles: [], recentlyModifiedFiles: [], hotspots: [],
    developerHabits: { totalReads: 0, totalEdits: 0, totalChanges: 0 }, knowledge: {
      architecture: [], codingStyle: [], preferredPatterns: [], previousFailures: [], previousFixes: [],
    },
    evolution: [{
      id: "contradicted", kind: "architecture", summary: "Old boundary", files: ["old.ts"], directories: [],
      snapshotId: "old-snapshot", fingerprint: "old", state: "contradicted", source: "workspace",
      observedAt: 1000, evidenceCount: 4, strength: { supportingObservations: 4, distinctSnapshots: 2, contradictionCount: 1, invalidated: true, current: false, stale: true, label: "contradicted" },
    }],
    learning: [],
  };
  const insight = deriveEngineeringInsights({ snapshot: snapshot(), memory }).insights[0];
  assert.equal(insight.state, "contradicted");
  assert.equal(insight.priority, "informational");
  assert.ok(insight.contradictions.length > 0);
  assert.equal(insight.evidence[0].state, "contradicted");
});

test("unavailable and failed snapshots produce no ordinary priorities", () => {
  for (const status of ["unavailable", "failed"]) {
    const result = deriveEngineeringInsights({
      snapshot: snapshot(status),
      diagnostics: { diagnostics: [diagnostic("hidden")], providerErrors: [], limitations: [] },
    });
    assert.deepEqual(result.insights, []);
    assert.ok(result.limitations.length > 0);
  }
});

test("insight path is read-only and does not import execution infrastructure", () => {
  const source = fs.readFileSync(path.join(root, "lib/intelligence/engineering-insights.ts"), "utf8");
  assert.doesNotMatch(source, /agent\/(executor|workflow|verification|runtime)/);
  assert.doesNotMatch(source, /safeWrite|writeFile|rename|executePlan|runWorkflow|createChangeProposal/);
});
