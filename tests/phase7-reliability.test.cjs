const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { load, root } = require('./load-typescript.cjs');
const get = file => load(path.join(root, file));
const safe = get('lib/fs-safe.ts');
const { toolRegistry } = get('lib/tools/index.ts');
const { executePlan } = get('lib/agent/executor.ts');
const { validatePlan } = get('lib/agent/plan-validator.ts');
const { createRepairPlan } = get('lib/agent/repair-planner.ts');
const { ChatSessionClient } = get('lib/chat/session.ts');
const readRoute = get('app/api/fs/read/route.ts');
const writeRoute = get('app/api/fs/write/route.ts');
const deleteRoute = get('app/api/fs/delete/route.ts');
const listRoute = get('app/api/fs/list/route.ts');
const chatRoute = get('app/api/chat/route.ts');
const engineeringRoute = get('app/api/engineering/route.ts');
const indexManager = get('lib/intelligence/workspace-index-manager.ts');

async function fixture(run) {
  const directory = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'codexia-reliability-')));
  const workspace = path.join(directory, 'workspace');
  const outside = path.join(directory, 'outside');
  await fs.mkdir(workspace); await fs.mkdir(outside);
  const previous = process.env.WORKSPACE_DIR;
  process.env.WORKSPACE_DIR = workspace;
  try { await run({ directory, workspace, outside }); }
  finally {
    indexManager.stopAllWorkspaceIndexWatchers(); indexManager.resetWorkspaceIndex();
    if (previous === undefined) delete process.env.WORKSPACE_DIR; else process.env.WORKSPACE_DIR = previous;
    await fs.rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

const context = workspace => ({ workspace, messages: [], observations: [], toolResults: [], filesRead: [], filesModified: [], memory: [] });
const plan = steps => ({ goal: 'fixture', files: [], steps });
const step = (action, tool, args = {}) => ({ action, tool, args, description: 'fixture step' });
const mutation = (route, body, origin = 'http://localhost:3000') => route.POST(new Request('http://localhost:3000/api/fs/mutation', {
  method: 'POST', headers: { host: 'localhost:3000', origin, 'content-type': 'application/json' }, body: JSON.stringify(body),
}));
const chat = body => chatRoute.POST(new Request('http://localhost:3000/api/chat', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
}));

test('B06: placeholder, missing and disguised legacy writes fail before tool execution', () => fixture(async ({ workspace }) => {
  await fs.writeFile(path.join(workspace, 'a.ts'), 'before');
  const writer = toolRegistry.get('write_file');
  const original = writer.execute; let invoked = 0;
  writer.execute = async () => { invoked++; throw new Error('must not run'); };
  try {
    for (const candidate of [
      step('write', 'write_file', { path: 'a.ts', content: '' }),
      step('write', 'write_file', { path: 'a.ts' }),
      step('write', 'write_file', { path: 'a.ts', content: 'PLACEHOLDER' }),
      step('write', 'write_file', { path: 'a.ts', content: 'write this later' }),
      step('read', 'write_file', { path: 'a.ts', content: 'changed' }),
    ]) {
      assert.throws(() => validatePlan(plan([candidate])), /read-only|content|cannot execute/i);
      const result = await executePlan(plan([candidate]), context(workspace));
      assert.equal(result.success, false); assert.match(result.output, /Execution prevented/);
    }
    assert.equal(invoked, 0);
    assert.equal(await fs.readFile(path.join(workspace, 'a.ts'), 'utf8'), 'before');
  } finally { writer.execute = original; }
}));

test('B06: repair retries retain read-only inspection and cannot introduce a mutation', () => {
  const repair = createRepairPlan(plan([
    step('read', 'read_file', { path: 'a.ts' }),
    step('analyze', undefined),
  ]), { observations: [{ type: 'error', summary: 'failed read' }] });
  assert.deepEqual(repair.steps.map(item => item.action), ['read', 'analyze']);
  assert.ok(repair.steps.every(item => item.tool !== 'write_file'));
});

test('B06/B07: autonomous edits use bounded engineering admission; unsupported edits never mutate', () => fixture(async ({ workspace }) => {
  await fs.writeFile(path.join(workspace, 'a.ts'), 'before');
  await fs.writeFile(path.join(workspace, 'package.json'), JSON.stringify({ scripts: { test: 'node --test' } }));
  const admitted = await (await chat({ context: { selectedFile: 'a.ts' }, messages: [{ role: 'user', content: 'Change this file to export value 2' }] })).json();
  assert.equal(admitted.kind, 'engineering'); assert.deepEqual(admitted.goal.scope.files, ['a.ts']);
  const unsupported = await (await chat({ messages: [{ role: 'user', content: 'Create missing.ts' }] })).json();
  assert.equal(unsupported.kind, 'unsupported');
  assert.equal(await fs.readFile(path.join(workspace, 'a.ts'), 'utf8'), 'before');
  await assert.rejects(fs.stat(path.join(workspace, 'missing.ts')), { code: 'ENOENT' });
}));

test('B07: selected workspace file is explicit deterministic read-only context', () => fixture(async ({ workspace }) => {
  await fs.writeFile(path.join(workspace, 'a.ts'), 'export const selected = "A";');
  await fs.writeFile(path.join(workspace, 'b.ts'), 'export const selected = "B";');
  const originalFetch = global.fetch; const prompts = [];
  global.fetch = async (_url, options) => {
    prompts.push(JSON.parse(options.body).messages);
    return Response.json({ message: { content: 'explained' } });
  };
  try {
    for (const selectedFile of ['a.ts', 'b.ts']) {
      const response = await chat({ context: { selectedFile }, messages: [{ role: 'user', content: 'Explain this file.' }] });
      assert.equal(response.status, 200); assert.equal((await response.json()).content, 'explained');
    }
    assert.match(prompts[0].find(item => item.role === 'system' && item.content.includes('selected workspace file')).content, /a\.ts[\s\S]*"A"/);
    assert.match(prompts[1].find(item => item.role === 'system' && item.content.includes('selected workspace file')).content, /b\.ts[\s\S]*"B"/);
  } finally { global.fetch = originalFetch; }
}));

test('B07: invalid, absolute and missing selected-file context is rejected without guessing', () => fixture(async ({ workspace, outside }) => {
  await fs.writeFile(path.join(workspace, 'a.ts'), 'inside'); await fs.writeFile(path.join(outside, 'secret.ts'), 'secret');
  assert.equal((await chat({ context: { selectedFile: '../outside/secret.ts' }, messages: [{ role: 'user', content: 'Explain this file.' }] })).status, 403);
  assert.equal((await chat({ context: { selectedFile: path.join(outside, 'secret.ts') }, messages: [{ role: 'user', content: 'Explain this file.' }] })).status, 400);
  const missing = await chat({ messages: [{ role: 'user', content: 'Why is this import here?' }] });
  assert.equal(missing.status, 200); assert.equal((await missing.json()).kind, 'unsupported');
}));

function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }

test('B08: page-owned Chat state preserves messages, file association and draft across view unmounts', async () => {
  const session = new ChatSessionClient();
  const engineering = { submit: async () => ({ kind: 'chat', content: 'answer' }) };
  session.selectFile('a.ts'); session.setInput('question');
  const firstView = session.subscribe(() => {}); firstView();
  const secondView = session.subscribe(() => {}); await session.send(engineering); secondView();
  session.setInput('next draft');
  const thirdView = session.subscribe(() => {});
  assert.deepEqual(session.getSnapshot().messages.map(item => [item.role, item.content]), [['user', 'question'], ['assistant', 'answer']]);
  assert.equal(session.getSnapshot().selectedFile, 'a.ts'); assert.equal(session.getSnapshot().input, 'next draft'); thirdView();
});

test('B08: an in-flight response completes once while Chat is unmounted and cannot resend or erase a newer draft', async () => {
  const held = deferred(); let calls = 0;
  const engineering = { submit: async () => { calls++; return held.promise; } };
  const session = new ChatSessionClient(); session.setInput('first');
  const mounted = session.subscribe(() => {}); const sending = session.send(engineering); mounted();
  session.setInput('draft while away');
  assert.equal(await session.send(engineering), false); assert.equal(calls, 1);
  held.resolve({ kind: 'chat', content: 'one response' }); await sending;
  assert.equal(session.getSnapshot().messages.filter(item => item.role === 'assistant').length, 1);
  assert.equal(session.getSnapshot().input, 'draft while away'); assert.equal(session.getSnapshot().busy, false);
});

test('B08/B12: Chat transport failures are represented once as failures, separate from engineering state', async () => {
  const engineeringState = { runtimeId: 'authoritative-runtime' }; let calls = 0;
  const engineering = { getSnapshot: () => engineeringState, submit: async () => { calls++; throw new Error('Request failed (500)'); } };
  const session = new ChatSessionClient(); session.setInput('hello'); await session.send(engineering);
  assert.equal(calls, 1); assert.equal(engineering.getSnapshot().runtimeId, 'authoritative-runtime');
  assert.match(session.getSnapshot().messages.at(-1).content, /Error.*500/);
  assert.equal(session.getSnapshot().messages.filter(item => item.role === 'assistant').length, 1);
});

test('B12: filesystem handlers return truthful statuses and generic unexpected failures', () => fixture(async ({ workspace, outside }) => {
  assert.equal((await readRoute.GET(new Request('http://localhost:3000/api/fs/read'))).status, 400);
  assert.equal((await readRoute.GET(new Request('http://localhost:3000/api/fs/read?path=../outside/secret'))).status, 403);
  assert.equal((await readRoute.GET(new Request('http://localhost:3000/api/fs/read?path=missing.txt'))).status, 404);
  assert.equal((await mutation(deleteRoute, { path: 'missing.txt' })).status, 404);
  assert.equal((await writeRoute.POST(new Request('http://localhost:3000/api/fs/write', { method: 'POST',
    headers: { host: 'localhost:3000', origin: 'http://localhost:3000', 'content-type': 'application/json' }, body: '{bad' }))).status, 400);
  await fs.writeFile(path.join(outside, 'secret'), 'secret'); await fs.symlink(path.join(outside, 'secret'), path.join(workspace, 'link'));
  assert.equal((await readRoute.GET(new Request('http://localhost:3000/api/fs/read?path=link'))).status, 400);
  assert.equal((await mutation(writeRoute, { path: 'ok.txt', content: 'one', expectedVersion: null })).status, 200);
  assert.equal((await readRoute.GET(new Request('http://localhost:3000/api/fs/read?path=ok.txt'))).status, 200);
  assert.equal((await listRoute.GET()).status, 200);
  assert.equal((await mutation(writeRoute, { path: 'ok.txt', content: 'two', expectedVersion: safe.fileVersion('stale') })).status, 409);
  assert.equal((await mutation(deleteRoute, { path: 'ok.txt' })).status, 200);
  assert.equal((await mutation(writeRoute, { path: 'blocked.txt', content: 'x', expectedVersion: null }, 'http://wrong.example')).status, 403);
  const saved = process.env.WORKSPACE_DIR; delete process.env.WORKSPACE_DIR;
  try {
    const failed = await listRoute.GET(); assert.equal(failed.status, 500);
    const body = await failed.json(); assert.equal(body.error, 'Internal filesystem error');
    assert.doesNotMatch(JSON.stringify(body), new RegExp(workspace.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  } finally { process.env.WORKSPACE_DIR = saved; }
}));

test('B12: malformed Chat and engineering requests are non-success responses', async () => {
  const malformedChat = await chatRoute.POST(new Request('http://localhost:3000/api/chat', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad',
  }));
  assert.equal(malformedChat.status, 400);
  const invalidEngineering = await engineeringRoute.POST(new Request('http://localhost:3000/api/engineering', {
    method: 'POST', headers: { host: 'localhost:3000', origin: 'http://localhost:3000', 'content-type': 'application/json' },
    body: JSON.stringify({ operation: 'unknown' }),
  }));
  assert.equal(invalidEngineering.status, 400);
});
