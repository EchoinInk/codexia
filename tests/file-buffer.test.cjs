const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { load, root } = require('./load-typescript.cjs');
const { FileBuffer } = load(path.join(root, 'lib/editor/file-buffer.ts'));
const { fileVersion } = load(path.join(root, 'lib/fs-safe.ts'));
const response = (file, content) => Response.json({ path: file, content, version: fileVersion(content) });
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }

test('B09: out-of-order A response cannot replace B or be saved into B', async () => {
  const a = deferred(), b = deferred(), writes = [], signals = [];
  const buffer = new FileBuffer(async (url, options) => {
    if (options?.method === 'POST') {
      const body = JSON.parse(options.body); writes.push(body);
      return Response.json({ path: body.path, version: fileVersion(body.content) });
    }
    signals.push(options.signal);
    return url.endsWith('A.ts') ? a.promise : b.promise;
  });
  const first = buffer.select('A.ts');
  const second = buffer.select('B.ts');
  assert.equal(signals[0].aborted, true);
  b.resolve(response('B.ts', 'B'));
  await second;
  // Deliberately emulate a transport ignoring AbortSignal.
  a.resolve(response('A.ts', 'A'));
  await first;
  assert.equal(buffer.getSnapshot().path, 'B.ts');
  assert.equal(buffer.getSnapshot().content, 'B');
  buffer.edit('B.ts'); buffer.change('B.ts', 'B edited');
  assert.equal(await buffer.save('A.ts'), false);
  assert.equal(await buffer.save('B.ts'), true);
  assert.deepEqual(writes, [{ path: 'B.ts', content: 'B edited', expectedVersion: fileVersion('B') }]);
});

test('B09: no save before load, while switching, after failed load, or while already saving', async () => {
  const read = deferred(), save = deferred(); let writes = 0;
  const buffer = new FileBuffer(async (_url, options) => {
    if (options?.method === 'POST') { writes++; return save.promise; }
    return read.promise;
  });
  const loading = buffer.select('A.ts');
  buffer.edit('A.ts'); buffer.change('A.ts', 'early');
  assert.equal(buffer.canSave('A.ts'), false);
  assert.equal(await buffer.save('A.ts'), false);
  read.resolve(response('A.ts', 'original')); await loading;
  // Path changes in the component precede the select effect: the path check is immediate.
  assert.equal(await buffer.save('B.ts'), false);
  buffer.edit('A.ts'); buffer.change('A.ts', 'edited');
  const saving = buffer.save('A.ts');
  assert.equal(await buffer.save('A.ts'), false);
  save.resolve(Response.json({ path: 'A.ts', version: fileVersion('edited') }));
  assert.equal(await saving, true);
  assert.equal(writes, 1);
  const failed = new FileBuffer(async () => Response.json({ error: 'missing' }, { status: 404 }));
  await failed.select('missing.ts'); failed.edit('missing.ts');
  assert.equal(await failed.save('missing.ts'), false);
});

test('B09: dirty drafts survive file/view changes with their original version', async () => {
  let reads = 0;
  const buffer = new FileBuffer(async url => { reads++; const name = url.endsWith('A.ts') ? 'A.ts' : 'B.ts'; return response(name, name); });
  await buffer.select('A.ts'); buffer.edit('A.ts'); buffer.change('A.ts', 'dirty A');
  await buffer.select('B.ts');
  buffer.stopLoading(); // FileViewer unmount/view switch
  await buffer.select('A.ts');
  assert.equal(buffer.getSnapshot().content, 'dirty A');
  assert.equal(buffer.getSnapshot().version, fileVersion('A.ts'));
  assert.equal(buffer.getSnapshot().editing, true);
  assert.equal(reads, 2);
  buffer.discard('A.ts');
  assert.equal(buffer.getSnapshot().content, 'A.ts');
  assert.equal(buffer.getSnapshot().editing, false);
});

test('B09: 409 retains draft and does not adopt an external version or claim save success', async () => {
  const buffer = new FileBuffer(async (_url, options) => options?.method === 'POST'
    ? Response.json({ error: 'File changed externally' }, { status: 409 }) : response('A.ts', 'before'));
  await buffer.select('A.ts'); buffer.edit('A.ts'); buffer.change('A.ts', 'mine');
  assert.equal(await buffer.save('A.ts'), false);
  assert.equal(buffer.getSnapshot().content, 'mine');
  assert.equal(buffer.getSnapshot().original, 'before');
  assert.equal(buffer.getSnapshot().version, fileVersion('before'));
  assert.match(buffer.getSnapshot().error, /externally/);
  assert.equal(buffer.getSnapshot().editing, true);
});

test('B09: late save for A cannot replace active B and duplicate saves remain blocked on return', async () => {
  const done = deferred();
  const buffer = new FileBuffer(async (url, options) => options?.method === 'POST' ? done.promise
    : response(url.endsWith('A.ts') ? 'A.ts' : 'B.ts', url.endsWith('A.ts') ? 'A' : 'B'));
  await buffer.select('A.ts'); buffer.edit('A.ts'); buffer.change('A.ts', 'edited A');
  const saving = buffer.save('A.ts');
  await buffer.select('B.ts');
  await buffer.select('A.ts'); assert.equal(buffer.canSave('A.ts'), false);
  await buffer.select('B.ts');
  done.resolve(Response.json({ path: 'A.ts', version: fileVersion('edited A') }));
  assert.equal(await saving, true);
  assert.equal(buffer.getSnapshot().path, 'B.ts');
  assert.equal(buffer.getSnapshot().content, 'B');
});

// Render the real FileViewer with the existing React server renderer. Only syntax
// highlighting is stubbed; its asynchronous rendering is unrelated to editing.
function renderFileViewer(buffer, selectedPath) {
  const fs = require('node:fs');
  const vm = require('node:vm');
  const ts = require('typescript');
  const React = require('react');
  const filename = path.join(root, 'components/FileViewer.tsx');
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  const localRequire = name => name === './Shiki' ? { Shiki: ({ code }) => React.createElement('pre', null, code) }
    : name.startsWith('@/') ? load(path.join(root, name.slice(2))) : require(name);
  vm.runInThisContext(`(function(require,module,exports){${compiled}\n})`, { filename })(localRequire, module, module.exports);
  return require('react-dom/server').renderToStaticMarkup(React.createElement(module.exports.FileViewer, {
    path: selectedPath, buffer, onClose() {},
  }));
}

test('B09: actual FileViewer disables unloaded selection and retains editable draft after conflict', async () => {
  const buffer = new FileBuffer(async (_url, options) => options?.method === 'POST'
    ? Response.json({ error: 'Conflict' }, { status: 409 }) : response('A.ts', 'before'));
  let html = renderFileViewer(buffer, 'A.ts');
  assert.match(html, /disabled=""[^>]*>Edit<\/button>/);
  await buffer.select('A.ts'); buffer.edit('A.ts'); buffer.change('A.ts', 'draft');
  html = renderFileViewer(buffer, 'B.ts');
  assert.match(html, /Loading/);
  assert.doesNotMatch(html, /<textarea/);
  assert.match(html, /disabled=""[^>]*>Edit<\/button>/);
  await buffer.save('A.ts');
  html = renderFileViewer(buffer, 'A.ts');
  assert.match(html, /Conflict/);
  assert.match(html, /<textarea[^>]*>draft<\/textarea>/);
});
