// Run after npm run build: node --test tests/hardening-http.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { once } = require('node:events');

test('production HTTP: local mutation guard, root protection and compare-before-write', { timeout: 30000 }, async () => {
  const workspace = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'codexia-http-hardening-')));
  const socket = net.createServer();
  socket.listen(0, '127.0.0.1'); await once(socket, 'listening');
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  const root = path.resolve(__dirname, '..');
  const server = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: root, env: { ...process.env, WORKSPACE_DIR: workspace }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  server.stdout.on('data', chunk => { output += chunk; });
  server.stderr.on('data', chunk => { output += chunk; });
  const exited = once(server, 'exit');
  const post = (route, body, from = origin) => fetch(`${origin}/api/fs/${route}`, {
    method: 'POST', headers: { Origin: from, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  try {
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      try { if ((await fetch(origin)).ok) { ready = true; break; } } catch { /* starting */ }
      if (server.exitCode !== null) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(ready, output);
    assert.equal((await post('write', { path: 'file.txt', content: 'before', expectedVersion: null }, 'http://wrong.example')).status, 403);
    const created = await post('write', { path: 'file.txt', content: 'before', expectedVersion: null });
    assert.equal(created.status, 200, await created.text());
    const loaded = await (await fetch(`${origin}/api/fs/read?path=file.txt`)).json();
    assert.equal(loaded.content, 'before');
    assert.equal((await post('delete', { path: '.' })).status, 400);
    assert.equal((await post('delete', { path: workspace })).status, 400);
    await fs.writeFile(path.join(workspace, 'file.txt'), 'external');
    assert.equal((await post('write', { path: 'file.txt', content: 'stale', expectedVersion: loaded.version })).status, 409);
    assert.equal(await fs.readFile(path.join(workspace, 'file.txt'), 'utf8'), 'external');
    assert.equal((await post('delete', { path: 'file.txt' }, 'http://wrong.example')).status, 403);
    assert.equal((await post('delete', { path: 'file.txt' })).status, 200);
  } finally {
    if (server.exitCode === null) server.kill('SIGTERM');
    await exited;
    await fs.rm(workspace, { recursive: true, force: true });
  }
});
