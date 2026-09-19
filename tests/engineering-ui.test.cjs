const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { load, root } = require('./load-typescript.cjs');
const { EngineeringSessionClient, reportPhase } = load(path.join(root, 'lib/engineering/session.ts'));
const { chatRequestKind } = load(path.join(root, 'lib/agent/task.ts'));
const { FileBuffer } = load(path.join(root, 'lib/editor/file-buffer.ts'));
const before = 'export const value = 1;';
const after = 'export const value = 2;';

async function fixture(run) {
  const workspace = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'codexia-ui-')));
  const model = load(path.join(root, 'lib/models/engineering-reasoner.ts'));
  const verification = load(path.join(root, 'lib/agent/engineering/verification.ts'));
  const original = { propose: model.ollamaEngineeringReasoner.propose, checks: verification.runEngineeringChecks, workspace: process.env.WORKSPACE_DIR };
  let calls = 0, fail = false;
  try {
    await fs.writeFile(path.join(workspace, 'a.ts'), before);
    await fs.writeFile(path.join(workspace, 'package.json'), JSON.stringify({ scripts: { test: 'node --test' } }));
    process.env.WORKSPACE_DIR = workspace;
    model.ollamaEngineeringReasoner.propose = async () => ({ changes: [{ path: 'a.ts', before, after: ++calls === 1 ? after : 'export const value = 3;' }] });
    verification.runEngineeringChecks = async checks => checks.map(check => ({ id: check.id, success: !fail,
      provider: 'fixture', measuredAt: Date.now(), output: fail ? 'failed' : 'passed' }));
    const routes = {
      '/api/chat': load(path.join(root, 'app/api/chat/route.ts')).POST,
      '/api/engineering': load(path.join(root, 'app/api/engineering/route.ts')).POST,
      '/api/fs/read': load(path.join(root, 'app/api/fs/read/route.ts')).GET,
      '/api/fs/write': load(path.join(root, 'app/api/fs/write/route.ts')).POST,
    };
    const requests = [];
    const request = async (url, options = {}) => {
      const parsed = new URL(url, 'http://127.0.0.1:3000');
      requests.push({ url: parsed.pathname, body: options.body ? JSON.parse(options.body) : undefined });
      return routes[parsed.pathname](new Request(parsed, { ...options,
        headers: { ...options.headers, origin: 'http://127.0.0.1:3000', host: '127.0.0.1:3000' } }));
    };
    const client = new EngineeringSessionClient(request);
    await run({ workspace, client, request, requests, calls: () => calls, failChecks: () => { fail = true; } });
  } finally {
    const indexes = load(path.join(root, 'lib/intelligence/workspace-index-manager.ts'));
    indexes.stopAllWorkspaceIndexWatchers(); indexes.resetWorkspaceIndex();
    model.ollamaEngineeringReasoner.propose = original.propose;
    verification.runEngineeringChecks = original.checks;
    if (original.workspace === undefined) delete process.env.WORKSPACE_DIR; else process.env.WORKSPACE_DIR = original.workspace;
    await fs.rm(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}
const submit = client => client.submit([{ role: 'user', content: 'Change a.ts so value is 2' }]);
function renderReview(client) {
  const React = require('react');
  const ts = require('typescript');
  const vm = require('node:vm');
  function component(file) {
    const module = { exports: {} };
    const compiled = ts.transpileModule(require('node:fs').readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    const localRequire = name => name === './Markdown' ? { Markdown: ({ children }) => React.createElement('pre', null, children) }
      : name.startsWith('./') ? component(path.resolve(path.dirname(file), `${name}.tsx`))
      : name.startsWith('@/') ? load(path.join(root, name.slice(2))) : require(name);
    vm.runInThisContext(`(function(require,module,exports){${compiled}\n})`, { filename: file })(localRequire, module, module.exports);
    return module.exports;
  }
  return require('react-dom/server').renderToStaticMarkup(React.createElement(component(path.join(root, 'components/EngineeringReview.tsx')).EngineeringReview, { session: client }));
}

test('A02: visible client handoff uses real engineering adapter; exact displayed A is approved and executed once', () => fixture(async ({ client, workspace, requests, calls }) => {
  const phases = []; client.subscribe(() => phases.push(client.getSnapshot().phase));
  const handoff = await submit(client);
  assert.equal(handoff.kind, 'engineering');
  assert.equal(client.getSnapshot().runtimeId, handoff.taskId);
  assert.ok(phases.includes('starting'));
  assert.equal(client.getSnapshot().phase, 'awaiting_approval');
  assert.equal(await fs.readFile(path.join(workspace, 'a.ts'), 'utf8'), before);
  const pending = client.getSnapshot().report.pendingProposal;
  const checkpoint = JSON.parse(await fs.readFile(path.join(workspace, `.codexia/runtime/checkpoints/${handoff.taskId}.json`), 'utf8'));
  assert.deepEqual(pending.proposal, checkpoint.context.engineering.tasks[0].pendingProposal.proposal);
  const html = renderReview(client);
  assert.ok(html.includes(pending.digest));
  assert.ok(html.includes(before) && html.includes(after));
  assert.match(html, /a\.ts/); assert.match(html, /Awaiting your approval/); assert.match(html, /tests must pass/);
  const length = requests.length;
  await client.approve('unreviewed-id'); assert.equal(requests.length, length);
  const approving = client.approve(pending.proposal.id);
  assert.doesNotMatch(renderReview(client), /Outcome: paused/);
  await client.approve(pending.proposal.id); // duplicate clicks cannot send a second resume
  await approving;
  assert.ok(phases.includes('resuming'));
  assert.equal(client.getSnapshot().phase, 'completed');
  assert.equal(calls(), 1);
  const resumes = requests.filter(item => item.body?.operation === 'resume');
  assert.equal(resumes.length, 1);
  assert.deepEqual(resumes[0].body.approval.proposalIds, pending.approval.proposalIds);
  assert.equal(resumes[0].body.approval.goalDigest, pending.approval.goalDigest);
  assert.equal(resumes[0].body.approval.mode, 'proposal');
  assert.equal(resumes[0].body.approval.expiresAt - resumes[0].body.approval.approvedAt, 300000);
  assert.deepEqual(requests.find(item => item.body?.operation === 'start').body.approval.proposalIds, []);
  assert.equal(await fs.readFile(path.join(workspace, 'a.ts'), 'utf8'), after);
  assert.deepEqual(JSON.parse(await fs.readFile(client.getSnapshot().report.tasks[0].journal, 'utf8')).proposal, pending.proposal);
  assert.match(renderReview(client), /Completed and verified/);
  assert.ok(!requests.some(item => item.url === '/api/fs/write'));
}));

test('A02: read-only Chat stays read-only; unsupported scope never falls back to a writer', () => fixture(async ({ client, requests, calls }) => {
  const read = await client.submit([{ role: 'user', content: 'List files in this project' }]);
  assert.equal(read.kind, 'chat');
  assert.equal(client.getSnapshot().runtimeId, undefined);
  for (const content of ['Fix the workspace', 'Create absent.ts', 'Delete a.ts', 'Deploy a.ts']) {
    const result = await client.submit([{ role: 'user', content }]); assert.equal(result.kind, 'unsupported');
  }
  assert.equal(requests.filter(item => item.url === '/api/engineering').length, 0);
  assert.equal(calls(), 0);
  for (const text of ['How do I edit a.ts?', 'Explain how to fix this function', 'Inspect a.ts without changing it']) assert.equal(chatRequestKind(text), 'read_only');
  for (const text of ['Can you fix a.ts?', 'Refactor a.ts', 'Explain a.ts and then fix it']) assert.equal(chatRequestKind(text), 'engineering');
}));

test('A02: decline closes review honestly, survives remount, and never changes source', () => fixture(async ({ client, workspace, requests, calls }) => {
  const unsubscribe = client.subscribe(() => {});
  await submit(client); const id = client.getSnapshot().runtimeId;
  const pending = client.getSnapshot().report.pendingProposal;
  unsubscribe(); // Chat panel unmounted; page-owned client remains
  const buffer = new FileBuffer(async () => Response.json({ path: 'a.ts', content: before, version: 'fixture' }));
  await buffer.select('a.ts');
  const back = client.subscribe(() => {});
  assert.equal(client.getSnapshot().runtimeId, id);
  assert.deepEqual(client.getSnapshot().report.pendingProposal, pending);
  assert.ok(renderReview(client).includes(pending.digest));
  await client.decline();
  assert.equal(client.getSnapshot().dismissed, true);
  assert.match(client.getSnapshot().notice, /remains paused.*not cancelled/);
  assert.doesNotMatch(renderReview(client), /Approve this exact proposal/);
  await client.approve(pending.digest);
  assert.equal(requests.filter(item => item.body?.operation === 'resume').length, 0);
  assert.equal(await fs.readFile(path.join(workspace, 'a.ts'), 'utf8'), before);
  await client.reopen(); assert.equal(client.getSnapshot().phase, 'awaiting_approval');
  assert.equal(calls(), 1); back();
}));

test('A02: stale approval shows authoritative invalidation without regeneration', () => fixture(async ({ client, workspace, calls }) => {
  await submit(client); const id = client.getSnapshot().report.pendingProposal.digest;
  await fs.writeFile(path.join(workspace, 'a.ts'), 'export const external = 9;');
  await client.approve(id);
  assert.equal(client.getSnapshot().phase, 'invalidated');
  assert.equal(client.getSnapshot().report.pendingProposal, undefined);
  assert.match(renderReview(client), /Proposal invalidated/);
  assert.equal(calls(), 1);
  assert.equal(await fs.readFile(path.join(workspace, 'a.ts'), 'utf8'), 'export const external = 9;');
}));

test('A02: failed verification displays rollback and never claims completed', () => fixture(async ({ client, workspace, failChecks }) => {
  await submit(client); failChecks();
  await client.approve(client.getSnapshot().report.pendingProposal.digest);
  // A second repair proposal may require approval, but the prior rollback must stay visible.
  const report = client.getSnapshot().report;
  assert.equal(report.lastChangeOutcome, 'rolled_back');
  assert.notEqual(client.getSnapshot().phase, 'completed');
  assert.equal(await fs.readFile(path.join(workspace, 'a.ts'), 'utf8'), before);
  assert.doesNotMatch(renderReview(client), /Completed and verified/);
  assert.match(renderReview(client), /failed verification and was rolled back/);
}));

test('A02: manual save stays on B09 versioned filesystem route, including conflict after engineering', () => fixture(async ({ client, request, requests, workspace }) => {
  const buffer = new FileBuffer(request);
  await buffer.select('a.ts'); buffer.edit('a.ts'); buffer.change('a.ts', 'export const value = 4;');
  assert.equal(await buffer.save('a.ts'), true);
  const writes = requests.filter(item => item.url === '/api/fs/write');
  assert.match(writes[0].body.expectedVersion, /^[0-9a-f]{64}$/);
  assert.ok(!requests.some(item => item.url === '/api/engineering'));
  assert.equal(client.getSnapshot().runtimeId, undefined);
  buffer.edit('a.ts'); buffer.change('a.ts', 'export const value = 5;');
  await fs.writeFile(path.join(workspace, 'a.ts'), 'export const value = 6;');
  assert.equal(await buffer.save('a.ts'), false);
  assert.match(buffer.getSnapshot().error, /changed/i);
}));

test('A02: legacy Chat rejects mutating or verification plans, including tools mislabelled read', () => fixture(async ({ workspace }) => {
  const planners = load(path.join(root, 'lib/agent/planner-index.ts'));
  const { runAgent } = load(path.join(root, 'lib/agent/agent.ts'));
  const original = planners.getPlanner;
  try {
    for (const step of [
      { action: 'read', tool: 'write_file', args: { path: 'a.ts', content: after } },
      { action: 'write', tool: 'write_file', args: { path: 'a.ts', content: after } },
      { action: 'verify', description: 'Run arbitrary project scripts' },
    ]) {
      planners.getPlanner = () => ({ createPlan: async () => ({ goal: 'bad', files: ['a.ts'], steps: [step] }) });
      const result = await runAgent('Inspect this project', workspace);
      assert.match(result.content, /Execution prevented/);
    }
    assert.match((await runAgent('Edit a.ts', workspace)).content, /governed/);
    assert.equal(await fs.readFile(path.join(workspace, 'a.ts'), 'utf8'), before);
  } finally { planners.getPlanner = original; }
}));

test('A02: report states never treat a mere write, cancellation or rollback conflict as success', () => {
  assert.equal(reportPhase({ runtimeStatus: 'completed', outcome: 'completed' }), 'failed');
  assert.equal(reportPhase({ runtimeStatus: 'cancelled' }), 'cancelled');
  assert.equal(reportPhase({ runtimeStatus: 'paused', lastChangeOutcome: 'rollback_conflict' }), 'failed');
  assert.equal(reportPhase({ runtimeStatus: 'paused', lastChangeOutcome: 'rolled_back' }), 'rolled_back');
  assert.equal(reportPhase({ runtimeStatus: 'paused' }), 'paused');
  assert.equal(reportPhase({ runtimeStatus: 'running' }), 'running');
});

function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
test('A02: late status response cannot replace completed resume with old approval authority', () => fixture(async ({ request, calls }) => {
  const held = deferred(), captured = deferred(); let holdStatus = false;
  const client = new EngineeringSessionClient(async (url, options) => {
    const response = await request(url, options);
    if (holdStatus && JSON.parse(options.body).operation === 'status') { captured.resolve(); await held.promise; }
    return response;
  });
  await submit(client);
  const id = client.getSnapshot().report.pendingProposal.digest;
  holdStatus = true;
  const refreshing = client.refresh(); await captured.promise;
  await client.approve(id);
  held.resolve(); await refreshing;
  assert.equal(client.getSnapshot().phase, 'completed');
  assert.equal(client.getSnapshot().report.pendingProposal, undefined);
  assert.equal(calls(), 1);
}));

test('A02: existing active-runtime cancellation is honoured without source writes', () => fixture(async ({ client, workspace }) => {
  const model = load(path.join(root, 'lib/models/engineering-reasoner.ts'));
  const reasoner = model.ollamaEngineeringReasoner.propose;
  const started = deferred(), release = deferred();
  model.ollamaEngineeringReasoner.propose = async input => { started.resolve(); await release.promise; return reasoner(input); };
  const submitting = submit(client); await started.promise;
  await client.decline();
  assert.match(client.getSnapshot().notice, /Cancellation requested/);
  release.resolve(); await submitting;
  assert.equal(client.getSnapshot().phase, 'cancelled');
  assert.equal(await fs.readFile(path.join(workspace, 'a.ts'), 'utf8'), before);
}));

test('A02: production-style local Host is accepted and wrong-Origin engineering requests remain blocked', () => fixture(async () => {
  const { POST } = load(path.join(root, 'app/api/engineering/route.ts'));
  const request = origin => new Request('http://localhost:3000/api/engineering', { method: 'POST',
    headers: { host: '127.0.0.1:3000', origin, 'content-type': 'application/json' },
    body: JSON.stringify({ operation: 'status', taskId: 'absent' }) });
  assert.equal((await POST(request('http://127.0.0.1:3000'))).status, 404);
  assert.equal((await POST(request('http://wrong.example'))).status, 403);
}));
