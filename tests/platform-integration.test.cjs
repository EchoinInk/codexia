const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { load, root } = require("./load-typescript.cjs");

const platform = load(path.join(root, "lib/platform-integration/index.ts"));
const { modelProviderGenerator } = load(path.join(root, "lib/models/provider.ts"));

async function fixture(run, options = {}) {
  const workspace = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "codexia-platform-")));
  const other = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "codexia-platform-other-")));
  const calls = { intelligence: 0, engineering: 0, lifecycle: 0, reporter: 0 };
  let release;
  const adapters = {
    intelligence: { query: async () => { calls.intelligence++; return { workspace, status: "current", usable: true, evidence: { snapshotId: "s1" } }; } },
    engineering: { request: async ({ requestId }) => { calls.engineering++; if (options.engineeringGate) await new Promise(resolve => { release = resolve; }); return { workspace, requestId, accepted: true, taskId: "phase7-task" }; } },
    lifecycle: {
      read: async () => { calls.lifecycle++; return { workspace, status: "active", tasks: [{ id: "q", title: "q", status: "active", budget: { limit: 1, consumed: 1 } }] }; },
      request: async (_workspace, action) => { calls.lifecycle++; return { requested: { action, workspace, at: 1 }, acknowledged: false, detail: "Runtime has not acknowledged the request", projection: { workspace, status: "active", tasks: [] } }; },
    },
    reporter: { read: async () => { calls.reporter++; return { workspace, status: "verified", evidence: { validator: "passed" } }; } },
  };
  const service = new platform.PlatformIntegrationService({ workspace, authorizedCapabilities: platform.PLATFORM_CAPABILITIES,
    adapters, sharing: options.sharing, emit: options.emit });
  const connect = (overrides = {}) => service.connect({ id: "test-client", kind: "ide", workspace,
    contractVersions: ["0.9", platform.PLATFORM_CONTRACT_VERSION], requestedCapabilities: platform.PLATFORM_CAPABILITIES, ...overrides });
  try { await run({ workspace, other, calls, adapters, service, connect, release: () => release?.() }); }
  finally { release?.(); await fs.rm(workspace, { recursive: true, force: true }); await fs.rm(other, { recursive: true, force: true }); }
}

const goal = { title: "request", mode: "repair", scope: { files: ["a.ts"], maxFilesPerBatch: 1, maxRisk: "low" }, checks: [], acceptance: [], compatibilityChecks: [], constraints: [], documentationFiles: [], budgets: { maxIterations: 1, maxRepairAttempts: 1, timeoutMs: 1000, noProgressLimit: 1 }, tasks: [] };

test("8.6 negotiates the supported version and discovers authorized capabilities deterministically", () => fixture(async ({ service, connect, workspace }) => {
  const session = connect({ requestedCapabilities: ["reporter.read", "intelligence.read", "reporter.read"] });
  const discovery = service.discover(session.id);
  assert.equal(discovery.version, "1.0"); assert.equal(discovery.workspace, workspace);
  assert.deepEqual(discovery.capabilities, ["intelligence.read", "reporter.read"]);
  assert.deepEqual(discovery.sharing, { mode: "local", allowed: [], maxBytes: 0 });
}));

test("incompatible versions and unknown capabilities fail closed", () => fixture(async ({ connect }) => {
  assert.throws(() => connect({ contractVersions: ["2.0"] }), error => error.code === "INCOMPATIBLE_VERSION");
  assert.throws(() => connect({ requestedCapabilities: ["filesystem.write"] }), error => error.code === "UNKNOWN_CAPABILITY");
}));

test("read-only clients cannot request mutation or lifecycle controls", () => fixture(async ({ service, connect, workspace, calls }) => {
  const session = connect({ requestedCapabilities: ["intelligence.read"] });
  assert.equal((await service.queryIntelligence(session.id, workspace)).status, "current");
  await assert.rejects(service.requestEngineering(session.id, workspace, "r1", goal), error => error.code === "CAPABILITY_DENIED");
  await assert.rejects(service.requestLifecycle(session.id, workspace, "pause"), error => error.code === "CAPABILITY_DENIED");
  assert.equal(calls.engineering, 0); assert.equal(calls.lifecycle, 0);
}));

test("engineering requests use one governed adapter call and duplicate/concurrent IDs cannot execute twice", () => fixture(async ({ service, connect, workspace, calls, release }) => {
  const session = connect({ requestedCapabilities: ["engineering.request"] });
  const first = service.requestEngineering(session.id, workspace, "stable-request", goal);
  const duplicate = service.requestEngineering(session.id, workspace, "stable-request", goal);
  assert.equal(first, duplicate); await new Promise(resolve => setImmediate(resolve)); assert.equal(calls.engineering, 1);
  release(); assert.equal((await first).taskId, "phase7-task"); assert.equal(calls.engineering, 1);
}, { engineeringGate: true }));

test("integration cannot manufacture approval, verification, Reporter outcomes, or attempt budgets", () => fixture(async ({ service, connect, workspace, calls }) => {
  const session = connect({ requestedCapabilities: ["engineering.request", "lifecycle.control", "lifecycle.read", "reporter.read"] });
  assert.equal(service.discover(session.id).capabilities.includes("approval.grant"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(service, "approve"), false);
  const receipt = await service.requestEngineering(session.id, workspace, "r2", goal);
  assert.deepEqual(receipt, { workspace, requestId: "r2", accepted: true, taskId: "phase7-task" });
  const lifecycle = await service.readLifecycle(session.id, workspace);
  assert.deepEqual(lifecycle.tasks[0].budget, { limit: 1, consumed: 1 });
  assert.equal(lifecycle.tasks[0].verification, undefined);
  const outcome = await service.readReporterOutcome(session.id, workspace, "phase7-task");
  assert.equal(outcome.status, "verified"); assert.equal(calls.reporter, 1);
}));

test("missing intelligence and Reporter evidence remains unavailable", () => fixture(async ({ service, connect, workspace, adapters }) => {
  adapters.intelligence.query = async () => ({ workspace, status: "unavailable", usable: false });
  adapters.reporter.read = async () => undefined;
  const session = connect({ requestedCapabilities: ["intelligence.read", "reporter.read"] });
  await assert.rejects(service.queryIntelligence(session.id, workspace), error => error.code === "EVIDENCE_UNAVAILABLE");
  await assert.rejects(service.readReporterOutcome(session.id, workspace, "missing"), error => error.code === "EVIDENCE_UNAVAILABLE");
}));

test("canonical workspace isolation rejects client, request, and adapter substitution", () => fixture(async ({ service, connect, workspace, other, adapters }) => {
  assert.throws(() => connect({ workspace: other }), error => error.code === "WORKSPACE_MISMATCH");
  const session = connect({ requestedCapabilities: ["intelligence.read"] });
  await assert.rejects(service.queryIntelligence(session.id, other), error => error.code === "WORKSPACE_MISMATCH");
  adapters.intelligence.query = async () => ({ workspace: other, status: "current", usable: true, evidence: {} });
  await assert.rejects(service.queryIntelligence(session.id, workspace), error => error.code === "WORKSPACE_MISMATCH");
}));

test("provider failures are typed, isolated, and cannot gain mutation authority", async () => {
  const generate = modelProviderGenerator({ id: "openai-1", kind: "openai", location: "external", generate: async () => { throw new Error("Authorization: Bearer super-secret-token"); } });
  await assert.rejects(generate([{ role: "user", content: "hi" }]), error => {
    assert.equal(error.code, "PROVIDER_UNAVAILABLE"); assert.equal(error.retryable, true);
    assert.doesNotMatch(error.message, /super-secret-token|authorization|bearer/i); return true;
  });
  assert.equal(Object.prototype.hasOwnProperty.call(generate, "write"), false);
});

test("adapter payloads cannot surface secrets in reports", () => fixture(async ({ service, connect, workspace, adapters }) => {
  adapters.reporter.read = async () => ({ workspace, status: "failed", evidence: { authorization: "Bearer abc123", detail: "token=abc123" } });
  const session = connect({ requestedCapabilities: ["reporter.read"] });
  const outcome = await service.readReporterOutcome(session.id, workspace, "task");
  assert.equal(outcome.evidence.authorization, "[REDACTED]");
  assert.equal(outcome.evidence.detail, "[REDACTED]");
  assert.doesNotMatch(JSON.stringify(outcome), /abc123|bearer/i);
}));

test("data sharing is local/private by default and explicit external sharing stays bounded", () => fixture(async ({ service, connect }) => {
  const session = connect();
  assert.throws(() => service.authorizeExternalSharing(session.id, ["source"], 1), error => error.code === "CAPABILITY_DENIED");
}));

test("bounded explicit sharing permits only configured data kinds and byte limit", () => fixture(async ({ service, connect }) => {
  const session = connect();
  assert.deepEqual(service.authorizeExternalSharing(session.id, ["diagnostics"], 512), { mode: "external", allowed: ["diagnostics"], maxBytes: 512 });
  assert.throws(() => service.authorizeExternalSharing(session.id, ["source"], 1), error => error.code === "CAPABILITY_DENIED");
  assert.throws(() => service.authorizeExternalSharing(session.id, ["diagnostics"], 1025), error => error.code === "CAPABILITY_DENIED");
}, { sharing: { mode: "external", allowed: ["diagnostics"], maxBytes: 1024 } }));

test("lifecycle control preserves request-versus-authoritative-ack semantics and attempt state", () => fixture(async ({ service, connect, workspace }) => {
  const session = connect({ requestedCapabilities: ["lifecycle.control"] });
  const result = await service.requestLifecycle(session.id, workspace, "resume", "runtime-1");
  assert.equal(result.requested.action, "resume"); assert.equal(result.acknowledged, false);
  assert.equal(result.projection.status, "active"); assert.match(result.detail, /not acknowledged/);
}));

test("resource limits fail closed before adapters and typed events contain no error details or secrets", () => fixture(async ({ service, connect, workspace, calls }) => {
  const session = connect({ requestedCapabilities: ["engineering.request"], limits: { maxRequestBytes: 10 } });
  await assert.rejects(service.requestEngineering(session.id, workspace, "bounded", goal), error => error.code === "RESOURCE_LIMIT");
  assert.equal(calls.engineering, 0);
}));

test("deduplication never bypasses authorization and rejects request-ID goal substitution", () => fixture(async ({ service, connect, workspace, calls, release }) => {
  const authorized = connect({ requestedCapabilities: ["engineering.request"] });
  const readOnly = connect({ requestedCapabilities: ["intelligence.read"] });
  const first = service.requestEngineering(authorized.id, workspace, "shared-id", goal);
  await assert.rejects(service.requestEngineering(readOnly.id, workspace, "shared-id", goal), error => error.code === "CAPABILITY_DENIED");
  await assert.rejects(service.requestEngineering(authorized.id, workspace, "shared-id", { ...goal, title: "different" }), error => error.code === "INVALID_REQUEST");
  assert.equal(calls.engineering, 1); release(); await first;
}, { engineeringGate: true }));

test("engineering receipts are workspace-bound and cannot add authority-like fields", () => fixture(async ({ service, connect, workspace, other, adapters }) => {
  const session = connect({ requestedCapabilities: ["engineering.request"] });
  adapters.engineering.request = async ({ requestId }) => ({ workspace: other, requestId, accepted: true });
  await assert.rejects(service.requestEngineering(session.id, workspace, "wrong-workspace", goal), error => error.code === "WORKSPACE_MISMATCH");
  adapters.engineering.request = async ({ requestId }) => ({ workspace, requestId, accepted: true, taskId: "task", approved: true, verification: "passed" });
  const receipt = await service.requestEngineering(session.id, workspace, "filtered", goal);
  assert.deepEqual(receipt, { workspace, requestId: "filtered", accepted: true, taskId: "task" });
}));

test("runtime lifecycle validation rejects approval before invoking the adapter", () => fixture(async ({ service, connect, workspace, calls }) => {
  const session = connect({ requestedCapabilities: ["lifecycle.control"] });
  assert.throws(() => service.requestLifecycle(session.id, workspace, "approve"), error => error.code === "INVALID_REQUEST");
  assert.equal(calls.lifecycle, 0);
}));

test("boundary timeouts reject adapters that ignore abort signals", () => fixture(async ({ service, connect, workspace }) => {
  const session = connect({ requestedCapabilities: ["intelligence.read"], limits: { timeoutMs: 5 } });
  service.options.adapters.intelligence.query = async () => new Promise(() => {});
  await assert.rejects(service.queryIntelligence(session.id, workspace), error => error.code === "RESOURCE_LIMIT" && error.retryable);
}));

test("concurrency accounting remains exact when requests complete out of order", () => fixture(async ({ service, connect, workspace, adapters }) => {
  const releases = [];
  adapters.intelligence.query = async () => new Promise(resolve => releases.push(() => resolve({ workspace, status: "current", usable: true, evidence: {} })));
  const session = connect({ requestedCapabilities: ["intelligence.read"], limits: { maxConcurrentRequests: 2 } });
  const first = service.queryIntelligence(session.id, workspace);
  const second = service.queryIntelligence(session.id, workspace);
  await new Promise(resolve => setImmediate(resolve));
  releases.shift()(); await first;
  const third = service.queryIntelligence(session.id, workspace);
  await new Promise(resolve => setImmediate(resolve));
  await assert.rejects(service.queryIntelligence(session.id, workspace), error => error.code === "RESOURCE_LIMIT");
  releases.splice(0).forEach(release => release());
  await Promise.all([second, third]);
}));

test("provider and adapter failures never copy arbitrary upstream exception text", async () => {
  const marker = "opaque-upstream-response-body";
  const generate = modelProviderGenerator({ id: "custom-1", kind: "custom", location: "external", generate: async () => { throw new Error(marker); } });
  await assert.rejects(generate([{ role: "user", content: "hi" }]), error => {
    assert.equal(error.code, "PROVIDER_UNAVAILABLE"); assert.doesNotMatch(error.message, new RegExp(marker)); return true;
  });
});
