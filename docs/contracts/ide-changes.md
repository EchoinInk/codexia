# IDE diagnostics and changes

## Phase 6.2

`IntelligenceContext.diagnose()` returns structured diagnostics, provider failures, and index limitations. Providers are injectable and isolated; cancellation propagates. The default TypeScript provider includes source ranges, severity, code, workspace explanations, related indexed dependencies, and suggestions. Missing external packages/standard libraries can produce incomplete-context diagnostics; results do not replace a real project build.

`diagnosticCodeActions(index, diagnostic)` generates compiler fixes as existing `DiffResult` before/after records. Commands and new-file fixes are excluded. `explainDiagnostic(index, diagnostic, advisor)` accepts a model-independent advisor; the Ollama adapter is supplied by Models and used only on explicit explanation requests. Model replacement text is untrusted, constrained to the diagnostic source, and validated. AI explanation text remains advice, not verification.

`GET /api/intelligence/diagnostics` returns a report. POST `{operation: "actions" | "explain", diagnosticId}` resolves the current diagnostic and returns proposals or AI advice. Cached-index freshness limits apply. These operations never mutate source.

A `ChangeProposal` carries its origin, title, kind, workspace snapshot digest, content digest, warnings, and diff. Digests detect staleness/tampering but do not constitute authorization. Validation rejects malformed edits, duplicate/escaping paths, missing sources, old snapshots, no-op changes, and increased compiler error counts. TypeScript error comparison covers indexed files; it cannot establish behavioral equivalence. The user must review the exact proposed content before application.

The compiler host remains a disposable read-only adapter over the existing index. No additional index, watcher, provider dependency, or model-specific runtime is introduced.

## Verification

`npm test` uses Node's test runner and the existing TypeScript transpiler. The runtime verification pipeline now calls `npm test` without Jest-specific flags. Phase 6.2 passed 8 regression tests, including existing Phase 6.1 coverage. This is not a production build or a full-project typecheck.

## Phase 6.3

`planRename(index, file, position, newName)` uses compiler rename locations, excludes comments/string literals, preserves shorthand and import/export syntax with compiler prefix/suffix edits, and returns a proposal or conflicts. Keywords, inaccessible targets, external-file changes, and collisions are rejected. Collision checks are deliberately conservative: an existing identifier anywhere in an affected file may reject a technically legal rename. Public consumers and reflective/dynamic access outside indexed references need manual review.

`availableRefactorings` lists compiler refactors for a source range; `planRefactoring` selects an applicable action and validates its edits. New-file/move refactors and actions requiring external commands are rejected. Both use the same proposal and compiler snapshot contracts as quick fixes.

`applyReviewedChange` is a bounded Workflow adapter: fresh index → Validator → existing Patch Executor → verification → result/rollback. It requires the exact reviewed proposal ID. IDs are content digests, not security credentials. Default verification uses the existing typecheck/test/lint pipeline with the explicit workspace working directory. An injectable verifier supports deterministic tests and host integration.

The Executor preflights source, rejects symlinks, and compares content again before writing. Workflow keeps a durable before/after journal under `.codexia/changes`, with per-process workspace serialization. Failed/throwing/empty verification triggers rollback. Rollback only restores files still equal to the proposed output and never overwrites a concurrent external edit; conflicts retain recovery evidence. `recoverChange` can restore interrupted non-verified journals. A partial OS write or concurrent modification can require manual recovery. This is not a multi-process filesystem transaction; other editors/processes are not locked. Journals contain source and inherit the local workspace's privacy boundary.

POST `/api/intelligence/refactor` accepts operations:

- `rename`: file, position, newName.
- `list`: file, range.
- `refactor`: file, range, refactor, action.
- `validate`: proposal (read-only cached-index check).
- `apply`: proposal, reviewedId (fresh validation and default verification).
- `recover`: journalName (basename only).

Mutating requests reject mismatched browser origins; callers must still enforce their deployment's access control. The HTTP adapter marks the existing index dirty after apply/recovery. No independent watcher or Runtime loop is introduced.

Phase 6.3 passed `npm test`: 16 tests, covering rename references/shadowing/shorthand, conflict rejection, refactor planning, fresh-source checks, durable journals, verification rollback, crash recovery, and concurrent edit preservation.

## Phase 6.4

`IntelligenceContext.analyseArchitecture(options)` returns structured findings, evidence, confidence, recommendations, the extended existing dependency graph, and analysis limitations. Options contain workspace-relative `entryPoints`, `publicFiles`, and explicit `layers` (`name`, path `prefixes`, `allowedDependencies` by layer name). Unknown roots, overlapping layer membership, and invalid layer references are rejected.

Unused local/parameter/import candidates use compiler unused diagnostics. Export candidates use compiler symbol references and exclude explicit public/entry files. Re-exported definitions are assessed in their owner module. External consumers are unknown: these reports never authorize deletion.

The existing dependency graph now resolves workspace imports with the shared compiler project, including path aliases, barrels, static dynamic imports, and literal require calls. It separately records unresolved local imports, external imports, and opaque dynamic loading. Dependency cycles are strongly connected components, reported once. Intelligence impact analysis uses exact, transitive resolved edges instead of substring matching. The graph's existing raw `imports` field remains available; `IntelligenceContext.dependencies` now contains resolved workspace paths.

Reachability starts only from caller-supplied entry points plus public files; it is skipped without entry points. Dynamic loading remains an explicit limitation. Layer violations are checked only against supplied rules; no architecture conventions are guessed. Reports do not mutate code.

POST `/api/intelligence/architecture` accepts these options and returns JSON findings plus Markdown produced by the Reporter. Example options:

```json
{
  "entryPoints": ["app/page.tsx"],
  "publicFiles": [],
  "layers": [
    { "name": "models", "prefixes": ["lib/models"], "allowedDependencies": [] },
    { "name": "agent", "prefixes": ["lib/agent"], "allowedDependencies": ["models"] }
  ]
}
```

This example is not a prescribed Codexia policy. Supply rules and entry points appropriate to the target project; routes, plugins, test files, and package exports may all be roots.

Phase 6.4 initially passed 21 tests. Final hardening added multi-file rollback, symlink rejection, concurrent workflow rejection, and post-verification content checks: `npm test` passed all 24 tests. `npx tsc --noEmit --incremental false` also passed. Lint and production build were not run; live Ollama inference was not used by the deterministic tests.


## Phase 7 integration

The existing-file change validator also accepts indexed Markdown replacements for executable documentation obligations. Workspace snapshot schema 3 adds Markdown source and rebuilds older persisted indexes. Engineering scope/risk checks are applied in addition to ordinary proposal validation. `applyReviewedChange` accepts an optional AbortSignal; cancellation at safe write/verification boundaries rolls back the active batch using the same journal rules. Bounded engineering authorization is documented in `autonomous-engineering.md`; ordinary proposal mode continues to require exact reviewed content.
