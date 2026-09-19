# Local filesystem and legacy execution boundary

This Phase 7 hardening batch retains the existing Planner, Validator, Workflow,
Executor and Runtime. It changes admission and file access, not their ownership.

## Local manual-file API

`WORKSPACE_DIR` resolves to a canonical existing directory. The single-workspace
HTTP application accepts only that configured identity; any supplied workspace
must resolve to the same directory. Programmatic contexts, tools, Git providers
and verification continue accepting an explicit workspace.

Filesystem mutations require a loopback Host, a matching Origin when present,
non-cross-site browser metadata, and an `application/json` object. Origin-less
local host integrations are supported; this is not authentication for a remote
service. The default dev/start scripts bind to 127.0.0.1. A remote deployment
would need a separate authenticated access policy.

- GET `/api/fs/read?path=...`: returns `{path, content, version}` without caching.
- POST `/api/fs/write`: accepts `{path, content, expectedVersion}`. A version from
  the read response permits replacement only if the current content still
  matches. `null` means create a new file exclusively. Missing versions are
  rejected. Stale content, removed files, and create-existing conflicts return
  409. Parent directories for new files are checked component by component.
- POST `/api/fs/delete`: accepts `{path}` for one specific regular file. Empty
  paths, every spelling of the workspace root, directories and symlinks are
  rejected. The operation never recursively removes a directory.

These routes are explicit manual editor/host operations, not agent tools. The
shared containment primitive also backs the existing reviewed patch functions:
all path components reject symlinks, and final reads/writes use no-follow opens.
Compare/write operations are serialized per file within the process. This does
not establish a distributed transaction or prevent an unrelated OS process from
racing a parent-directory replacement or writing after comparison.

## Agent and tool admission

Tools declare allowed actions, argument validation and actual capabilities.
Both plan validation and the Executor enforce them before execution. A write
cannot be relabeled as a read, and planner-supplied confirmation fields grant no
authority. Verification classification uses capabilities, not just action labels.
Rejected plans perform neither tool actions nor verification subprocesses.
`verify` remains a workflow stage, not an Executor tool.

Legacy mutating tool plans are unavailable. Supported autonomous changes remain
on the existing proposal → Validator → reviewed change Workflow → guarded patch
path. Agent deletion and Git staging/commit stay unavailable: the current
reviewed source-replacement contract does not authorize them. No `git add .` or
other staging is performed; a future separately approved Git contract must name
exact files. Read-only Git status/diff and verification use the explicit context
workspace, never the server process directory by accident.

## Saved-file editor

FileViewer uses one page-owned buffer store keyed by path. Superseded reads are
aborted and ignored even if the transport completes late. Editing/saving requires
a loaded version for the selected path; save requests capture that same path,
content and version. Duplicate saves are blocked. A 409 preserves the draft and
its original version for review. Cancel discards the draft; closing/reopening a
clean file reloads its current disk content. Dirty drafts survive file and view
switches within the page session, but not a browser reload.

## Regression checks

`npm test` includes `hardening-boundaries.test.cjs` and `file-buffer.test.cjs`.
After `npm run build`, also run `node --test tests/hardening-http.cjs` for the
production HTTP adapter. All mutations and verification scripts in these checks
use disposable fixture workspaces, never the Codexia source repository.
