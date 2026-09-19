const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { load, root } = require('./load-typescript.cjs');
const get = file => load(path.join(root, file));
const run = promisify(execFile);
const safe = get('lib/fs-safe.ts');
const readRoute = get('app/api/fs/read/route.ts');
const writeRoute = get('app/api/fs/write/route.ts');
const deleteRoute = get('app/api/fs/delete/route.ts');
const { configuredRequestWorkspace, localMutationBody } = get('lib/local-request.ts');
const { executePlan } = get('lib/agent/executor.ts');
const { runWorkflow } = get('lib/agent/workflow.ts');
const { validatePlan } = get('lib/agent/plan-validator.ts');
const { requiresVerification } = get('lib/tools/validation.ts');
const { toolRegistry } = get('lib/tools/index.ts');
const { createContext } = get('lib/agent/context.ts');
const indexManager = get('lib/intelligence/workspace-index-manager.ts');
const { createGitProvider } = get('lib/agent/git-provider.ts');

async function fixture(fn) {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'codexia-hardening-'));
  const directory = await fs.realpath(temporary);
  const configured = path.join(directory, 'configured');
  const requested = path.join(directory, 'requested');
  const server = path.join(directory, 'server');
  for (const dir of [configured, requested, server]) await fs.mkdir(dir);
  const oldWorkspace = process.env.WORKSPACE_DIR;
  process.env.WORKSPACE_DIR = configured;
  try { await fn({ directory, configured, requested, server }); }
  finally {
    indexManager.stopAllWorkspaceIndexWatchers();
    indexManager.resetWorkspaceIndex();
    // Context activity recording is intentionally asynchronous in the baseline.
    await new Promise(resolve => setTimeout(resolve, 50));
    if (oldWorkspace === undefined) delete process.env.WORKSPACE_DIR;
    else process.env.WORKSPACE_DIR = oldWorkspace;
    await fs.rm(directory, { recursive: true, force: true });
  }
}
function request(route, body, origin = 'http://localhost:3000', type = 'application/json') {
  return new Request(`http://localhost:3000/api/fs/${route}`, {
    method: 'POST', headers: { origin, 'Content-Type': type }, body: JSON.stringify(body),
  });
}
const read = file => readRoute.GET(new Request(`http://localhost:3000/api/fs/read?path=${encodeURIComponent(file)}`));
const context = workspace => ({ workspace, messages: [], observations: [], toolResults: [], filesRead: [], filesModified: [], memory: [] });
const plan = steps => ({ goal: 'Fixture operation', files: [], steps });
const step = (action, tool, args = {}) => ({ action, tool, args, description: 'Fixture step' });

test('B01: wrong Origin and non-JSON mutation bodies cannot write/delete', () => fixture(async ({ configured }) => {
  await fs.writeFile(path.join(configured, 'file.txt'), 'before');
  for (const [route, body] of [[writeRoute, { path: 'file.txt', content: 'after', expectedVersion: safe.fileVersion('before') }],
    [deleteRoute, { path: 'file.txt' }]]) {
    assert.equal((await route.POST(request('mutation', body, 'http://wrong.example'))).status, 403);
    assert.equal((await route.POST(request('mutation', body, 'http://localhost:3000', 'text/plain'))).status, 415);
    for (const invalid of [null, [], {}, { path: 1 }, { path: '' }]) {
      assert.equal((await route.POST(request('mutation', invalid))).status, 400);
    }
  }
  assert.equal(await fs.readFile(path.join(configured, 'file.txt'), 'utf8'), 'before');
  assert.equal((await writeRoute.POST(request('write', { path: 'file.txt', content: 'unversioned' }))).status, 400);
  assert.equal((await writeRoute.POST(new Request('http://attacker.example/api/fs/write', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
  }))).status, 403);
}));

test('B01: deletion rejects every root spelling, missing input and directories', () => fixture(async ({ configured }) => {
  await fs.mkdir(path.join(configured, 'folder'));
  await fs.writeFile(path.join(configured, 'keep.txt'), 'keep');
  for (const target of ['', ' ', '.', './', configured, `${configured}/`, 'folder/..', `${configured}/folder/..`, 'folder']) {
    const result = await deleteRoute.POST(request('delete', { path: target }));
    assert.equal(result.status, 400, target);
    assert.equal(await fs.readFile(path.join(configured, 'keep.txt'), 'utf8'), 'keep');
  }
  assert.equal((await deleteRoute.POST(request('delete', { path: 'keep.txt' }))).status, 200);
  await assert.rejects(fs.stat(path.join(configured, 'keep.txt')), { code: 'ENOENT' });
}));

test('B02: symlink file and parent paths cannot read/write/delete outside root', () => fixture(async ({ configured, requested }) => {
  await fs.writeFile(path.join(requested, 'outside.txt'), 'outside');
  await fs.symlink(requested, path.join(configured, 'linked'));
  await fs.symlink(path.join(requested, 'outside.txt'), path.join(configured, 'file-link.txt'));
  for (const target of ['linked/outside.txt', 'file-link.txt']) {
    await assert.rejects(safe.safeReadFile(target, configured), /Symlink/);
    await assert.rejects(safe.safeWriteFile(target, 'bad', configured), /Symlink/);
    await assert.rejects(safe.safeDeleteFile(target, configured), /Symlink/);
    assert.equal((await read(target)).status, 400);
    assert.equal((await writeRoute.POST(request('write', { path: target, content: 'bad', expectedVersion: safe.fileVersion('outside') }))).status, 400);
    assert.equal((await deleteRoute.POST(request('delete', { path: target }))).status, 400);
  }
  await assert.rejects(safe.safeWriteFile('linked/new/deep.txt', 'bad', configured, null), /Symlink/);
  await assert.rejects(safe.listTree('linked', configured), /Symlink/);
  assert.equal(await fs.readFile(path.join(requested, 'outside.txt'), 'utf8'), 'outside');
  await assert.rejects(fs.stat(path.join(requested, 'new')), { code: 'ENOENT' });
}));

test('B02/B09: valid create/read/versioned edit/delete works and stale saves return 409', () => fixture(async ({ configured }) => {
  const filename = 'nested/deep/file.txt';
  assert.equal((await writeRoute.POST(request('write', { path: filename, content: 'one', expectedVersion: null }))).status, 200);
  const loaded = await (await read(filename)).json();
  assert.equal(loaded.content, 'one');
  assert.equal(loaded.version, safe.fileVersion('one'));
  assert.equal((await writeRoute.POST(request('write', { path: filename, content: 'duplicate', expectedVersion: null }))).status, 409);
  assert.equal((await writeRoute.POST(request('write', { path: filename, content: 'two', expectedVersion: loaded.version }))).status, 200);
  await fs.writeFile(path.join(configured, filename), 'external');
  assert.equal((await writeRoute.POST(request('write', { path: filename, content: 'stale', expectedVersion: safe.fileVersion('two') }))).status, 409);
  assert.equal(await fs.readFile(path.join(configured, filename), 'utf8'), 'external');
  assert.equal((await deleteRoute.POST(request('delete', { path: filename }))).status, 200);
  assert.equal((await writeRoute.POST(request('write', { path: filename, content: 'stale', expectedVersion: loaded.version }))).status, 409);
}));

test('B09: concurrent saves using one version cannot both succeed', () => fixture(async () => {
  await writeRoute.POST(request('write', { path: 'file.txt', content: 'before', expectedVersion: null }));
  const responses = await Promise.all(['first', 'second'].map(content => writeRoute.POST(request('write', {
    path: 'file.txt', content, expectedVersion: safe.fileVersion('before'),
  }))));
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
}));

test('B03: mislabeled mutations are classified as mutations and rejected before any tool', () => fixture(async ({ configured }) => {
  await fs.writeFile(path.join(configured, 'keep.txt'), 'before');
  let inspections = 0;
  toolRegistry.register({ name: 'fixture_read', description: 'fixture', category: 'analysis', capability: 'read', actions: ['read'],
    requiresConfirmation: false, validate() {}, async execute() { inspections++; } });
  for (const tool of ['write_file', 'delete_file', 'git_commit']) {
    const args = { path: 'keep.txt', content: 'bad', message: 'bad', confirmed: true };
    const candidate = plan([step('read', 'fixture_read'), step('read', tool, args)]);
    assert.equal(requiresVerification(candidate.steps), true);
    assert.throws(() => validatePlan(candidate), /cannot execute as read/);
    const result = await executePlan(candidate, context(configured));
    assert.equal(result.success, false);
    assert.match(result.output, /Execution prevented/);
    assert.doesNotMatch(result.output, /Verification skipped/);
  }
  assert.equal(inspections, 0);
  assert.equal(await fs.readFile(path.join(configured, 'keep.txt'), 'utf8'), 'before');
  assert.equal(toolRegistry.get('verify'), undefined);
}));

test('B03: correct write labels and forged confirmation/approval still cannot grant authority', () => fixture(async ({ configured }) => {
  await fs.writeFile(path.join(configured, 'keep.txt'), 'before');
  for (const tool of ['write_file', 'delete_file', 'git_commit']) {
    const args = { path: 'keep.txt', content: 'bad', message: 'bad', approved: true, confirmed: true, files: ['keep.txt'] };
    const candidate = plan([step('write', tool, args)]);
    const result = await runWorkflow(candidate, { ...context(configured), approval: { approved: true } });
    assert.equal(result.execution.success, false);
    assert.equal(result.state.approved, false);
    await assert.rejects(toolRegistry.get(tool).execute(args, { workspace: configured }), /reviewed|Workflow/);
  }
  assert.equal(await fs.readFile(path.join(configured, 'keep.txt'), 'utf8'), 'before');
  for (const args of [{}, { path: '' }, { path: 'keep.txt' }, { path: 'keep.txt', content: 1 }]) {
    assert.equal((await executePlan(plan([step('write', 'write_file', args)]), context(configured))).success, false);
  }
  assert.throws(() => validatePlan(plan([step('read', 'read_file', [])])), /Invalid arguments/);
}));

test('B04: configured HTTP workspace cannot be silently replaced by caller input', () => fixture(async ({ configured, requested }) => {
  assert.equal(configuredRequestWorkspace(), configured);
  assert.throws(() => configuredRequestWorkspace(requested), /differs/);
  const alias = path.join(path.dirname(configured), 'alias');
  await fs.symlink(configured, alias);
  assert.equal(configuredRequestWorkspace(alias), configured);
  assert.equal((await writeRoute.POST(request('write', { workspace: requested, path: 'bad.txt', content: 'bad', expectedVersion: null }))).status, 400);
  const route = get('app/api/chat/route.ts');
  const result = await route.POST(new Request('http://localhost:3000/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspace: requested, messages: [{ role: 'user', content: 'inspect project' }] }) }));
  assert.equal(result.status, 400);
  await assert.rejects(fs.stat(path.join(requested, 'bad.txt')), { code: 'ENOENT' });
}));

test('B04: explicit context, file tools, Git and verification all use the same canonical workspace', () => fixture(async ({ configured, requested, server }) => {
  for (const [directory, content] of [[configured, 'configured'], [requested, 'requested'], [server, 'server']]) {
    await fs.writeFile(path.join(directory, 'identity.txt'), content);
    await run('git', ['init', '-q'], { cwd: directory });
  }
  await fs.writeFile(path.join(requested, 'tracked.txt'), 'before');
  await run('git', ['add', '--', 'tracked.txt'], { cwd: requested });
  await fs.writeFile(path.join(requested, 'tracked.txt'), 'after-requested');
  await fs.writeFile(path.join(requested, 'value.ts'), 'export const value = 1;');
  await fs.writeFile(path.join(requested, 'tsconfig.json'), JSON.stringify({ compilerOptions: { noEmit: true }, files: ['value.ts'] }));
  await fs.mkdir(path.join(requested, 'node_modules/.bin'), { recursive: true });
  await fs.symlink(path.join(root, 'node_modules/typescript/bin/tsc'), path.join(requested, 'node_modules/.bin/tsc'));
  await fs.writeFile(path.join(requested, 'check.cjs'), 'require("node:fs").appendFileSync("verification-cwd.txt", process.cwd()+"\\n")');
  await fs.writeFile(path.join(requested, 'package.json'), JSON.stringify({ scripts: { test: 'node check.cjs', lint: 'node check.cjs' } }));
  const cwd = process.cwd();
  process.chdir(server);
  try {
    const ctx = await createContext([{ role: 'user', content: 'inspect project' }], requested);
    assert.equal(ctx.workspace, requested);
    assert.ok(ctx.intelligence.files.includes('value.ts'));
    const result = await runWorkflow(plan([step('read', 'read_file', { path: 'identity.txt' }), step('verify')]), ctx);
    assert.equal(result.execution.success, true, result.execution.output);
    assert.match(result.execution.context.toolResults[0].output, /requested/);
    const git = createGitProvider(requested);
    assert.match(await git.status(), /tracked.txt/);
    assert.match(await git.diff(), /after-requested/);
    assert.deepEqual((await fs.readFile(path.join(requested, 'verification-cwd.txt'), 'utf8')).trim().split('\n'), [requested, requested]);
    for (const directory of [configured, server]) await assert.rejects(fs.stat(path.join(directory, 'verification-cwd.txt')), { code: 'ENOENT' });
  } finally { process.chdir(cwd); }
}));

test('B03/B04: unavailable publication cannot stage unapproved or planner-supplied files', () => fixture(async ({ configured }) => {
  await run('git', ['init', '-q'], { cwd: configured });
  await fs.writeFile(path.join(configured, 'previously-approved.txt'), 'approved by host');
  await fs.writeFile(path.join(configured, 'unrelated.txt'), 'must not stage');
  await run('git', ['add', '--', 'previously-approved.txt'], { cwd: configured });
  const before = (await run('git', ['diff', '--cached', '--name-only'], { cwd: configured })).stdout;
  await assert.rejects(createGitProvider(configured).commit('not authorized'), /authority/);
  await assert.rejects(toolRegistry.get('git_commit').execute({ message: 'not authorized', files: ['unrelated.txt'], approved: true }, { workspace: configured }), /authority/);
  const after = (await run('git', ['diff', '--cached', '--name-only'], { cwd: configured })).stdout;
  assert.equal(after, before);
  assert.equal(after.trim(), 'previously-approved.txt');
}));


test('B01: validated Host supports Next localhost normalization without accepting remote authorities', async () => {
  const make = (host, origin) => new Request('http://localhost:3000/api/fs/write', {
    method: 'POST', headers: { host, origin, 'Content-Type': 'application/json' }, body: '{}',
  });
  assert.deepEqual(await localMutationBody(make('127.0.0.1:3000', 'http://127.0.0.1:3000')), {});
  for (const host of ['remote.example:3000', 'localhost:3001', 'localhost:3000/path']) {
    await assert.rejects(localMutationBody(make(host, `http://${host}`)), /Local host/);
  }
  await assert.rejects(localMutationBody(make('127.0.0.1:3000', 'http://localhost:3000')), /Origin/);
});
